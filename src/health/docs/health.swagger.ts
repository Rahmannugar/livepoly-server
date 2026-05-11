import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  LiveHealthResponseDto,
  ReadyHealthResponseDto,
} from './health-response.dto';

export const HealthDocs = {
  Controller: () => applyDecorators(ApiTags('Health')),

  Live: () =>
    applyDecorators(
      ApiOperation({ summary: 'Check server liveness' }),
      ApiOkResponse({
        description: 'Server process is alive',
        type: LiveHealthResponseDto,
      }),
    ),

  Ready: () =>
    applyDecorators(
      ApiOperation({ summary: 'Check app and database readiness' }),
      ApiOkResponse({
        description: 'App and database are ready',
        type: ReadyHealthResponseDto,
      }),
      ApiServiceUnavailableResponse({
        description: 'Service is not ready',
      }),
    ),
};
