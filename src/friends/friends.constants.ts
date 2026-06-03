export const FRIEND_LIST = {
  defaultLimit: 50,
  maxLimit: 100,
  firstPageTtlSeconds: 60,
  ttlJitterRatio: 0.15,
} as const;

export const FRIEND_EVENTS = {
  requestSent: 'FriendRequestSent',
  requestAccepted: 'FriendRequestAccepted',
  requestRejected: 'FriendRequestRejected',
  requestCanceled: 'FriendRequestCanceled',
  removed: 'FriendRemoved',
} as const;
