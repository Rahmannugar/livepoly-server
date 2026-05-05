import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'livepoly-server',
      checkedAt: new Date().toISOString(),
    };
  }

  @Get('ready')
  getReadiness() {
    return {
      status: 'ok',
      service: 'livepoly-server',
      checks: {
        app: 'ok',
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
