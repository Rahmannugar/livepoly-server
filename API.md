# LivePoly Server API

This document summarizes the backend contract for frontend work. Swagger remains the source for detailed HTTP schema rendering; this file gives a compact map of the main routes and realtime events.

## HTTP Conventions

- Authenticated routes use `Authorization: Bearer <accessToken>`.
- Validation errors use `422 Unprocessable Entity`.
- Malformed cursors use `400 Bad Request`.
- Missing auth, invalid credentials, unverified accounts, and suspended accounts return `401 Unauthorized`.
- Ownership/role failures return `403 Forbidden`.
- Missing resources return `404 Not Found`.
- Known routes called with unsupported methods return `405 Method Not Allowed`.
- Conflict with current state returns `409 Conflict`.

## Auth

Base path: `/auth`

- `POST /auth/signup`
- `POST /auth/verify-email`
- `POST /auth/verify-email/resend`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/oauth/google`
- `GET /auth/oauth/google/callback`
- `GET /auth/oauth/discord`
- `GET /auth/oauth/discord/callback`

## Users

Base path: `/users`

- `GET /users/me`
- `PATCH /users/me`
- `DELETE /users/me`
- `POST /users/me/avatar/upload-url`
- `GET /users/:username`
- `GET /users/:username/matches`
- `GET /users/search`

Search query:

```txt
query: username prefix, minimum configured length
limit: optional, max 100
cursor: optional
```

Match history query:

```txt
limit: optional, max 100
cursor: optional
```

## Admin

Base path: `/admin`

- `PATCH /admin/users/:username/status`

Only admin users can update player status. Supported statuses are `active` and `suspended`.

## Rooms

Base path: `/rooms`

- `POST /rooms`
- `GET /rooms`
- `GET /rooms/current`
- `GET /rooms/:code`
- `POST /rooms/:code/join`
- `POST /rooms/:code/leave`
- `POST /rooms/:code/spectate`
- `DELETE /rooms/:code/spectate`
- `POST /rooms/:code/invites`
- `POST /rooms/:code/start`

Room responses include players and spectator count. Spectating is allowed only for active rooms and is capped by application-level capacity.

## Friends

Base path: `/friends`

- `POST /friends/requests`
- `GET /friends`
- `GET /friends/requests`
- `POST /friends/requests/:friendshipId/accept`
- `POST /friends/requests/:friendshipId/reject`
- `POST /friends/requests/:friendshipId/cancel`
- `DELETE /friends/:friendshipId`

Friend list query:

```txt
limit: optional, max 100
cursor: optional
```

Friend request query:

```txt
limit: optional, max 100 for incoming and outgoing lists
incomingCursor: optional
outgoingCursor: optional
```

## Notifications

Base path: `/notifications`

- `GET /notifications`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:notificationId/read`

Notification listing is paginated and authenticated.

## Leaderboards

Base path: `/leaderboards`

- `GET /leaderboards/weekly`
- `GET /leaderboards/monthly`

Leaderboards return top ranked players for the current rolling window snapshot.

## Health

Base path: `/health`

- `GET /health/live`
- `GET /health/ready`

## Socket.IO Game Namespace

Namespace:

```txt
/game
```

Authentication:

```ts
io('/game', {
  auth: {
    token: accessToken,
  },
});
```

Room name used internally:

```txt
game:<gameId>
```

### Client Emits

`game:join`

```ts
{
  gameId: string;
}
```

`game:roll-and-move`

```ts
{
  gameId: string;
  dice: [number, number];
}
```

`game:end-turn`

```ts
{
  gameId: string;
}
```

`game:buy-property`

```ts
{
  gameId: string;
}
```

`game:decline-property-purchase`

```ts
{
  gameId: string;
}
```

`game:place-auction-bid`

```ts
{
  gameId: string;
  amount: number;
}
```

`game:pass-auction-bid`

```ts
{
  gameId: string;
}
```

`game:pay-debt`

```ts
{
  gameId: string;
}
```

`game:declare-bankruptcy`

```ts
{
  gameId: string;
}
```

`game:build-property`

```ts
{
  gameId: string;
  tileKey: string;
}
```

`game:sell-building`

```ts
{
  gameId: string;
  tileKey: string;
}
```

`game:mortgage-property`

```ts
{
  gameId: string;
  tileKey: string;
}
```

`game:unmortgage-property`

```ts
{
  gameId: string;
  tileKey: string;
}
```

`game:events:get`

If `cursor` is omitted, the server returns the latest configured recovery window.

```ts
{
  gameId: string;
  cursor?: string;
}
```

`game:heartbeat`

```ts
{
  gameId: string;
}
```

`game:presence:get`

```ts
{
  gameId: string;
}
```

### Server Returns or Emits

`game:joined`

```ts
{
  gameId: string;
  access: 'player' | 'spectator';
  roomPlayerId?: string;
  spectatorId?: string;
}
```

`game:state`

```ts
{
  gameId: string;
  state: GameEngineState;
  events: GameEngineEvent[];
}
```

`game:events`

```ts
{
  gameId: string;
  events: GameEngineEvent[];
}
```

`game:events:recovered`

```ts
{
  gameId: string;
  items: {
    sequence: number;
    type: string;
    payload: unknown;
    createdAt: string;
  }[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

`game:heartbeat:acknowledged`

```ts
{
  gameId: string;
  receivedAt: string;
  ttlSeconds: number;
}
```

`game:presence`

```ts
{
  gameId: string;
  onlineUsers: {
    userId: string;
    access: 'player' | 'spectator';
    socketCount: number;
    lastSeenAt: string;
  }[];
  playersOnline: number;
  spectatorsOnline: number;
}
```

`game:command-rejected`

```ts
{
  gameId: string;
  command: string;
  code?: string;
  message: string;
}
```

`game:error`

```ts
{
  message: string;
  code?: string;
}
```

## Frontend Reconnect Flow

1. Reconnect socket with access token.
2. Emit `game:join`.
3. Emit `game:events:get` with the last known cursor.
4. If no cursor exists, accept the latest recovery window.
5. Emit `game:presence:get`.
6. Start heartbeat loop using the configured interval from frontend constants.
