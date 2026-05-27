export type UserRole = 'player' | 'admin';

export type UserStatus = 'active' | 'suspended';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
  tokenVersion: number;
};
