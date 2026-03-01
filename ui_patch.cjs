const fs = require('fs');
let code = fs.readFileSync('public/js/core/events.js', 'utf8');

const oldBlock =                   // Create modal overlay
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

                  overlay.appendChild(modalBox);;

const newBlock =                   // Create modal overlay with nice UI
                  const overlay = document.createElement('div');
                  overlay.className = 'modal-overlay active';
                  overlay.style.zIndex = '99999';
                  overlay.style.display = 'flex';
                  overlay.style.alignItems = 'center';
                  overlay.style.justifyContent = 'center';
                  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
                  overlay.style.backdropFilter = 'blur(4px)';

                  const modalBox = document.createElement('div');
                  modalBox.className = 'modal-card';
                  modalBox.style.maxWidth = '400px';
                  modalBox.style.width = '90%';
                  modalBox.style.padding = '0';
                  modalBox.style.overflow = 'hidden';
                  modalBox.style.animation = 'modalSlideIn 0.3s ease';

                  modalBox.innerHTML = \\\
                      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding: 20px; display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                          <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center;">
                                  <i class="bi bi-shield-lock"></i>
                              </div>
                              Ingresar al Perfil
                          </h3>
                          <button id="closeImpersonateX" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; padding: 5px;"><i class="bi bi-x-lg"></i></button>
                      </div>
                      <div class="modal-body" style="padding: 24px; background: var(--surface);">
                          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.95rem; line-height: 1.5;">
                              Por seguridad, ingresa tu <strong>contraseña de administrador</strong> para asumir la sesión de <strong style="color: var(--text-primary)">\\\</strong>.
                          </p>
                          <div class="form-group" style="margin-bottom: 0;">
                              <input type="password" id="adminPassForImpersonate" class="form-control" placeholder="••••••••" style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-hover); color: var(--text-primary); transition: border-color 0.3s ease;" autocomplete="off" autofocus />
                          </div>
                      </div>
                      <div class="modal-footer" style="border-top: 1px solid var(--border); padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; background: var(--surface);">
                          <button id="cancelImpersonate" class="btn" style="background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-weight: 500;">Cancelar</button>
                          <button id="confirmImpersonate" class="btn btn-primary" style="background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: opacity 0.2s ease;">
                              <i class="bi bi-box-arrow-in-right"></i> Acceder
                          </button>
                      </div>
                  \\\;

                  overlay.appendChild(modalBox);;

let normalizedCode = code.replace(/\\r\\n/g, '\\n');
let normalizedOld = oldBlock.replace(/\\r\\n/g, '\\n');
if(normalizedCode.includes(normalizedOld)) {
    code = normalizedCode.replace(normalizedOld, newBlock.replace(/\\r\\n/g, '\\n'));
    fs.writeFileSync('public/js/core/events.js', code);
    console.log('Frontend event replaced');
} else {
    console.error('Could not find frontend code block!');
}
