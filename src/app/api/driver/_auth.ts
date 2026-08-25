import { NextRequest, NextResponse } from "next/server";
import {
  getBearerToken,
  verifyDriverToken,
  type DriverSession,
} from "@/lib/driver-session";

export function requireDriver(request: NextRequest): DriverSession | null {
  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) return null;
  return verifyDriverToken(token);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
