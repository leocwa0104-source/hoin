# GeoChat - Location-Based Area Subscriptions

Location-based chat where users subscribe to custom geographic areas (polygons) instead of chat rooms.

## Features

- **Custom Zones**: Draw any polygon on the map (e.g., your office, home, favorite park).
- **Spatial Subscription**: You only see messages that fall inside your zones.
- **Authentication**: Email OTP registration + Email/Password login.
- **Data**: Stored in Neon Postgres.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, AMap JS API (Gaode)
- **Backend**: Node.js, Express (Vercel Serverless)
- **Database**: Neon Postgres

## How to Run

1. Install deps:
   ```bash
   npm install
   ```

2. Start API (local):
   ```bash
   npm run dev:api
   ```

3. Start client:
   ```bash
   npm run dev
   ```

## Usage

1. Register with Email OTP, then login with email/password.
2. Click **New Zone** and draw a polygon on the map.
3. Enter a zone name and save.
4. Enter the zone and send messages.

## Environment Variables

### Server (/api)

- DATABASE_URL=Neon Postgres connection string (sslmode=require)
- OTP_SECRET=Random string for OTP hashing
- SESSION_SECRET=Random string for session hashing
- FROM_EMAIL=Verified sender email address (e.g. noreply@hoin.chat)
- SENDER_DOMAIN=hoin.chat (optional, used when FROM_EMAIL not set)
- FROM_LOCAL_PART=noreply (optional, used with SENDER_DOMAIN)
- TENCENTCLOUD_SECRET_ID=Tencent Cloud SecretId
- TENCENTCLOUD_SECRET_KEY=Tencent Cloud SecretKey
- TENCENTCLOUD_REGION=ap-guangzhou (or your SES region)
- SES_TEMPLATE_ID=Email template ID (optional; TemplateData includes {code})

### Client (Vercel)

- VITE_AMAP_KEY=Gaode JS API key
- VITE_AMAP_SECURITY_JS_CODE=Gaode securityJsCode
