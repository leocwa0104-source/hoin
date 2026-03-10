# GeoChat - Location-Based Area Subscriptions

This is a Proof of Concept for a location-based chat platform where users subscribe to **custom defined geographic areas** instead of traditional chat rooms.

## Features

- **Custom Zones**: Draw any polygon on the map (e.g., your office, home, favorite park).
- **Spatial Subscription**: You only receive messages that are geographically located within your defined zones.
- **Real-time**: Messages are broadcast instantly to all subscribers of the relevant area.
- **Privacy**: The sender doesn't know who is listening; they just broadcast to a location.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Leaflet (Map), Socket.io-client
- **Backend**: Node.js, Express, Socket.io, Turf.js (Geospatial analysis)
- **Data**: In-memory storage (reset on restart)

## How to Run

1.  **Start Server**:
    ```bash
    cd server
    npm install
    node index.js
    ```

2.  **Start Client**:
    ```bash
    cd client
    npm install
    npm run dev
    ```

## Usage

1.  Enter a nickname to "login".
2.  Click **"New Zone"** to go to the map.
3.  Use the **Polygon Tool** (top-right toolbar) to draw a shape on the map.
4.  Save the zone.
5.  Click the zone in your list to enter the chat.
6.  Send messages! (Your location is simulated as being inside the zone for this demo).
