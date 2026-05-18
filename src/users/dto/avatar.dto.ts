import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { USER_AVATAR } from '../users.constants';
import type { UserAvatarContentType } from '../users.constants';

export class CreateAvatarUploadUrlDto {
  @ApiProperty({
    example: 'image/webp',
    enum: USER_AVATAR.allowedContentTypes,
  })
  @IsIn(USER_AVATAR.allowedContentTypes)
  contentType: UserAvatarContentType;

  @ApiProperty({
    example: 5242880,
    minimum: 1,
    maximum: USER_AVATAR.maxBytes,
  })
  @IsInt()
  @Min(1)
  @Max(USER_AVATAR.maxBytes)
  contentLength: number;
}
