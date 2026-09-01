const {app, BrowserWindow, ipcMain, safeStorage, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { iniciarOllama, detenerOllama, obtenerEstadoOllama } = require('./ollamaManager');
const { ejecutarSetupInicial, obtenerEstadoSetup } = require('./ollamaSetup');

const esWindows = process.platform === 'win32';
const esLinux = process.platform === 'linux';

// Timer used to repeatedly kill blocked processes while a focus session is active
let intervaloBloqueo = null;
// Child process that runs the Spring Boot backend (java -jar ...)
let procesoBackend = null;
// Main BrowserWindow instance
let ventanaPrincipal = null;
// Estado de arranque del backend expuesto vía IPC
let estadoBackend = {
  online: false,
  error: null,
  javaExe: null,
  jar: null,
  logFile: null,
};

/**
 * Devuelve el directorio de logs dentro de userData, creando si es necesario.
 */
function obtenerDirLogs() {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Crea un escritor de logs para el backend/electron.
 * Retorna objeto con ruta de fichero, stream y función stamp.
 */
function crearEscritorLog(nombre) {
  const logFile = path.join(obtenerDirLogs(), nombre);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const stamp = () => new Date().toISOString();
  stream.write(`\n===== ${stamp()} =====\n`);
  return { logFile, stream, stamp };
}

/**
 * Determina la ruta al ejecutable java a usar:
 * - Si la app está empaquetada intenta usar el JRE incluido en resources
 * - En desarrollo intenta usar build/jre si existe
 * - En último caso cae al 'java' del PATH
 */
function obtenerJavaEjecutable() {
  if (app.isPackaged) {
    const rutaJre = path.join(process.resourcesPath, 'jre', 'bin');
    return path.join(rutaJre, esWindows ? 'java.exe' : 'java');
  }
  const jreLocal = path.join(__dirname, '..', 'build', 'jre', 'bin', esWindows ? 'java.exe' : 'java');
  if (fs.existsSync(jreLocal)) {
    return jreLocal;
  }
  return 'java';
}

/**
 * Devuelve la ruta al JAR del backend según si la app está empaquetada o en desarrollo.
 */
function obtenerRutaJar() {
  const nombreJar = 'AulaPersonal-0.0.1-SNAPSHOT.jar';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', nombreJar);
  }
  return path.join(__dirname, '..', 'build', 'libs', nombreJar);
}

/**
 * Mata procesos por nombre en Windows (taskkill) o en Unix (pkill -f).
 * Usado por el mecanismo de bloqueo de apps para impedir ejecución.
 */
function matarProceso(nombre) {
  if (esWindows) {
    execFile('taskkill', ['/F', '/IM', `${nombre}.exe`, '/T'], { windowsHide: true }, () => {});
  } else {
    execFile('pkill', ['-f', nombre], () => {});
  }
}

/**
 * Muestra un dialog de error de arranque e incluye pista del fichero de log si hay.
 */
function mostrarErrorArranque(titulo, detalle) {
  const logHint = estadoBackend.logFile
    ? `\n\nRegistro: ${estadoBackend.logFile}`
    : '';
  dialog.showErrorBox(titulo, `${detalle}${logHint}`);
}

/**
 * Arranca el backend Spring Boot ejecutando el JAR con java.
 * - Compone la ruta del JRE/JAR
 * - Crea un proceso hijo y redirige stdout/stderr a un fichero de log
 * - Espera una comprobación health check a /api/notas
 * Retorna true si el backend quedó online.
 */
async function iniciarBackend() {
  const javaExe = obtenerJavaEjecutable();
  const rutaJar = obtenerRutaJar();
  const rutaDatosUsuario = app.getPath('userData');
  const { logFile, stream, stamp } = crearEscritorLog('backend.log');

  estadoBackend = {
    online: false,
    error: null,
    javaExe,
    jar: rutaJar,
    logFile,
  };

  if (!fs.existsSync(rutaJar)) {
    estadoBackend.error = `No se encontró el backend JAR:\n${rutaJar}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    stream.end();
    mostrarErrorArranque('Backend no disponible', estadoBackend.error);
    return false;
  }

  if (javaExe !== 'java' && !fs.existsSync(javaExe)) {
    estadoBackend.error = `No se encontró el JRE embebido:\n${javaExe}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    stream.end();
    mostrarErrorArranque('Backend no disponible', estadoBackend.error);
    return false;
  }

  stream.write(`[${stamp()}] Iniciando: ${javaExe} -jar ${rutaJar}\n`);

  procesoBackend = spawn(javaExe, ['-jar', rutaJar], {
    env: {
      ...process.env,
      APP_DATA_DIR: rutaDatosUsuario,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  procesoBackend.stdout.on('data', (chunk) => stream.write(chunk));
  procesoBackend.stderr.on('data', (chunk) => stream.write(chunk));
  procesoBackend.on('error', (err) => {
    estadoBackend.error = `Error al arrancar el backend: ${err.message}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    console.error('Backend start error:', err.message);
  });
  procesoBackend.on('exit', (code, signal) => {
    stream.write(`[${stamp()}] Backend salió code=${code} signal=${signal}\n`);
    if (!estadoBackend.online) {
      estadoBackend.error = estadoBackend.error
        || `El backend terminó antes de estar listo (code=${code}).`;
    }
  });

  const listo = await esperarBackend();
  if (listo) {
    estadoBackend.online = true;
    stream.write(`[${stamp()}] Backend listo en http://localhost:8080\n`);
    return true;
  }

  estadoBackend.error = estadoBackend.error
    || 'El backend no respondió en http://localhost:8080 tras 30 s.';
  stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
  mostrarErrorArranque(
    'Backend no disponible',
    'Chat AI, Música y Notas necesitan el servidor local.\n\n' + estadoBackend.error
  );
  return false;
}

/**
 * Detiene el backend comprobando el estado del proceso y creando una promesa a la que se tenga que esperar para que el
 * proceso este muerto antes de cerrar.
 * */

function detenerBackend(){
  return new Promise((resolve) => {
    if(!procesoBackend)return resolve();
    const p = procesoBackend;
    let timer;
    procesoBackend = null;
    if(p.exitCode != null)return resolve();
    if(esWindows) {
      execFile('taskkill',['/F', '/T', '/PID' ,String(p.pid)], () => {console.log('CAMINO: callback de taskkill');resolve()});
    }else{
      p.kill('SIGKILL');
    }
    p.once('exit', () => {
      console.log('CAMINO: evento exit')
      clearTimeout(timer);
      resolve();
    });
    timer = setTimeout(() => {
      console.log('CAMINO: timeout 5s')
      resolve();
    }, 5000);
  })
}

/**
 * Espera hasta que el endpoint http://localhost:8080/api/notas responda 200.
 * Se usa durante el arranque para confirmar que el backend arrancó correctamente.
 */
function esperarBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    let intentos = 0;

    function comprobar() {
      if (procesoBackend && procesoBackend.exitCode !== null) {
        resolve(false);
        return;
      }

      intentos++;
      const req = http.get('http://localhost:8080/api/notas', (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => {
        if (intentos >= 30) {
          resolve(false);
        } else {
          setTimeout(comprobar, 1000);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
      });
      req.end();
    }

    comprobar();
  });
}

/**
 * Crea la ventana principal BrowserWindow y carga el renderer index.html.
 * Configura preload y desactiva throttling de fondo para que el Pomodoro siga
 * funcionando al minimizar.
 */
function crearVentana() {
  const iconoApp = path.join(__dirname, 'renderer', 'assets', 'imagenes', 'aula-personal-icon.png');

  ventanaPrincipal = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    icon: iconoApp,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // El Pomodoro (y el widget de la sidebar) deben seguir ticando al minimizar
      backgroundThrottling: false,
    },
  });

  ventanaPrincipal.loadFile('electron/renderer/index.html');
  // Por si la preferencia no aplica en alguna versión: forzar en webContents
  ventanaPrincipal.webContents.setBackgroundThrottling(false);

  if (fs.existsSync(iconoApp)) {
    ventanaPrincipal.setIcon(iconoApp);
  }
}

/** IPC handlers expuestos al renderer a través de preload. */
ipcMain.handle('obtener-icono', async (_event, ruta) => {
    try {
        const icono = await app.getFileIcon(ruta, { size: 'small' });
        return icono.toDataURL();
    } catch (_) {
        return '';
    }
});

ipcMain.handle('backend-status', () => ({ ...estadoBackend }));

ipcMain.handle('ollama-status', async () => {
  return obtenerEstadoOllama();
});

ipcMain.handle('ollama-setup-status', () => {
  return obtenerEstadoSetup();
});

ipcMain.handle('guardar-api-key', (_event, provider, key) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  try {
    const encrypted = safeStorage.encryptString(key);
    return { ok: true, data: encrypted.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('obtener-api-key', (_event, encryptedBase64) => {
  if (!safeStorage.isEncryptionAvailable() || !encryptedBase64) {
    return { ok: false, value: '' };
  }
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return { ok: true, value: safeStorage.decryptString(buffer) };
  } catch (err) {
    return { ok: false, error: err.message, value: '' };
  }
});

/**
 * IPC: bloquear-apps
 * - Lanza un interval que intenta matar procesos por nombre cada 2s durante
 *   la duración pedida. Esto implementa el bloqueo de aplicaciones del Pomodoro.
 */
ipcMain.handle('bloquear-apps', (_event, nombresApps, minutos) => {
  if (intervaloBloqueo) clearInterval(intervaloBloqueo);

  const duracionMs = minutos * 60 * 1000;
  const inicio = Date.now();

  intervaloBloqueo = setInterval(() => {
    if (Date.now() - inicio >= duracionMs) {
      clearInterval(intervaloBloqueo);
      intervaloBloqueo = null;
      return;
    }
    for (const nombre of nombresApps) {
      matarProceso(nombre);
    }
  }, 2000);

  return true;
});

ipcMain.handle('desbloquear-todo', () => {
  if (intervaloBloqueo) {
    clearInterval(intervaloBloqueo);
    intervaloBloqueo = null;
  }
  return true;
});

app.whenReady().then(async () => {
  const ollama = await iniciarOllama({
    logDir: obtenerDirLogs(),
  });
  if (!ollama.online) {
    console.error('Ollama no está disponible al arrancar:', ollama.error || 'offline');
  }

  await iniciarBackend();
  crearVentana();
  ejecutarSetupInicial().catch((err) => {
    console.error('Ollama setup error:', err.message);
  });
});


let cerrado = false;
app.on('will-quit', (e) => {
  detenerOllama();
  if (cerrado) return;
  e.preventDefault();
  cerrado = true;
  detenerBackend().finally(()=> app.quit());

});

app.on('window-all-closed', (e) => {
  e.preventDefault();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
