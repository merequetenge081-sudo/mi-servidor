import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const mongoURL = process.env.MONGO_URL;
if (!mongoURL) {
  console.error('Falta MONGO_URL en .env');
  process.exit(1);
}

await mongoose.connect(mongoURL, { dbName: process.env.MONGO_DB_NAME || undefined })
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => { console.error('❌ Error conectando a MongoDB', err); process.exit(1); });

const LeaderSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  area: String,
  active: Boolean,
  token: String,
  eventId: { type: String, default: '' },
  registrations: { type: Number, default: 0 }
});

const RegistrationSchema = new mongoose.Schema({
  leaderId: String,
  leaderName: String,
  eventId: String,
  firstName: String,
  lastName: String,
  cedula: String,
  email: String,
  phone: String,
  date: String,
  notifications: Object,
  confirmed: Boolean,
  confirmedBy: String,
  confirmedAt: Date
});

const EventSchema = new mongoose.Schema({
  name: String,
  date: Date,
  description: String,
  token: String,
  active: Boolean,
  createdAt: Date
});

const Leader = mongoose.model('Leader', LeaderSchema);
const Registration = mongoose.model('Registration', RegistrationSchema);
const Event = mongoose.model('Event', EventSchema);

async function run() {
  try {
    const eventName = 'Evento Político Inicial';

    let ev = await Event.findOne({ name: eventName });
    if (!ev) {
      ev = await Event.create({ name: eventName, date: new Date(), description: 'Evento inicial migrado', token: `event-${Date.now()}`, active: true, createdAt: new Date() });
      console.log('✅ Evento creado:', ev.name, ev._id);
    } else {
      console.log('ℹ️ Evento encontrado:', ev.name, ev._id);
    }

    const leaders = await Leader.find();
    console.log(`📌 Líderes encontrados: ${leaders.length}`);

    let updatedLeaders = 0;
    for (const l of leaders) {
      if (!l.eventId || String(l.eventId) !== String(ev._id)) {
        l.eventId = String(ev._id);
        await l.save();
        updatedLeaders++;
      }
    }

    console.log(`✅ Líderes asignados/actualizados: ${updatedLeaders}`);

    const regs = await Registration.find();
    console.log(`📌 Registros encontrados: ${regs.length}`);

    let updatedRegs = 0;
    for (const r of regs) {
      // si el registro ya tiene eventId distinto, lo actualizamos también
      if (!r.eventId || String(r.eventId) !== String(ev._id)) {
        // asignar solo si tiene leaderId o si queremos forzar
        r.eventId = String(ev._id);
        await r.save();
        updatedRegs++;
      }
    }

    console.log(`✅ Registros asignados/actualizados: ${updatedRegs}`);

    console.log('🎉 Proceso completado.');
  } catch (err) {
    console.error('❌ Error en el proceso:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
