/**
 * Script de prueba para bulkCreateRegistrations
 * Ejecutar: node test-bulk-import.js
 */

const testData = {
  leaderId: "TU_LEADER_ID_AQUI", // Reemplazar con un leaderId real
  registrations: [
    {
      firstName: "Juan",
      lastName: "Pérez",
      cedula: "1234567890",
      email: "juan.perez@test.com",
      phone: "3001234567",
      votingPlace: "COLEGIO SAN JOSE", // Debe existir en BD
      votingTable: "001",
      localidad: "Kennedy"
    },
    {
      firstName: "María",
      lastName: "García",
      cedula: "0987654321",
      email: "maria.garcia@test.com",
      phone: "3009876543",
      votingPlace: "Puesto Inexistente", // No existe - debe marcar para revisión
      votingTable: "002",
      localidad: "Suba"
    },
    {
      firstName: "Pedro",
      lastName: "López",
      cedula: "5555555555",
      email: "pedro.lopez@test.com",
      phone: "3005555555",
      votingPlace: "", // Vacío - debe marcar para revisión
      votingTable: "003"
    }
  ]
};

console.log("📋 Datos de prueba preparados:");
console.log(JSON.stringify(testData, null, 2));
console.log("\n✅ Casos de prueba cubiertos:");
console.log("1. ✅ Registro con puesto válido");
console.log("2. ⚠️  Registro con puesto no encontrado (requiere revisión)");
console.log("3. ⚠️  Registro sin puesto (requiere revisión)");
console.log("\n📍 Para probar:");
console.log("1. Reemplaza 'TU_LEADER_ID_AQUI' con un leaderId válido");
console.log("2. Ajusta 'COLEGIO SAN JOSE' a un puesto real de tu BD");
console.log("3. Usa este JSON en Postman/Thunder Client:");
console.log("\n   POST http://localhost:3000/api/registrations/bulk");
console.log("   Headers: Authorization: Bearer YOUR_TOKEN");
console.log("   Body: [el JSON de arriba]");
