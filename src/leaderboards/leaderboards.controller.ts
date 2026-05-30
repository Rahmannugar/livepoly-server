import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { LeaderboardsDocs } from './docs/leaderboards.swagger';
import { LEADERBOARD_PERIODS } from './leaderboards.constants';
import { LeaderboardsService } from './leaderboards.service';
import { LEADERBOARDS_RATE_LIMIT_RULES } from './leaderboards-rate-limit-rules';

@LeaderboardsDocs.Controller()
@Controller('leaderboards')
@UseGuards(AuthGuard, RateLimitGuard)
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @LeaderboardsDocs.GetWeekly()
  @RateLimit(...LEADERBOARDS_RATE_LIMIT_RULES.read)
  @Get('weekly')
  @HttpCode(HttpStatus.OK)
  getWeekly() {
    return this.leaderboardsService.getLeaderboard(LEADERBOARD_PERIODS.weekly);
  }

  @LeaderboardsDocs.GetMonthly()
  @RateLimit(...LEADERBOARDS_RATE_LIMIT_RULES.read)
  @Get('monthly')
  @HttpCode(HttpStatus.OK)
  getMonthly() {
    return this.leaderboardsService.getLeaderboard(LEADERBOARD_PERIODS.monthly);
  }
}
