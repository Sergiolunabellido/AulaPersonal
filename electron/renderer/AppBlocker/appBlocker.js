let apps = [];
let bloqueadas = [];
let finBloqueo = null;
let timeoutId = null;

// ========================================================================
//  SELECCIÓN DE APPS PARA POMODORO
//  Persiste en localStorage qué apps tiene el usuario marcadas para que
//  el Pomodoro las bloquee automáticamente al iniciar una sesión.
// ========================================================================

/**
 * Lee de localStorage las apps marcadas por el usuario para bloquear
 * desde el Pomodoro. Devuelve un array de nombres de proceso.
 * @returns {string[]}
 */
function obtenerSeleccionadas() {
  return JSON.parse(localStorage.getItem('pomodoro-apps-seleccionadas') || '[]');
}

/**
 * Guarda en localStorage la lista de procesos seleccionados.
 * @param {string[]} seleccionadas - Array de nombres de proceso
 */
function guardarSeleccionadas(seleccionadas) {
  localStorage.setItem('pomodoro-apps-seleccionadas', JSON.stringify(seleccionadas));
}

/**
 * Sincroniza el array de seleccionadas con el estado actual de los checkboxes
 * (solo de las apps que NO están ya bloqueadas).
 */
function sincronizarSeleccionadas() {
  const seleccionadas = [];
  document.querySelectorAll('#lista-apps input[type="checkbox"]').forEach(cb => {
    const div = cb.closest('div');
    if (cb.checked && !cb.disabled) {
      const app = apps.find(a => a.nombre === div.dataset.nombre);
      if (app) seleccionadas.push(app.proceso.replace(/\.exe$/i, ''));
    }
  });
  guardarSeleccionadas(seleccionadas);
}

/**
 * Restaura el estado de los checkboxes a partir de lo guardado en localStorage.
 * Se llama después de renderizar la lista.
 */
function restaurarSeleccionadas() {
  const seleccionadas = obtenerSeleccionadas();
  document.querySelectorAll('#lista-apps input[type="checkbox"]').forEach(cb => {
    const div = cb.closest('div');
    const app = apps.find(a => a.nombre === div.dataset.nombre);
    if (app && !cb.disabled) {
      cb.checked = seleccionadas.includes(app.proceso.replace(/\.exe$/i, ''));
    }
  });
}

function guardarEstadoBloqueo() {
  sessionStorage.setItem('appblocker-bloqueo', JSON.stringify({
    bloqueadas,
    finBloqueo,
  }));
}

function restaurarEstadoBloqueo() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('appblocker-bloqueo'));
    if (saved && saved.finBloqueo && Date.now() < saved.finBloqueo) {
      bloqueadas = saved.bloqueadas || [];
      finBloqueo = saved.finBloqueo;
      mostrarEstadoBloqueo();
      actualizarTiempoRestante();
      return true;
    } else if (saved) {
      sessionStorage.removeItem('appblocker-bloqueo');
    }
  } catch { /* ignorar */ }
  return false;
}

function obtenerApps() {
    return JSON.parse(localStorage.getItem('apps-bloqueo') || '[]');
}

function guardarApp(nombre, proceso, ruta) {
    const guardadas = obtenerApps();
    guardadas.push({ nombre, proceso, ruta, id: Date.now() });
    localStorage.setItem('apps-bloqueo', JSON.stringify(guardadas));
}

function eliminarApp(id) {
    const guardadas = obtenerApps();
    const filtradas = guardadas.filter(a => a.id !== id);
    localStorage.setItem('apps-bloqueo', JSON.stringify(filtradas));
}

(async () => {
    apps = obtenerApps();
    document.getElementById('contador').textContent = `${apps.length} apps`;

    for (const app of apps) {
        if (app.ruta && !app.icono) {
            const icono = await window.electronAPI.obtenerIcono(app.ruta);
            if (icono) app.icono = icono;
        }
    }

    renderizarApps(apps);

    document.getElementById('btn-mostrar-form').addEventListener('click', () => {
        const form = document.getElementById('form-add-app');
        form.classList.toggle('hidden');
    });

    document.getElementById('btn-guardar-app').addEventListener('click', () => {
        const nombre = document.getElementById('input-nombre').value.trim();
        const proceso = document.getElementById('input-proceso').value.trim();
        const ruta = document.getElementById('input-ruta').value.trim();

        if (!nombre || !proceso) {
            alertas('warning', 'Name and process name are required');
            return;
        }

        const existentes = obtenerApps();
        if (existentes.some(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
            alertas('warning', `"${nombre}" already exists`);
            return;
        }

        guardarApp(nombre, proceso, ruta);
        document.getElementById('input-nombre').value = '';
        document.getElementById('input-proceso').value = '';
        document.getElementById('input-ruta').value = '';
        document.getElementById('form-add-app').classList.add('hidden');
        apps = obtenerApps();
        document.getElementById('contador').textContent = `${apps.length} apps`;
        const filtro = document.getElementById('input-buscar').value.toLowerCase();
        renderizarApps(apps.filter(a => a.nombre.toLowerCase().includes(filtro)));
        alertas('success', `"${nombre}" added`);
    });

    document.getElementById('input-buscar').addEventListener('input', (e) => {
        const filtro = e.target.value.toLowerCase();
        renderizarApps(apps.filter(a => a.nombre.toLowerCase().includes(filtro)));
    });

    document.getElementById('btn-bloquear').addEventListener('click', iniciarBloqueo);
    document.getElementById('btn-desbloquear').addEventListener('click', desbloquearTodo);

    window.addEventListener('beforeunload', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    restaurarEstadoBloqueo();
})();

function renderizarApps(lista) {
    const contenedor = document.getElementById('lista-apps');
    const sinResultados = document.getElementById('sin-resultados');

    contenedor.innerHTML = '';

    if (lista.length === 0) {
        sinResultados.classList.remove('hidden');
        return;
    }

    sinResultados.classList.add('hidden');

    for (const app of lista) {
        const div = document.createElement('div');
        const bloqueada = bloqueadas.includes(app.nombre);
        div.className = `flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${bloqueada ? 'bg-red-100 border-red-300 line-through text-gray-400' : 'hover:bg-gray-50 border-gray-200'}`;
        div.dataset.nombre = app.nombre;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = bloqueada;
        checkbox.disabled = bloqueada;
        checkbox.className = 'w-4 h-4 accent-red-600 cursor-pointer shrink-0';

        const icono = document.createElement('img');
        icono.className = 'w-7 h-7 rounded';
        icono.alt = '';
        if (app.icono) {
            icono.src = app.icono;
        } else {
            icono.className = 'w-7 h-7 rounded hidden';
        }

        const label = document.createElement('span');
        label.className = 'text-sm truncate flex-1';
        label.textContent = app.nombre;

        div.appendChild(checkbox);
        div.appendChild(icono);
        div.appendChild(label);

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'text-red-400 hover:text-red-600 text-xs px-1 shrink-0';
        btnEliminar.textContent = '✕';
        btnEliminar.title = 'Remove';
        btnEliminar.addEventListener('click', (e) => {
            e.stopPropagation();
            eliminarApp(app.id);
            apps = obtenerApps();
            renderizarApps(apps);
            document.getElementById('contador').textContent = `${apps.length} apps`;
        });
        div.appendChild(btnEliminar);

        // Evento para marcar/desmarcar al hacer clic en la tarjeta
        div.addEventListener('click', (e) => {
            if (e.target !== checkbox && e.target !== btnEliminar && !bloqueada) {
                checkbox.checked = !checkbox.checked;
                sincronizarSeleccionadas();
            }
        });

        // Persistir selección cuando el usuario cambia el checkbox directamente
        checkbox.addEventListener('change', sincronizarSeleccionadas);

        contenedor.appendChild(div);
    }

    // Una vez renderizada, restaurar las selecciones guardadas
    restaurarSeleccionadas();
}

async function iniciarBloqueo() {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    const seleccionadas = [];
    document.querySelectorAll('#lista-apps input[type="checkbox"]:checked').forEach(cb => {
        const nombre = cb.closest('div').dataset.nombre;
        const app = apps.find(a => a.nombre === nombre);
        if (app) seleccionadas.push(app);
    });

    if (seleccionadas.length === 0) {
        alertas('warning', 'Select at least one app to block');
        return;
    }

    const minutos = parseInt(document.getElementById('select-tiempo').value);
    bloqueadas = seleccionadas.map(a => a.nombre);

    await window.electronAPI.bloquearApps(seleccionadas.map(a => a.proceso.replace(/\.exe$/i, '')), minutos);

    finBloqueo = Date.now() + minutos * 60 * 1000;
    guardarEstadoBloqueo();
    mostrarEstadoBloqueo();
    actualizarTiempoRestante();
    // Limpiar selección de pomodoro porque las apps ya están bloqueadas
    guardarSeleccionadas([]);
    renderizarApps(apps.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
}

function mostrarEstadoBloqueo() {
    const div = document.getElementById('estado-bloqueo');
    div.classList.remove('hidden');
    document.getElementById('texto-estado').textContent = `Blocking: ${bloqueadas.join(', ')}`;
    document.getElementById('btn-bloquear').disabled = true;
}

function actualizarTiempoRestante() {
    if (!finBloqueo) return;

    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }

    const ahora = Date.now();
    const restante = Math.max(0, Math.floor((finBloqueo - ahora) / 1000));

    if (restante <= 0) {
        document.getElementById('estado-bloqueo').classList.add('hidden');
        document.getElementById('btn-bloquear').disabled = false;
        bloqueadas = [];
        finBloqueo = null;
        sessionStorage.removeItem('appblocker-bloqueo');
        renderizarApps(apps.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
        return;
    }

    const mins = Math.floor(restante / 60);
    const segs = restante % 60;
    document.getElementById('tiempo-restante').textContent = `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;

    timeoutId = setTimeout(actualizarTiempoRestante, 1000);
}

async function desbloquearTodo() {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    await window.electronAPI.desbloquearTodo();
    bloqueadas = [];
    finBloqueo = null;
    sessionStorage.removeItem('appblocker-bloqueo');
    document.getElementById('estado-bloqueo').classList.add('hidden');
    document.getElementById('btn-bloquear').disabled = false;
    guardarSeleccionadas([]);
    renderizarApps(apps.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
}