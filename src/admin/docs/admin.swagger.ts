import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

export function ApiUpdateUserStatus() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update user status',
      description:
        'Allows an admin to suspend or restore a user account. Suspended users cannot use authenticated app flows.',
    }),
    ApiParam({
      name: 'username',
      example: 'playerone',
      description: 'Username of the target user.',
    }),
    ApiBody({ type: UpdateUserStatusDto }),
    ApiOkResponse({
      description: 'User status updated.',
      schema: {
        example: {
          success: true,
          data: {
            user: {
              id: '25fc577e-a4a9-4b22-b113-a0efacdc6470',
              email: 'player@example.com',
              username: 'playerone',
              role: 'player',
              status: 'suspended',
            },
          },
          meta: {
            statusCode: HttpStatus.OK,
            requestId: 'b0a45b42-6cd4-4c33-a8b4-f969cba8aed0',
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Authentication required.',
    }),
    ApiForbiddenResponse({
      description: 'Admin access required.',
    }),
    ApiNotFoundResponse({
      description: 'User not found.',
    }),
    ApiUnprocessableEntityResponse({
      description: 'Invalid status payload.',
    }),
  );
}
