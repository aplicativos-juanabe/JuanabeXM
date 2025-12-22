import fetch from 'node-fetch';

const API = 'http://localhost:3002/api';
const documento = '9999';

async function run() {
  try {
    console.log('Creating dummy student (if not exists)');
    await fetch(`${API}/estudiante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento, nombre: 'Test', apellido: 'User', grado: '5' })
    }).catch(()=>{});

    console.log('Saving progress...');
    const questions = [{ id: 'q1', pregunta: '1+1', respuesta: '2', area: 'matematicas' }];
    const config = { tiempo_limite_minutos: 1 };
    const resp = await fetch(`${API}/examen/progreso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento, currentQuestionIndex: 0, answersJson: {}, questionsJson: questions, configJson: config, examId: null, remainingTimeSeconds: 60 })
    });
    console.log('Progress save status:', resp.status);

    console.log('Finalizing exam (POST /api/examen)...');
    const resultados = { detail: [{ id: 'q1', pregunta: '1+1', area: 'matematicas', userAnswer: '2', isCorrect: true }], score: 1, byArea: { matematicas:1 }, passed: false };
    const r2 = await fetch(`${API}/examen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento, resultados, tiempoUsado: 10 })
    });
    console.log('Final save status:', r2.status);
    const body = await r2.json();
    console.log('Final save response:', body);

    console.log('Checking saved progress (should be deleted by client flow only)');
    const p = await fetch(`${API}/examen/progreso/${documento}`);
    console.log('Get progress status:', p.status);
    if (p.status === 200) console.log('Progress still exists:', await p.json());
    else console.log('No progress found (status):', p.status);

  } catch (e) {
    console.error('Test failed:', e);
  }
}

run();
