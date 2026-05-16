import { Injectable } from '@nestjs/common';
import { UsersStatsRepository } from '../repositories/users-stats.repository';

@Injectable()
export class UsersStatsService {
  constructor(private readonly usersStatsRepository: UsersStatsRepository) {}

  async getPublicStats(userId: string) {
    return this.usersStatsRepository.getStats(userId);
  }

  async getPrivateStats(userId: string) {
    return this.usersStatsRepository.getStats(userId);
  }
}
