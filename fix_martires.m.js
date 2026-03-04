import mongoose from 'mongoose';

const url = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

async function run() {
  try {
    await mongoose.connect(url);
    console.log("Connected");
    
    const db = mongoose.connection.db;
    const puestos = db.collection('puestos');
    const registrations = db.collection('registrations');
    
    // Check how many exist
    const pCount1 = await puestos.countDocuments({ localidad: { $regex: /^m[aá]rtires$/i } });
    console.log(`Encontrados m[aá]rtires en puestos: ${pCount1}`);

    const pResult = await puestos.updateMany(
      { localidad: { $regex: /^m[aá]rtires$/i } },
      { $set: { localidad: 'Los Mártires' } }
    );
    console.log(`Puestos actualizados a "Los Mártires":`, pResult.modifiedCount);

    const rResult = await registrations.updateMany(
      { localidad: { $regex: /^m[aá]rtires$/i } },
      { $set: { localidad: 'Los Mártires' } }
    );
    console.log(`Registrations actualizados a "Los Mártires":`, rResult.modifiedCount);

    const checkAgain = await puestos.countDocuments({ localidad: 'Los Mártires' });
    console.log(`Total puestos con "Los Mártires":`, checkAgain);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();