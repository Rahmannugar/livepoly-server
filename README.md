# LivePoly Server

![LivePoly logo](./src/assets/livepoly.png)

LivePoly Server is the backend for LivePoly, an online Monopoly-inspired board game where players can create rooms, invite friends, play live turn-based matches, spectate active games, recover smoothly from reconnects, and compete on ranked weekly and monthly leaderboards.

The backend owns the full game lifecycle: authentication, room setup, player turns, dice movement, property buying, rent, auctions, jail, debt, bankruptcy, bots, turn timers, durable snapshots, event recovery, game results, stats, ratings, realtime updates, friends, notifications, avatar uploads, rate limits, and observability.

System design:

https://excalidraw.com/#json=OZCKDPE1yWeQQz_UYG_TX,bvMaOgovDIWth_qVfugCfQ

## Stack

- NestJS + TypeScript
- PostgreSQL with Drizzle ORM
- Redis for cache, live game state, queues, realtime scaling, presence, and rate limits
- Socket.IO for realtime gameplay
- BullMQ for background jobs
- Cloudflare R2-compatible S3 storage for avatar uploads
- New Relic + Pino for observability/logging
- Swagger/OpenAPI for HTTP API documentation

## Main Capabilities

- Email/password auth, OAuth, refresh sessions, token versioning, and suspended-user enforcement
- Admin user status control
- Rooms, invites, players, spectators, and room lifecycle
- Full game engine with movement, rent, jail, auctions, debt, bankruptcy, cards, timers, bots, and results
- Redis-backed live state with durable snapshots and durable event recovery
- Socket.IO realtime commands, fanout, heartbeat, and presence summary
- Ranked/casual stats, rating updates, match history, and weekly/monthly leaderboards
- Friends, friend requests, notifications, and cached paginated reads
- Avatar upload URL flow backed by R2-compatible object storage

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env:

```bash
cp .env.example .env
```

Start the API server, worker, and Redis with Docker Compose:

```bash
docker compose up -d --build
```

Run migrations:

```bash
docker compose exec livepoly-server npm run db:migrate
```

View logs:

```bash
docker compose logs -f livepoly-server livepoly-worker
```

Stop local services:

```bash
docker compose down
```

## Useful Commands

```bash
docker compose up -d --build
docker compose logs -f livepoly-server livepoly-worker
docker compose exec livepoly-server npm run db:migrate
npm test
npm run build
npm run db:generate migration_name
npm run db:migrate
npm run db:studio
```

## Documentation

- [API.md](./API.md): HTTP and Socket.IO API contract summary.
- [ARCHITECTURE.md](./ARCHITECTURE.md): backend architecture, data flow, reliability notes, and operational boundaries.

Swagger is exposed by the application at the configured API docs route when the server is running.
