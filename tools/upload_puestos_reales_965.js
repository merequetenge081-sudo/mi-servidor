/**
 * Script para subir 965 puestos CON NOMBRES REALES de instituciones
 * Datos obtenidos de https://datosabiertos.bogota.gov.co/dataset/puesto-de-votacion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123456';

// Leer los datos procesados
const puestosEstructura = JSON.parse(fs.readFileSync(path.join(__dirname, 'puestos_estructura.json'), 'utf8'));

// Generar puestos con los nombres reales
function generarPuestosReales() {
  const puestos = [];
  let codigoBase = 1001;
  let totalMesas = 0;

  Object.entries(puestosEstructura.localidades).forEach(([localidad, nombresPuestos]) => {
    nombresPuestos.forEach((nombre, index) => {
      const codigoPuesto = String(codigoBase).padStart(6, '0');
      
      // Variar mesas: ~70% con 3 mesas, ~30% con 4 mesas
      const numMesas = index % 10 < 3 ? 4 : 3;
      const mesas = [];
      for (let m = 1; m <= numMesas; m++) {
        mesas.push(m);
      }
      totalMesas += mesas.length;

      puestos.push({
        codigoPuesto,
        nombre, // Nombre real del puesto
        localidad,
        direccion: `Punto de votación ${index + 1}`,
        mesas
      });

      codigoBase++;
    });
  });

  console.log(`\n📦 Generados ${puestos.length} puestos con nombres REALES`);
  console.log(`📊 Total de mesas: ${totalMesas}\n`);
  
  return puestos;
}

const ALL_PUESTOS = generarPuestosReales();

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
    console.log(`\n🔄 Iniciando carga de ${ALL_PUESTOS.length} puestos...\n`);

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
    console.log("════════════════════════════════════════════════════════════════");
    let totalMesas = 0;
    Object.entries(stats).sort().forEach(([localidad, data]) => {
      totalMesas += data.mesas;
      console.log(`  ${localidad.padEnd(25)} → ${data.count.toString().padStart(3)} puesto(s) | ${data.mesas.toString().padStart(4)} mesa(s)`);
    });
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`\n📈 TOTAL: ${ALL_PUESTOS.length} puestos | ${totalMesas} mesas`);
    console.log(`\n✨ Todos los nombres son DATOS OFICIALES de Bogotá`);
    console.log(`   Fuente: https://datosabiertos.bogota.gov.co/dataset/puesto-de-votacion\n`);
    
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
