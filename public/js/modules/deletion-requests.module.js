
let deletionRequests = [];
window.deletionRequests = deletionRequests;

async function loadDeletionRequests() {
    try {
        const response = await fetch(`${API_URL}/api/deletion-requests`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (!response.ok) throw new Error('Error al cargar solicitudes');

        const data = await response.json();
        deletionRequests = data.requests || [];
        window.deletionRequests = deletionRequests;
        renderDeletionRequests();
        
        // Cargar estadísticas de archivos
        await loadArchivedStats();
        
        // Actualizar badge de notificaciones
        updateNotificationsBadge();
    } catch (error) {
        console.error('Error loading deletion requests:', error);
        const container = document.getElementById('deletionRequestsContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="bi bi-exclamation-triangle" style="font-size: 48px; color: var(--danger);"></i>
                    <p style="color: var(--text-muted); margin-top: 16px;">Error al cargar solicitudes</p>
                </div>
            `;
        }
    }
}

async function loadArchivedStats() {
    try {
        const response = await fetch(`${API_URL}/api/archived-registrations/stats`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            const countElement = document.getElementById('archivedCount');
            const personsElement = document.getElementById('archivedPersons');
            
            if (countElement) countElement.textContent = data.totalArchived || 0;
            if (personsElement) personsElement.textContent = data.uniquePersons || 0;
        }
    } catch (error) {
        console.error('Error loading archived stats:', error);
    }
}

function filterDeletionRequests() {
    const statusFilter = document.getElementById('deletionStatusFilter').value;
    const filtered = statusFilter 
        ? deletionRequests.filter(req => req.status === statusFilter)
        : deletionRequests;
    renderDeletionRequests(filtered);
}

function renderDeletionRequests(requests = deletionRequests) {
    const container = document.getElementById('deletionRequestsContainer');
    
    if (!container) return;

    if (requests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #f1f5f9; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-inbox" style="font-size: 40px; color: #94a3b8;"></i>
                </div>
                <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">No hay solicitudes</h3>
                <p style="color: #64748b; margin: 0; font-size: 14px;">No hay solicitudes de eliminación en este momento</p>
            </div>
        `;
        return;
    }

    const html = requests.map(req => {
        const statusColors = {
            pending: { 
                border: '#f59e0b', 
                text: '#92400e', 
                icon: 'clock-history', 
                label: 'Pendiente',
                badgeBg: '#fef3c7',
                badgeBorder: '#fed7aa'
            },
            approved: { 
                border: '#22c55e', 
                text: '#065f46', 
                icon: 'check-circle-fill', 
                label: 'Aprobada',
                badgeBg: '#d1fae5',
                badgeBorder: '#a7f3d0'
            },
            rejected: { 
                border: '#dc2626', 
                text: '#991b1b', 
                icon: 'x-circle-fill', 
                label: 'Rechazada',
                badgeBg: '#fee2e2',
                badgeBorder: '#fecaca'
            }
        };
        
        const statusKey = (req.status || 'pending').toString().toLowerCase();
        const status = statusColors[statusKey] || statusColors.pending;
        const createdDate = new Date(req.createdAt).toLocaleString('es-CO', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        const reviewedDate = req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : '-';

        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s;" onmouseover="this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.borderColor='#e2e8f0';">
                
                <!-- Header: Leader info and status -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-person-fill" style="font-size: 20px; color: #64748b;"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 600;">${req.leaderName}</h4>
                            <p style="color: #64748b; font-size: 13px; margin: 0;">
                                <i class="bi bi-hash"></i> ${req.leaderId.slice(-8)}
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: ${status.badgeBg}; color: ${status.text}; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid ${status.badgeBorder};">
                            <i class="bi bi-${status.icon}"></i> ${status.label}
                        </div>
                        <div style="text-align: center; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1;">${req.registrationCount}</div>
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Registros</div>
                        </div>
                    </div>
                </div>
                <!-- Reason -->
                ${req.reason ? `
                    <div style="background: #f8fafc; border-left: 3px solid #3b82f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #0f172a; font-size: 14px; line-height: 1.6;">
                            <span style="text-transform: uppercase; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">
                                <i class="bi bi-chat-left-quote" style="color: #3b82f6;"></i> Razón
                            </span><br>
                            <span style="color: #334155; margin-top: 6px; display: inline-block;">${req.reason}</span>
                        </p>
                    </div>
                ` : ''}

                <!-- Metadata Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                        <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                            <i class="bi bi-calendar-event"></i> Solicitado
                        </div>
                        <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${createdDate}</div>
                    </div>
                    ${req.reviewedAt ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-calendar-check"></i> Revisado
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${reviewedDate}</div>
                        </div>
                    ` : ''}
                    ${req.reviewedBy ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-person-check"></i> Revisado por
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${req.reviewedBy}</div>
                        </div>
                    ` : ''}
                    ${req.reviewNotes ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; grid-column: 1 / -1;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-sticky"></i> Notas de revisión
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${req.reviewNotes}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- Action Buttons for Pending Requests -->
                ${req.status === 'pending' ? `
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 10px; align-items: start;">
                            <i class="bi bi-lightbulb" style="font-size: 16px; color: #f59e0b; flex-shrink: 0; margin-top: 2px;"></i>
                            <div style="color: #92400e; font-size: 13px; line-height: 1.5;">
                                <strong style="display: block; margin-bottom: 6px; color: #78350f;">Opciones de aprobación:</strong>
                                <div style="color: #92400e;">
                                    <div style="margin-bottom: 3px;">• <strong>Aprobar y Archivar:</strong> Guarda copias para reutilización futura</div>
                                    <div>• <strong>Aprobar y Eliminar:</strong> Eliminación permanente sin respaldo</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'reject')" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0';">
                            <i class="bi bi-x-circle"></i> Rechazar
                        </button>
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'approve-and-archive')" style="background: white; color: #2563eb; border: 1px solid #2563eb; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: all 0.2s;" onmouseover="this.style.background='#eff6ff';" onmouseout="this.style.background='white';">
                            <i class="bi bi-archive-fill"></i> Archivar
                        </button>
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'approve')" style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3); transition: all 0.2s;" onmouseover="this.style.background='#b91c1c'; this.style.boxShadow='0 4px 12px rgba(220, 38, 38, 0.4)';" onmouseout="this.style.background='#dc2626'; this.style.boxShadow='0 1px 3px rgba(220, 38, 38, 0.3)';">
                            <i class="bi bi-trash-fill"></i> Eliminar
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function reviewDeletionRequest(requestId, action) {
    const actionTexts = {
        'approve': 'aprobar',
        'approve-and-archive': 'aprobar y archivar',
        'reject': 'rechazar'
    };
    const actionText = actionTexts[action] || action;
    
    const confirmTexts = {
        'approve': '⚠️ ADVERTENCIA: Esta acción ELIMINARÁ PERMANENTEMENTE todos los registros del líder SIN RESPALDO. ¿Estás seguro?',
        'approve-and-archive': '✅ Esta acción eliminará los registros del líder actual PERO guardará copias en la base de datos de archivo para uso futuro (auto-rellenar en próximos eventos). ¿Continuar?',
        'reject': '¿Estás seguro de rechazar esta solicitud?'
    };
    const confirmText = confirmTexts[action] || '¿Estás seguro?';

    if (!confirm(confirmText)) return;

    let notes = '';
    if (action === 'reject') {
        notes = prompt('Razón del rechazo (opcional):') || '';
    } else if (action === 'approve-and-archive') {
        notes = 'Aprobado con archivo para reutilización futura';
    }

    try {
        const response = await fetch(`${API_URL}/api/deletion-requests/${requestId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({ action, notes })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al procesar solicitud');
        }

        showAlert(data.message || `Solicitud ${actionText}da exitosamente`, 'success');
        await loadDeletionRequests();
        
        // Si se aprobó (con o sin archivo), recargar registros y líderes
        if (action === 'approve' || action === 'approve-and-archive') {
            await loadAllLeaders();
            await loadAllRegistrations();
        }
    } catch (error) {
        console.error('Error reviewing deletion request:', error);
        showAlert('Error: ' + error.message, 'error');
    }
}

window.refreshDeletionRequests = loadDeletionRequests;
window.loadDeletionRequests = loadDeletionRequests;
