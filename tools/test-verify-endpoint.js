import mongoose from 'mongoose';
import { verifyLeaderRegistrations } from '../src/controllers/registrations.controller.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

// Mock request/response
class MockRes {
  constructor() {
    this.statusCode = 200;
    this.jsonData = null;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.jsonData = data;
    return this;
  }
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB\n');

    // Mock request
    const req = {
      user: {
        leaderId: 'LID-MLULVTSN-3G4H',
        userId: '699815fdcad68725e4453105',
        role: 'leader',
        organizationId: '699543e647e78a0ff2dd85e6'
      },
      params: {
        leaderId: 'LID-MLULVTSN-3G4H'
      },
      body: {
        threshold: 0.85
      }
    };

    const res = new MockRes();

    console.log('🔄 Ejecutando verifyLeaderRegistrations...\n');

    await verifyLeaderRegistrations(req, res);

    console.log(`\n✅ Status: ${res.statusCode}`);
    if (res.jsonData) {
      console.log('📊 Response:', JSON.stringify(res.jsonData, null, 2));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

run();
