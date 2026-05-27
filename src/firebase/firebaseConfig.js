import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwqraVSDudNqCGwx6ZnJ0qlgMlipRfckY",
  authDomain: "sos-carabineros2.firebaseapp.com",
  projectId: "sos-carabineros2",
  storageBucket: "sos-carabineros2.firebasestorage.app",
  messagingSenderId: "112265072108",
  appId: "1:112265072108:web:84acfeb80b712c4e10c4c9"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
