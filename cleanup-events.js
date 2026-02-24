import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');

async function cleanupTestEvents() {
  try {
    await client.connect();
    const db = client.db('seguimiento-datos-dev');
    const events = db.collection('events');
    
    // Mostrar eventos actuales
    const allEvents = await events.find({}).toArray();
    console.log('📋 Eventos actuales:');
    allEvents.forEach(e => console.log(`  - ${e.name}`));
    
    // Eliminar eventos de prueba
    const result = await events.deleteMany({ 
      $or: [
        { name: 'pruebas' },
        { name: 'asd' },
        { description: 'asd' }
      ]
    });
    
    console.log(`\n✅ Eliminados ${result.deletedCount} eventos de prueba`);
    
    // Mostrar eventos restantes
    const remaining = await events.find({}).toArray();
    console.log('\n📋 Eventos después de limpieza:');
    remaining.forEach(e => console.log(`  ✓ ${e.name}`));
  } finally {
    await client.close();
  }
}

cleanupTestEvents().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
