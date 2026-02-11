import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

dotenv.config();
const mongoURL = process.env.MONGO_URL;
if (!mongoURL) {
  console.error('ERROR: debe definir MONGO_URL en .env antes de ejecutar este script');
  process.exit(1);
}

const LeaderSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  area: String,
  active: Boolean,
  token: String,
  eventId: { type: String, default: '' },
  registrations: { type: Number, default: 0 },
  passwordHash: { type: String, default: '' }
});
const Leader = mongoose.model('Leader', LeaderSchema);

async function main() {
  await mongoose.connect(mongoURL);

  const name = process.argv[2] || 'Líder Prueba';
  const email = process.argv[3] || `leader_${Date.now()}@test.local`;
  const phone = process.argv[4] || '3001234567';
  const password = process.argv[5] || 'leader123456';

  const hash = await bcrypt.hash(password, 10);

  const leader = await Leader.create({
    name,
    email,
    phone,
    area: 'Prueba',
    active: true,
    token: `leader-${Date.now()}`,
    passwordHash: hash,
    registrations: 0
  });

  console.log(`✅ Líder creado:`);
  console.log(`   ID: ${leader._id}`);
  console.log(`   Nombre: ${leader.name}`);
  console.log(`   Email: ${leader.email}`);
  console.log(`   Contraseña: ${password} (hasheada para BD)`);
  console.log(`\n   Para loguearse:`);
  console.log(`   leaderId: "${leader._id}"`);
  console.log(`   password: "${password}"`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error creando líder:', err);
  process.exit(1);
});
