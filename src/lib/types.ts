export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "failed";

export interface Driver {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  guest_email: string | null;
  customer_name: string;
  customer_phone: string | null;
  assigned_driver_id: string | null;
  delivery_remarks: string | null;
  proof_photo_url: string | null;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  shipping_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  title: string;
  description: string | null;
  location_label: string | null;
  created_at: string;
}

export interface DeliveryLocation {
  id: string;
  order_id: string;
  driver_name: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface DeliveryAttempt {
  id: string;
  order_id: string;
  driver_id: string;
  outcome: "delivered" | "failed";
  remarks: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface OrderDetail extends Order {
  order_events: OrderEvent[];
  order_items: OrderItem[];
  delivery_locations: DeliveryLocation[];
}

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

export const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "failed",
];
