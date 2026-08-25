# Lamatic Order Tracking

Guest order tracking with real-time status updates, OpenStreetMap delivery map, timeline, and an admin dashboard. Built with **Next.js 16**, **React 19**, and **Supabase**.

## Features

- **Guest tracking** — order number only (no login, no email)
- **Real-time updates** — Supabase Realtime on orders, events, and driver GPS
- **Tracking timeline** — visual status history
- **Live delivery map** — OpenStreetMap via Leaflet (driver route + destination)
- **Admin dashboard** — update status, assign drivers, push driver coordinates
- **Driver Expo app** — Android driver app with Maps, camera POD (Cloudinary), failure remarks
- **Keyboard shortcuts** — press `?` for help (`/`, `h`, `Esc` on track page; `r`, `l` in admin)
- **Mobile-friendly** — responsive layout for phones and tablets

## Quick start

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run:
   - `supabase/setup-all.sql` (base schema + seed), then
   - `supabase/migrations/002_driver_app.sql` (drivers, phones, POD fields)
3. Enable **Realtime** for `orders`, `order_events`, and `delivery_locations` (Database → Replication) if not already added by the migration.

### 2. Environment

Copy `.env.local.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ADMIN_SESSION_SECRET=any-long-random-string-for-local-testing
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_UPLOAD_PRESET=driver_pod
```

Create an **unsigned** Cloudinary upload preset named `driver_pod` for proof-of-delivery photos.

### 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test credentials (seeded in database)

### Guest tracking (order number only)

| Order number    | Notes                         |
|-----------------|-------------------------------|
| `ORD-2024-1001` | Out for delivery + live map   |
| `ORD-2024-1002` | Shipped                       |
| `ORD-2024-1003` | Delivered                     |

### Admin (temporary testing login)

| Email                 | Password         |
|-----------------------|------------------|
| `admin@lamatic.test`  | `TestAdmin123!`  |

### Driver app (Expo)

| Email                 | Password         |
|-----------------------|------------------|
| `driver@lamatic.test` | `TestDriver123!` |

See [`driver-app/README.md`](driver-app/README.md). Quick start:

```bash
cd driver-app
npm install
# set EXPO_PUBLIC_API_URL (Android emulator: http://10.0.2.2:3000)
npx expo start
```

Admin can assign drivers on the dashboard. Drivers see assigned `shipped` / `out_for_delivery` orders, open Google Maps, call the customer, and complete with a POD photo (Cloudinary) or failure remarks.

Admin URL: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Keyboard shortcuts

**Track page**

| Key   | Action                    |
|-------|---------------------------|
| `?`   | Show / hide shortcuts     |
| `/`   | Focus order number        |
| `h`   | Back to search            |
| `Esc` | Close help or clear order |

**Admin**

| Key   | Action        |
|-------|---------------|
| `?`   | Shortcuts     |
| `r`   | Refresh list  |
| `l`   | Logout        |

## Admin: update driver on map

1. Sign in to the admin dashboard.
2. Select an order.
3. Enter latitude/longitude (optional) and click a status button.
4. Open the guest track page for that order — the map and timeline update in real time.

## Scripts

```bash
npm run dev      # development
npm run build    # production build
npm run start    # start production server
```

Generate a new admin password hash:

```bash
node scripts/generate-admin-hash.mjs "YourNewPassword"
```

## Stack

- Next.js 16 (App Router)
- React 19
- Supabase (Postgres + Realtime)
- Leaflet + OpenStreetMap tiles
- Tailwind CSS 4
