import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { GameDocs } from './docs/game.swagger';
import { GAME_RATE_LIMIT_RULES } from './game-rate-limit.rules';
import { GameResultsService } from './results/game-results.service';

@GameDocs.Controller()
@UseGuards(AuthGuard, RateLimitGuard)
@Controller('games')
export class GameController {
  constructor(private readonly gameResultsService: GameResultsService) {}

  @GameDocs.GetGameResult()
  @RateLimit(...GAME_RATE_LIMIT_RULES.read)
  @Get(':gameId/result')
  @HttpCode(HttpStatus.OK)
  getGameResult(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('gameId') gameId: string,
  ) {
    return this.gameResultsService.getGameResultForUser({
      gameId,
      userId: authUser.id,
    });
  }
}
