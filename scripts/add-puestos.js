import mongoose from 'mongoose';
import { Puestos } from '../src/models/Puestos.js';

const MONGO_ATLAS_URL = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

async function addPuestos() {
  try {
    await mongoose.connect(MONGO_ATLAS_URL);
    console.log('Connected to MongoDB Atlas');

    const nuevosPuestos = [
      {
        codigoPuesto: 'CUSTOM-GALICIA-CB',
        nombre: 'GALICIA',
        localidad: 'CIUDAD BOLIVAR',
        ciudad: 'Bogotá',
        departamento: 'Bogotá D.C.',
        fuente: 'MANUAL',
        activo: true
      },
      {
        codigoPuesto: 'CUSTOM-MADELENA-CB',
        nombre: 'Madelena',
        localidad: 'CIUDAD BOLIVAR',
        ciudad: 'Bogotá',
        departamento: 'Bogotá D.C.',
        fuente: 'MANUAL',
        activo: true
      }
    ];

    for (const puesto of nuevosPuestos) {
      // Check if it already exists by name and localidad
      const existing = await Puestos.findOne({ 
        nombre: { $regex: new RegExp(`^${puesto.nombre}$`, 'i') }, 
        localidad: { $regex: new RegExp(`^${puesto.localidad}$`, 'i') } 
      });

      if (existing) {
        console.log(`El puesto ${puesto.nombre} en ${puesto.localidad} ya existe (Código: ${existing.codigoPuesto}).`);
      } else {
        const newPuesto = new Puestos(puesto);
        await newPuesto.save();
        console.log(`Puesto agregado: ${puesto.nombre} - ${puesto.localidad}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addPuestos();
