import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LeaderboardResponseDto } from './leaderboards-response.dto';

export const LeaderboardsDocs = {
  Controller: () => applyDecorators(ApiTags('Leaderboards')),

  GetWeekly: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Get weekly leaderboard' }),
      ApiOkResponse({ type: LeaderboardResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  GetMonthly: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Get monthly leaderboard' }),
      ApiOkResponse({ type: LeaderboardResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
