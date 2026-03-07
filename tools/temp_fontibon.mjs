import { connectDB, disconnectDB } from '../src/config/db.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';

const normalize = (value) => (value || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

const main = async () => {
  await connectDB();

  const event = await Event.findOne({ name: /Evento.*Inicial/i }).lean();
  if (!event) {
    const events = await Event.find().select('name').limit(10).lean();
    console.log('No encontre el evento. Ejemplos:', events.map((e) => e.name));
    await disconnectDB();
    return;
  }

  const eventId = event._id.toString();
  console.log('Evento:', event.name, eventId);

  const registrations = await Registration.aggregate([
    { $match: { eventId, dataIntegrityStatus: { $ne: 'invalid' } } },
    {
      $lookup: {
        from: 'puestos',
        localField: 'puestoId',
        foreignField: '_id',
        as: 'puesto'
      }
    },
    { $addFields: { puesto: { $arrayElemAt: ['$puesto', 0] } } },
    { $project: { localidad: 1, puestoLocalidad: '$puesto.localidad' } }
  ]);

  const target = 'fontibon';
  let total = 0;
  let fromPuesto = 0;
  let fromReg = 0;

  for (const reg of registrations) {
    const loc = reg.puestoLocalidad || reg.localidad || '';
    const locNorm = normalize(loc);
    if (locNorm.includes(target)) {
      total++;
    }

    if (reg.puestoLocalidad && normalize(reg.puestoLocalidad).includes(target)) {
      fromPuesto++;
    }

    if (reg.localidad && normalize(reg.localidad).includes(target)) {
      fromReg++;
    }
  }

  console.log('Fontibon total (puesto.localidad || registration.localidad):', total);
  console.log('Fontibon solo puesto.localidad:', fromPuesto);
  console.log('Fontibon solo registration.localidad:', fromReg);

  await disconnectDB();
};

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
