import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

const responseMetaSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 200 },
    requestId: {
      type: 'string',
      example: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
    },
  },
  required: ['statusCode', 'requestId'],
};

const liveHealthResponseSchema = {
  schema: {
    example: {
      success: true,
      data: {
        status: 'ok',
        service: 'livepoly-server',
        checkedAt: '2026-05-11T10:15:30.000Z',
      },
      meta: {
        statusCode: 200,
        requestId: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
      },
    },
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'livepoly-server' },
          checkedAt: {
            type: 'string',
            example: '2026-05-11T10:15:30.000Z',
          },
        },
        required: ['status', 'service', 'checkedAt'],
      },
      meta: responseMetaSchema,
    },
    required: ['success', 'data', 'meta'],
  },
};

const readyHealthResponseSchema = {
  schema: {
    example: {
      success: true,
      data: {
        status: 'ok',
        service: 'livepoly-server',
        checkedAt: '2026-05-11T10:15:30.000Z',
        checks: {
          app: 'ok',
          database: 'ok',
        },
      },
      meta: {
        statusCode: 200,
        requestId: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
      },
    },
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'livepoly-server' },
          checkedAt: {
            type: 'string',
            example: '2026-05-11T10:15:30.000Z',
          },
          checks: {
            type: 'object',
            properties: {
              app: { type: 'string', example: 'ok' },
              database: { type: 'string', example: 'ok' },
            },
            required: ['app', 'database'],
          },
        },
        required: ['status', 'service', 'checkedAt', 'checks'],
      },
      meta: responseMetaSchema,
    },
    required: ['success', 'data', 'meta'],
  },
};

export const HealthDocs = {
  Controller: () => applyDecorators(ApiTags('Health')),

  Live: () =>
    applyDecorators(
      ApiOperation({ summary: 'Check server liveness' }),
      ApiOkResponse({
        description: 'Server process is alive',
        ...liveHealthResponseSchema,
      }),
    ),

  Ready: () =>
    applyDecorators(
      ApiOperation({ summary: 'Check app and database readiness' }),
      ApiOkResponse({
        description: 'App and database are ready',
        ...readyHealthResponseSchema,
      }),
      ApiServiceUnavailableResponse({
        description: 'Service is not ready',
        ...readyHealthResponseSchema,
      }),
    ),
};
