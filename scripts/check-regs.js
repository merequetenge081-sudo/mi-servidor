import { connectDB } from '../src/config/db.js';
import { Registration } from '../src/models/Registration.js';

async function check() {
  await connectDB();
  const total = await Registration.countDocuments();
  const withPuesto = await Registration.countDocuments({ puestoId: { $ne: null } });
  const withoutPuesto = await Registration.countDocuments({ puestoId: null });
  const withVotingPlace = await Registration.countDocuments({ puestoId: null, votingPlace: { $ne: null, $ne: '' } });
  
  console.log('--- REGISTRATION STATS ---');
  console.log(`Total Registrations: ${total}`);
  console.log(`With puestoId: ${withPuesto}`);
  console.log(`Without puestoId: ${withoutPuesto}`);
  console.log(`Without puestoId BUT WITH votingPlace string: ${withVotingPlace}`);
  
  process.exit(0);
}

check();