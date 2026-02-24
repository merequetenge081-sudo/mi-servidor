/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const apiCall = jest.fn();

jest.unstable_mockModule('../../public/js/leader/auth.js', () => ({
  AuthManager: { apiCall }
}));

const { LeaderManager } = await import('../../public/js/leader/leader.js');

describe('Leader panel name display', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="leaderNameWelcome"></span>
      <input id="registrationLink" value="" />
    `;
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sets leader name from wrapped response and stores leaderId', async () => {
    apiCall.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { name: 'Carlos Perez', leaderId: 'L100', token: 'tok-1' }
      })
    });

    await LeaderManager.loadLeaderData('L100');

    expect(document.getElementById('leaderNameWelcome').textContent).toBe('Carlos');
    expect(document.getElementById('registrationLink').value).toContain('token=tok-1');
    expect(localStorage.getItem('leaderId')).toBe('L100');
  });
});
