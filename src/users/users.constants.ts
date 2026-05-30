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

export const USER_EVENTS = {
  avatarUploadUrlCreated: 'UserAvatarUploadUrlCreated',
  publicProfileViewFailed: 'PublicProfileViewFailed',
  publicProfileViewed: 'PublicProfileViewed',
  profileViewFailed: 'UserProfileViewFailed',
  profileViewed: 'UserProfileViewed',
  profileUpdateRequested: 'UserProfileUpdateRequested',
  profileUpdateFailed: 'UserProfileUpdateFailed',
  profileUpdated: 'UserProfileUpdated',
  deleteRequested: 'UserDeleteRequested',
  deleteFailed: 'UserDeleteFailed',
  deleted: 'UserDeleted',
  jobCompleted: 'UserJobCompleted',
  jobSkipped: 'UserJobSkipped',
  unknownJobReceived: 'UserUnknownJobReceived',
} as const;

export const USER_METRICS = {
  jobCompleted: 'Custom/User/Job/Completed',
  jobSkipped: 'Custom/User/Job/Skipped',
  unknownJobReceived: 'Custom/User/Job/Unknown',
} as const;
