export type FriendListCursor = {
  createdAt: Date;
  friendshipId: string;
};

export type FriendSummaryRow = {
  friendshipId: string;
  userId: string;
  email: string;
  username: string;
  avatarObjectKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FriendRequestSummaryRow = {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  requesterUsername: string;
  requesterAvatarObjectKey: string | null;
  addresseeUsername: string;
  addresseeAvatarObjectKey: string | null;
  status: 'pending';
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedFriendsResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export type FriendRequestsResponse = {
  incoming: PaginatedFriendsResponse<FriendRequestSummaryRow>;
  outgoing: PaginatedFriendsResponse<FriendRequestSummaryRow>;
};
