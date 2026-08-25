import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { updateLocation } from "./api";

export const LOCATION_TASK_NAME = "driver-location-task";
const CONTEXT_KEY = "lamatic_tracking_context";

type TrackingContext = { token: string; orderId: string };

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { locations } = (data as { locations: Location.LocationObject[] }) ?? {
    locations: [],
  };
  const latest = locations[locations.length - 1];
  if (!latest) return;

  const raw = await SecureStore.getItemAsync(CONTEXT_KEY);
  if (!raw) return;
  const { token, orderId } = JSON.parse(raw) as TrackingContext;

  await updateLocation(token, orderId, {
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    heading: latest.coords.heading,
    speedKmh: latest.coords.speed != null ? latest.coords.speed * 3.6 : null,
  }).catch(() => {});
});

export async function startBackgroundTracking(token: string, orderId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;

  await SecureStore.setItemAsync(CONTEXT_KEY, JSON.stringify({ token, orderId }));

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 8000,
    distanceInterval: 15,
    foregroundService: {
      notificationTitle: "Lamatic Driver",
      notificationBody: "Sharing your live location for an active delivery",
      notificationColor: "#4F46E5",
    },
  });
  return true;
}

export async function stopBackgroundTracking() {
  await SecureStore.deleteItemAsync(CONTEXT_KEY);
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
