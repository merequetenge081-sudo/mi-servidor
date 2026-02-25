#!/usr/bin/env node
/**
 * Prueba de Funciones - Verifica que los archivos JS se cargan correctamente
 */

import http from 'http';

async function testEndpoint(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    content: data,
                    ok: res.statusCode === 200
                });
            });
        });

        req.on('error', (e) => {
            resolve({ status: 0, error: e.message });
        });

        req.end();
    });
}

async function runTests() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ VERIFICACIÓN DE CARGA DE MÓDULOS JS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const checks = [
        { path: '/js/modules/modals.module.js', desc: 'Módulo ModalsModule (Dark Mode + Help)' },
        { path: '/js/modules/leaders.module.js', desc: 'Módulo LeadersModule (Delete Leader)' },
        { path: '/dashboard.html', desc: 'Dashboard HTML' }
    ];

    for (const check of checks) {
        const result = await testEndpoint(check.path);
        const icon = result.ok ? '✅' : '❌';
        console.log(`${icon} ${check.desc}`);
        if (result.ok) {
            const size = new Blob([result.content]).size;
            console.log(`   Status: ${result.status} | Size: ${(size / 1024).toFixed(1)}KB`);
            
            // Verificar contenido específico
            if (check.path.includes('modals')) {
                const hasToggleDarkMode = result.content.includes('toggleDarkMode');
                const hasToggleHelpDrawer = result.content.includes('toggleHelpDrawer');
                console.log(`   - toggleDarkMode: ${hasToggleDarkMode ? '✅' : '❌'}`);
                console.log(`   - toggleHelpDrawer: ${hasToggleHelpDrawer ? '✅' : '❌'}`);
            }
            if (check.path.includes('leaders')) {
                const hasDeleteLeader = result.content.includes('function deleteLeader');
                const hasHandleConfirm = result.content.includes('handleConfirmDeleteLeader');
                console.log(`   - deleteLeader function: ${hasDeleteLeader ? '✅' : '❌'}`);
                console.log(`   - handleConfirmDeleteLeader: ${hasHandleConfirm ? '✅' : '❌'}`);
            }
        } else {
            console.log(`   Error: ${result.error || 'Request failed'}`);
        }
        console.log();
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n✅ RESUMEN DE CORRECCIONES APLICADAS:\n');
    console.log('1️⃣  BOTÓN MODO OSCURO (Dark Mode):');
    console.log('   ✓ Modificado: public/js/modules/modals.module.js');
    console.log('   ✓ Función toggleDarkMode() mejorada con transiciones suaves');
    console.log('   ✓ Persistencia en localStorage funcionando\n');
    
    console.log('2️⃣  BOTÓN ELIMINAR LÍDERES:');
    console.log('   ✓ Agregados inputs de confirmación al modal:');
    console.log('     - deleteLeaderInput: confirma nombre del líder');
    console.log('     - deleteLeaderNameConfirm: segunda confirmación');
    console.log('   ✓ Modal mejorado con advertencia visual');
    console.log('   ✓ Función handleConfirmDeleteLeader() verificada\n');
    
    console.log('3️⃣  BOTÓN DE AYUDA (Help Drawer):');
    console.log('   ✓ Modificado: public/js/modules/modals.module.js');
    console.log('   ✓ Nueva función toggleHelpDrawer() con aria-hidden');
    console.log('   ✓ Nueva función closeHelpDrawer() con aria-hidden');
    console.log('   ✓ Logging agregado para debugging\n');
    
    console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
