import { useRef, useMemo, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { Platform, ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const JitsiWebView = forwardRef(function JitsiWebView(
  { roomName, style, onError },
  ref
) {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const sanitizedRoom = useMemo(
    () => roomName.replace(/[^a-zA-Z0-9_-]/g, ""),
    [roomName]
  );

  const jitsiUrl = useMemo(
    () => `https://meet.jit.si/${sanitizedRoom}`,
    [sanitizedRoom]
  );

  useImperativeHandle(ref, () => ({
    injectCommand(command) {
      webviewRef.current?.injectJavaScript(
        `try{APP.conference.executeCommand('${command}')}catch(e){};true;`
      );
    },
  }));

  const injectedBefore = useMemo(
    () => `
    window.config = window.config || {};
    window.config.prejoinPageEnabled = false;
    window.config.disableDeepLinking = true;
    window.config.disableInviteFunctions = true;
    window.config.startWithAudioMuted = false;
    window.config.startWithVideoMuted = false;
    window.config.doNotStoreRoom = true;
    window.config.gatherStats = false;
    window.config.analytics = { disabled: true };
    window.config._deepLinking = false;
    window.config.enableDeepLinking = false;
    window.config.deeplinking = false;
    window.config.deepLinking = false;
    window.config.p2p = { enabled: true, preferH264: true };

    window.interfaceConfig = window.interfaceConfig || {};
    window.interfaceConfig.SHOW_JITSI_WATERMARK = false;
    window.interfaceConfig.SHOW_WATERMARK_FOR_GUESTS = false;
    window.interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS = true;
    window.interfaceConfig.DISABLE_PRESENCE_STATUS = true;
    window.interfaceConfig.TOOLBAR_ALWAYS_VISIBLE = true;

    true;
  `,
    []
  );

  const injectedAfter = useMemo(
    () => `
    (function() {
      var intv = setInterval(function() {
        var btn = document.querySelector(
          'button[data-testid="prejoin.join"], ' +
          '.prejoin-input-area button, ' +
          'button:has(span:contains("Join")), ' +
          '.jitsi-prejoin-join-button'
        );
        if (btn && !btn.disabled) {
          clearInterval(intv);
          btn.click();
        }
      }, 200);
      setTimeout(function() { clearInterval(intv); }, 20000);
    })();
  `,
    []
  );

  const shouldBlockRequest = useCallback((request) => {
    const url = request.url?.toLowerCase() || "";
    if (
      url.startsWith("org.jitsi.meet://") ||
      url.startsWith("intent://") ||
      url.includes("org.jitsi.meet") ||
      url.includes("/intent?")
    ) {
      return false;
    }
    return true;
  }, []);

  const handleMessage = useMemo(
    () => (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "error" || data.type === "readyToClose") {
          onError?.("error");
        }
      } catch {}
    },
    [onError]
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#4ADE80" />
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: jitsiUrl }}
        style={{ flex: 1, backgroundColor: "#0a0a0f" }}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        androidLayerType="hardware"
        allowsFullscreenVideo={false}
        sharedCookiesEnabled
        mixedContentMode="always"
        injectedJavaScriptBeforeContentLoaded={injectedBefore}
        injectedJavaScript={injectedAfter}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onPermissionRequest={(request) => {
          if (Platform.OS === "android") {
            try { request.grant(request.permissions); } catch (e) {}
          }
        }}
        onShouldStartLoadWithRequest={shouldBlockRequest}
        scalesPageToFit={Platform.OS === "android"}
        allowsBackForwardNavigationGestures={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
});

const s = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0f",
    zIndex: 1,
  },
});

export default JitsiWebView;
