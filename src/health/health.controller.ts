import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infra/database/database.service';
import { HealthDocs } from './docs/health.swagger';

@HealthDocs.Controller()
@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @HealthDocs.Live()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  getHealth() {
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
    try {
      await this.databaseService.ping();

      return {
        status: 'ok',
        service: 'livepoly-server',
        checks: {
          app: 'ok',
          database: 'ok',
        },
        checkedAt: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Service is not ready');
    }
  }
}
