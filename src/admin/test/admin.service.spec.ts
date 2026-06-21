import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { CacheService } from '../../infra/cache/cache.service';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { SessionCacheService } from '../../session/session-cache.service';
import { USER_SEARCH } from '../../users/users.constants';
import type { AdminRepository } from '../admin.repository';
import { AdminService } from '../admin.service';

const adminUser: AuthUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  username: 'admin',
  role: 'admin',
  status: 'active',
  sessionId: 'session-1',
  tokenVersion: 0,
};

describe('AdminService', () => {
  const tx = { tx: true };
  let service: AdminService;
  let adminRepository: {
    findDeletedUserByUsername: jest.Mock;
    restoreDeletedUser: jest.Mock;
  };
  let cacheIncr: jest.Mock;
  let recordSecurityEvent: jest.Mock;

  beforeEach(() => {
    adminRepository = {
      findDeletedUserByUsername: jest.fn(),
      restoreDeletedUser: jest.fn(),
    };
    cacheIncr = jest.fn().mockResolvedValue(2);
    recordSecurityEvent = jest.fn();

    const databaseService = {
      transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const cacheService = {
      getClient: jest.fn().mockReturnValue({ incr: cacheIncr }),
    };
    const observabilityService = { recordSecurityEvent };

    service = new AdminService(
      adminRepository as unknown as AdminRepository,
      databaseService as unknown as DatabaseService,
      {} as SessionCacheService,
      cacheService as unknown as CacheService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('restores a deleted user and invalidates user search', async () => {
    adminRepository.findDeletedUserByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'playerone',
    });
    adminRepository.restoreDeletedUser.mockResolvedValue({
      id: 'user-1',
      email: 'player@example.com',
      username: 'playerone',
      role: 'player',
      status: 'active',
      tokenVersion: 2,
    });

    await expect(
      service.restoreDeletedUser(adminUser, ' PlayerOne '),
    ).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'player@example.com',
        username: 'playerone',
        role: 'player',
        status: 'active',
      },
    });

    expect(adminRepository.findDeletedUserByUsername).toHaveBeenCalledWith(
      'playerone',
      tx,
    );
    expect(adminRepository.restoreDeletedUser).toHaveBeenCalledWith(
      'user-1',
      tx,
    );
    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      'AdminDeletedUserRestored',
      expect.objectContaining({
        adminUserId: adminUser.id,
        targetUserId: 'user-1',
      }),
    );
  });

  it('rejects restoration when the deleted user does not exist', async () => {
    adminRepository.findDeletedUserByUsername.mockResolvedValue(null);

    await expect(
      service.restoreDeletedUser(adminUser, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(adminRepository.restoreDeletedUser).not.toHaveBeenCalled();
  });

  it('prevents an admin from restoring their own deleted identity', async () => {
    adminRepository.findDeletedUserByUsername.mockResolvedValue({
      id: adminUser.id,
      username: adminUser.username,
    });

    await expect(
      service.restoreDeletedUser(adminUser, adminUser.username),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
