export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "failed";

export type Driver = {
  id: string;
  email: string;
  displayName: string;
};

export type DriverOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  estimated_delivery: string | null;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
};

export type DriverOrderDetail = DriverOrder & {
  proof_photo_url?: string | null;
  delivery_remarks?: string | null;
  order_items: OrderItem[];
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
};
