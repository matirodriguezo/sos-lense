import * as Location from "expo-location";
import { updateDoc, doc, addDoc, collection, serverTimestamp, GeoPoint } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const LOG = "[LocationSvc]";

export async function updateIncidentLocation(incidentId) {
  console.log(`${LOG} updateIncidentLocation: ${incidentId}`);

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permiso de ubicación denegado");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const { latitude, longitude } = location.coords;
  console.log(`${LOG} got position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

  let address = "";
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results?.length > 0) {
      const r = results[0];
      address = [r.street, r.name, r.city, r.region].filter(Boolean).join(", ");
    }
  } catch {}

  const incidentRef = doc(db, "incidents", incidentId);

  await updateDoc(incidentRef, {
    latitude,
    longitude,
    address: address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    location: new GeoPoint(latitude, longitude),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(incidentRef, "locationHistory"), {
    latitude,
    longitude,
    address: address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    location: new GeoPoint(latitude, longitude),
    createdAt: serverTimestamp(),
  });

  console.log(`${LOG} incident ${incidentId} location updated`);

  return { latitude, longitude, address };
}
