const mongoose = require('mongoose');
require('dotenv').config();

const { Registration } = require('./src/models/Registration.js');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');
  
  const docs = await Registration.aggregate([
    { $match: { leaderName: /Nidia /i } },
    { $limit: 10 },
    { $project: { _id: 0, localidad: 1, departamento: 1, capital: 1, puestoId: 1 } }
  ]);
  
  console.log(docs);
  process.exit(0);
}

test();
