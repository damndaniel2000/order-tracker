import Constants from "expo-constants";

/**
 * Point this at your Next.js API.
 * Android emulator: http://10.0.2.2:3000
 * Physical device: http://YOUR_LAN_IP:3000
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";
