import { useRef, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000}
#remote{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
#local{position:absolute;bottom:100px;right:16px;width:90px;height:130px;object-fit:cover;border-radius:12px;border:2px solid #4ADE80;background:#1a1a2e;z-index:10}
#loading{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;flex-direction:column;gap:12px;color:rgba(255,255,255,0.6);font-size:14px;z-index:20;background:#000}
.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #4ADE80;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="loading"><div class="spinner"></div><span>Conectando...</span></div>
<button id="startBtn" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30;padding:16px 32px;font-size:16px;border-radius:12px;border:none;background:#4ADE80;color:#000;font-weight:bold">Iniciar c\u00e1mara</button>
<video id="remote" autoplay playsinline></video>
<video id="local" autoplay muted playsinline></video>
<script>
(function(){
var pc = null;
var localStream = null;
var started = false;
var iceQueue = [];
var config = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]};

function post(type, data) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: type, d: data })); } catch(e) {}
}

function flushIceQueue() {
  while (iceQueue.length) {
    var c = iceQueue.shift();
    if (pc) pc.addIceCandidate(new RTCIceCandidate(c)).catch(function(){});
  }
}

function createPeerConnection() {
  if (pc) { post('log', 'dup pc'); return; }
  try {
    pc = new RTCPeerConnection(config);
    pc.onicecandidate = function(e) {
      if (e.candidate) post('ice', e.candidate);
    };
    pc.ontrack = function(e) {
      var el = document.getElementById('remote');
      if (el && e.streams[0]) { el.srcObject = e.streams[0]; post('remote_on'); }
    };
    pc.oniceconnectionstatechange = function() {
      post('log', 'ice:' + pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        post('disconnected');
      }
    };
    if (localStream) {
      localStream.getTracks().forEach(function(t) { pc.addTrack(t, localStream); });
    }
  } catch(e) {
    post('error', 'pc: ' + e.message);
  }
}

function startCamera() {
  var l = document.getElementById('loading');
  var b = document.getElementById('startBtn');
  if (b) b.style.display = 'none';
  if (l) l.style.display = 'flex';
  var p = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
  var called = false;
  var timer = setTimeout(function() {
    if (!called) { called = true; showError('La c\u00e1mara no responde'); }
  }, 10000);
  p.then(function(s) {
    if (called) return;
    clearTimeout(timer);
    called = true;
    localStream = s;
    var el = document.getElementById('local');
    if (el) el.srcObject = s;
    if (l) l.style.display = 'none';
    post('ready');
    if (pc) { s.getTracks().forEach(function(t) { pc.addTrack(t, s); }); }
  }).catch(function(e) {
    if (called) return;
    clearTimeout(timer);
    called = true;
    showError(e.name + ': ' + e.message);
  });
}

window.init = function() {
  if (started) return;
  started = true;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    post('error', 'no md');
    return;
  }
  startCamera();
};

window._onSignaling = function(msg) {
  if (msg.type === 'makeOffer') {
    createPeerConnection();
    if (!pc) { post('error', 'pc null'); return; }
    pc.createOffer()
      .then(function(o) { return pc.setLocalDescription(o); })
      .then(function() { var d = pc.localDescription; if (d) post('offer', {type:d.type,sdp:d.sdp}); })
      .catch(function(e) { post('error', 'o:' + e.message); });
  } else if (msg.type === 'offer') {
    if (pc && pc.signalingState !== 'stable') { post('log', 'skip offer ' + pc.signalingState); return; }
    createPeerConnection();
    if (!pc) { post('error', 'pc null'); return; }
    pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      .then(function() { flushIceQueue(); return pc.createAnswer(); })
      .then(function(a) { return pc.setLocalDescription(a); })
      .then(function() { var d = pc.localDescription; if (d) post('answer', {type:d.type,sdp:d.sdp}); })
      .catch(function(e) { post('error', 'a:' + e.message); });
  } else if (msg.type === 'answer') {
    if (!pc || pc.signalingState === 'stable') return;
    pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      .then(function() { flushIceQueue(); })
      .catch(function(e) { post('error', 'ra:' + e.message); });
  } else if (msg.type === 'ice') {
    if (!pc || !pc.remoteDescription) { iceQueue.push(msg.data); return; }
    pc.addIceCandidate(new RTCIceCandidate(msg.data)).catch(function(){});
  }
};

window._hangUp = function() {
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach(function(t) { t.stop(); }); localStream = null; }
  iceQueue = []; started = false;
  post('hangup');
};

document.getElementById('startBtn').onclick = startCamera;
})();
</script>
</body>
</html>`;

const WebRTCView = forwardRef(function WebRTCView({ style, onWebRTCMessage }, ref) {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inited = useRef(false);
  const navAllowed = useRef(1);

  useImperativeHandle(ref, () => ({
    forwardSignaling(type, data) {
      webviewRef.current?.injectJavaScript(
        `window._onSignaling(${JSON.stringify({ type, data })}); true;`
      );
      console.log("[WebRTC] >> signal " + type);
    },
    hangUp() {
      webviewRef.current?.injectJavaScript(`window._hangUp(); true;`);
    },
  }));

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    if (inited.current) return;
    inited.current = true;
    console.log("[WebRTC] injecting init");
    webviewRef.current?.injectJavaScript(`window.init(); true;`);
  }, []);

  if (error) {
    return (
      <View style={[{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }, style]}>
        <Text style={{ color: "#999", marginBottom: 12, textAlign: "center", paddingHorizontal: 24 }}>{error}</Text>
        <Text style={{ color: "#4ADE80", fontSize: 16, fontWeight: "bold" }} onPress={() => {
          setError(null);
          setLoading(true);
          inited.current = false;
          navAllowed.current = 1;
        }}>Reintentar</Text>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1 }, style]}>
      {loading && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#4ADE80" />
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ html: HTML, baseUrl: "https://localhost" }}
        style={{ flex: 1, backgroundColor: "#000" }}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo={false}
        originWhitelist={["*"]}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            console.log("[WebRTC] << " + msg.t);
            if (msg.t === "error") { console.error("[WebRTC]", msg.d); setError(msg.d); }
            onWebRTCMessage?.(msg.t, msg.d);
          } catch(e) {
            console.log("[WebRTC] parse fail", e.message);
          }
        }}
        onLoadEnd={handleLoadEnd}
        onShouldStartLoadWithRequest={() => {
          if (navAllowed.current > 0) { navAllowed.current--; return true; }
          return false;
        }}
        onError={(syntheticEvent) => {
          const { code, description } = syntheticEvent.nativeEvent;
          console.error("[WebRTC] wv error", code, description);
          setError("Error del WebView: " + description);
        }}
        scalesPageToFit={false}
        allowsBackForwardNavigationGestures={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
});

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
});

export default WebRTCView;
