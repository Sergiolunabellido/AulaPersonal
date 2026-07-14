const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { OLLAMA_BASE_URL, comprobarOllamaOnline } = require('./ollamaManager');

// Modelos gratuitos orientados a programación (Qwen2.5-Coder en Ollama)
const SETUP_VERSION = 2;
const MODELOS_DEFECTO = ['qwen2.5-coder:1.5b', 'qwen2.5-coder:3b', 'qwen2.5-coder:7b'];
const MODELO_FALLBACK = 'qwen2.5-coder:3b';

let setupEnProgreso = false;

function obtenerRutaSetup() {
  return path.join(app.getPath('userData'), 'ollama', 'setup-complete.json');
}

function setupCompletado() {
  try {
    const data = JSON.parse(fs.readFileSync(obtenerRutaSetup(), 'utf8'));
    return data && data.complete === true && data.version === SETUP_VERSION;
  } catch {
    return false;
  }
}

function obtenerEstadoSetup() {
  return {
    enProgreso: setupEnProgreso,
    completado: setupCompletado(),
    totalModelos: MODELOS_DEFECTO.length,
  };
}

function marcarSetupCompleto(modelosInstalados, modeloDefecto) {
  const dir = path.dirname(obtenerRutaSetup());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    obtenerRutaSetup(),
    JSON.stringify({
      complete: true,
      version: SETUP_VERSION,
      modelosInstalados,
      modeloDefecto,
      completedAt: new Date().toISOString(),
    }, null, 2)
  );
}

function emitirProgreso(payload) {
  for (const ventana of BrowserWindow.getAllWindows()) {
    ventana.webContents.send('ollama-setup-progress', payload);
  }
}

function calcularProgresoGlobal(indiceModelo, totalModelos, progresoModeloPct) {
  const fraccion = Math.min(100, Math.max(0, progresoModeloPct)) / 100;
  return Math.min(100, Math.round(((indiceModelo + fraccion) / totalModelos) * 100));
}

function emitirProgresoLimpio(indice, total, progresoModeloPct) {
  const progresoGlobal = calcularProgresoGlobal(indice, total, progresoModeloPct);
  emitirProgreso({
    fase: 'descargando',
    progresoGlobal,
    modeloActual: indice + 1,
    totalModelos: total,
    mensaje: `Descargando modelos de programación (${indice + 1} de ${total})…`,
  });
}

function modeloYaInstalado(nombre, modelosInstalados) {
  const base = nombre.split(':')[0];
  return modelosInstalados.some((m) => m === nombre || m.startsWith(base + ':'));
}

function obtenerModelosInstalados() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_BASE_URL}/api/tags`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const nombres = (json.models || []).map((m) => m.name);
          resolve(nombres);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

function pullModelo(nombre, onProgress) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ name: nombre, stream: true });
    const req = http.request(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lineas = buffer.split('\n');
        buffer = lineas.pop() || '';
        for (const linea of lineas) {
          if (!linea.trim()) continue;
          try {
            const evt = JSON.parse(linea);
            if (onProgress) onProgress(evt);
            if (evt.error) reject(new Error(evt.error));
          } catch { /* ignorar líneas parciales */ }
        }
      });
      res.on('end', () => resolve(true));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function ejecutarSetupInicial() {
  if (process.env.OLLAMA_SKIP_SETUP === '1') {
    emitirProgreso({ fase: 'completo', skipped: true });
    return { skipped: true };
  }

  if (setupCompletado()) {
    emitirProgreso({ fase: 'completo', alreadyComplete: true });
    return { skipped: true, alreadyComplete: true };
  }

  if (!(await comprobarOllamaOnline())) {
    emitirProgreso({ fase: 'error', mensaje: 'Ollama no está disponible. Puedes usar modelos de pago con API key.' });
    return { error: 'Ollama offline' };
  }

  setupEnProgreso = true;
  const total = MODELOS_DEFECTO.length;
  const instalados = await obtenerModelosInstalados();
  const modelosOk = [];
  let modeloDefecto = null;

  emitirProgreso({
    fase: 'descargando',
    progresoGlobal: 0,
    modeloActual: 1,
    totalModelos: total,
    mensaje: 'Descargando modelos Qwen2.5 Coder…',
  });

  for (let i = 0; i < MODELOS_DEFECTO.length; i++) {
    const modelo = MODELOS_DEFECTO[i];
    if (modeloYaInstalado(modelo, instalados)) {
      modelosOk.push(modelo);
      if (!modeloDefecto) modeloDefecto = modelo;
      emitirProgresoLimpio(i, total, 100);
      continue;
    }

    emitirProgresoLimpio(i, total, 0);

    try {
      await pullModelo(modelo, (evt) => {
        const totalBytes = evt.total || 0;
        const completed = evt.completed || 0;
        const pctModelo = totalBytes > 0 ? Math.round((completed / totalBytes) * 100) : 0;
        emitirProgresoLimpio(i, total, pctModelo);
      });
      modelosOk.push(modelo);
      if (!modeloDefecto) modeloDefecto = modelo;
      emitirProgresoLimpio(i, total, 100);
    } catch (_) {
      emitirProgresoLimpio(i, total, 100);
    }
  }

  setupEnProgreso = false;

  if (!modeloDefecto && modelosOk.length === 0) {
    emitirProgreso({
      fase: 'error',
      mensaje: 'No se pudo instalar ningún modelo local. Puedes usar modelos de pago con API key.',
    });
    return { error: 'No models installed' };
  }

  if (!modeloDefecto) modeloDefecto = MODELO_FALLBACK;

  marcarSetupCompleto(modelosOk, modeloDefecto);
  emitirProgreso({
    fase: 'completo',
    progresoGlobal: 100,
    modelosInstalados: modelosOk,
    modeloDefecto,
    mensaje: 'Modelos listos. Ya puedes usar el chat.',
  });

  return { complete: true, modelosOk, modeloDefecto };
}

module.exports = {
  MODELOS_DEFECTO,
  ejecutarSetupInicial,
  setupCompletado,
  obtenerModelosInstalados,
  obtenerEstadoSetup,
};
