import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyC9ffvqdzKVx3x00zvdlemfE66VjYdsvcU",
  authDomain: "sos-carabineros.firebaseapp.com",
  projectId: "sos-carabineros",
  storageBucket: "sos-carabineros.firebasestorage.app",
  messagingSenderId: "50528553078",
  appId: "1:50528553078:web:060ffe46549079bb72b757",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
