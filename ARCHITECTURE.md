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

Owns lobby rooms, invites, joining/leaving, room start, spectators, and live room listings. Room start creates game state and durable start snapshot in one transaction.

### Game

Owns the game engine, game state, commands, timers, bots, recovery, realtime gateway, event log, snapshots, results, stats updates, and leaderboard refresh triggers.

The game engine is pure domain logic. Command services coordinate Redis state mutation, durable event append, snapshots, result finalization, follow-up jobs, and realtime publishing.

### Friends

Owns friend request lifecycle and friend lists. Friend list and request reads are cursor paginated with first-page Redis caching and version-based invalidation.

### Notifications

Owns notification creation, listing, read state, unread count, and delivery through outbox/realtime flows.

### Leaderboards

Owns weekly and monthly leaderboard snapshots. The service reads cached snapshots and refreshes snapshots through queued jobs.

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
- Leaderboard refresh.

The outbox is a durable “publish this later” table.

Today, LivePoly uses it for notification-created events. When a feature creates a notification, it saves both the notification row and an outbox event in the same database transaction. A worker later claims the outbox event and publishes it to the user notification channel.

That means if publishing fails after the database write, the notification event is still stored and can be retried instead of being lost.

## Caching

Current cache targets include:

- User match history first page.
- Username search first page.
- Friend list/request first page.
- Leaderboard snapshots.
- Room/live listing style reads where applicable.

Do not cache authority decisions for money, turns, winner, bankruptcy, game state mutation, result finalization, or rating/stat mutation.

