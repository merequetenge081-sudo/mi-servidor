import { jest } from '@jest/globals';

const findOne = jest.fn();

jest.unstable_mockModule('../../src/models/Leader.js', () => ({
  Leader: { findOne }
}));

const { RegistrationService } = await import('../../src/backend/modules/registrations/registration.service.js');

describe('RegistrationService leader lookup', () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it('looks up leader by _id when leaderId is ObjectId', async () => {
    const lean = jest.fn().mockResolvedValue({ name: 'Leader' });
    findOne.mockReturnValue({ lean });

    const service = new RegistrationService();
    await service._findLeader('507f1f77bcf86cd799439011', null);

    expect(findOne).toHaveBeenCalledWith({
      $or: [
        { leaderId: '507f1f77bcf86cd799439011' },
        { _id: '507f1f77bcf86cd799439011' }
      ]
    });
    expect(lean).toHaveBeenCalled();
  });
});
