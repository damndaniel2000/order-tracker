import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

export async function requestDriverPermissions() {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  const location = await Location.requestForegroundPermissionsAsync();
  return {
    camera: camera.granted,
    location: location.granted,
  };
}

export function openGoogleMaps(
  lat: number | null,
  lng: number | null,
  address: string
) {
  if (lat != null && lng != null) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    return Linking.openURL(url);
  }
  const q = encodeURIComponent(address);
  return Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${q}`
  );
}

export function callPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return Linking.openURL(`tel:${cleaned}`);
}

export async function takeProofPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required for proof of delivery.");
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}
