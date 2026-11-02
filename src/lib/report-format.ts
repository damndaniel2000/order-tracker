import type { OrderStatus } from "@/lib/types";

// Everything the client reads (reports, exports, date headers) is in Indian
// time, regardless of where the server or browser happens to run.
const TIME_ZONE = "Asia/Kolkata";

const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const headerFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "14-Oct-2026" -- same day-month shape as the manifest's Pick Up Date. */
export function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(dateParts.formatToParts(d).map((p) => [p.type, p.value]));
  // Newer ICU spells September "Sept" -- keep the manifest's 3-letter months.
  return `${parts.day}-${parts.month.slice(0, 3)}-${parts.year}`;
}

/** "01-Sep" -- exactly how the manifest writes dates (no year). */
export function formatDayMonthIST(iso: string | null | undefined): string {
  return formatDateIST(iso).slice(0, 6);
}

/** "15:02" (24h). */
export function formatTimeIST(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return timeFormat.format(d);
}

/** IST calendar day as "YYYY-MM-DD" -- same shape as an <input type="date"> value. */
export function dateKeyIST(iso: string): string {
  return dateKeyFormat.format(new Date(iso));
}

export type DateGroup<T> = { key: string; label: string; items: T[] };

/**
 * Groups orders under the IST calendar day they were picked up (falling back
 * to when they were created), newest day first. Order within a day is kept
 * as given.
 */
export function groupByDate<T extends { pickup_at: string | null; created_at: string }>(
  orders: T[]
): DateGroup<T>[] {
  const groups = new Map<string, DateGroup<T>>();
  for (const order of orders) {
    const d = new Date(order.pickup_at ?? order.created_at);
    const key = dateKeyFormat.format(d);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: headerFormat.format(d).replace("Sept", "Sep"), items: [] };
      groups.set(key, group);
    }
    group.items.push(order);
  }
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export type ManifestSource = {
  order_number: string;
  ref_no: string | null;
  oda: string | null;
  chargeable_weight: number | null;
  status: OrderStatus;
  shipping_address: string;
  pincode: string | null;
  city: string | null;
  receiver_name: string | null;
  received_by: string | null;
  consignee_name: string | null;
  pickup_at: string | null;
  delivery_remarks: string | null;
  proof_photo_url: string | null;
  customers: { customer_code: string } | null;
  drivers?: { display_name: string; phone: string | null } | null;
  order_items: { quantity: number }[];
  order_events: { status: OrderStatus; created_at: string }[];
};

export function deliveryEventTime(
  events: { status: OrderStatus; created_at: string }[]
): string | null {
  return (
    events.find((e) => e.status === "delivered" || e.status === "undelivered")?.created_at ??
    null
  );
}

// Digit-only values (AWB, pincode, mobile) go out as numbers, like in the
// uploaded sheet, as long as Excel can hold them exactly.
function sheetValue(value: string | null | undefined): string | number {
  if (!value) return "";
  return /^\d{1,15}$/.test(value) ? Number(value) : value;
}

/**
 * One export row in exactly the manifest layout the admin uploads (same
 * headers, same order). The booking columns are the ones
 * order-upload-parser.ts reads, so an export can be uploaded straight back;
 * the delivery columns (DATE, TIME, NAME, REMARK, DEF YES / NO, POD LINK) are
 * filled from the driver app and ignored on upload.
 */
export function buildManifestRow(
  row: ManifestSource,
  srNo: number,
  { includeDriver }: { includeDriver: boolean }
): Record<string, string | number> {
  const deliveredAt = deliveryEventTime(row.order_events);
  const out: Record<string, string | number> = {
    "SR NO.": srNo,
    Customer: row.customers?.customer_code ?? "",
    AWB: sheetValue(row.order_number),
    "Ref No.": sheetValue(row.ref_no),
    "Pick Up Date": formatDayMonthIST(row.pickup_at),
    "Pick up time": formatTimeIST(row.pickup_at),
    To: row.consignee_name ?? "",
    Address: row.shipping_address,
    Pincode: sheetValue(row.pincode),
    City: row.city ?? "",
    "ODA Y/N": row.oda ?? "",
    "No. Of Boxes": row.order_items.reduce((sum, i) => sum + i.quantity, 0),
    "Chargable Weight": row.chargeable_weight ?? "",
    DATE: formatDayMonthIST(deliveredAt),
    TIME: formatTimeIST(deliveredAt),
    // Orders delivered before received_by existed had the driver-typed name
    // written into receiver_name instead.
    NAME: row.received_by ?? (row.status === "delivered" ? row.receiver_name ?? "" : ""),
  };
  if (includeDriver) {
    out.SPRINTER = row.drivers?.display_name ?? "";
    out.MOBILE = sheetValue(row.drivers?.phone);
  }
  out.REMARK = row.delivery_remarks ?? "";
  out["DEF YES / NO"] =
    row.status === "delivered" ? "YES" : row.status === "undelivered" ? "NO" : "";
  out["POD LINK"] = row.proof_photo_url ?? "";
  return out;
}

export const MANIFEST_SELECT =
  "order_number, ref_no, oda, chargeable_weight, status, shipping_address, pincode, city, receiver_name, received_by, consignee_name, pickup_at, delivery_remarks, proof_photo_url, created_at, customers (customer_code), order_items (quantity), order_events (status, created_at)";
