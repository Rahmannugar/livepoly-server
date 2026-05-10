import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infra/database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('live')
  getHealth() {
    return {
      status: 'ok',
      service: 'livepoly-server',
      checkedAt: new Date().toISOString(),
    };
  }

  @Get('ready')
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
