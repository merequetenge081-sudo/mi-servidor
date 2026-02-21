// Script para probar el endpoint de registrations
const testEndpoint = async () => {
  try {
    // Obtener un leaderId que tenga registros con revisión
    const leaderId = '698103743730b5358b0a3414'; // El que tiene 69 registros
    
    const response = await fetch(`http://localhost:3000/api/registrations?leaderId=${leaderId}&limit=5`);
    const data = await response.json();
    
    console.log('📊 Respuesta del endpoint:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.data && data.data.length > 0) {
      console.log('\n📋 Primer registro:');
      const first = data.data[0];
      console.log(`- requiereRevisionPuesto: ${first.requiereRevisionPuesto}`);
      console.log(`- revisionPuestoResuelta: ${first.revisionPuestoResuelta}`);
      console.log(`- votingPlace: ${first.votingPlace}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

testEndpoint();
