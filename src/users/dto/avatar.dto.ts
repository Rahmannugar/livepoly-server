import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export const ALLOWED_AVATAR_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateAvatarUploadUrlDto {
  @ApiProperty({ example: 'image/webp', enum: ALLOWED_AVATAR_CONTENT_TYPES })
  @IsIn(ALLOWED_AVATAR_CONTENT_TYPES)
  contentType: (typeof ALLOWED_AVATAR_CONTENT_TYPES)[number];

  @ApiProperty({ example: 5242880, minimum: 1, maximum: 10485760 })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  contentLength: number;
}

export class ConfirmAvatarUploadDto {
  @ApiProperty({ example: 'avatars/user-id/avatar-uuid.webp' })
  @IsString()
  objectKey: string;
}
