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
  const form = new FormData();
  form.append("file", {
    uri,
    type: "image/jpeg",
    name: `pod-${Date.now()}.jpg`,
  } as unknown as Blob);
  form.append("upload_preset", config.uploadPreset);
  form.append("folder", config.folder);

  const res = await fetch(config.uploadUrl, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary upload failed");
  }
  return data.secure_url as string;
}
