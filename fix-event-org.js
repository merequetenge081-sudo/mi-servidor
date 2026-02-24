import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');

async function fixEventOrganization() {
  try {
    await client.connect();
    const db = client.db('seguimiento-datos-dev');
    const events = db.collection('events');
    const orgs = db.collection('organizations');
    
    // Obtener la organización por defecto
    const defaultOrg = await orgs.findOne({ slug: 'default' });
    if (!defaultOrg) {
      console.log('❌ No se encontró organización default');
      return;
    }
    
    console.log(`🔍 Organización por defecto: ${defaultOrg._id}`);
    
    // Actualizar todos los eventos para que usen el organizationId correcto
    const result = await events.updateMany(
      {},
      { $set: { organizationId: defaultOrg._id.toString() } }
    );
    
    console.log(`✅ Actualizados ${result.modifiedCount} evento(s)`);
    
    // Verificar
    const updated = await events.find({}).toArray();
    console.log('\n📋 Eventos después de actualizar:');
    updated.forEach((e) => {
      console.log(`  ${e.name}: organizationId = ${e.organizationId}`);
    });
    
  } finally {
    await client.close();
  }
}

fixEventOrganization().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
