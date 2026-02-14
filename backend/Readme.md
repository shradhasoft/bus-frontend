# BackEnd part of the BookMySeat Website.

## Real-time tracking (production pattern)

This backend now supports production-style tracking with:

- HTTPS telemetry ingestion for conductor devices.
- Redis hot-path for latest location.
- Redis pub/sub fanout for websocket viewers.
- Redis Streams + async history persistence worker.
- MongoDB fallback for latest snapshot compatibility.

### Environment

Required:

- `REDIS_URL=rediss://...`

Optional tuning:

- `TRACKING_MAX_BATCH_POINTS` (default `20`)
- `TRACKING_MAX_POINTS_PER_MIN` (default `120`)
- `TRACKING_MAX_FUTURE_SKEW_SEC` (default `120`)
- `TRACKING_MAX_PAST_SKEW_SEC` (default `600`)
- `TRACKING_MAX_SPEED_KMPH` (default `150`)
- `TRACKING_LOW_CONFIDENCE_ACC_M` (default `100`)
- `TRACKING_HISTORY_TTL_DAYS` (default `7`)
- `TRACKING_STALE_AFTER_SEC` (default `120`)

Socket/CORS wiring (recommended for production):

- `CORS_ORIGINS=https://app.example.com,https://admin.example.com`
- `SOCKET_IO_PATH=/socket.io` (or `/api/socket.io` if behind a reverse proxy path)
- `SOCKET_PING_INTERVAL_MS=25000`
- `SOCKET_PING_TIMEOUT_MS=20000`

Frontend alignment:

- `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1` (REST base can include path)
- `NEXT_PUBLIC_SOCKET_URL=https://api.example.com` (socket host/origin)
- `NEXT_PUBLIC_SOCKET_PATH=/socket.io` (or `/api/socket.io` to match backend path)

### API overview

Write path (conductor only):

- `POST /v1/telemetry/location`
- `GET /v1/telemetry/assignments`

Public read path:

- `GET /v1/tracking/search?q=...`
- `GET /v1/tracking/bus/:busNumber/latest`
- `GET /v1/tracking/trip/:tripKey/latest`
- `GET /v1/tracking/bus/:busNumber/history?from=&to=&limit=`
- `GET /v1/tracking/health`

Legacy compatibility:

- Existing `/track/*` endpoints remain available.
- Legacy socket event `conductor:location` is still accepted, but deprecated.

### Socket events

Public namespace:

- Namespace: `/tracking`
- Subscribe: `tracking:subscribe` with `{ busNumber }` or `{ tripKey }`
- Unsubscribe: `tracking:unsubscribe`
- Event emitted: `tracking.location`

Private namespace (`/`) compatibility:

- Existing `user:subscribe`, `user:unsubscribe` continue to work.
- Existing `bus:location` continues to be emitted.
