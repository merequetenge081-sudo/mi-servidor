\ = Get-Content public\js\core\events.js -Raw

\ = @"
              // Impersonate Leader button
              const impersonateBtn = target.closest('.impersonate-btn');
              if (impersonateBtn) {
                  closeAllActionMenus();
                  const leaderId = impersonateBtn.dataset.leaderId;
                  
                  // Helper function inside to prompt for password cleanly
                  const promptPassword = () => {
                      return new Promise((resolve) => {
                          const overlay = document.createElement('div');
                          overlay.style.position = 'fixed';
                          overlay.style.top = '0'; overlay.style.left = '0';
                          overlay.style.width = '100vw'; overlay.style.height = '100vh';
                          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                          overlay.style.display = 'flex';
                          overlay.style.justifyContent = 'center';
                          overlay.style.alignItems = 'center';
                          overlay.style.zIndex = '999999';
                          
                          const modal = document.createElement('div');
                          modal.style.background = document.body.classList.contains('dark-mode') ? '#1f2937' : '#fff';
                          modal.style.padding = '24px';
                          modal.style.borderRadius = '8px';
                          modal.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                          modal.style.minWidth = '320px';
                          
                          const title = document.createElement('h3');
                          title.style.margin = '0 0 16px 0';
                          title.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#111827';
                          title.innerText = 'Ingresar al perfil del líder';
                          title.style.fontSize = '18px';
                          
                          const desc = document.createElement('p');
                          desc.style.margin = '0 0 16px 0';
                          desc.style.color = document.body.classList.contains('dark-mode') ? '#9ca3af' : '#4b5563';
                          desc.style.fontSize = '14px';
                          desc.innerText = 'Por la seguridad de la cuenta, ingresa tu contraseña de administrador:';
                          
                          const input = document.createElement('input');
                          input.type = 'password';
                          input.style.width = '100%';
                          input.style.padding = '10px';
                          input.style.marginBottom = '20px';
                          input.style.border = '1px solid #d1d5db';
                          if (document.body.classList.contains('dark-mode')) {
                              input.style.border = '1px solid #4b5563';
                          }
                          input.style.borderRadius = '6px';
                          input.style.boxSizing = 'border-box';
                          input.style.background = document.body.classList.contains('dark-mode') ? '#374151' : '#f9fafb';
                          input.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#000';
                          input.style.outline = 'none';
                          
                          const btnContainer = document.createElement('div');
                          btnContainer.style.display = 'flex';
                          btnContainer.style.justifyContent = 'flex-end';
                          btnContainer.style.gap = '12px';
                          
                          const cancelBtn = document.createElement('button');
                          cancelBtn.innerText = 'Cancelar';
                          cancelBtn.style.padding = '8px 16px';
                          cancelBtn.style.border = 'none';
                          cancelBtn.style.background = 'transparent';
                          cancelBtn.style.color = document.body.classList.contains('dark-mode') ? '#fbbf24' : '#d97706';
                          cancelBtn.style.cursor = 'pointer';
                          cancelBtn.style.fontWeight = '600';
                          cancelBtn.style.borderRadius = '6px';
                          
                          const submitBtn = document.createElement('button');
                          submitBtn.innerText = 'Ingresar';
                          submitBtn.style.padding = '8px 16px';
                          submitBtn.style.border = 'none';
                          submitBtn.style.background = '#10b981';
                          submitBtn.style.color = '#fff';
                          submitBtn.style.borderRadius = '6px';
                          submitBtn.style.cursor = 'pointer';
                          submitBtn.style.fontWeight = '600';
                          
                          btnContainer.appendChild(cancelBtn);
                          btnContainer.appendChild(submitBtn);
                          
                          modal.appendChild(title);
                          modal.appendChild(desc);
                          modal.appendChild(input);
                          modal.appendChild(btnContainer);
                          overlay.appendChild(modal);
                          document.body.appendChild(overlay);
                          
                          input.focus();
                          
                          const cleanup = () => {
                              if(document.body.contains(overlay)) {
                                  document.body.removeChild(overlay);
                              }
                          };
                          
                          cancelBtn.onclick = () => { cleanup(); resolve(null); };
                          submitBtn.onclick = () => { cleanup(); resolve(input.value); };
                          input.onkeydown = (e) => {
                              if (e.key === 'Enter') { cleanup(); resolve(input.value); }
                              if (e.key === 'Escape') { cleanup(); resolve(null); }
                          };
                      });
                  };
                  
                  promptPassword().then(async (adminPassword) => {
                      if (!adminPassword) return; // User cancelled
                      try {
                          // Show minimal loading state
                          const prevText = impersonateBtn.innerHTML;
                          impersonateBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
                          
                          const response = await fetch('/api/v2/auth/impersonate', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ' + localStorage.getItem('token')
                              },
                              body: JSON.stringify({ adminPassword, leaderId })
                          });
                          
                          const data = await response.json();
                          if (!response.ok) {
                              impersonateBtn.innerHTML = prevText;
                              const errMsg = data.error || 'Error de autenticación.';
                              if (window.ModalsModule && ModalsModule.showAlert) {
                                  ModalsModule.showAlert(errMsg, 'error');
                              } else {
                                  alert(errMsg);
                              }
                              return;
                          }
                          
                          // Success - switch tokens and redirect
                          localStorage.setItem('token', data.token);
                          localStorage.setItem('role', 'leader');
                          localStorage.setItem('userId', leaderId);
                          localStorage.setItem('impersonated', 'true');
                          if (data.data && data.data.name) {
                              localStorage.setItem('leaderName', data.data.name);
                          }
                          window.location.href = '/leader.html';
                      } catch (error) {
                          impersonateBtn.innerHTML = prevText;
                          if (window.ModalsModule && ModalsModule.showAlert) {
                              ModalsModule.showAlert('Error de red: ' + error.message, 'error');
                          } else {
                              alert('Error de red: ' + error.message);
                          }
                      }
                  });
              }

              // Leader QR button
              const qrBtn = target.closest('.qr-btn');
