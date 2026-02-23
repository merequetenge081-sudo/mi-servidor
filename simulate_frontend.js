import "dotenv/config";

// Simular exactamente lo que hace el frontend
async function simulateFrontend() {
  const BASE_URL = "http://localhost:3000";
  
  try {
    console.log("=" .repeat(50));
    console.log("SIMULANDO FLUJO DEL FRONTEND");
    console.log("=" .repeat(50));
    
    // 1. Login
    console.log("\n📊 PASO 1: Login");
    const loginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    
    const { token } = await loginRes.json();
    console.log("✅ Token obtenido:", token.substring(0, 30) + "...");
    
    // 2. Simular AppState.user.token = token
    console.log("\n📊 PASO 2: Simular AppState");
    const AppStateSimulated = {
      user: { token, eventId: null }
    };
    console.log("✅ AppState.user.token =", AppStateSimulated.user.token.substring(0, 30) + "...");
    
    // 3. Llamar DataService.getLeaders()
    console.log("\n📊 PASO 3: DataService.getLeaders()");
    const endpoint1 = `/api/leaders`;
    console.log("   Endpoint:", endpoint1);
    const leadersRes = await fetch(`${BASE_URL}${endpoint1}`, {
      headers: { 'Authorization': `Bearer ${AppStateSimulated.user.token}` }
    });
    console.log("   Status:", leadersRes.status);
    const leadersData = await leadersRes.json();
    const leaders = Array.isArray(leadersData) ? leadersData : (leadersData.data || []);
    console.log(`✅ Leaders cargados: ${leaders.length}`);
    AppStateSimulated.data = { leaders };
    
    // 4. Llamar DataService.getRegistrations()
    console.log("\n📊 PASO 4: DataService.getRegistrations()");
    const endpoint2 = `/api/registrations?limit=2000`;
    console.log("   Endpoint:", endpoint2);
    const regsRes = await fetch(`${BASE_URL}${endpoint2}`, {
      headers: { 'Authorization': `Bearer ${AppStateSimulated.user.token}` }
    });
    console.log("   Status:", regsRes.status);
    const regsData = await regsRes.json();
    const regs = Array.isArray(regsData) ? regsData : (regsData.data || []);
    console.log(`✅ Registrations cargados: ${regs.length}`);
    AppStateSimulated.data.registrations = regs;
    
    // 5. Verificar qué tienAppState
    console.log("\n📊 PASO 5: Verificar AppState.data");
    console.log("   Leaders:", AppStateSimulated.data.leaders.length);
    console.log("   Registrations:", AppStateSimulated.data.registrations.length);
    
    // 6. Simular AnalyticsModule.updateStats()
    console.log("\n📊 PASO 6: Simular AnalyticsModule.updateStats()");
    const registrations = AppStateSimulated.data.registrations || [];
    const bogota = registrations.filter(r => r.registeredToVote === true).length;
    const resto = registrations.length - bogota;
    const confirmed = registrations.filter(r => r.confirmed === true || r.confirmed === 'true').length;
    const confirmRate = registrations.length > 0 ? ((confirmed / registrations.length) * 100).toFixed(1) : '0.0';
    
    console.log(`   confirmRate: ${confirmRate}%`);
    console.log(`   bogota: ${bogota}`);
    console.log(`   resto: ${resto}`);
    console.log(`   confirmed: ${confirmed}`);
    console.log(`   total: ${registrations.length}`);
    
    if (registrations.length === 0) {
      console.log("\n❌ PROBLEMA: NO HAY REGISTRACIONES");
    } else if (confirmRate === '0.0') {
      console.log("\n⚠️  Confirmación al 0% (posible dato incorrecto)");
    } else {
      console.log("\n✅ TODO FUNCIONA CORRECTAMENTE");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

simulateFrontend();
