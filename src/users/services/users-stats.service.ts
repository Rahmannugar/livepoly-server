import { Injectable } from '@nestjs/common';
import { UsersStatsRepository } from '../repositories/users-stats.repository';

@Injectable()
export class UsersStatsService {
  constructor(private readonly usersStatsRepository: UsersStatsRepository) {}

  async getStats(userId: string) {
    return this.usersStatsRepository.getStats(userId);
  }
}
