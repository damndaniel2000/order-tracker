# Likhit Driver (Expo)

Android-first Expo app for delivery drivers. Talks to the Next.js API in the parent repo.

## Prerequisites

1. Run Next.js API locally (`npm run dev` in repo root) on port 3000.
2. Apply SQL: `supabase/migrations/002_driver_app.sql` in the Supabase SQL Editor (after schema from `001` / `setup-all.sql`).
3. Configure Cloudinary (for proof-of-delivery photos):
   - Create a cloud at [cloudinary.com](https://cloudinary.com)
   - Settings → Upload → Add upload preset named `driver_pod` (or your name)
   - Set signing mode to **Unsigned**
   - Add to parent `.env.local`:
     ```
     CLOUDINARY_CLOUD_NAME=...
     CLOUDINARY_UPLOAD_PRESET=driver_pod
     ```

## Configure API URL

Edit `driver-app/.env`:

```
# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Physical phone on same Wi‑Fi (use your PC LAN IP)
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000

# iOS simulator / web
# EXPO_PUBLIC_API_URL=http://localhost:3000
```

## Run

```bash
cd driver-app
npm install
npx expo start
```

Press `a` for Android emulator, or scan the QR code with Expo Go.

## Test login

| Email | Password |
|-------|----------|
| `driver@likhit.test`  | `TestDriver123!` |

Assigned sample orders: `ORD-2024-1001`, `ORD-2024-1002` (after migration 002).

## Features

- Login (SecureStore session)
- Active order list (shipped / out for delivery)
- Call customer, open Google Maps
- Start delivery
- Mark delivered (camera → Cloudinary → API)
- Mark failed (remarks required)
