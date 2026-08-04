function cargarPagina(evento, pagina) {
    if (evento) evento.preventDefault();
    const divApp = document.getElementById('app');

    const rutas = {
        bienvenida: 'welcome/welcome.html',
        bloqueoApps: 'AppBlocker/appBlocker.html',
        pomodoro: 'Pomodoro/pomodoro.html',
        chatIA: 'chatAI/chat.html',
        musica: 'music/music.html',
        notas: 'notes/notes.html',
    };

    const ruta = rutas[pagina];
    if (!ruta) {
        divApp.innerHTML = '<p class="text-gray-500">Página en construcción</p>';
        return;
    }

    fetch(ruta)
        .then(respuesta => {
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} loading ${ruta}`);
            return respuesta.text();
        })
        .then(html => {
            divApp.innerHTML = html;
            divApp.querySelectorAll('script').forEach(scriptOriginal => {
                const scriptNuevo = document.createElement('script');
                for (const attr of scriptOriginal.attributes) {
                    scriptNuevo.setAttribute(attr.name, attr.value);
                }
                scriptNuevo.textContent = scriptOriginal.textContent;
                scriptOriginal.replaceWith(scriptNuevo);
            });
        })
        .catch(error => {
            divApp.innerHTML = `<p class="text-red-500">Error loading page: ${error.message}</p>`;
        });
}

// Cargar la página de bienvenida al iniciar la aplicación
document.addEventListener('DOMContentLoaded', () => cargarPagina(null, 'bienvenida'));

const CLAVE_POMODORO_CONFIG = 'pomodoro-config';
const POMODORO_DEFECTO = { minutosSesion: 60, numeroSesiones: 3, minutosDescanso: 5 };

function leerConfigPomodoro() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_POMODORO_CONFIG));
        if (guardado && guardado.minutosSesion != null && guardado.numeroSesiones != null && guardado.minutosDescanso != null) {
            return guardado;
        }
    } catch (_) { /* ignore */ }
    return { ...POMODORO_DEFECTO };
}

function formatearDuracionHoras(minutos) {
    if (minutos < 60) return minutos + ' min';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? h + ' h' : h + ' h ' + m + ' min';
}

function formatearEtiquetaSesion(minutos) {
    if (minutos < 60) return minutos + ' min';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? h + ' h' : h + ' h ' + m + ' min';
}

function rellenarPreviewFocusSession() {
    const cfg = leerConfigPomodoro();
    const totalSesionesMin = cfg.minutosSesion * cfg.numeroSesiones;
    const totalDescansos = Math.max(0, cfg.numeroSesiones - 1);

    const el = (id) => document.getElementById(id);
    if (el('focus-preview-sessions')) {
        el('focus-preview-sessions').textContent =
            cfg.numeroSesiones + ' sesiones de ' + formatearEtiquetaSesion(cfg.minutosSesion);
    }
    if (el('focus-preview-total-hours')) {
        el('focus-preview-total-hours').textContent = formatearDuracionHoras(totalSesionesMin);
    }
    if (el('focus-preview-total-minutes')) {
        el('focus-preview-total-minutes').textContent = totalSesionesMin + ' min';
    }
    if (el('focus-preview-break-time')) {
        el('focus-preview-break-time').textContent = cfg.minutosDescanso + ' min';
    }
    if (el('focus-preview-total-breaks')) {
        el('focus-preview-total-breaks').textContent =
            totalDescansos + (totalDescansos === 1 ? ' descanso' : ' descansos');
    }
}

function abrirModalFocusSession(evento) {
    if (evento) evento.preventDefault();
    rellenarPreviewFocusSession();
    const modal = document.getElementById('modal-focus-session');
    if (modal) modal.classList.remove('hidden');
}

function cerrarModalFocusSession() {
    const modal = document.getElementById('modal-focus-session');
    if (modal) modal.classList.add('hidden');
}

function confirmarFocusSession() {
    cerrarModalFocusSession();
    window.iniciarPomodoroAuto = true;
    cargarPagina(null, 'pomodoro');
}

// ── Widget del temporizador en la barra lateral ──

const CLAVE_POMODORO_TIMER = 'pomodoro-timer';
let sidebarFocusIntervalo = null;

/** Callbacks que registra pomodoro.js mientras la página está montada */
window.pomodoroSidebarHooks = {
    pausar: null,
    reanudar: null,
    detener: null,
    reiniciar: null,
    cleanup: null,
};

function formatearCuentaAtrasSidebar(totalSegundos) {
    if (totalSegundos <= 0) return '00:00';
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

function leerEstadoTemporizadorPomodoro() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_POMODORO_TIMER));
        if (guardado && (guardado.estado === 'running' || guardado.estado === 'paused' || guardado.estado === 'completed')) {
            return guardado;
        }
    } catch (_) { /* ignore */ }
    return null;
}

function calcularSegundosRestantesSidebar(guardado) {
    if (!guardado) return 0;
    if (guardado.estado === 'paused' || guardado.estado === 'completed') {
        return Math.max(0, guardado.segundosRestantes || 0);
    }
    if (guardado.estado === 'running') {
        const transcurridos = Math.floor((Date.now() - (guardado.marcaTiempo || Date.now())) / 1000);
        return Math.max(0, (guardado.segundosRestantes || 0) - transcurridos);
    }
    return 0;
}

/**
 * Si el tiempo de la fase actual se agotó (navegando fuera de Pomodoro),
 * avanza sesiones/descansos en localStorage y lo persiste.
 * @returns {object|null} Estado actualizado (o null si no hay)
 */
function sincronizarFasesPomodoroSidebar(guardado) {
    // Con la página Pomodoro montada, ella es la fuente de verdad
    if (document.getElementById('pomodoro-app')) return guardado;
    if (!guardado || guardado.estado !== 'running') return guardado;

    const cfg = guardado.instantaneaConfig || leerConfigPomodoro();
    let restante = calcularSegundosRestantesSidebar(guardado);
    if (restante > 0) return guardado;

    let fase = guardado.fase || 'session';
    let sesionActual = guardado.sesionActual || 1;
    let descansoActual = guardado.descansoActual || 0;
    let totalSegundosFase = guardado.totalSegundosFase || 1;

    // restante ya es <= 0: sumamos el exceso negativo al calcular desde marcaTiempo
    const transcurridos = Math.floor((Date.now() - (guardado.marcaTiempo || Date.now())) / 1000);
    restante = (guardado.segundosRestantes || 0) - transcurridos;

    while (restante <= 0) {
        if (fase === 'session') {
            if (sesionActual < (cfg.numeroSesiones || 3)) {
                descansoActual++;
                fase = 'break';
                totalSegundosFase = (cfg.minutosDescanso || 5) * 60;
                restante += totalSegundosFase;
            } else {
                const completado = {
                    ...guardado,
                    estado: 'completed',
                    fase: 'session',
                    sesionActual,
                    descansoActual,
                    segundosRestantes: 0,
                    totalSegundosFase,
                    marcaTiempo: Date.now(),
                };
                localStorage.setItem(CLAVE_POMODORO_TIMER, JSON.stringify(completado));
                return completado;
            }
        } else {
            sesionActual++;
            fase = 'session';
            totalSegundosFase = (cfg.minutosSesion || 60) * 60;
            restante += totalSegundosFase;
        }
    }

    const actualizado = {
        ...guardado,
        estado: 'running',
        fase,
        sesionActual,
        descansoActual,
        segundosRestantes: restante,
        totalSegundosFase,
        marcaTiempo: Date.now(),
        instantaneaConfig: cfg,
    };
    localStorage.setItem(CLAVE_POMODORO_TIMER, JSON.stringify(actualizado));
    return actualizado;
}

function mostrarVistaSidebarFocus(vista) {
    const idle = document.getElementById('sidebar-focus-idle');
    const active = document.getElementById('sidebar-focus-active');
    const completed = document.getElementById('sidebar-focus-completed');
    if (!idle || !active || !completed) return;
    idle.classList.toggle('hidden', vista !== 'idle');
    active.classList.toggle('hidden', vista !== 'active');
    completed.classList.toggle('hidden', vista !== 'completed');
}

function pintarSidebarFocusDesdeEstado(guardado) {
    guardado = sincronizarFasesPomodoroSidebar(guardado);

    if (!guardado) {
        mostrarVistaSidebarFocus('idle');
        return;
    }

    if (guardado.estado === 'completed') {
        mostrarVistaSidebarFocus('completed');
        return;
    }

    if (guardado.estado !== 'running' && guardado.estado !== 'paused') {
        mostrarVistaSidebarFocus('idle');
        return;
    }

    mostrarVistaSidebarFocus('active');

    const cfg = guardado.instantaneaConfig || leerConfigPomodoro();
    const numeroSesiones = cfg.numeroSesiones || 3;
    const numeroDescansos = Math.max(0, numeroSesiones - 1);
    const fase = guardado.fase || 'session';
    const sesionActual = guardado.sesionActual || 1;
    const descansoActual = guardado.descansoActual || 0;
    const totalSegundosFase = guardado.totalSegundosFase || 1;
    const segundosRestantes = calcularSegundosRestantesSidebar(guardado);

    const phaseEl = document.getElementById('sidebar-focus-phase');
    const countdownEl = document.getElementById('sidebar-focus-countdown');
    const progressEl = document.getElementById('sidebar-focus-progress');
    const pauseBtn = document.getElementById('sidebar-focus-pause');

    if (phaseEl) {
        phaseEl.textContent = fase === 'session'
            ? `SESIÓN ${sesionActual} DE ${numeroSesiones}`
            : `DESCANSO ${descansoActual} DE ${numeroDescansos}`;
    }
    if (countdownEl) {
        countdownEl.textContent = formatearCuentaAtrasSidebar(segundosRestantes);
    }
    if (progressEl) {
        const pct = totalSegundosFase > 0 ? (segundosRestantes / totalSegundosFase) * 100 : 0;
        progressEl.style.width = Math.max(0, pct) + '%';
        progressEl.className = 'h-1.5 rounded-full transition-all duration-700 ease-linear ' +
            (fase === 'session' ? 'bg-blue-600' : 'bg-green-500');
    }
    if (pauseBtn) {
        if (guardado.estado === 'paused') {
            pauseBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Reanudar';
        } else {
            pauseBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg> Pausa';
        }
    }
}

function actualizarSidebarFocusTimer() {
    pintarSidebarFocusDesdeEstado(leerEstadoTemporizadorPomodoro());
}

function asegurarTickSidebarFocus() {
    if (sidebarFocusIntervalo) return;
    sidebarFocusIntervalo = setInterval(() => {
        const estado = leerEstadoTemporizadorPomodoro();
        if (!estado || (estado.estado !== 'running' && estado.estado !== 'paused' && estado.estado !== 'completed')) {
            pintarSidebarFocusDesdeEstado(null);
            return;
        }
        pintarSidebarFocusDesdeEstado(estado);
    }, 1000);
}

function sidebarFocusPausa() {
    if (typeof window.pomodoroSidebarHooks.pausar === 'function' ||
        typeof window.pomodoroSidebarHooks.reanudar === 'function') {
        const guardado = leerEstadoTemporizadorPomodoro();
        if (guardado?.estado === 'paused' && window.pomodoroSidebarHooks.reanudar) {
            window.pomodoroSidebarHooks.reanudar();
        } else if (window.pomodoroSidebarHooks.pausar) {
            window.pomodoroSidebarHooks.pausar();
        }
        setTimeout(actualizarSidebarFocusTimer, 50);
        return;
    }

    const guardado = leerEstadoTemporizadorPomodoro();
    if (!guardado) return;

    if (guardado.estado === 'running') {
        const restante = calcularSegundosRestantesSidebar(guardado);
        guardado.estado = 'paused';
        guardado.segundosRestantes = restante;
        guardado.marcaTiempo = Date.now();
        localStorage.setItem(CLAVE_POMODORO_TIMER, JSON.stringify(guardado));
    } else if (guardado.estado === 'paused') {
        guardado.estado = 'running';
        guardado.marcaTiempo = Date.now();
        localStorage.setItem(CLAVE_POMODORO_TIMER, JSON.stringify(guardado));
    }
    actualizarSidebarFocusTimer();
}

async function sidebarFocusDetener() {
    if (typeof window.pomodoroSidebarHooks.detener === 'function') {
        window.pomodoroSidebarHooks.detener();
        setTimeout(actualizarSidebarFocusTimer, 50);
        return;
    }

    localStorage.removeItem(CLAVE_POMODORO_TIMER);
    if (window.electronAPI?.desbloquearTodo) {
        try { await window.electronAPI.desbloquearTodo(); } catch (_) { /* ignore */ }
    }
    actualizarSidebarFocusTimer();
}

function sidebarFocusReiniciar() {
    if (typeof window.pomodoroSidebarHooks.reiniciar === 'function') {
        window.pomodoroSidebarHooks.reiniciar();
        setTimeout(actualizarSidebarFocusTimer, 50);
        return;
    }
    localStorage.removeItem(CLAVE_POMODORO_TIMER);
    actualizarSidebarFocusTimer();
}

window.actualizarSidebarFocusTimer = actualizarSidebarFocusTimer;

document.addEventListener('DOMContentLoaded', () => {
    actualizarSidebarFocusTimer();
    asegurarTickSidebarFocus();
});

window.addEventListener('storage', (e) => {
    if (e.key === CLAVE_POMODORO_TIMER) actualizarSidebarFocusTimer();
});

const coloresModal = {
    info:    { color: 'bg-blue-500', hover: 'hover:bg-blue-600', icono: 'ℹ️' },
    warning: { color: 'bg-yellow-500', hover: 'hover:bg-yellow-600', icono: '⚠️' },
    success: { color: 'bg-green-500', hover: 'hover:bg-green-600', icono: '✅' },
    error:   { color: 'bg-red-500', hover: 'hover:bg-red-600', icono: '❌' },
};

let modalResolver = null;
let modalEsConfirmacion = false;

function obtenerElementosModal() {
    return {
        overlay: document.getElementById('modal-overlay'),
        titulo: document.getElementById('modal-titulo'),
        icono: document.getElementById('modal-icono'),
        texto: document.getElementById('modal-mensaje'),
        boton: document.getElementById('modal-boton'),
        cancelar: document.getElementById('modal-boton-cancelar'),
    };
}

function restablecerModal() {
    const modal = obtenerElementosModal();
    if (!modal.overlay) return;

    modalEsConfirmacion = false;
    modalResolver = null;
    modal.titulo.classList.add('hidden');
    modal.cancelar.classList.add('hidden');
    modal.boton.textContent = 'Aceptar';
    modal.boton.onclick = () => cerrarModal(true);
    modal.cancelar.onclick = () => cerrarModal(false);
}

function cerrarModal(resultado) {
    const modal = obtenerElementosModal();
    if (!modal.overlay) return;

    modal.overlay.classList.add('hidden');

    if (modalResolver) {
        const resolver = modalResolver;
        modalResolver = null;
        resolver(!!resultado);
    }

    restablecerModal();
}

function cerrarModalOverlay() {
    cerrarModal(modalEsConfirmacion ? false : true);
}

function alertas(tipo, mensaje) {
    const modal = obtenerElementosModal();
    if (!modal.overlay) return;

    const c = coloresModal[tipo] || coloresModal.info;

    modal.titulo.classList.add('hidden');
    modal.cancelar.classList.add('hidden');
    modal.texto.textContent = mensaje;
    modal.icono.textContent = c.icono;
    modal.boton.textContent = 'Aceptar';
    modal.boton.className = `px-4 py-2 text-white rounded-md transition-colors duration-200 ${c.color} ${c.hover}`;
    modal.boton.onclick = () => cerrarModal(true);
    modalEsConfirmacion = false;
    modal.overlay.classList.remove('hidden');
}

function confirmarModal(mensaje, opciones = {}) {
    const modal = obtenerElementosModal();
    if (!modal.overlay) return Promise.resolve(false);

    const tipo = opciones.tipo || 'warning';
    const c = coloresModal[tipo] || coloresModal.warning;

    return new Promise((resolve) => {
        modalEsConfirmacion = true;
        modalResolver = resolve;

        modal.titulo.textContent = opciones.titulo || 'Confirmar acción';
        modal.titulo.classList.remove('hidden');
        modal.texto.textContent = mensaje;
        modal.icono.textContent = c.icono;

        modal.cancelar.textContent = opciones.cancelar || 'Cancelar';
        modal.cancelar.classList.remove('hidden');
        modal.cancelar.onclick = () => cerrarModal(false);

        modal.boton.textContent = opciones.confirmar || 'Confirmar';
        modal.boton.className = `px-4 py-2 text-white rounded-md transition-colors duration-200 ${c.color} ${c.hover}`;
        modal.boton.onclick = () => cerrarModal(true);

        modal.overlay.classList.remove('hidden');
    });
}
