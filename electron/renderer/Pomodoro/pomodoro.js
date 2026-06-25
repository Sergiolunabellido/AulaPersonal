/**
 * Módulo Pomodoro - Configurador y temporizador de sesiones de estudio.
 *
 * Ofrece dos modos de funcionamiento:
 *   1. CONFIGURACIÓN (idle): el usuario selecciona duración de sesión,
 *      número de sesiones y duración de descansos. El panel derecho
 *      muestra una vista previa con los totales calculados.
 *   2. TEMPORIZACIÓN (running): una vez iniciado, alterna automáticamente
 *      entre sesiones de estudio y descansos hasta completar todo el ciclo.
 *
 * PERSISTENCIA:
 *   - La configuración (sessionMinutes, sessionCount, breakMinutes) se guarda
 *     en localStorage con clave 'pomodoro-config'.
 *   - El estado del temporizador (running/paused, fase, tiempo restante) se
 *     guarda en localStorage con clave 'pomodoro-timer'. Esto permite que el
 *     temporizador sobreviva a la navegación entre páginas e incluso al cierre
 *     de la aplicación.
 *   - Al restaurar un temporizador en estado 'running', se calcula el tiempo
 *     transcurrido desde la última vez que se guardó y se avanza por las fases
 *     correspondientes (sesión -> descanso -> sesión -> ...).
 *
 * CICLO DE VIDA DEL TEMPORIZADOR:
 *   IDLE ──[Iniciar]──> RUNNING (Sesión 1) ──[fin]──> RUNNING (Descanso 1)
 *   ──[fin]──> RUNNING (Sesión 2) ── ... ──[fin]──> COMPLETED
 *   COMPLETED ──[Nueva sesión]──> IDLE
 *   RUNNING ──[Pausa]──> PAUSED ──[Reanudar]──> RUNNING
 *   RUNNING/PAUSED ──[Detener]──> IDLE
 *
 * Estados:
 *   idle      - Configuración visible, temporizador sin iniciar
 *   running   - Temporizador activo, cuenta atrás en curso
 *   paused    - Temporizador pausado, se conserva el tiempo restante
 *   completed - Todas las sesiones y descansos han finalizado
 *
 * Fases dentro de running:
 *   session   - Periodo de estudio activo
 *   break     - Periodo de descanso entre sesiones
 *
 * RELACIÓN SESIONES-DESCANSOS:
 *   Los descansos ocurren SIEMPRE entre sesiones.
 *   Para N sesiones hay N-1 descansos.
 *   Ej: 3 sesiones -> Sesión1 -> Descanso1 -> Sesión2 -> Descanso2 -> Sesión3 -> COMPLETED
 */
(function () {
  'use strict';

  // ========================================================================
  //  CLAVES DE LOCALSTORAGE
  // ========================================================================

  /** Clave para la configuración (sessionMinutes, sessionCount, breakMinutes) */
  const STORAGE_CONFIG_KEY = 'pomodoro-config';

  /** Clave para el estado del temporizador (running/paused, fase, tiempo, etc.) */
  const STORAGE_TIMER_KEY = 'pomodoro-timer';

  // ========================================================================
  //  VALORES POR DEFECTO
  // ========================================================================

  /** @type {{ sessionMinutes: number, sessionCount: number, breakMinutes: number }} */
  const DEFAULTS = {
    sessionMinutes: 60,
    sessionCount: 3,
    breakMinutes: 5,
  };

  // ========================================================================
  //  ESTADO DE CONFIGURACIÓN
  //  Se persiste en localStorage para que sobreviva entre sesiones de la app.
  // ========================================================================

  /**
   * Carga la configuración guardada o devuelve los valores por defecto.
   * @returns {{ sessionMinutes: number, sessionCount: number, breakMinutes: number }}
   */
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_CONFIG_KEY));
      if (saved && saved.sessionMinutes != null && saved.sessionCount != null && saved.breakMinutes != null) {
        return saved;
      }
    } catch { /* ignorar datos corruptos */ }
    return { ...DEFAULTS };
  }

  /**
   * Persiste la configuración en localStorage.
   */
  function persistState() {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({
      sessionMinutes: state.sessionMinutes,
      sessionCount: state.sessionCount,
      breakMinutes: state.breakMinutes,
    }));
  }

  /** @type {{ sessionMinutes: number, sessionCount: number, breakMinutes: number }} */
  const state = loadState();

  // ========================================================================
  //  PERSISTENCIA DEL ESTADO DEL TEMPORIZADOR
  //  Permite que el pomodoro continúe funcionando aunque el usuario navegue
  //  a otras páginas o cierre y reabra la aplicación.
  // ========================================================================

  /**
   * Guarda el estado completo del temporizador en localStorage.
   * Incluye tanto las variables del timer como la configuración con la que
   * se inició, para poder restaurar correctamente al volver.
   */
  function persistTimerState() {
    localStorage.setItem(STORAGE_TIMER_KEY, JSON.stringify({
      status: timer.status,
      phase: timer.phase,
      currentSession: timer.currentSession,
      currentBreak: timer.currentBreak,
      remainingSeconds: timer.remainingSeconds,
      totalPhaseSeconds: timer.totalPhaseSeconds,
      timestamp: Date.now(),
      configSnapshot: {
        sessionMinutes: state.sessionMinutes,
        sessionCount: state.sessionCount,
        breakMinutes: state.breakMinutes,
      },
    }));
  }

  /**
   * Lee el estado del temporizador guardado en localStorage.
   * @returns {object|null} Estado guardado o null si no hay nada válido
   */
  function loadTimerState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_TIMER_KEY));
      if (saved && (saved.status === 'running' || saved.status === 'paused' || saved.status === 'completed')) {
        return saved;
      }
    } catch { /* ignorar */ }
    return null;
  }

  /**
   * Elimina el estado del temporizador de localStorage.
   * Se llama al detener, reiniciar o completar el ciclo.
   */
  function clearTimerState() {
    localStorage.removeItem(STORAGE_TIMER_KEY);
  }

  /**
   * Restaura el temporizador a partir del estado guardado.
   *
   * Si el estado era 'running', calcula el tiempo transcurrido desde el
   * último guardado y avanza por las fases necesarias (sesión -> descanso
   * -> siguiente sesión -> ...) hasta ponerse al día.
   *
   * Si el estado era 'paused', restaura el tiempo restante exacto.
   *
   * Si el estado era 'completed', muestra la pantalla de finalización.
   *
   * @param {object} saved - Estado cargado de localStorage
   * @returns {boolean} true si se restauró el temporizador, false si no
   */
  function restoreTimerState(saved) {
    // Restaurar la configuración con la que se inició el temporizador
    const cfg = saved.configSnapshot || DEFAULTS;
    state.sessionMinutes = cfg.sessionMinutes;
    state.sessionCount = cfg.sessionCount;
    state.breakMinutes = cfg.breakMinutes;
    persistState();

    if (saved.status === 'completed') {
      // Mostrar pantalla de completado
      timer.status = 'completed';
      timer.phase = saved.phase || 'session';
      timer.currentSession = saved.currentSession || 1;
      timer.currentBreak = saved.currentBreak || 0;
      timer.remainingSeconds = 0;
      timer.totalPhaseSeconds = saved.totalPhaseSeconds || 1;
      showTimerView('completed');
      setControlsEnabled(true);
      updatePreviewUI();
      return true;
    }

    if (saved.status === 'paused') {
      timer.status = 'paused';
      timer.phase = saved.phase;
      timer.currentSession = saved.currentSession;
      timer.currentBreak = saved.currentBreak;
      timer.remainingSeconds = saved.remainingSeconds;
      timer.totalPhaseSeconds = saved.totalPhaseSeconds;
      showTimerView('active');
      setControlsEnabled(false);
      updatePreviewUI();
      updateTimerUI();
      el.btnPause.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Reanudar
      `;
      return true;
    }

    if (saved.status === 'running') {
      // Calcular el tiempo transcurrido mientras se estuvo fuera
      const elapsedSeconds = Math.floor((Date.now() - saved.timestamp) / 1000);
      let remaining = saved.remainingSeconds - elapsedSeconds;
      let phase = saved.phase;
      let currentSession = saved.currentSession;
      let currentBreak = saved.currentBreak;
      const totalPhaseSeconds = saved.totalPhaseSeconds;

      // Avanzar por las fases hasta ponerse al día
      while (remaining <= 0) {
        if (phase === 'session') {
          if (currentSession < cfg.sessionCount) {
            // Pasar a descanso
            currentBreak++;
            phase = 'break';
            remaining = cfg.breakMinutes * 60 + remaining; // remaining es negativo
          } else {
            // Última sesión -> completado
            timer.status = 'completed';
            timer.phase = 'session';
            timer.currentSession = currentSession;
            timer.currentBreak = currentBreak;
            timer.remainingSeconds = 0;
            timer.totalPhaseSeconds = totalPhaseSeconds;
            showTimerView('completed');
            setControlsEnabled(true);
            updatePreviewUI();
            clearTimerState();
            return true;
          }
        } else {
          // Viene de un descanso -> siguiente sesión
          currentSession++;
          phase = 'session';
          remaining = cfg.sessionMinutes * 60 + remaining; // remaining es negativo
        }
      }

      // El temporizador sigue activo
      timer.status = 'running';
      timer.phase = phase;
      timer.currentSession = currentSession;
      timer.currentBreak = currentBreak;
      timer.remainingSeconds = remaining;
      timer.totalPhaseSeconds = phase === 'session'
        ? cfg.sessionMinutes * 60
        : cfg.breakMinutes * 60;

      showTimerView('active');
      setControlsEnabled(false);
      updatePreviewUI();
      updateTimerUI();
      el.btnPause.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        Pausa
      `;

      // Reanudar el intervalo
      timer.intervalId = setInterval(tick, 1000);
      return true;
    }

    return false;
  }

  // ========================================================================
  //  ESTADO DEL TEMPORIZADOR
  //  Gestiona el ciclo de ejecución del pomodoro una vez iniciado.
  // ========================================================================

  /** @type {{ status: string, phase: string, currentSession: number, currentBreak: number, remainingSeconds: number, totalPhaseSeconds: number, intervalId: number|null }} */
  const timer = {
    status: 'idle',
    phase: 'session',
    currentSession: 1,
    currentBreak: 0,
    remainingSeconds: 0,
    totalPhaseSeconds: 0,
    intervalId: null,
  };

  // ========================================================================
  //  REFERENCIAS AL DOM
  // ========================================================================

  /** @type {Object<string, HTMLElement|NodeListOf<HTMLElement>>} */
  const el = {
    sessionTimeButtons: document.querySelectorAll('#session-time-buttons button'),
    sessionCount: document.getElementById('session-count'),
    sessionCountMinus: document.getElementById('session-count-minus'),
    sessionCountPlus: document.getElementById('session-count-plus'),
    breakTimeButtons: document.querySelectorAll('#break-time-buttons button'),
    breakCount: document.getElementById('break-count'),

    previewSessions: document.getElementById('preview-sessions'),
    previewTotalHours: document.getElementById('preview-total-hours'),
    previewTotalMinutes: document.getElementById('preview-total-minutes'),
    previewBreakTime: document.getElementById('preview-break-time'),
    previewTotalBreaks: document.getElementById('preview-total-breaks'),

    timerIdle: document.getElementById('timer-idle'),
    timerActive: document.getElementById('timer-active'),
    timerCompleted: document.getElementById('timer-completed'),
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),
    btnReset: document.getElementById('btn-reset'),
    timerPhaseLabel: document.getElementById('timer-phase-label'),
    timerCountdown: document.getElementById('timer-countdown'),
    timerProgress: document.getElementById('timer-progress'),

    sessionConfigBlock: document.getElementById('session-config-block'),
    breakConfigBlock: document.getElementById('break-config-block'),
    sessionControls: document.getElementById('session-controls'),
    breakControls: document.getElementById('break-controls'),
  };

  // ========================================================================
  //  BLOQUEO DE APPS
  // ========================================================================

  /**
   * Calcula la duración total del pomodoro en minutos (sesiones + descansos).
   * @returns {number}
   */
  function calcularDuracionTotalMinutos() {
    const sesiones = state.sessionMinutes * state.sessionCount;
    const descansos = state.breakMinutes * Math.max(0, state.sessionCount - 1);
    return sesiones + descansos;
  }

  /**
   * Lee de localStorage las apps seleccionadas en AppBlocker.
   * @returns {string[]}
   */
  function obtenerAppsSeleccionadas() {
    try {
      return JSON.parse(localStorage.getItem('pomodoro-apps-seleccionadas') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Bloquea las apps seleccionadas por el tiempo total del pomodoro.
   * @returns {Promise<void>}
   */
  async function bloquearAppsSeleccionadas() {
    const procesos = obtenerAppsSeleccionadas();
    if (procesos.length === 0) return;
    const totalMinutos = calcularDuracionTotalMinutos();
    if (totalMinutos <= 0) return;
    await window.electronAPI.bloquearApps(procesos, totalMinutos);
  }

  /**
   * Desbloquea todas las apps bloqueadas.
   * @returns {Promise<void>}
   */
  async function desbloquearTodasLasApps() {
    await window.electronAPI.desbloquearTodo();
  }

  // ========================================================================
  //  FUNCIONES DE FORMATEO
  // ========================================================================

  /**
   * Convierte minutos a etiqueta textual.
   * @param {number} minutes
   * @returns {string} Ej: "1 h", "1 h 30 min", "30 min"
   */
  function formatSessionLabel(minutes) {
    if (minutes === 60) return '1 h';
    if (minutes > 60 && minutes % 60 === 0) return `${minutes / 60} h`;
    if (minutes > 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    return `${minutes} min`;
  }

  /**
   * Convierte segundos a formato mm:ss o h:mm:ss.
   * @param {number} totalSeconds
   * @returns {string}
   */
  function formatCountdown(totalSeconds) {
    if (totalSeconds <= 0) return '00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  // ========================================================================
  //  ACTUALIZACIÓN DE LA INTERFAZ
  // ========================================================================

  /**
   * Actualiza el panel Session Preview y los indicadores de configuración.
   */
  function updatePreviewUI() {
    const { sessionMinutes, sessionCount, breakMinutes } = state;
    const breakCount = Math.max(0, sessionCount - 1);
    const totalMinutes = sessionMinutes * sessionCount;
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;

    el.sessionCount.textContent = sessionCount;
    el.breakCount.textContent = breakCount;

    const sessionLabel = formatSessionLabel(sessionMinutes);
    el.previewSessions.textContent = `${sessionCount} sesiones de ${sessionLabel}`;

    if (totalHours > 0 && totalRemainingMinutes > 0) {
      el.previewTotalHours.textContent = `${totalHours} h ${totalRemainingMinutes} min`;
    } else if (totalHours > 0) {
      el.previewTotalHours.textContent = `${totalHours} h`;
    } else {
      el.previewTotalHours.textContent = `${totalRemainingMinutes} min`;
    }

    el.previewTotalMinutes.textContent = `${totalMinutes} min`;
    el.previewBreakTime.textContent = `${breakMinutes} min`;
    el.previewTotalBreaks.textContent = `${breakCount} descanso${breakCount !== 1 ? 's' : ''}`;
  }

  /**
   * Actualiza los elementos del temporizador en ejecución.
   */
  function updateTimerUI() {
    const { phase, currentSession, currentBreak, remainingSeconds, totalPhaseSeconds } = timer;
    const { sessionCount } = state;
    const breakCount = Math.max(0, sessionCount - 1);

    el.timerPhaseLabel.textContent = phase === 'session'
      ? `SESIÓN ${currentSession} de ${sessionCount}`
      : `DESCANSO ${currentBreak} de ${breakCount}`;

    el.timerCountdown.textContent = formatCountdown(remainingSeconds);

    const progress = totalPhaseSeconds > 0
      ? (remainingSeconds / totalPhaseSeconds) * 100
      : 0;
    el.timerProgress.style.width = `${Math.max(0, progress)}%`;

    el.timerProgress.className = `h-2.5 rounded-full transition-all duration-700 ease-linear ${
      phase === 'session' ? 'bg-blue-600' : 'bg-green-500'
    }`;
  }

  /**
   * Muestra una de las tres vistas del panel temporizador.
   * @param {'idle'|'active'|'completed'} view
   */
  function showTimerView(view) {
    el.timerIdle.classList.toggle('hidden', view !== 'idle');
    el.timerActive.classList.toggle('hidden', view !== 'active');
    el.timerCompleted.classList.toggle('hidden', view !== 'completed');
  }

  /**
   * Habilita o deshabilita los controles de configuración.
   * @param {boolean} enabled
   */
  function setControlsEnabled(enabled) {
    const value = !enabled;
    el.sessionTimeButtons.forEach(btn => btn.disabled = value);
    el.breakTimeButtons.forEach(btn => btn.disabled = value);
    el.sessionCountMinus.disabled = value;
    el.sessionCountPlus.disabled = value;

    el.sessionControls.classList.toggle('opacity-100', enabled);
    el.sessionControls.classList.toggle('opacity-50', !enabled);
    el.sessionControls.classList.toggle('pointer-events-none', !enabled);
    el.breakControls.classList.toggle('opacity-100', enabled);
    el.breakControls.classList.toggle('opacity-50', !enabled);
    el.breakControls.classList.toggle('pointer-events-none', !enabled);
  }

  // ========================================================================
  //  MARCADO VISUAL DE BOTONES ACTIVOS
  // ========================================================================

  /**
   * Marca el botón activo dentro de un grupo.
   * @param {NodeListOf<HTMLButtonElement>} buttons
   * @param {number} value
   */
  function setActiveButton(buttons, value) {
    buttons.forEach(btn => {
      const isActive = parseInt(btn.dataset.minutes) === value;
      const isSession = buttons === el.sessionTimeButtons;
      btn.classList.toggle('bg-blue-50', isActive && isSession);
      btn.classList.toggle('border-blue-500', isActive && isSession);
      btn.classList.toggle('text-blue-700', isActive && isSession);
      btn.classList.toggle('bg-green-50', isActive && !isSession);
      btn.classList.toggle('border-green-500', isActive && !isSession);
      btn.classList.toggle('text-green-700', isActive && !isSession);
      btn.classList.toggle('bg-white', !isActive);
      btn.classList.toggle('border-gray-200', !isActive);
      btn.classList.toggle('text-gray-600', !isActive);
    });
  }

  // ========================================================================
  //  LÓGICA DEL TEMPORIZADOR
  // ========================================================================

  /**
   * Maneja la transición entre fases cuando el tiempo llega a cero.
   */
  function handlePhaseEnd() {
    const { sessionCount, breakMinutes, sessionMinutes } = state;

    if (timer.phase === 'session') {
      if (timer.currentSession < sessionCount) {
        timer.currentBreak++;
        timer.phase = 'break';
        timer.remainingSeconds = breakMinutes * 60;
        timer.totalPhaseSeconds = timer.remainingSeconds;
      } else {
        timer.status = 'completed';
        clearInterval(timer.intervalId);
        timer.intervalId = null;
        desbloquearTodasLasApps();
        showTimerView('completed');
        setControlsEnabled(true);
        clearTimerState();
        return;
      }
    } else {
      timer.currentSession++;
      timer.phase = 'session';
      timer.remainingSeconds = sessionMinutes * 60;
      timer.totalPhaseSeconds = timer.remainingSeconds;
    }

    persistTimerState();
    updateTimerUI();
  }

  /**
   * Ejecuta un tick del temporizador (cada segundo).
   */
  function tick() {
    if (timer.status !== 'running') return;

    timer.remainingSeconds--;

    if (timer.remainingSeconds <= 0) {
      handlePhaseEnd();
    } else {
      updateTimerUI();
    }

    // Persistir en cada tick para que al navegar a otra página o al cerrar
    // la app se pierda como máximo 1 segundo de precisión
    persistTimerState();
  }

  /**
   * Inicia el temporizador con la configuración actual.
   */
  function startTimer() {
    // Limpiar cualquier estado previo
    clearTimerState();

    timer.status = 'running';
    timer.phase = 'session';
    timer.currentSession = 1;
    timer.currentBreak = 0;
    timer.remainingSeconds = state.sessionMinutes * 60;
    timer.totalPhaseSeconds = timer.remainingSeconds;

    showTimerView('active');
    setControlsEnabled(false);
    updateTimerUI();

    bloquearAppsSeleccionadas();
    persistTimerState();

    timer.intervalId = setInterval(tick, 1000);
  }

  /**
   * Pausa o reanuda el temporizador.
   */
  function togglePause() {
    if (timer.status === 'running') {
      timer.status = 'paused';
      clearInterval(timer.intervalId);
      timer.intervalId = null;
      el.btnPause.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Reanudar
      `;
      persistTimerState();
    } else if (timer.status === 'paused') {
      timer.status = 'running';
      timer.intervalId = setInterval(tick, 1000);
      el.btnPause.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        Pausa
      `;
      persistTimerState();
    }
  }

  /**
   * Detiene el temporizador y vuelve al estado idle.
   */
  function stopTimer() {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
    timer.status = 'idle';
    desbloquearTodasLasApps();
    clearTimerState();
    showTimerView('idle');
    setControlsEnabled(true);
    el.btnPause.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
      Pausa
    `;
  }

  /**
   * Reinicia el pomodoro desde completed a idle.
   */
  function resetTimer() {
    timer.status = 'idle';
    desbloquearTodasLasApps();
    clearTimerState();
    showTimerView('idle');
  }

  // ========================================================================
  //  INICIALIZACIÓN
  // ========================================================================

  /**
   * Inicializa el componente.
   */
  function init() {
    // -- Restaurar estado del temporizador si existe --
    const savedTimer = loadTimerState();
    if (savedTimer) {
      restoreTimerState(savedTimer);
    } else {
      // No hay temporizador previo, mostrar idle con la config guardada
      setActiveButton(el.sessionTimeButtons, state.sessionMinutes);
      setActiveButton(el.breakTimeButtons, state.breakMinutes);
      updatePreviewUI();
      showTimerView('idle');
      setControlsEnabled(true);
    }

    // -- Eventos: selección de tiempo de sesión --
    el.sessionTimeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.sessionMinutes = parseInt(btn.dataset.minutes);
        setActiveButton(el.sessionTimeButtons, state.sessionMinutes);
        persistState();
        updatePreviewUI();
      });
    });

    // -- Eventos: selección de tiempo de descanso --
    el.breakTimeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.breakMinutes = parseInt(btn.dataset.minutes);
        setActiveButton(el.breakTimeButtons, state.breakMinutes);
        persistState();
        updatePreviewUI();
      });
    });

    // -- Eventos: contador de sesiones --
    el.sessionCountMinus.addEventListener('click', () => {
      if (state.sessionCount > 1) {
        state.sessionCount--;
        persistState();
        updatePreviewUI();
      }
    });
    el.sessionCountPlus.addEventListener('click', () => {
      if (state.sessionCount < 50) {
        state.sessionCount++;
        persistState();
        updatePreviewUI();
      }
    });

    // -- Eventos: temporizador --
    el.btnStart.addEventListener('click', startTimer);
    el.btnPause.addEventListener('click', togglePause);
    el.btnStop.addEventListener('click', stopTimer);
    el.btnReset.addEventListener('click', resetTimer);

    // -- Auto-inicio desde la barra lateral --
    if (window.autoIniciarPomodoro) {
      window.autoIniciarPomodoro = false;
      startTimer();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
