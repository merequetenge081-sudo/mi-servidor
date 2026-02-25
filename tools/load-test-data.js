/**
 * 🧪 TEST DATA - Crear Leaders y Registrations para testing
 * 
 * Carga datos de prueba que incluyan el registro de Miriam Rocío Leuro
 * para que la verificación automática pueda procesarlo
 */

import mongoose from 'mongoose';

async function loadTestData() {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seguimiento-datos';
    
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    const leadersCollection = db.collection('leaders');
    const registrationsCollection = db.collection('leaderregistrations');

    console.log('🧪 Cargando datos de test...\n');

    // 1. Crear Leader
    const leaderData = {
      leaderId: 'LID-MLULVTSN-3G4H', // ID del test
      nombre: 'Miriam Rocío Leuro',
      cedula: '41650922',
      email: 'miriam@test.com',
      telefono: '3012345678',
      localidad: 'Rafael Uribe Uribe',
      organizacion: 'Test Organization',
      createdAt: new Date(),
      status: 'active',
    };

    // Verificar si existe
    let leader = await leadersCollection.findOne({ leaderId: leaderData.leaderId });
    if (!leader) {
      await leadersCollection.insertOne(leaderData);
      console.log('✅ Leader creado/encontrado:', leaderData.leaderId);
    } else {
      console.log('⏭️  Leader ya existe:', leaderData.leaderId);
    }

    // 2. Crear Registration (sin match todavía)
    const registrationData = {
      leaderId: leader?._id || leaderData.leaderId,
      puesto: 'Alcaldia Quiroga', // Sin acento para forzar fuzzy match
      localidad: 'Rafael Uribe Uribe',
      mesa: 8,
      codigoPuesto: '41650922',
      matchConfidence: 0, // Sin match aún
      matched: false,
      createdAt: new Date(),
      status: 'pending',
    };

    // Verificar si existe
    let registration = await registrationsCollection.findOne({
      leaderId: registrationData.leaderId,
      puesto: registrationData.puesto,
    });

    if (!registration) {
      const result = await registrationsCollection.insertOne(registrationData);
      console.log('✅ Registration creado:', result.insertedId);
    } else {
      console.log('⏭️  Registration ya existe');
    }

    // Mostrar resumen
    console.log('\n📊 Estado de datos:');
    const totalLeaders = await leadersCollection.countDocuments();
    const totalRegs = await registrationsCollection.countDocuments();
    const puestosCount = await db.collection('puestos').countDocuments();

    console.log(`   Leaders: ${totalLeaders}`);
    console.log(`   Registrations: ${totalRegs}`);
    console.log(`   Puestos: ${puestosCount}`);

    // Verificar que el puesto existe
    const puesto = await db.collection('puestos').findOne({ nombre: /Alcaldía/i });
    console.log(`\n✅ Puesto Alcaldía disponible para verificación: ${puesto ? 'SÍ' : 'NO'}`);

    console.log('\n✨ Datos de test listos!');
    console.log('Ahora ejecuta: npm test -- registrations.controller.test.js\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

loadTestData();
