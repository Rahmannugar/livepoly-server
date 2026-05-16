export const USER_AVATAR = {
  maxBytes: 10 * 1024 * 1024,
  uploadExpiresInSeconds: 10 * 60,
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export type UserAvatarContentType =
  (typeof USER_AVATAR.allowedContentTypes)[number];

export const USER_AVATAR_UPLOAD_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  cleanedUp: 'cleaned_up',
  expired: 'expired',
} as const;

export type UserAvatarUploadStatus =
  (typeof USER_AVATAR_UPLOAD_STATUS)[keyof typeof USER_AVATAR_UPLOAD_STATUS];
