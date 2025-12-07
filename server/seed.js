import { dbFunctions } from './database.js';

async function seed() {
  console.log('🌱 Agregando datos de prueba...\n');

  // Estudiante 1
  await dbFunctions.registrarEstudiante({
    documento: '1001',
    nombre: 'María',
    apellido: 'García',
    email: 'maria@test.com',
    telefono: '3001234567',
    grado: '6°'
  });

  await dbFunctions.guardarExamen('1001', {
    score: 13,
    byArea: { lenguaje: 5, ingles: 4, matematicas: 4 },
    passed: true,
    detail: Array(15).fill(0).map((_, i) => ({
      id: `q${i}`,
      pregunta: `Pregunta ${i + 1}`,
      area: i < 5 ? 'lenguaje' : i < 10 ? 'ingles' : 'matematicas',
      userAnswer: 'A',
      respuesta: i % 2 === 0 ? 'A' : 'B',
      isCorrect: i % 2 === 0
    }))
  }, 2100);

  // Estudiante 2
  await dbFunctions.registrarEstudiante({
    documento: '1002',
    nombre: 'Carlos',
    apellido: 'López',
    email: 'carlos@test.com',
    telefono: '3009876543',
    grado: '7°'
  });

  await dbFunctions.guardarExamen('1002', {
    score: 8,
    byArea: { lenguaje: 3, ingles: 2, matematicas: 3 },
    passed: false,
    detail: Array(15).fill(0).map((_, i) => ({
      id: `q${i}`,
      pregunta: `Pregunta ${i + 1}`,
      area: i < 5 ? 'lenguaje' : i < 10 ? 'ingles' : 'matematicas',
      userAnswer: 'A',
      respuesta: i % 3 === 0 ? 'A' : 'B',
      isCorrect: i % 3 === 0
    }))
  }, 2400);

  // Estudiante 3
  await dbFunctions.registrarEstudiante({
    documento: '1003',
    nombre: 'Ana',
    apellido: 'Martínez',
    email: 'ana@test.com',
    telefono: '3005556677',
    grado: '6°'
  });

  await dbFunctions.guardarExamen('1003', {
    score: 11,
    byArea: { lenguaje: 4, ingles: 3, matematicas: 4 },
    passed: true,
    detail: Array(15).fill(0).map((_, i) => ({
      id: `q${i}`,
      pregunta: `Pregunta ${i + 1}`,
      area: i < 5 ? 'lenguaje' : i < 10 ? 'ingles' : 'matematicas',
      userAnswer: 'A',
      respuesta: i % 2 === 0 ? 'A' : 'B',
      isCorrect: i % 2 === 0 || i % 3 === 0
    }))
  }, 1950);

  console.log('✅ Datos de prueba agregados!');
  
  // Mostrar estadísticas
  const stats = await dbFunctions.obtenerEstadisticas();
  console.log('\n📊 Estadísticas:', stats);
  
  const resultados = await dbFunctions.obtenerTodosResultados();
  console.log('\n📋 Total registros:', resultados.length);
  
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});