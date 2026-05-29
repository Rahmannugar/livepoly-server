export type RatingParticipant = {
  userId: string;
  placement: number;
  rating: number;
};

export type RatingChange = {
  userId: string;
  placement: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
};

export type PlayerStatsForUpdate = {
  userId: string;
  gamesPlayed: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  fourthPlace: number;
  avgPosition: string;
  currentRating: number;
  peakRating: number;
  totalNetWorth: bigint;
  totalRentCollected: bigint;
  totalRentPaid: bigint;
};

export type UpdatePlayerStatsInput = {
  userId: string;
  gamesPlayed: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  fourthPlace: number;
  avgPosition: number;
  currentRating: number;
  peakRating: number;
  totalNetWorth: bigint;
  totalRentCollected: bigint;
  totalRentPaid: bigint;
};

export type RecordRatingChangeInput = {
  userId: string;
  roomId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  placement: number;
};