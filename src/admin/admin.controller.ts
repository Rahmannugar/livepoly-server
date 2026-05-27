import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ApiUpdateUserStatus } from './docs/admin.swagger';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiUpdateUserStatus()
  @Patch('users/:username/status')
  updateUserStatus(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('username') username: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(authUser, username, dto.status);
  }
}
