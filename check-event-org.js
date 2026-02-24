import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');

async function checkEventOrg() {
  try {
    await client.connect();
    const db = client.db('seguimiento-datos-dev');
    const events = db.collection('events');
    
    const allEvents = await events.find({}).toArray();
    console.log('📊 Análisis de eventos:\n');
    allEvents.forEach((e, i) => {
      console.log(`[${i+1}] ${e.name}`);
      console.log(`    _id: ${e._id}`);
      console.log(`    organizationId: ${e.organizationId || 'NULL'}`);
      console.log(`    active: ${e.active}`);
      console.log('');
    });
    
    // También revisar qué organizaciones existen
    const orgs = db.collection('organizations');
    const allOrgs = await orgs.find({}).toArray();
    console.log('\n📋 Organizaciones en la BD:');
    allOrgs.forEach((org, i) => {
      console.log(`[${i+1}] ${org.name} (ID: ${org._id})`);
    });
    
  } finally {
    await client.close();
  }
}

checkEventOrg().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
