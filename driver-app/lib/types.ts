export type OrderStatus =
  | "booked"
  | "arrived_at_hub"
  | "out_for_delivery"
  | "delivered"
  | "undelivered"
  | "cancelled";

export type Driver = {
  id: string;
  username: string;
  displayName: string;
};

export type DriverOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  shipping_address: string;
  status: OrderStatus;
  delivery_lat: number | null;
  delivery_lng: number | null;
  estimated_delivery: string | null;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
};

export type DriverOrderDetail = DriverOrder & {
  proof_photo_url?: string | null;
  delivery_remarks?: string | null;
  order_items: OrderItem[];
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  booked: "Order Booked",
  arrived_at_hub: "Arrived at Hub",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  undelivered: "Undelivered",
  cancelled: "Cancelled",
};
