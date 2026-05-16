export const USER_AVATAR = {
  maxBytes: 10 * 1024 * 1024,
  uploadExpiresInSeconds: 10 * 60,
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export type UserAvatarContentType =
  (typeof USER_AVATAR.allowedContentTypes)[number];
