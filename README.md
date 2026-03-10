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
- FROM_EMAIL=Sender email address (Tencent Exmail account)
- SMTP_HOST=smtp.exmail.qq.com
- SMTP_PORT=465
- SMTP_SECURE=true
- SMTP_USER=your_exmail_account
- SMTP_PASS=SMTP password / authorization code

### Client (Vercel)

- VITE_AMAP_KEY=Gaode JS API key
- VITE_AMAP_SECURITY_JS_CODE=Gaode securityJsCode
