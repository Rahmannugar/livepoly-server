import { ApiProperty } from '@nestjs/swagger';

class ResponseMetaDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0' })
  requestId: string;
}

export class AuthUserResponseDto {
  @ApiProperty({ example: '25fc577e-a4a9-4b22-b113-a0efacdc6470' })
  id: string;

  @ApiProperty({ example: 'player@example.com' })
  email: string;

  @ApiProperty({ example: 'rahmannugar' })
  username: string;
}

export class AuthTokenDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class MessageDataDto {
  @ApiProperty({ example: 'Verification code sent' })
  message: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AuthTokenDataDto })
  data: AuthTokenDataDto;

  @ApiProperty({ type: ResponseMetaDto })
  meta: ResponseMetaDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: MessageDataDto })
  data: MessageDataDto;

  @ApiProperty({ type: ResponseMetaDto })
  meta: ResponseMetaDto;
}
