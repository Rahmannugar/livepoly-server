import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: ['active', 'suspended'],
    example: 'suspended',
  })
  @IsIn(['active', 'suspended'])
  status: 'active' | 'suspended';
}
