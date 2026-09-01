/**
 * AppBlocker - Gestor de bloqueo de aplicaciones
 *
 * Permite al usuario:
 * - Agregar aplicaciones a una lista de bloqueo
 * - Seleccionar apps para bloquear durante sesiones de Pomodoro
 * - Iniciar/detener bloqueos que impiden la ejecución de procesos en el SO
 *
 * Interacción:
 * - Llamadas IPC: window.electronAPI.bloquearApps(), desbloquearTodo(), obtenerIcono()
 * - Almacenamiento: localStorage para apps guardadas y estado de bloqueo en sessionStorage
 * - Endpoint backend: no usa API directa, solo controla procesos via IPC
 */
(function() {
    // Estado del módulo
    let aplicaciones = [];        // Lista de apps guardadas
    let bloqueadas = [];          // Apps actualmente bloqueadas
    let finBloqueo = null;        // Timestamp de fin del bloqueo
    let idTemporizador = null;    // ID del interval que actualiza el timer visual

    // ── Gestión de apps seleccionadas ──
    // Persisten en localStorage para que el Pomodoro sepa qué apps bloquear

    function obtenerSeleccionadas() {
        return JSON.parse(localStorage.getItem('pomodoro-apps-seleccionadas') || '[]');
    }

    function guardarSeleccionadas(seleccionadas) {
        localStorage.setItem('pomodoro-apps-seleccionadas', JSON.stringify(seleccionadas));
    }

    // Sincroniza checkboxes → localStorage cada vez que cambian
    function sincronizarSeleccionadas() {
        const seleccionadas = [];
        document.querySelectorAll('#lista-apps input[type="checkbox"]').forEach(checkbox => {
            const contenedor = checkbox.closest('div');
            if (checkbox.checked && !checkbox.disabled) {
                const app = aplicaciones.find(a => a.nombre === contenedor.dataset.nombre);
                if (app) seleccionadas.push(app.proceso.replace(/\.exe$/i, ''));
            }
        });
        guardarSeleccionadas(seleccionadas);
    }

    function restaurarSeleccionadas() {
        const seleccionadas = obtenerSeleccionadas();
        document.querySelectorAll('#lista-apps input[type="checkbox"]').forEach(checkbox => {
            const contenedor = checkbox.closest('div');
            const app = aplicaciones.find(a => a.nombre === contenedor.dataset.nombre);
            if (app && !checkbox.disabled) {
                checkbox.checked = seleccionadas.includes(app.proceso.replace(/\.exe$/i, ''));
            }
        });
    }

    // ── Restauración de estado de bloqueo ──
    // Si había un bloqueo en marcha, lo restaura desde sessionStorage

    function guardarEstadoBloqueo() {
        sessionStorage.setItem('appblocker-bloqueo', JSON.stringify({
            bloqueadas,
            finBloqueo,
        }));
        window.dispatchEvent(new CustomEvent('app-bloqueo-cambio'));
    }

    // Sincroniza el estado de bloqueo cuando se navega entre páginas SPA
    function aplicarEstadoBloqueoDesdeStorage() {
        const habiaBloqueo = restaurarEstadoBloqueo();
        if (!habiaBloqueo) {
            if (idTemporizador) {
                clearTimeout(idTemporizador);
                idTemporizador = null;
            }
            bloqueadas = [];
            finBloqueo = null;
            const banner = document.getElementById('estado-bloqueo');
            const btn = document.getElementById('btn-bloquear');
            if (banner) banner.classList.add('hidden');
            if (btn) btn.disabled = false;
            const filtro = (document.getElementById('input-buscar')?.value || '').toLowerCase();
            renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(filtro)));
        }
    }

    function restaurarEstadoBloqueo() {
        try {
            const guardado = JSON.parse(sessionStorage.getItem('appblocker-bloqueo'));
            if (guardado && guardado.finBloqueo && Date.now() < guardado.finBloqueo) {
                bloqueadas = guardado.bloqueadas || [];
                finBloqueo = guardado.finBloqueo;
                mostrarEstadoBloqueo();
                actualizarTiempoRestante();
                const filtro = (document.getElementById('input-buscar')?.value || '').toLowerCase();
                renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(filtro)));
                return true;
            } else if (guardado) {
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

    function eliminarApp(idApp) {
        const guardadas = obtenerApps();
        const filtradas = guardadas.filter(a => a.id !== idApp);
        localStorage.setItem('apps-bloqueo', JSON.stringify(filtradas));
    }

    (async () => {
        aplicaciones = obtenerApps();
        document.getElementById('contador').textContent = `${aplicaciones.length} apps`;

        for (const app of aplicaciones) {
            if (app.ruta && !app.icono) {
                const icono = await window.electronAPI.obtenerIcono(app.ruta);
                if (icono) app.icono = icono;
            }
        }

        renderizarApps(aplicaciones);

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
            aplicaciones = obtenerApps();
            document.getElementById('contador').textContent = `${aplicaciones.length} apps`;
            const filtro = document.getElementById('input-buscar').value.toLowerCase();
            renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(filtro)));
            alertas('success', `"${nombre}" added`);
        });

        document.getElementById('input-buscar').addEventListener('input', (evento) => {
            const filtro = evento.target.value.toLowerCase();
            renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(filtro)));
        });

        document.getElementById('btn-bloquear').addEventListener('click', iniciarBloqueo);
        document.getElementById('btn-desbloquear').addEventListener('click', desbloquearTodo);

        window.addEventListener('beforeunload', () => {
            if (idTemporizador) clearTimeout(idTemporizador);
        });

        restaurarEstadoBloqueo();

        const onBloqueoCambio = () => {
            if (!document.getElementById('estado-bloqueo')) return;
            aplicarEstadoBloqueoDesdeStorage();
        };
        window.addEventListener('app-bloqueo-cambio', onBloqueoCambio);

        const observadorApp = new MutationObserver(() => {
            if (!document.getElementById('estado-bloqueo')) {
                window.removeEventListener('app-bloqueo-cambio', onBloqueoCambio);
                observadorApp.disconnect();
            }
        });
        const appRoot = document.getElementById('app');
        if (appRoot) observadorApp.observe(appRoot, { childList: true });
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
            const tarjeta = document.createElement('div');
            const bloqueada = bloqueadas.includes(app.nombre);
            tarjeta.className = `flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${bloqueada ? 'bg-red-100 border-red-300 line-through text-gray-400' : 'hover:bg-gray-50 border-gray-200'}`;
            tarjeta.dataset.nombre = app.nombre;

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

            const etiqueta = document.createElement('span');
            etiqueta.className = 'text-sm truncate flex-1';
            etiqueta.textContent = app.nombre;

            tarjeta.appendChild(checkbox);
            tarjeta.appendChild(icono);
            tarjeta.appendChild(etiqueta);

            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'text-red-400 hover:text-red-600 text-xs px-1 shrink-0';
            btnEliminar.textContent = '✕';
            btnEliminar.title = 'Remove';
            btnEliminar.addEventListener('click', (evento) => {
                evento.stopPropagation();
                eliminarApp(app.id);
                aplicaciones = obtenerApps();
                renderizarApps(aplicaciones);
                document.getElementById('contador').textContent = `${aplicaciones.length} apps`;
            });
            tarjeta.appendChild(btnEliminar);

            tarjeta.addEventListener('click', (evento) => {
                if (evento.target !== checkbox && evento.target !== btnEliminar && !bloqueada) {
                    checkbox.checked = !checkbox.checked;
                    sincronizarSeleccionadas();
                }
            });

            checkbox.addEventListener('change', sincronizarSeleccionadas);

            contenedor.appendChild(tarjeta);
        }

        restaurarSeleccionadas();
    }

    /**
     * Inicia bloqueo de apps seleccionadas.
     * 1. Valida que al menos una app esté seleccionada
     * 2. Llama window.electronAPI.bloquearApps(procesos, minutos) para matar procesos en el SO
     * 3. Guarda estado en sessionStorage para que persista entre navegaciones SPA
     */
    async function iniciarBloqueo() {
        if (idTemporizador) {
            clearTimeout(idTemporizador);
            idTemporizador = null;
        }
        const seleccionadas = [];
        document.querySelectorAll('#lista-apps input[type="checkbox"]:checked').forEach(checkbox => {
            const nombre = checkbox.closest('div').dataset.nombre;
            const app = aplicaciones.find(a => a.nombre === nombre);
            if (app) seleccionadas.push(app);
        });

        if (seleccionadas.length === 0) {
            alertas('warning', 'Select at least one app to block');
            return;
        }

        const minutos = parseInt(document.getElementById('select-tiempo').value);
        bloqueadas = seleccionadas.map(a => a.nombre);

        // Llamar IPC para bloquear procesos en Windows/Mac/Linux
        await window.electronAPI.bloquearApps(seleccionadas.map(a => a.proceso.replace(/\.exe$/i, '')), minutos);

        finBloqueo = Date.now() + minutos * 60 * 1000;
        guardarEstadoBloqueo();
        mostrarEstadoBloqueo();
        actualizarTiempoRestante();
        guardarSeleccionadas([]);
        renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
    }

    function mostrarEstadoBloqueo() {
        const div = document.getElementById('estado-bloqueo');
        div.classList.remove('hidden');
        document.getElementById('texto-estado').textContent = `Blocking: ${bloqueadas.join(', ')}`;
        document.getElementById('btn-bloquear').disabled = true;
    }

    function actualizarTiempoRestante() {
        if (!finBloqueo) return;

        if (idTemporizador) {
            clearTimeout(idTemporizador);
            idTemporizador = null;
        }

        const ahora = Date.now();
        const restante = Math.max(0, Math.floor((finBloqueo - ahora) / 1000));

        if (restante <= 0) {
            document.getElementById('estado-bloqueo').classList.add('hidden');
            document.getElementById('btn-bloquear').disabled = false;
            bloqueadas = [];
            finBloqueo = null;
            sessionStorage.removeItem('appblocker-bloqueo');
            renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
            return;
        }

        const minutos = Math.floor(restante / 60);
        const segundos = restante % 60;
        document.getElementById('tiempo-restante').textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

        idTemporizador = setTimeout(actualizarTiempoRestante, 1000);
    }

    async function desbloquearTodo() {
        if (idTemporizador) {
            clearTimeout(idTemporizador);
            idTemporizador = null;
        }
        await window.electronAPI.desbloquearTodo();
        bloqueadas = [];
        finBloqueo = null;
        if (typeof window.limpiarEstadoBloqueoApps === 'function') {
            window.limpiarEstadoBloqueoApps();
        } else {
            sessionStorage.removeItem('appblocker-bloqueo');
        }
        document.getElementById('estado-bloqueo').classList.add('hidden');
        document.getElementById('btn-bloquear').disabled = false;
        guardarSeleccionadas([]);
        renderizarApps(aplicaciones.filter(a => a.nombre.toLowerCase().includes(document.getElementById('input-buscar').value.toLowerCase())));
    }
})();
