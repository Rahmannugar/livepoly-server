import { ApiProperty } from '@nestjs/swagger';

class HealthMetaDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0' })
  requestId: string;
}

class LiveHealthDataDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'livepoly-server' })
  service: string;

  @ApiProperty({ example: '2026-05-11T10:15:30.000Z' })
  checkedAt: string;
}

class ReadyChecksDto {
  @ApiProperty({ example: 'ok' })
  app: string;

  @ApiProperty({ example: 'ok' })
  database: string;
}

class ReadyHealthDataDto extends LiveHealthDataDto {
  @ApiProperty({ type: ReadyChecksDto })
  checks: ReadyChecksDto;
}

export class LiveHealthResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: LiveHealthDataDto })
  data: LiveHealthDataDto;

  @ApiProperty({ type: HealthMetaDto })
  meta: HealthMetaDto;
}

export class ReadyHealthResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ReadyHealthDataDto })
  data: ReadyHealthDataDto;

  @ApiProperty({ type: HealthMetaDto })
  meta: HealthMetaDto;
}
