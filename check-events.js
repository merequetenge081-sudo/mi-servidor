import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');

async function checkEvents() {
  try {
    await client.connect();
    const db = client.db('seguimiento-datos-dev');
    const events = db.collection('events');
    
    const allEvents = await events.find({}).toArray();
    console.log('📊 Total eventos:', allEvents.length);
    console.log('📋 Listado completo:\n');
    allEvents.forEach((e, i) => {
      console.log(`  [${i+1}] ID: ${e._id}`);
      console.log(`      Nombre: ${e.name}`);
      console.log(`      Descripción: ${e.description || 'N/A'}`);
      console.log(`      Active: ${e.active}`);
      console.log('');
    });
    
    if (allEvents.length === 0) {
      console.log('⚠️ No hay eventos en la base de datos!');
    }
  } finally {
    await client.close();
  }
}

checkEvents().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
