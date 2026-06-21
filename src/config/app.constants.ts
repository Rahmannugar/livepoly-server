export const SWAGGER_PATH = 'docs';

export const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://livepoly.site',
] as const;

export const API_DOCUMENTATION = {
  title: 'LivePoly API',
  description: 'Backend API for LivePoly.',
  version: '0.1.0',
} as const;

export const SERVER_TIMEOUTS = {
  requestTimeoutMs: 60_000,
  headersTimeoutMs: 65_000,
  keepAliveTimeoutMs: 60_000,
} as const;
