/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const apiCall = jest.fn();
const showSuccessModal = jest.fn();

jest.unstable_mockModule('../../public/js/leader/auth.js', () => ({
  AuthManager: { apiCall }
}));

jest.unstable_mockModule('../../public/js/leader/modals.js', () => ({
  ModalsManager: { showSuccessModal }
}));

const { FormManager } = await import('../../public/js/leader/forms.js');

describe('Leader panel registration form', () => {
  beforeEach(() => {
    global.alert = jest.fn();
    document.body.innerHTML = `
      <input id="firstName" value="Ana" />
      <input id="lastName" value="Lopez" />
      <input id="cedula" value="123" />
      <input id="email" value="ana@example.com" />
      <input id="phone" value="3000000000" />
      <input type="radio" name="ubicacionTipo" value="bogota" checked />
      <div id="bogotaContainer"></div>
      <div id="restoContainer"></div>
      <select id="localidad"><option value="Usaquen" selected>Usaquen</option></select>
      <select id="departamento"><option value="" selected></option></select>
      <div id="puestoCatalogo"></div>
      <div id="puestoManual"></div>
      <input id="puestoBusquedaLeader" value="" />
      <select id="localidad"><option value="Usaquen" selected>Usaquen</option></select>
      <input id="puestoId" value="507f1f77bcf86cd799439011" />
      <input id="votingTable" value="12" />
      <input id="votingPlace" value="" />
      <div id="capitalContainer"></div>
      <input id="capital" value="" />
      <input type="checkbox" id="hasConsentToRegisterLeader" checked />
      <div id="consentErrorLeader" style="display:none"></div>
    `;

    apiCall.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  it('posts registration using leaderData leaderId', async () => {
    await FormManager.saveNewRegistration('fallback-id', {
      leaderId: 'L001',
      eventId: 'EVT01'
    });

    expect(apiCall).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiCall.mock.calls[0];
    expect(endpoint).toBe('/api/registrations');
    const payload = JSON.parse(options.body);
    expect(payload.leaderId).toBe('L001');
    expect(payload.eventId).toBe('EVT01');
    expect(payload.firstName).toBe('Ana');
    expect(payload.hasConsentToRegister).toBe(true);
  });

  it('blocks submit when consent is not checked', async () => {
    document.getElementById('hasConsentToRegisterLeader').checked = false;
    await FormManager.saveNewRegistration('L001', { leaderId: 'L001' });

    expect(apiCall).not.toHaveBeenCalled();
    expect(document.getElementById('consentErrorLeader').style.display).toBe('block');
  });
});
