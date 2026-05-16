export type DeletedUserCleanupJob = {
  userId: string;
  email: string;
  username: string;
  avatarObjectKey: string | null;
  deletedAt: string;
};
