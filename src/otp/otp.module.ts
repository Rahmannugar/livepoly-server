import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { OtpService } from './otp.service';

@Module({
  imports: [CacheModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
