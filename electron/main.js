const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { execFile, spawn } = require('child_process');

const esWindows = process.platform === 'win32';
const esLinux = process.platform === 'linux';

let intervaloBloqueo = null;
let procesoBackend = null;

function obtenerJavaEjecutable() {
  if (app.isPackaged) {
    const rutaJre = path.join(process.resourcesPath, 'jre', 'bin');
    return path.join(rutaJre, esWindows ? 'java.exe' : 'java');
  }
  return 'java';
}

function obtenerRutaJar() {
  const nombreJar = 'AulaPersonal-0.0.1-SNAPSHOT.jar';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', nombreJar);
  }
  return path.join(__dirname, '..', 'build', 'libs', nombreJar);
}

function matarProceso(nombre) {
  if (esWindows) {
    execFile('taskkill', ['/F', '/IM', `${nombre}.exe`, '/T'], { windowsHide: true }, () => {});
  } else {
    execFile('pkill', ['-f', nombre], () => {});
  }
}

async function iniciarBackend() {
  const javaExe = obtenerJavaEjecutable();
  const rutaJar = obtenerRutaJar();
  const rutaDatosUsuario = app.getPath('userData');

  procesoBackend = spawn(javaExe, ['-jar', rutaJar], {
    env: {
      ...process.env,
      APP_DATA_DIR: rutaDatosUsuario,
    },
    stdio: 'ignore',
  });

  procesoBackend.on('error', (err) => {
    console.error('Backend start error:', err.message);
  });

  await esperarBackend();
}

function esperarBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    let intentos = 0;

    function comprobar() {
      intentos++;
      const req = http.get('http://localhost:8080/api/notas', () => {
        resolve();
      });
      req.on('error', () => {
        if (intentos >= 30) {
          resolve();
        } else {
          setTimeout(comprobar, 1000);
        }
      });
      req.end();
    }

    comprobar();
  });
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  ventana.loadFile('electron/renderer/index.html');

  if (esLinux) {
    ventana.setIcon(path.join(__dirname, 'renderer', 'assets', 'imagenes', 'mobile_profile.svg'));
  }
}

async function obtenerIcono(ruta) {
  try {
    const icono = await app.getFileIcon(ruta, { size: 'small' });
    return icono.toDataURL();
  } catch (_) {
    return '';
  }
}

ipcMain.handle('obtener-icono', async (_event, ruta) => {
  return await obtenerIcono(ruta);
});

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
  await iniciarBackend();
  crearVentana();
});

app.on('will-quit', () => {
  if (procesoBackend) {
    procesoBackend.kill();
    procesoBackend = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
