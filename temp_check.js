import mongoose from 'mongoose';
const url = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';
mongoose.connect(url).then(async () => {
    const db = mongoose.connection.db;
    const p = db.collection('puestos');
    const noLoc = await p.find({localidad: 'Fontibón', $or: [{codigoLocalidad: {$exists: true}}, {codigoPuesto: {$exists: true}}]}).project({codigoLocalidad:1, codigoPuesto:1}).toArray();
    console.log('Items with codes:', noLoc.length, noLoc[0]);
    process.exit(0);
});