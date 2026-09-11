import * as XLSX from "xlsx";

export const MAX_ROWS = 2000;

// Real manifest headers vary in casing/spacing/punctuation across exports
// ("Pick Up Date" vs "Pick up time", "No. Of Boxes") -- normalize before
// matching so the parser doesn't depend on the admin retyping headers.
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  customer: "customer",
  awb: "awb",
  to: "to",
  address: "address",
  pincode: "pincode",
  city: "city",
  pickupdate: "pickupDate",
  pickuptime: "pickupTime",
  receivername: "receiverName",
  sprintername: "driverName",
  mobilenumber: "driverPhone",
  mobileno: "driverPhone",
  phonenumber: "driverPhone",
  contactnumber: "driverPhone",
  sprinterphonenumber: "driverPhone",
  sprinterphoneno: "driverPhone",
  sprinternumber: "driverPhone",
  sprintermobile: "driverPhone",
  sprintermobilenumber: "driverPhone",
  driverphonenumber: "driverPhone",
  driverphone: "driverPhone",
  drivermobilenumber: "driverPhone",
  drivernumber: "driverPhone",
};

export type ParsedRow = {
  customer?: string;
  awb?: string;
  to?: string;
  address?: string;
  pincode?: string;
  city?: string;
  pickupDate?: string;
  pickupTime?: string;
  receiverName?: string;
  driverName?: string;
  driverPhone?: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Pick Up Date" values in the real sheet have no year (e.g. "01-Aug") --
// per explicit instruction, always resolve the year to whatever year it is
// at the moment the upload is processed, regardless of what's in the cell.
export function parsePickupAt(dateRaw: unknown, timeRaw: unknown): string | null {
  if (dateRaw === undefined || dateRaw === null || dateRaw === "") return null;
  const currentYear = new Date().getFullYear();

  let day: number | undefined;
  let month: number | undefined;
  if (dateRaw instanceof Date) {
    day = dateRaw.getDate();
    month = dateRaw.getMonth();
  } else {
    const str = String(dateRaw).trim();
    const match = /^(\d{1,2})[-\/\s]([A-Za-z]{3,})/.exec(str);
    if (match) {
      day = parseInt(match[1], 10);
      month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        day = d.getDate();
        month = d.getMonth();
      }
    }
  }
  if (day === undefined || month === undefined || month < 0 || isNaN(day)) return null;

  let hours = 0;
  let minutes = 0;
  if (timeRaw !== undefined && timeRaw !== null && timeRaw !== "") {
    if (timeRaw instanceof Date) {
      hours = timeRaw.getHours();
      minutes = timeRaw.getMinutes();
    } else {
      const tMatch = /^(\d{1,2}):(\d{2})/.exec(String(timeRaw).trim());
      if (tMatch) {
        hours = parseInt(tMatch[1], 10);
        minutes = parseInt(tMatch[2], 10);
      }
    }
  }

  const d = new Date(currentYear, month, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; error: string };

export function parseManifest(buf: Buffer): ParseResult {
  let rawRows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { ok: false, error: "Could not read the file. Make sure it's a valid .xlsx file." };
  }

  if (rawRows.length === 0) {
    return { ok: false, error: "The sheet has no data rows." };
  }
  if (rawRows.length > MAX_ROWS) {
    return { ok: false, error: `Too many rows (max ${MAX_ROWS} per upload).` };
  }

  const firstRowKeys = Object.keys(rawRows[0]);
  const normalizedToKnown = new Map<string, string>();
  for (const key of firstRowKeys) {
    const known = HEADER_MAP[normalizeHeader(key)];
    if (known) normalizedToKnown.set(key, known);
  }
  const hasCoreColumns = ["customer", "awb", "address"].every((needed) =>
    Array.from(normalizedToKnown.values()).includes(needed)
  );
  if (!hasCoreColumns) {
    return {
      ok: false,
      error:
        "This file doesn't look like the expected manifest. Expected at least Customer, AWB, and Address columns.",
    };
  }

  const rows: ParsedRow[] = rawRows.map((raw) => {
    const parsed: ParsedRow = {};
    for (const [originalKey, value] of Object.entries(raw)) {
      const known = normalizedToKnown.get(originalKey);
      if (!known) continue;
      (parsed as Record<string, unknown>)[known] =
        value instanceof Date ? value : String(value ?? "").trim();
    }
    return parsed;
  });

  return { ok: true, rows };
}

export function matchDriver<T extends { username: string; display_name: string; phone: string | null }>(
  drivers: T[],
  driverPhone: string | null,
  driverName: string | null
): T | null {
  if (driverPhone) {
    const target = driverPhone.replace(/\D/g, "").slice(-10);
    if (target) {
      const match = drivers.find(
        (d) => d.phone && d.phone.replace(/\D/g, "").slice(-10) === target
      );
      if (match) return match;
    }
  }
  if (driverName) {
    const lower = driverName.trim().toLowerCase();
    const match = drivers.find(
      (d) => d.username === lower || d.display_name.toLowerCase() === lower
    );
    if (match) return match;
  }
  return null;
}
