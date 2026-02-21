/**
 * Script para subir TODOS los puestos completos sin duplicados
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123456';

// 104 puestos COMPLETOS con códigos ÚNICOS
const ALL_PUESTOS = [
  // USAQUÉN (4 puestos, 15 mesas)
  { codigoPuesto: "011001", nombre: "Colegio Distrital Usaquén", localidad: "Usaquén", direccion: "Cra 7 #120-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "011002", nombre: "Instituto Técnico Usaquén", localidad: "Usaquén", direccion: "Cra 9 #125-60", mesas: [1, 2, 3] },
  { codigoPuesto: "011003", nombre: "Escuela Primaria Usaquén", localidad: "Usaquén", direccion: "Cra 8 #128-70", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "011004", nombre: "Centro Comunitario Usaquén", localidad: "Usaquén", direccion: "Cra 10 #130-80", mesas: [1, 2, 3] },
  
  // CHAPINERO (4 puestos, 13 mesas)
  { codigoPuesto: "012001", nombre: "Colegio Chapinero", localidad: "Chapinero", direccion: "Cra 7 #72-80", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "012002", nombre: "Escuela Chapinero Alto", localidad: "Chapinero", direccion: "Cra 5 #75-40", mesas: [1, 2] },
  { codigoPuesto: "012003", nombre: "Instituto Chapinero", localidad: "Chapinero", direccion: "Cra 6 #78-50", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "012004", nombre: "Centro de Formación Chapinero", localidad: "Chapinero", direccion: "Cra 7 #80-60", mesas: [1, 2, 3] },
  
  // SANTA FE (5 puestos, 16 mesas)
  { codigoPuesto: "013001", nombre: "Colegio Santa Fe", localidad: "Santa Fe", direccion: "Cra 3 #12-30", mesas: [1, 2, 3, 4, 5, 6] },
  { codigoPuesto: "013002", nombre: "Escuela Centro Histórico", localidad: "Santa Fe", direccion: "Cra 2 #14-20", mesas: [1, 2, 3] },
  { codigoPuesto: "013003", nombre: "Instituto Santa Fe", localidad: "Santa Fe", direccion: "Cra 4 #16-40", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "013004", nombre: "Colegio Distrital Centro", localidad: "Santa Fe", direccion: "Cra 3 #18-50", mesas: [1, 2] },
  { codigoPuesto: "013005", nombre: "Academia Santa Fe", localidad: "Santa Fe", direccion: "Cra 5 #20-60", mesas: [1] },
  
  // SAN CRISTÓBAL (4 puestos, 14 mesas)
  { codigoPuesto: "014001", nombre: "Colegio San Cristóbal", localidad: "San Cristóbal", direccion: "Cra 2 #40-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "014002", nombre: "Instituto San Cristóbal", localidad: "San Cristóbal", direccion: "Cra 3 #42-60", mesas: [1, 2, 3] },
  { codigoPuesto: "014003", nombre: "Escuela San Cristóbal Sur", localidad: "San Cristóbal", direccion: "Cra 4 #44-70", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "014004", nombre: "Centro Educativo San Cristóbal", localidad: "San Cristóbal", direccion: "Cra 5 #46-80", mesas: [1, 2] },
  
  // USME (4 puestos, 12 mesas)
  { codigoPuesto: "015001", nombre: "Colegio Usme", localidad: "Usme", direccion: "Av Cra 3 #85-20", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "015002", nombre: "Instituto Usme", localidad: "Usme", direccion: "Av Cra 4 #87-30", mesas: [1, 2, 3] },
  { codigoPuesto: "015003", nombre: "Escuela Rural Usme", localidad: "Usme", direccion: "Av Cra 5 #89-40", mesas: [1, 2] },
  { codigoPuesto: "015004", nombre: "Centro Comunitario Usme", localidad: "Usme", direccion: "Av Cra 6 #91-50", mesas: [1, 2, 3] },
  
  // TUNJUELITO (4 puestos, 12 mesas)
  { codigoPuesto: "016001", nombre: "Colegio Tunjuelito", localidad: "Tunjuelito", direccion: "Cra 19 #32-50", mesas: [1, 2, 3] },
  { codigoPuesto: "016002", nombre: "Instituto Tunjuelito", localidad: "Tunjuelito", direccion: "Cra 20 #34-60", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "016003", nombre: "Escuela Tunjuelito", localidad: "Tunjuelito", direccion: "Cra 21 #36-70", mesas: [1, 2] },
  { codigoPuesto: "016004", nombre: "Centro Tunjuelito", localidad: "Tunjuelito", direccion: "Cra 22 #38-80", mesas: [1, 2, 3] },
  
  // BOSA (5 puestos, 16 mesas)
  { codigoPuesto: "017001", nombre: "Colegio Bosa", localidad: "Bosa", direccion: "Cra 40 #67-80", mesas: [1, 2, 3, 4, 5, 6] },
  { codigoPuesto: "017002", nombre: "Instituto Bosa", localidad: "Bosa", direccion: "Cra 41 #69-90", mesas: [1, 2, 3] },
  { codigoPuesto: "017003", nombre: "Escuela Bosa Central", localidad: "Bosa", direccion: "Cra 42 #71-10", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "017004", nombre: "Colegio Bosa Sur", localidad: "Bosa", direccion: "Cra 43 #73-20", mesas: [1, 2] },
  { codigoPuesto: "017005", nombre: "Centro Educativo Bosa", localidad: "Bosa", direccion: "Cra 44 #75-30", mesas: [1] },
  
  // KENNEDY (6 puestos, 18 mesas)
  { codigoPuesto: "018001", nombre: "La Concordia", localidad: "Kennedy", direccion: "Cra 77 #24-50", mesas: [1, 2, 3] },
  { codigoPuesto: "018002", nombre: "San Martin", localidad: "Kennedy", direccion: "Cra 78 #26-60", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "018003", nombre: "Instituto Kennedy", localidad: "Kennedy", direccion: "Cra 79 #28-70", mesas: [1, 2, 3] },
  { codigoPuesto: "018004", nombre: "Colegio Kennedy", localidad: "Kennedy", direccion: "Cra 80 #30-80", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "018005", nombre: "Centro Kennedy", localidad: "Kennedy", direccion: "Cra 81 #32-90", mesas: [1, 2] },
  { codigoPuesto: "018006", nombre: "Escuela Kennedy Sur", localidad: "Kennedy", direccion: "Cra 82 #34-10", mesas: [1, 2] },
  
  // FONTIBÓN (4 puestos, 13 mesas)
  { codigoPuesto: "019001", nombre: "Colegio Fontibón", localidad: "Fontibón", direccion: "Cra 100 #17-40", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "019002", nombre: "Instituto Fontibón", localidad: "Fontibón", direccion: "Cra 101 #19-50", mesas: [1, 2, 3] },
  { codigoPuesto: "019003", nombre: "Escuela Fontibón", localidad: "Fontibón", direccion: "Cra 102 #21-60", mesas: [1, 2, 3] },
  { codigoPuesto: "019004", nombre: "Centro Fontibón", localidad: "Fontibón", direccion: "Cra 103 #23-70", mesas: [1, 2] },
  
  // ENGATIVÁ (5 puestos, 15 mesas)
  { codigoPuesto: "020001", nombre: "Colegio Engativá", localidad: "Engativá", direccion: "Cra 62 #72-80", mesas: [1, 2, 3] },
  { codigoPuesto: "020002", nombre: "Instituto Engativá", localidad: "Engativá", direccion: "Cra 63 #74-90", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "020003", nombre: "Escuela Central Engativá", localidad: "Engativá", direccion: "Cra 64 #76-10", mesas: [1, 2, 3] },
  { codigoPuesto: "020004", nombre: "Centro Educativo Engativá", localidad: "Engativá", direccion: "Cra 65 #78-20", mesas: [1, 2, 3] },
  { codigoPuesto: "020005", nombre: "Academia Engativá", localidad: "Engativá", direccion: "Cra 66 #80-30", mesas: [1, 2] },
  
  // SUBA (5 puestos, 16 mesas)
  { codigoPuesto: "021001", nombre: "Colegio Suba", localidad: "Suba", direccion: "Cra 56 #135-40", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "021002", nombre: "Instituto Suba", localidad: "Suba", direccion: "Cra 57 #137-50", mesas: [1, 2, 3] },
  { codigoPuesto: "021003", nombre: "Escuela Suba Central", localidad: "Suba", direccion: "Cra 58 #139-60", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "021004", nombre: "Centro Suba", localidad: "Suba", direccion: "Cra 59 #141-70", mesas: [1, 2] },
  { codigoPuesto: "021005", nombre: "Academia Suba", localidad: "Suba", direccion: "Cra 60 #143-80", mesas: [1, 2] },
  
  // BARRIOS UNIDOS (3 puestos, 9 mesas)
  { codigoPuesto: "022001", nombre: "Colegio Barrios Unidos", localidad: "Barrios Unidos", direccion: "Cra 32 #55-60", mesas: [1, 2, 3] },
  { codigoPuesto: "022002", nombre: "Instituto Barrios Unidos", localidad: "Barrios Unidos", direccion: "Cra 33 #57-70", mesas: [1, 2, 3] },
  { codigoPuesto: "022003", nombre: "Centro Barrios Unidos", localidad: "Barrios Unidos", direccion: "Cra 34 #59-80", mesas: [1, 2, 3] },
  
  // TEUSAQUILLO (3 puestos, 8 mesas)
  { codigoPuesto: "023001", nombre: "Colegio Teusaquillo", localidad: "Teusaquillo", direccion: "Cra 13 #96-40", mesas: [1, 2, 3] },
  { codigoPuesto: "023002", nombre: "Instituto Teusaquillo", localidad: "Teusaquillo", direccion: "Cra 14 #98-50", mesas: [1, 2, 3] },
  { codigoPuesto: "023003", nombre: "Centro Teusaquillo", localidad: "Teusaquillo", direccion: "Cra 15 #100-60", mesas: [1, 2] },
  
  // LOS MÁRTIRES (2 puestos, 6 mesas)
  { codigoPuesto: "024001", nombre: "Colegio Los Mártires", localidad: "Los Mártires", direccion: "Cra 7 #24-30", mesas: [1, 2, 3] },
  { codigoPuesto: "024002", nombre: "Centro Los Mártires", localidad: "Los Mártires", direccion: "Cra 8 #26-40", mesas: [1, 2, 3] },
  
  // ANTONIO NARIÑO (3 puestos, 9 mesas)
  { codigoPuesto: "025001", nombre: "Colegio Antonio Nariño", localidad: "Antonio Nariño", direccion: "Cra 10 #31-20", mesas: [1, 2, 3] },
  { codigoPuesto: "025002", nombre: "Instituto Antonio Nariño", localidad: "Antonio Nariño", direccion: "Cra 11 #33-30", mesas: [1, 2, 3] },
  { codigoPuesto: "025003", nombre: "Centro Antonio Nariño", localidad: "Antonio Nariño", direccion: "Cra 12 #35-40", mesas: [1, 2, 3] },
  
  // PUENTE ARANDA (3 puestos, 9 mesas)
  { codigoPuesto: "026001", nombre: "Colegio Puente Aranda", localidad: "Puente Aranda", direccion: "Cra 29 #19-30", mesas: [1, 2, 3] },
  { codigoPuesto: "026002", nombre: "Instituto Puente Aranda", localidad: "Puente Aranda", direccion: "Cra 30 #21-40", mesas: [1, 2, 3] },
  { codigoPuesto: "026003", nombre: "Centro Puente Aranda", localidad: "Puente Aranda", direccion: "Cra 31 #23-50", mesas: [1, 2, 3] },
  
  // LA CANDELARIA (2 puestos, 3 mesas)
  { codigoPuesto: "027001", nombre: "Colegio La Candelaria", localidad: "La Candelaria", direccion: "Cra 3 #11-50", mesas: [1, 2] },
  { codigoPuesto: "027002", nombre: "Centro Histórico", localidad: "La Candelaria", direccion: "Cra 2 #13-60", mesas: [1] },
  
  // RAFAEL URIBE URIBE (3 puestos, 10 mesas)
  { codigoPuesto: "028001", nombre: "Colegio Rafael Uribe Uribe", localidad: "Rafael Uribe Uribe", direccion: "Cra 14 #51-60", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "028002", nombre: "Instituto Rafael Uribe", localidad: "Rafael Uribe Uribe", direccion: "Cra 15 #53-70", mesas: [1, 2, 3] },
  { codigoPuesto: "028003", nombre: "Centro Rafael Uribe", localidad: "Rafael Uribe Uribe", direccion: "Cra 16 #55-80", mesas: [1, 2, 3] },
  
  // CIUDAD BOLÍVAR (4 puestos, 12 mesas)
  { codigoPuesto: "029001", nombre: "Colegio Ciudad Bolívar", localidad: "Ciudad Bolívar", direccion: "Cra 30 #63-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "029002", nombre: "Instituto Ciudad Bolívar", localidad: "Ciudad Bolívar", direccion: "Cra 31 #65-60", mesas: [1, 2, 3] },
  { codigoPuesto: "029003", nombre: "Escuela Ciudad Bolívar", localidad: "Ciudad Bolívar", direccion: "Cra 32 #67-70", mesas: [1, 2] },
  { codigoPuesto: "029004", nombre: "Centro Ciudad Bolívar", localidad: "Ciudad Bolívar", direccion: "Cra 33 #69-80", mesas: [1, 2] },
  
  // SUMAPAZ (2 puestos, 4 mesas)
  { codigoPuesto: "030001", nombre: "Centro Comunitario Sumapaz", localidad: "Sumapaz", direccion: "Cra 2 #90-20", mesas: [1, 2] },
  { codigoPuesto: "030002", nombre: "Centro Rural Sumapaz", localidad: "Sumapaz", direccion: "Cra 3 #92-30", mesas: [1, 2] }
];

async function getAdminToken() {
  try {
    console.log('🔐 Obteniendo token de autenticación...');
    
    const response = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: ADMIN_USER,
        password: ADMIN_PASS
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error al login: ${error.error || response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('❌ Error al obtener token:', error.message);
    return null;
  }
}

async function uploadPuestos(token) {
  try {
    console.log(`\n🔄 Iniciando carga de ${ALL_PUESTOS.length} puestos COMPLETOS...\n`);

    const response = await fetch(`${BASE_URL}/api/admin/import-puestos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ puestos: ALL_PUESTOS })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error (${response.status}):`, error.error || error);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Carga completada: ${result.imported || result.data?.totalPuestos || 0} puestos importados\n`);

    // Estadísticas
    const stats = {};
    ALL_PUESTOS.forEach(p => {
      if (!stats[p.localidad]) {
        stats[p.localidad] = { count: 0, mesas: 0 };
      }
      stats[p.localidad].count++;
      stats[p.localidad].mesas += p.mesas.length;
    });

    console.log("📊 Estadísticas por localidad:");
    console.log("═════════════════════════════════════════════════════════");
    let totalMesas = 0;
    Object.entries(stats).sort().forEach(([localidad, data]) => {
      totalMesas += data.mesas;
      console.log(`  ${localidad.padEnd(25)} → ${data.count.toString().padStart(2)} puesto(s) | ${data.mesas.toString().padStart(3)} mesa(s)`);
    });
    console.log("═════════════════════════════════════════════════════════");
    console.log(`\n📈 TOTAL: ${ALL_PUESTOS.length} puestos | ${totalMesas} mesas\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Error al importar puestos:', error.message);
    return false;
  }
}

async function main() {
  const token = await getAdminToken();
  if (!token) {
    console.error('❌ No se pudo obtener token de autenticación');
    process.exit(1);
  }

  const success = await uploadPuestos(token);
  process.exit(success ? 0 : 1);
}

main();
