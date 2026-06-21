import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';
import { DatabaseService } from '../infra/database/database.service';
import { ObservabilityService } from '../infra/observability/observability.service';
import { HealthDocs } from './docs/health.swagger';

@HealthDocs.Controller()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly databaseService: DatabaseService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  @HealthDocs.Live()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  getHealth() {
    this.observabilityService.recordMetric('Custom/Health/Live/Success');

    return {
      status: 'ok',
      service: 'livepoly-server',
      checkedAt: new Date().toISOString(),
    };
  }

  @HealthDocs.Ready()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async getReadiness() {
    const startedAt = Date.now();

    try {
      await Promise.all([
        this.databaseService.ping(),
        this.cacheService.ping(),
      ]);

      this.observabilityService.recordMetric('Custom/Health/Ready/Success');
      this.observabilityService.recordDurationMetric(
        'Custom/Health/Ready/Duration',
        Date.now() - startedAt,
      );

      return {
        status: 'ok',
        service: 'livepoly-server',
        checks: {
          app: 'ok',
          database: 'ok',
          redis: 'ok',
        },
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.observabilityService.recordMetric('Custom/Health/Ready/Failure');
      this.observabilityService.recordDurationMetric(
        'Custom/Health/Ready/Duration',
        Date.now() - startedAt,
      );
      this.logger.warn({
        message: 'health.ready.failed',
        errorName: error instanceof Error ? error.name : undefined,
      });
      throw new ServiceUnavailableException('Service is not ready');
    }
  }
}
