/**
 * Test UI Functions - Diagnóstico de botones no funcionales
 * 1. Modo oscuro
 * 2. Eliminar líderes
 * 3. Botón de ayuda
 */

const http = require('http');

function testDarkModeButton() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/dashboard.html',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const hasThemeToggle = data.includes('theme-toggle');
                const hasThemeToggleInEvents = data.includes('class="theme-toggle"');
                const hasToggleDarkMode = data.includes('toggleDarkMode');
                
                resolve({
                    ok: hasThemeToggle && hasToggleDarkMode,
                    details: {
                        hasThemeToggle,
                        hasThemeToggleInEvents,
                        hasToggleDarkMode
                    }
                });
            });
        });

        req.on('error', (e) => {
            resolve({ ok: false, error: e.message });
        });

        req.end();
    });
}

function testDeleteLeaderButton() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/dashboard.html',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const hasDeleteBtn = data.includes('delete-leader-btn');
                const hasConfirmDeleteBtn = data.includes('confirmDeleteBtn');
                const hasDeleteConfirmModal = data.includes('deleteConfirmModal');
                
                resolve({
                    ok: hasDeleteBtn && hasConfirmDeleteBtn && hasDeleteConfirmModal,
                    details: {
                        hasDeleteBtn,
                        hasConfirmDeleteBtn,
                        hasDeleteConfirmModal
                    }
                });
            });
        });

        req.on('error', (e) => {
            resolve({ ok: false, error: e.message });
        });

        req.end();
    });
}

function testHelpButton() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/dashboard.html',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const hasHelpToggle = data.includes('data-action="help-toggle"');
                const hasHelpDrawer = data.includes('helpDrawer');
                const hasHelpOverlay = data.includes('helpOverlay');
                const hasToggleHelpDrawer = data.includes('toggleHelpDrawer');
                
                resolve({
                    ok: hasHelpToggle && hasHelpDrawer && hasHelpOverlay && hasToggleHelpDrawer,
                    details: {
                        hasHelpToggle,
                        hasHelpDrawer,
                        hasHelpOverlay,
                        hasToggleHelpDrawer
                    }
                });
            });
        });

        req.on('error', (e) => {
            resolve({ ok: false, error: e.message });
        });

        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando pruebas de funciones UI...\n');

    try {
        const darkModeTests = await testDarkModeButton();
        const deleteLeaderTests = await testDeleteLeaderButton();
        const helpButtonTests = await testHelpButton();

        console.log('📋 RESULTADOS:\n');
        
        console.log('1️⃣  Modo Oscuro:');
        console.log(`   Status: ${darkModeTests.ok ? '✅ OK' : '❌ ERROR'}`);
        console.log(`   Details: ${JSON.stringify(darkModeTests.details, null, 2)}\n`);

        console.log('2️⃣  Eliminar Líderes:');
        console.log(`   Status: ${deleteLeaderTests.ok ? '✅ OK' : '❌ ERROR'}`);
        console.log(`   Details: ${JSON.stringify(deleteLeaderTests.details, null, 2)}\n`);

        console.log('3️⃣  Botón Ayuda:');
        console.log(`   Status: ${helpButtonTests.ok ? '✅ OK' : '❌ ERROR'}`);
        console.log(`   Details: ${JSON.stringify(helpButtonTests.details, null, 2)}\n`);

        const allOk = darkModeTests.ok && deleteLeaderTests.ok && helpButtonTests.ok;
        console.log(`\n📊 Resultado Final: ${allOk ? '✅ TODAS FUNCIONES OK' : '❌ ALGUNAS FUNCIONES FALLAN'}`);

    } catch (error) {
        console.error('❌ Error en pruebas:', error);
    }
}

runTests();
