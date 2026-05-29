import { Injectable } from '@nestjs/common';
import type { RatingChange, RatingParticipant } from './game-stats.types';

const DEFAULT_K_FACTOR = 32;
const MIN_RATING = 100;

@Injectable()
export class GameRatingService {
  calculateRatingChanges(
    participants: RatingParticipant[],
    kFactor = DEFAULT_K_FACTOR,
  ): RatingChange[] {
    if (participants.length < 2) {
      return [];
    }

    this.assertUniquePlacements(participants);

    return participants.map((participant) => {
      const opponents = participants.filter(
        (opponent) => opponent.userId !== participant.userId,
      );

      const performanceDelta = opponents.reduce((total, opponent) => {
        const actualScore = participant.placement < opponent.placement ? 1 : 0;
        const expectedScore = this.getExpectedScore(
          participant.rating,
          opponent.rating,
        );

        return total + actualScore - expectedScore;
      }, 0);

      const ratingDelta = Math.round(
        (kFactor / opponents.length) * performanceDelta,
      );

      const ratingAfter = Math.max(
        MIN_RATING,
        participant.rating + ratingDelta,
      );

      return {
        userId: participant.userId,
        placement: participant.placement,
        ratingBefore: participant.rating,
        ratingAfter,
        ratingDelta: ratingAfter - participant.rating,
      };
    });
  }

  private getExpectedScore(
    playerRating: number,
    opponentRating: number,
  ): number {
    return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  }

  private assertUniquePlacements(participants: RatingParticipant[]): void {
    const placements = new Set<number>();

    for (const participant of participants) {
      if (placements.has(participant.placement)) {
        throw new Error('Rating calculation requires unique placements');
      }

      placements.add(participant.placement);
    }
  }
}
