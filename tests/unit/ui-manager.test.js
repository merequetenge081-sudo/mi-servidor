/** @jest-environment jsdom */
import { UIManager } from '../../public/js/leader/ui.js';

describe('UIManager helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="helpDrawer"></div>
      <div id="helpOverlay"></div>
    `;
    localStorage.clear();
  });

  it('toggles help drawer and overlay', () => {
    UIManager.toggleHelpDrawer();
    expect(document.getElementById('helpDrawer').classList.contains('active')).toBe(true);
    expect(document.getElementById('helpOverlay').classList.contains('active')).toBe(true);

    UIManager.toggleHelpDrawer();
    expect(document.getElementById('helpDrawer').classList.contains('active')).toBe(false);
    expect(document.getElementById('helpOverlay').classList.contains('active')).toBe(false);
  });

  it('stores dark mode preference', () => {
    UIManager.toggleDarkMode();
    expect(localStorage.getItem('darkMode')).toBe('enabled');
  });
});
