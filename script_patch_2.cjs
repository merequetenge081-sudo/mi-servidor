const fs = require('fs');
let content = fs.readFileSync('public/js/core/events.js', 'utf8');

const replacement = \// Impersonate button
              const impersonateBtn = target.closest('.impersonate-btn');
              if (impersonateBtn) {
                  if (typeof closeAllActionMenus === 'function') closeAllActionMenus();
                  const leaderId = impersonateBtn.dataset.leaderId;
                  const leaderName = impersonateBtn.dataset.leaderName || 'el líder';

                  // Create modal overlay
                  const overlay = document.createElement('div');
                  overlay.style.position = 'fixed';
                  overlay.style.top = '0';
                  overlay.style.left = '0';
                  overlay.style.width = '100vw';
                  overlay.style.height = '100vh';
                  overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
                  overlay.style.display = 'flex';
                  overlay.style.justifyContent = 'center';
                  overlay.style.alignItems = 'center';
                  overlay.style.zIndex = '99999';

                  const modalBox = document.createElement('div');
                  modalBox.style.background = 'var(--surface)';
                  modalBox.style.padding = '30px';
                  modalBox.style.borderRadius = '12px';
                  modalBox.style.width = '400px';
                  modalBox.style.maxWidth = '90%';
                  modalBox.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                  modalBox.style.textAlign = 'center';

                  modalBox.innerHTML = \\\
                      <h3 style="color:var(--text-primary); margin-bottom: 10px;">Ingresar como \\\</h3>
                      <p style="color:var(--text-secondary); font-size: 0.9em; margin-bottom: 20px;">Por seguridad, ingresa tu <b>contraseña de administrador</b> para continuar.</p>
                      <input type="password" id="adminPassForImpersonate" placeholder="Contraseña de Admin" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-hover); color: var(--text-primary);" />
                      <div style="display: flex; gap: 10px; justify-content: flex-end;">
                          <button id="cancelImpersonate" style="padding: 10px 15px; border-radius: 6px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer;">Cancelar</button>
                          <button id="confirmImpersonate" style="padding: 10px 20px; border-radius: 6px; border: none; background: var(--primary); color: white; cursor: pointer; font-weight: bold;">Ingresar</button>
                      </div>
                  \\\;

                  overlay.appendChild(modalBox);
                  document.body.appendChild(overlay);

                  // Focus input
                  const passInput = document.getElementById('adminPassForImpersonate');
                  passInput.focus();

                  // Handlers
                  const closeModal = () => {
                      if (document.body.contains(overlay)) {
                          document.body.removeChild(overlay);
                      }
                  };

                  document.getElementById('cancelImpersonate').addEventListener('click', closeModal);
                  
                  passInput.addEventListener('keydown', (ke) => {
                      if (ke.key === 'Enter') {
                          document.getElementById('confirmImpersonate').click();
                      }
                      if (ke.key === 'Escape') {
                          closeModal();
                      }
                  });

                  document.getElementById('confirmImpersonate').addEventListener('click', async () => {
                      const adminPassword = passInput.value;
                      if (!adminPassword) {
                          if (typeof Helpers !== 'undefined') Helpers.showAlert('La contraseña es obligatoria', 'error');
                          return;
                      }

                      const btn = document.getElementById('confirmImpersonate');
                      btn.textContent = 'Verificando...';
                      btn.disabled = true;

                      try {
                          const token = localStorage.getItem('token');
                          const response = await fetch('/api/v2/auth/impersonate', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': \\\Bearer \\\\\\
                              },
                              body: JSON.stringify({
                                  leaderId: leaderId,
                                  adminPassword: adminPassword
                              })
                          });

                          const data = await response.json();

                          if (!response.ok) {
                              throw new Error(data.message || 'Error de autenticación');
                          }

                          closeModal();
                          if (typeof Helpers !== 'undefined') Helpers.showAlert('Acceso concedido. Redirigiendo...', 'success');
                          
                          localStorage.setItem('admin_token', token);
                          localStorage.setItem('token', data.data.token);
                          localStorage.setItem('user', JSON.stringify(data.data.user));

                          setTimeout(() => {
                              window.location.href = '/leader.html';
                          }, 1000);

                      } catch (err) {
                          console.error('Impersonation error:', err);
                          if (typeof Helpers !== 'undefined') Helpers.showAlert(err.message || 'Error al intentar acceder', 'error');
                          btn.textContent = 'Ingresar';
                          btn.disabled = false;
                      }
                  });

                  return;
              }

              // Leader QR button\;

if (content.includes('// Leader QR button')) {
    content = content.replace('// Leader QR button', replacement);
    fs.writeFileSync('public/js/core/events.js', content, 'utf8');
    console.log('Successfully patched events.js');
} else {
    console.log('Could not find anchor');
}
