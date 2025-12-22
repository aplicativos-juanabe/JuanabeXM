// Script para probar la conectividad API
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

console.log('🔍 Probando conectividad con API...');
console.log('📡 URL de API:', API_URL);

async function testAPI() {
  try {
    // Probar endpoint de health
    console.log('🏥 Probando /api/health...');
    const healthResponse = await fetch(`${API_URL}/api/health`);
    console.log('📊 Status:', healthResponse.status);

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check exitoso:', healthData);
    } else {
      console.log('❌ Health check falló');
      const errorText = await healthResponse.text();
      console.log('📝 Error:', errorText);
    }

    // Probar endpoint de configuraciones
    console.log('⚙️ Probando /api/examen/configuraciones...');
    const configResponse = await fetch(`${API_URL}/api/examen/configuraciones`);
    console.log('📊 Status:', configResponse.status);

    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log('✅ Configuraciones obtenidas:', configData.length, 'items');
    } else {
      console.log('❌ Configuraciones fallaron');
      const errorText = await configResponse.text();
      console.log('📝 Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('💡 Posibles causas:');
    console.log('   - URL de API incorrecta');
    console.log('   - Backend no desplegado');
    console.log('   - Problemas de CORS');
    console.log('   - Firewall o red bloqueando la conexión');
  }
}

testAPI();