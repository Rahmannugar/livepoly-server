# LivePoly Server Architecture

LivePoly Server is a modular NestJS backend. Each feature owns its controller, service, repository, DTOs, docs, and tests where useful. Shared infrastructure lives under `src/infra`.

## High-Level Shape

```txt
HTTP / Socket.IO
  -> Controller / Gateway
  -> Service
  -> Repository / Queue / Cache / Storage / Realtime emitter
  -> PostgreSQL / Redis / R2 / BullMQ
```

Controllers and gateways stay thin. Business rules live in services. Repositories own SQL access. Redis is used for cache, live state, queue backing, rate limits, presence, and Socket.IO scaling.

## Main Modules

### Auth

Handles email/password signup, email verification, login, refresh, logout, password reset, OAuth, token versioning, session revocation, and active/suspended user enforcement.

Suspended users receive generic unauthorized responses from auth-sensitive flows. Internal security events keep the real reason.

### Users

Owns profile reads/updates, soft delete, avatar upload intent, username prefix search, stats lookup, and match history. User search and match history use cursor pagination and Redis first-page caching.

### Admin

Owns admin-only account status changes. Admin role is intended to be granted manually through SQL.

### Rooms

Owns lobby rooms, invites, joining/leaving, room start, spectators, and live room listings. Room start creates game state and durable start snapshot in one transaction. Room lobbies expose an authenticated SSE stream at `GET /rooms/stream/:code`; join, leave, spectator, cancel, and start changes publish to the room's Redis pub/sub channel so all lobby clients can refetch the room without polling.

### Game

Owns the game engine, game state, commands, timers, bots, recovery, realtime gateway, event log, snapshots, results, stats updates, and leaderboard refresh triggers.

The game engine is pure domain logic. Command services coordinate Redis state mutation, durable event append, snapshots, result finalization, follow-up jobs, and realtime publishing.

Games persist `startedAt`, `expiresAt`, and `finishedAt`. Ranked games use the fixed ranked duration; casual games use the room duration selected before start. The live state also carries `turnExpiresAt` and auction `bidExpiresAt` so clients can render authoritative timers without inventing client-only deadlines. Auction bidding uses its own short `bidExpiresAt`; when an auction resolves, the command layer reuses the current turn's existing `turnExpiresAt` only if that deadline is still in the future. If the old turn deadline has already passed, the command opens a fresh normal turn deadline.

Game-changing commands check the authoritative expiry before normal mutation. If `now >= expiresAt`, the command finalizes the game by time and returns the finished state/result path instead of applying the requested move. A delayed expiry job is also scheduled when the game starts, but it is a safety net rather than the only finalizer; it refuses to finish early and exists to close games with no further player commands.

Turn progress is protected by two backend-only layers. BullMQ is the primary path for bot turns, turn timeouts, auction bid timeouts, and game expiry. Those jobs use deterministic job IDs and stale-state guards, so duplicated or delayed jobs do not mutate newer state. When a recovery path sees that a deterministic job ID is stuck in BullMQ's failed set, it removes that failed duplicate before re-adding the guarded job, which lets retries recover from stale failed jobs instead of being blocked by job-id dedupe. The worker also runs a quiet timer watchdog every 10 seconds. Each pass scans a bounded batch of active games, recovers Redis state from snapshots when needed, and re-enqueues missing bot work, overdue turn/auction timeout work, overdue game-expiry work, or abandoned active games whose room has no joined human players through the same guarded command/result paths. The watchdog does not create a second game engine path and is intentionally not exposed as a player-facing “retrying” state; clients continue to see normal turn, auction, or result state while the backend repairs missed queue execution.

### Friends

Owns friend request lifecycle and friend lists. Friend list and request reads are cursor paginated with first-page Redis caching and version-based invalidation.

### Notifications

Owns notification creation, listing, read state, unread count, and delivery through outbox/realtime flows. Notifications are for out-of-band attention such as friend requests, room invites, and leaderboard placement. Active gameplay state such as a room starting is handled by room/current-game APIs and realtime game state rather than a separate notification. Notification clients subscribe through `GET /notifications/stream`; outbox publishing fans notification-created events to the user's Redis pub/sub channel.

### Leaderboards

Owns weekly and monthly leaderboard snapshots. The service reads cached snapshots and refreshes snapshots through queued jobs. When a refreshed snapshot includes users on the weekly or monthly leaderboard, the service creates one `leaderboard` notification per user per calendar leaderboard bucket, such as one weekly notification for `weekly:2026-W22` or one monthly notification for `monthly:2026-05`. Notification creation still uses the notifications outbox, and the deterministic bucket key prevents repeated snapshot refreshes from spamming the same user.

## Data Stores

### PostgreSQL

PostgreSQL is the source of truth for users, sessions, rooms, games, snapshots, events, results, stats, leaderboards, friends, notifications, jobs, and outbox events.

Important durability tables include:

- `game_snapshots`: recovery checkpoints for full game state.
- `game_events`: durable event stream for reconnect/event recovery.
- `room_results` and `room_player_results`: finalized game result records.
- `player_stats` and `rating_history`: ranked stats and rating changes.
- `leaderboard_snapshots`: weekly/monthly leaderboard windows.

### Redis

Redis is used for:

- Live game state.
- Redis-backed BullMQ queues.
- Short-lived API caches.
- Rate limits.
- Socket.IO Redis adapter/emitter.
- Game presence.

Cache entries use TTLs and jitter. Important mutable lists use version keys so broad invalidation does not rely on wildcard deletes.

### Object Storage

Avatar uploads use short-lived R2-compatible presigned URLs. The backend creates the upload intent and object key, then background cleanup/verification handles abandoned or replaced uploads.

## Realtime Model

Socket.IO runs under the `/game` namespace.

The gateway authenticates the socket and delegates game access and commands to services. The gateway does not decide live game permissions by itself.

Horizontal scaling uses the Socket.IO Redis adapter/emitter:

- API/worker emits once through the Socket.IO emitter.
- Redis adapter routes events to sockets in the distributed room.
- Gateways do not need to translate generic pub/sub messages manually.

Presence uses Redis keys with TTL. Heartbeats refresh presence. Presence summary groups multiple sockets/devices by user.

Reconnect pressure is handled with a layered approach. The frontend reconnects with exponential backoff and jitter, while the backend applies soft Redis-backed guards around expensive websocket reconnect actions such as connection auth, game join, event recovery, heartbeat, and presence summary. These guards are intentionally lenient so real reconnects keep working, but broken clients or outage loops cannot trigger unlimited gateway work.

Room lobby updates and notification delivery use authenticated Server-Sent Events instead of Socket.IO. Both SSE endpoints are explicit streaming responses, not buffered JSON requests. The shared SSE helper sets `text/event-stream`, no-cache/no-transform headers, writes an immediate `: connected` comment, and writes `: ping` comment heartbeats every 25 seconds. Comments keep browser/proxy connections alive without creating fake application events; real application messages are emitted with normal `event:` and JSON `data:` lines. The services unsubscribe from Redis pub/sub and clear heartbeat timers when the HTTP connection closes.

SSE stream ownership:

- `GET /rooms/stream/:code`: lobby membership/status stream. Backend publishes `room.updated` events whose payload identifies the underlying room event, such as `room.joined` or `room.started`.
- `GET /notifications/stream`: per-user notification stream. Backend publishes notification event names such as `notification.created`.

## Recovery Model

Live game state is stored in Redis for fast gameplay. Durability is handled separately:

- Snapshots store full game state checkpoints.
- Events store ordered command/result event payloads for reconnect recovery.

On reconnect, the client joins the game, requests missed events with a cursor, and refreshes presence. If no cursor exists, the server can return the latest recovery window.

## Jobs and Outbox

BullMQ handles background jobs for:

- Mail.
- User cleanup.
- Outbox publishing.
- Bot turns.
- Turn timers.
- Timer watchdog recovery.
- Leaderboard refresh.

The outbox is a durable “publish this later” table.

LivePoly uses it for notification-created events. When a feature creates a notification, it saves both the notification row and an outbox event in the same database transaction. A worker later claims the outbox event and publishes it to the user notification channel.

That means if publishing fails after the database write, the notification event is still stored and can be retried instead of being lost.

## Caching

Current cache targets include:

- User match history first page.
- Username search first page.
- Friend list/request first page.
- Leaderboard snapshots.
- Room/live listing style reads where applicable.

Do not cache authority decisions for money, turns, winner, bankruptcy, game state mutation, result finalization, or rating/stat mutation.
