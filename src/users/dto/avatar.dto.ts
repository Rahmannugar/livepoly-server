import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
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

export class ConfirmAvatarUploadDto {
  @ApiProperty({
    example:
      'avatars/7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp',
  })
  @IsString()
  objectKey: string;
}
