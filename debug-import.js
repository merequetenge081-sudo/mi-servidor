import axios from 'axios';

const testData = {
  leaderId: 'leader-1',
  registrations: [
    {
      firstName: 'TEST',
      lastName: 'Usuario',
      cedula: Math.floor(Math.random() * 1000000000) + '_debug',
      email: 'test@debug.com',
      phone: '3001111111',
      localidad: 'Usaquen',
      votingPlace: 'Agustin Fernadez',  // TYPO: Fernadez (falta r)
      votingTable: 1
    }
  ]
};

console.log('\n=== DEBUG: Verificando recepción en backend ===\n');
console.log('Datos enviados:');
console.log(JSON.stringify(testData, null, 2));

axios.post('http://localhost:3000/api/registrations/bulk/test', testData, {
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true
})
.then(response => {
  console.log('\n--- RESPUESTA ---');
  console.log('Status:', response.status);
  console.log('\nBody:', JSON.stringify(response.data, null, 2));
  
  if (response.data.autocorrections) {
    console.log('\n🔧 Autocorrecciones:', response.data.autocorrections.length);
  }
  
  console.log('\nPuestos cargados:', response.data.message);
})
.catch(error => {
  console.error('Error:', error.message);
});
