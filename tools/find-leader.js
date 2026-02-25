import mongoose from 'mongoose';
import { Leader, Registration } from '../src/models/index.js';

const query = process.argv[2];
const limit = Number(process.argv[3]) || 10;

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

if (!query) {
  console.error('❌ Debes pasar un query para buscar leaderId');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const res = await Leader.find({
    leaderId: { $regex: query, $options: 'i' }
  })
    .select('leaderId name email')
    .limit(limit)
    .lean();

  if (res.length > 0) {
    console.log(JSON.stringify({ leaders: res }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const registrationLeaders = await Registration.aggregate([
    { $match: { leaderId: { $regex: query, $options: 'i' } } },
    { $group: { _id: '$leaderId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  console.log(JSON.stringify({ leaders: [], registrationLeaderIds: registrationLeaders }, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
