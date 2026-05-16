export type DeletedUserCleanupJob = {
  userId: string;
  email: string;
  username: string;
  avatarObjectKey: string | null;
  deletedAt: string;
};

export type DeleteAvatarJob = {
  userId: string;
  objectKey: string;
};
