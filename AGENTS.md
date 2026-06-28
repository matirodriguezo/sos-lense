# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Stack & conventions (auto-detected by sdd-init)

- **Frontend**: Expo SDK 54 (`expo ~54.0.34`) + React Native 0.81.5 + React 19.1.0, @react-navigation v7 (native-stack + bottom-tabs), react-native-safe-area-context, react-native-screens, expo-location, expo-file-system, @react-native-async-storage/async-storage, react-native-webview, @expo/vector-icons, socket.io-client.
- **Backend**: Self-hosted NestJS + PostgreSQL 16 + PostGIS + socket.io (`/realtime` and `/signaling` namespaces). Code lives in `api/`.
- **Firebase**: Removed. No Firebase SDK, Auth, or Firestore references remain in application code.
- **Conventions**: UI strings and user-visible copy in Spanish (neutral/professional Spanish for public/contextual comments). Code identifiers, file names, commit messages, and technical artifacts in English. JavaScript (`.js`), no TypeScript yet. No lint/format/typecheck config.
- **Strict TDD**: disabled — no test infrastructure present.
