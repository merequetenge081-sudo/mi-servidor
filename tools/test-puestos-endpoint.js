/**
 * Test: Verificar que el endpoint de puestos retorna datos para Fontibón
 */

import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testPuestosEndpoint() {
  console.log("\n🧪 TEST: Endpoint de Puestos");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const token = process.env.TEST_TOKEN || 'test-token';
    
    console.log(`API URL: ${apiUrl}\n`);
    
    // Test 1: Puestos en Fontibón
    console.log("1️⃣  GET /api/puestos?localidad=Fontibon (SIN token)\n");
    try {
      const response1 = await fetch(
        `${apiUrl}/api/puestos?localidad=Fontibon`,
        { agent: apiUrl.includes('https') ? agent : undefined }
      );
      
      console.log(`   Status: ${response1.status}`);
      const data1 = await response1.json();
      
      if (response1.status === 401 || data1.error?.includes('token')) {
        console.log(`   ⚠️  Requiere token (esperado)\n`);
      } else {
        console.log(`   ✅ Puestos encontrados: ${data1.data?.length || data1.length || 0}\n`);
        
        if (data1.data && data1.data.length > 0) {
          const fondibonPuestos = data1.data;
          console.log(`   📌 Puestos en Fontibón (primeros 3):`);
          fondibonPuestos.slice(0, 3).forEach(p => {
            console.log(`      - ${p.nombre}`);
            console.log(`        📍 ${p.direccion}\n`);
          });
          
          // Buscar específicamente Veracruz/República de Costa Rica
          const veracruz = fondibonPuestos.find(p => 
            p.nombre.includes('República de Costa Rica') || 
            p.direccion.includes('23 - 42')
          );
          
          if (veracruz) {
            console.log(`   ✅ VERACRUZ ENCONTRADO:`);
            console.log(`      Nombre: ${veracruz.nombre}`);
            console.log(`      Dirección: ${veracruz.direccion}`);
            console.log(`      Mesas: ${veracruz.mesas.join(', ')}\n`);
          } else {
            console.log(`   ⚠️  Veracruz no encontrado en los datos\n`);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 2: Búsqueda con nombre directo
    console.log("2️⃣  Búsqueda de todos los puestos en Fontibón\n");
    const puestosUrl = `${apiUrl}/api/puestos?localidad=Fontibon`;
    console.log(`   URL: ${puestosUrl}`);
    console.log(`   Método: GET\n`);
    
    // Test 3: Verificar estructura de datos
    console.log("3️⃣  Estructura esperada de respuesta:\n");
    console.log(`   {
     "success": true,
     "data": [
       {
         "_id": "...",
         "codigoPuesto": "001001",
         "nombre": "Colegio Distrital República de Costa Rica - Sede C",
         "localidad": "Fontibon",
         "direccion": "Carrera 101 No. 23 - 42",
         "mesas": [1],
         "source": "original"
       },
       ...
     ],
     "count": 42
   }\n`);
    
    // Test 4: Verificar BD directamente (sin API)
    console.log("4️⃣  Verificación directa de BD (MongoDB)\n");
    try {
      const mongoose = await import('mongoose');
      const { config } = await import('dotenv');
      config();
      
      const puestosSchema = new mongoose.Schema({
        codigoPuesto: String,
        nombre: String,
        localidad: String,
        direccion: String
      }, { strict: false });
      
      const Puestos = mongoose.model('Puestos', puestosSchema);
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor');
      
      const fontibonCount = await Puestos.countDocuments({ localidad: "Fontibon" });
      console.log(`   ✅ Puestos en Fondibón (BD): ${fontibonCount}`);
      
      const veracruzDB = await Puestos.findOne({
        localidad: "Fontibon",
        nombre: /República de Costa Rica/i
      });
      
      if (veracruzDB) {
        console.log(`\n   ✅ VERACRUZ EN BD:`);
        console.log(`      ID: ${veracruzDB._id}`);
        console.log(`      Nombre: ${veracruzDB.nombre}`);
        console.log(`      Dirección: ${veracruzDB.direccion}`);
        console.log(`      Código: ${veracruzDB.codigoPuesto}\n`);
      }
      
      await mongoose.disconnect();
    } catch (error) {
      console.log(`   ⚠️  No se pudo verificar BD: ${error.message}\n`);
    }
    
    console.log("════════════════════════════════════════════");
    console.log("✅ TEST COMPLETADO");
    console.log("════════════════════════════════════════════\n");
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testPuestosEndpoint();
