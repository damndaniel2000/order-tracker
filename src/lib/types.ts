export type OrderStatus =
  | "booked"
  | "arrived_at_hub"
  | "out_for_delivery"
  | "delivered"
  | "undelivered"
  | "cancelled";

export interface Driver {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  assigned_driver_id: string | null;
  delivery_remarks: string | null;
  proof_photo_url: string | null;
  status: OrderStatus;
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

export interface AdminOrder extends Order {
  order_events: OrderEvent[];
}

export interface UploadResultRow {
  row: number;
  orderNumber?: string;
  customerCode: string;
  customerName?: string;
  driverAssigned?: string | null;
  status: "created" | "error";
  error?: string;
  warning?: string;
  customerCreated: boolean;
  generatedPassword?: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  booked: "Order Booked",
  arrived_at_hub: "Arrived at Hub",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  undelivered: "Undelivered",
  cancelled: "Cancelled",
};

export const STATUS_ORDER: OrderStatus[] = [
  "booked",
  "arrived_at_hub",
  "out_for_delivery",
  "delivered",
  "undelivered",
  "cancelled",
];

export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  booked: ["arrived_at_hub", "cancelled"],
  arrived_at_hub: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "undelivered", "cancelled"],
  delivered: [],
  undelivered: [],
  cancelled: [],
};
