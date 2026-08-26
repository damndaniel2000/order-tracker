import { File, UploadType } from "expo-file-system";
import { API_URL } from "./config";
import type { Driver, DriverOrder, DriverOrderDetail } from "./types";

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function login(email: string, password: string) {
  return request<{
    ok: true;
    token: string;
    driver: Driver;
  }>("/api/driver/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchOrders(token: string) {
  return request<{ driver: Driver; orders: DriverOrder[] }>(
    "/api/driver/orders",
    { token }
  );
}

export function fetchOrder(token: string, id: string) {
  return request<DriverOrderDetail>(`/api/driver/orders/${id}`, { token });
}

export function startDelivery(token: string, id: string) {
  return request<DriverOrderDetail>(`/api/driver/orders/${id}/start`, {
    method: "POST",
    token,
    body: "{}",
  });
}

export function completeDelivery(
  token: string,
  id: string,
  body: {
    outcome: "delivered" | "failed";
    remarks?: string;
    photoUrl?: string;
  }
) {
  return request<DriverOrderDetail>(`/api/driver/orders/${id}/complete`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function updateLocation(
  token: string,
  id: string,
  body: { lat: number; lng: number; heading?: number | null; speedKmh?: number | null }
) {
  return request<{ ok: true }>(`/api/driver/orders/${id}/location`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function getCloudinaryConfig(token: string) {
  return request<{
    cloudName: string;
    uploadPreset: string;
    folder: string;
    uploadUrl: string;
  }>("/api/driver/cloudinary-sign", {
    method: "POST",
    token,
    body: "{}",
  });
}

export async function uploadToCloudinary(
  token: string,
  uri: string
): Promise<string> {
  const config = await getCloudinaryConfig(token);
  const file = new File(uri);
  const result = await file.upload(config.uploadUrl, {
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType: "image/jpeg",
    parameters: {
      upload_preset: config.uploadPreset,
      folder: config.folder,
    },
  });

  const data = JSON.parse(result.body || "{}");
  if (result.status < 200 || result.status >= 300 || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary upload failed");
  }
  return data.secure_url as string;
}
