console.log("[WebRTC] platform resolved -> .web.js");
import { useRef, forwardRef, useImperativeHandle, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from "react-native";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const WebRTCView = forwardRef(function WebRTCView({ style, onWebRTCMessage }, ref) {
  const containerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceQueueRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log("[WebRTC.web] Mounted, platform:", Platform.OS);

  const log = useCallback((...args) => console.log("[WebRTC.web]", ...args), []);
  const warn = useCallback((...args) => console.warn("[WebRTC.web]", ...args), []);

  const post = useCallback(
    (type, data) => {
      log(">> emit", type, data ? typeof data : "");
      onWebRTCMessage?.(type, data);
    },
    [onWebRTCMessage, log]
  );

  const cleanup = useCallback(() => {
    log("cleanup");
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (window.__audioEl) {
      window.__audioEl.pause();
      window.__audioEl.remove();
      window.__audioEl = null;
    }
    iceQueueRef.current = [];
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [log]);

  const flushIceQueue = useCallback(() => {
    let n = 0;
    while (iceQueueRef.current.length) {
      const c = iceQueueRef.current.shift();
      pcRef.current?.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      n++;
    }
    if (n > 0) log("flushed", n, "ice candidates");
  }, [log]);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      log("createPeerConnection: already exists");
      return;
    }
    log("createPeerConnection");
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      if (localStreamRef.current) {
        log("adding local tracks:", localStreamRef.current.getTracks().length, "audio:", localStreamRef.current.getAudioTracks().length, "video:", localStreamRef.current.getVideoTracks().length);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          log("onicecandidate", e.candidate.candidate?.substring(0, 40));
          post("ice", e.candidate);
        }
      };
      pc.ontrack = (e) => {
        log("ontrack kind=" + e.track?.kind + " streams=" + e.streams?.length + " audio=" + (e.streams[0]?.getAudioTracks().length || 0) + " video=" + (e.streams[0]?.getVideoTracks().length || 0) + " trackReady=" + e.track?.readyState);
        if (e.streams[0]) {
          const stream = e.streams[0];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.play().catch(() => {});
          }
          if (stream.getAudioTracks().length > 0 && !window.__audioEl) {
            const a = document.createElement("audio");
            a.srcObject = stream;
            a.autoplay = true;
            a.setAttribute("playsinline", "");
            a.play().catch(() => {});
            window.__audioEl = a;
            log("remote audio element created");
          }
          log("remote stream attached");
          post("remote_on");
        }
      };
      pc.oniceconnectionstatechange = () => {
        log("iceConnectionState:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          warn("connection lost:", pc.iceConnectionState);
          post("disconnected");
        }
      };
      pc.onsignalingstatechange = () => {
        log("signalingState:", pc.signalingState);
      };
      if (localStreamRef.current) {
        log("adding existing local tracks to pc");
        localStreamRef.current
          .getTracks()
          .forEach((t) => pc.addTrack(t, localStreamRef.current));
      }
      pcRef.current = pc;
    } catch (e) {
      warn("createPeerConnection error:", e.message);
      post("error", "pc: " + e.message);
      setError(e.message);
    }
  }, [log, warn, post]);

  const startCamera = useCallback(async () => {
    log("startCamera");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      warn("getUserMedia not available");
      setError("Este navegador no soporta videollamadas.");
      post("error", "no md");
      return;
    }
    try {
      log("requesting getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      log("getUserMedia OK, tracks:", stream.getTracks().length);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        log("local video attached");
      } else {
        warn("localVideoRef is null, cannot attach stream");
      }
      setLoading(false);
      if (pcRef.current) {
        log("adding tracks to existing pc");
        stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));
      }
      log("emitting ready");
      post("ready");
    } catch (e) {
      warn("getUserMedia error:", e.name, e.message);
      setError(e.message || "Error al acceder a la cámara.");
      post("error", e.name + ": " + e.message);
    }
  }, [log, warn, post]);

  useImperativeHandle(
    ref,
    () => ({
      forwardSignaling(type, data) {
        log("<< forwardSignaling:", type);
        switch (type) {
          case "makeOffer":
            log("makeOffer: creating offer");
            createPeerConnection();
            if (!pcRef.current) {
              warn("makeOffer: pc is null");
              post("error", "pc null");
              return;
            }
            pcRef.current
              .createOffer()
              .then((o) => {
                log("createOffer OK");
                return pcRef.current.setLocalDescription(o);
              })
              .then(() => {
                const d = pcRef.current.localDescription;
                if (d) {
                  log("localDescription set, emitting offer");
                  post("offer", { type: d.type, sdp: d.sdp });
                }
              })
              .catch((e) => {
                warn("makeOffer error:", e.message);
                post("error", "o:" + e.message);
              });
            break;
          case "offer":
            log("offer received, setting remote description");
            if (pcRef.current && pcRef.current.signalingState !== "stable") {
              log("skip offer, signalingState:", pcRef.current.signalingState);
              return;
            }
            createPeerConnection();
            if (!pcRef.current) {
              warn("offer: pc is null");
              post("error", "pc null");
              return;
            }
            pcRef.current
              .setRemoteDescription(new RTCSessionDescription(data))
              .then(() => {
                log("remoteDescription set, flushing ice queue");
                flushIceQueue();
                log("creating answer...");
                return pcRef.current.createAnswer();
              })
              .then((a) => {
                log("createAnswer OK");
                return pcRef.current.setLocalDescription(a);
              })
              .then(() => {
                const d = pcRef.current.localDescription;
                if (d) {
                  log("localDescription set, emitting answer");
                  post("answer", { type: d.type, sdp: d.sdp });
                }
              })
              .catch((e) => {
                warn("offer processing error:", e.message);
                post("error", "a:" + e.message);
              });
            break;
          case "answer":
            if (!pcRef.current || pcRef.current.signalingState === "stable") {
              log("skip answer, state:", pcRef.current?.signalingState);
              return;
            }
            log("answer received, setting remote description");
            {
              const mlines = (data.sdp || "").split("\n").filter((l) => l.startsWith("m=")).join(", ");
              log("answer SDP m-lines:", mlines);
            }
            pcRef.current
              .setRemoteDescription(new RTCSessionDescription(data))
              .then(() => {
                log("remoteDescription set (answer), flushing ice");
                flushIceQueue();
              })
              .catch((e) => {
                warn("answer processing error:", e.message);
                post("error", "ra:" + e.message);
              });
            break;
          case "ice":
            if (!pcRef.current || !pcRef.current.remoteDescription) {
              iceQueueRef.current.push(data);
              log("ice queued (no remote desc yet), queue size:", iceQueueRef.current.length);
              return;
            }
            pcRef.current
              .addIceCandidate(new RTCIceCandidate(data))
              .then(() => log("ice candidate added"))
              .catch(() => {});
            break;
        }
      },
      hangUp() {
        log("hangUp called");
        cleanup();
        post("hangup");
      },
    }),
    [createPeerConnection, flushIceQueue, post, cleanup, log, warn]
  );

  useEffect(() => {
    log("startCamera effect");
    startCamera();
    return () => {
      log("unmount cleanup");
      cleanup();
    };
  }, []);

  if (error) {
    return (
      <View
        style={[
          {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#000",
          },
          style,
        ]}
      >
        <Text
          style={{
            color: "#999",
            marginBottom: 12,
            textAlign: "center",
            paddingHorizontal: 24,
          }}
        >
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => {
            log("retry pressed");
            setError(null);
            setLoading(true);
            cleanup();
            startCamera();
          }}
        >
          <Text style={{ color: "#4ADE80", fontSize: 16, fontWeight: "bold" }}>
            Reintentar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      ref={containerRef}
      style={[
        { flex: 1, backgroundColor: "#000" },
        style,
      ]}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          flex: 1,
          width: "100%",
          objectFit: "cover",
        }}
      />
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          bottom: 100,
          right: 16,
          width: 90,
          height: 130,
          objectFit: "cover",
          borderRadius: 12,
          border: "2px solid #4ADE80",
          background: "#1a1a2e",
          zIndex: 10,
        }}
      />
      {loading && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#4ADE80" />
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});

export default WebRTCView;
