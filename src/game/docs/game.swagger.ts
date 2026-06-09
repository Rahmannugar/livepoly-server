import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GameResultResponseDto } from './game-response.dto';

export const GameDocs = {
  Controller: () => applyDecorators(ApiTags('Game')),

  GetGameResult: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Get game result',
        description:
          'Returns the finalized result for a game the authenticated user played in or spectated. Returns null while finalization is still settling.',
      }),
      ApiParam({
        name: 'gameId',
        example: '2d53f23e-7c6e-4d8a-a9d8-0f429dbd3734',
      }),
      ApiOkResponse({ type: GameResultResponseDto }),
      ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Authenticated user cannot access this game result',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
