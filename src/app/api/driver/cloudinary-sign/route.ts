import { NextRequest, NextResponse } from "next/server";
import { requireDriver, unauthorized } from "../_auth";

/**
 * Returns Cloudinary unsigned upload config for the driver app.
 * Create an unsigned upload preset named `driver_pod` (or set CLOUDINARY_UPLOAD_PRESET).
 */
export async function POST(request: NextRequest) {
  const driver = requireDriver(request);
  if (!driver) return unauthorized();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset =
    process.env.CLOUDINARY_UPLOAD_PRESET ?? "driver_pod";

  if (!cloudName) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cloudName,
    uploadPreset,
    folder: `driver-pod/${driver.id}`,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  });
}
