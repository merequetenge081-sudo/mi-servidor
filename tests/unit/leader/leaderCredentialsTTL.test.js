/**
 * Unit Tests: LeaderService temp password TTL
 */

import { jest } from '@jest/globals';

const mockFindById = jest.fn();
const mockUpdateOne = jest.fn();
const mockDecrypt = jest.fn();

jest.unstable_mockModule('../../../src/models/Leader.js', () => ({
  Leader: {
    findById: mockFindById,
    updateOne: mockUpdateOne
  }
}));

jest.unstable_mockModule('../../../src/backend/modules/leaders/leader.repository.js', () => ({
  default: {}
}));

jest.unstable_mockModule('../../../src/utils/crypto.js', () => ({
  decrypt: mockDecrypt,
  encrypt: jest.fn()
}));

jest.unstable_mockModule('../../../src/services/emailService.js', () => ({
  emailService: {}
}));

const { LeaderService } = await import('../../../src/backend/modules/leaders/leader.service.js');

const service = new LeaderService();

describe('LeaderService - temp password TTL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.TEMP_PASSWORD_TTL_HOURS;
  });

  it('should expire temp password after TTL and clear stored value', async () => {
    process.env.TEMP_PASSWORD_TTL_HOURS = '1';
    const leader = {
      _id: 'leader-1',
      username: 'user1',
      isTemporaryPassword: true,
      tempPasswordPlaintext: 'encrypted',
      tempPasswordCreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    };

    mockFindById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce(leader)
    });
    mockUpdateOne.mockResolvedValueOnce({});

    const result = await service.getLeaderCredentials('leader-1');

    expect(mockUpdateOne).toHaveBeenCalled();
    expect(result.hasCredentials).toBe(true);
    expect(result.passwordFixed).toBe(false);
    expect(result.tempPassword).toBe('No disponible');
  });

  it('should return temp password when within TTL', async () => {
    process.env.TEMP_PASSWORD_TTL_HOURS = '24';
    const leader = {
      _id: 'leader-2',
      username: 'user2',
      isTemporaryPassword: true,
      tempPasswordPlaintext: 'encrypted',
      tempPasswordCreatedAt: new Date()
    };

    mockFindById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce(leader)
    });
    mockDecrypt.mockReturnValueOnce('Temp1234');

    const result = await service.getLeaderCredentials('leader-2');

    expect(mockDecrypt).toHaveBeenCalledWith('encrypted');
    expect(result.tempPassword).toBe('Temp1234');
    expect(result.passwordFixed).toBe(false);
  });
});
