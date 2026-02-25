import mongoose from 'mongoose';
import { Puestos } from './src/models/Puestos.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://usuario:PqfSRXzEY4V6zrHQ@seguimientos.p0rrg.mongodb.net/seguimiento-datos?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Buscando variantes de Alcaldía Quiroga...\n');
    return Puestos.find({
      nombre: { $regex: /quiroga/i }
    }).lean();
  })
  .then(results => {
    if (results.length === 0) {
      console.log('❌ NO ENCONTRADO: Alcaldía Quiroga o variantes');
    } else {
      console.log('✅ ENCONTRADOS:', results.length, 'resultado(s)\n');
      results.forEach(r => {
        console.log('  -', r.nombre, '(Localidad:', r.localidad, ')');
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
