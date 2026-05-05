export const API_PREFIX = 'api';

export const SWAGGER_PATH = `${API_PREFIX}/docs`;

export const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://livepoly.vercel.app',
] as const;

export const API_DOCUMENTATION = {
  title: 'LivePoly API',
  description: 'Authoritative backend API for LivePoly.',
  version: '0.1.0',
} as const;
