import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { OtpService } from './otp.service';

@Module({
  imports: [CacheModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
