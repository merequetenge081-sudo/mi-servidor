import mongoose from 'mongoose';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  const db = mongoose.connection.db;

  // IDs de registros que requieren revisión manual
  const registrosRevisión = [
    '699e718ca8fd52ff1a2669db', // Ciudad Bochica Sur
    '699e718ca8fd52ff1a2669dc', // Granjas de San Pablo
    '699e718ca8fd52ff1a2669dd', // Los Molinos II Sector
    '699e718ca8fd52ff1a2669df', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669e0', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669e4', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669e5', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669e6', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669ec', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669f2', // Alcaldia Quiroga
    '699e718ca8fd52ff1a2669f9', // Colegio Eucaristico
    '699e718ca8fd52ff1a2669fa'  // San Antonio del Táchira
  ];

  console.log('🏷️  Marcando registros para revisión manual...\n');

  const result = await db.collection('registrations').updateMany(
    { _id: { $in: registrosRevisión.map(id => new mongoose.Types.ObjectId(id)) } },
    {
      $set: {
        requiresManualReview: true,
        reviewNotes: 'Nombre de puesto no identificado automáticamente - requiere búsqueda manual en registros electorales'
      }
    }
  );

  console.log(`✅ Actualizados: ${result.modifiedCount}/${registrosRevisión.length}`);

  // Verificación
  const checked = await db.collection('registrations').countDocuments({ requiresManualReview: true });
  console.log(`\n📊 Total registros marcados para revisión: ${checked}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
