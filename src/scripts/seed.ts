import 'dotenv/config';
import postgres from 'postgres';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres']);

const TRUNCATE_LOCAL_DATABASE_SQL = `
truncate table
  public.outbox_events,
  public.jobs,
  public.notifications,
  public.leaderboard_snapshots,
  public.rating_history,
  public.room_player_results,
  public.room_results,
  public.game_events,
  public.game_snapshots,
  public.games,
  public.room_spectators,
  public.room_players,
  public.rooms,
  public.player_stats,
  public.friendships,
  public.user_avatar_uploads,
  public.oauth_accounts,
  public.sessions,
  public.users
restart identity cascade;
`;

async function seedLocalDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed is disabled in production');
  }

  const parsedUrl = new URL(databaseUrl);

  if (!LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(
      `db:seed only accepts a local database host, received ${parsedUrl.hostname}`,
    );
  }

  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    prepare: false,
  });

  try {
    await client.unsafe(TRUNCATE_LOCAL_DATABASE_SQL);
    console.info('Local LivePoly database seeded');
  } finally {
    await client.end({ timeout: 5 });
  }
}

void seedLocalDatabase().catch((error: unknown) => {
  console.error('Local database seed failed', error);
  process.exitCode = 1;
});
