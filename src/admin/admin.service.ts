import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser, UserStatus } from '../auth/types/auth-user.type';
import { DatabaseService } from '../infra/database/database.service';
import { ObservabilityService } from '../infra/observability/observability.service';
import { SessionCacheService } from '../session/session-cache.service';
import { CacheService } from '../infra/cache/cache.service';
import { USER_SEARCH } from '../users/users.constants';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly databaseService: DatabaseService,
    private readonly sessionCacheService: SessionCacheService,
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async updateUserStatus(
    adminUser: AuthUser,
    username: string,
    status: UserStatus,
  ) {
    const normalizedUsername = username.trim().toLowerCase();

    const { targetUser, revokedSessions } =
      await this.databaseService.transaction(async (tx) => {
        const existingUser = await this.adminRepository.findUserByUsername(
          normalizedUsername,
          tx,
        );

        if (!existingUser) {
          return {
            targetUser: null,
            revokedSessions: [],
          };
        }

        if (existingUser.id === adminUser.id) {
          throw new BadRequestException('Admin cannot update their own status');
        }

        const targetUser = await this.adminRepository.updateUserStatus(
          existingUser.id,
          status,
          tx,
        );

        const revokedSessions =
          status === 'suspended'
            ? await this.adminRepository.revokeUserSessions(existingUser.id, tx)
            : [];

        return {
          targetUser,
          revokedSessions,
        };
      });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await Promise.all(
      revokedSessions.map((session) =>
        this.sessionCacheService.deleteSession(session.refreshTokenHash),
      ),
    );

    this.observabilityService.recordSecurityEvent('AdminUserStatusUpdated', {
      adminUserId: adminUser.id,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      status: targetUser.status,
      revokedSessionCount: revokedSessions.length,
    });

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        role: targetUser.role,
        status: targetUser.status,
      },
    };
  }

  async restoreDeletedUser(adminUser: AuthUser, username: string) {
    const normalizedUsername = username.trim().toLowerCase();

    const targetUser = await this.databaseService.transaction(async (tx) => {
      const deletedUser = await this.adminRepository.findDeletedUserByUsername(
        normalizedUsername,
        tx,
      );

      if (!deletedUser) {
        return null;
      }

      if (deletedUser.id === adminUser.id) {
        throw new BadRequestException('Admin cannot restore their own account');
      }

      return this.adminRepository.restoreDeletedUser(deletedUser.id, tx);
    });

    if (!targetUser) {
      throw new NotFoundException('Deleted user not found');
    }

    await this.cacheService.getClient().incr(USER_SEARCH.cacheVersionKey);

    this.observabilityService.recordSecurityEvent('AdminDeletedUserRestored', {
      adminUserId: adminUser.id,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    });

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        role: targetUser.role,
        status: targetUser.status,
      },
    };
  }
}
