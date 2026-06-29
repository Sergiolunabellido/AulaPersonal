(function () {
  'use strict';

  // ========================================================================
  //  CLAVES DE LOCALSTORAGE
  // ========================================================================

  /** Clave para la configuración (minutosSesion, numeroSesiones, minutosDescanso) */
  const CLAVE_CONFIGURACION = 'pomodoro-config';

  /** Clave para el estado del temporizador (running/paused, fase, tiempo, etc.) */
  const CLAVE_TEMPORIZADOR = 'pomodoro-timer';

  // ========================================================================
  //  VALORES POR DEFECTO
  // ========================================================================

  /** @type {{ minutosSesion: number, numeroSesiones: number, minutosDescanso: number }} */
  const VALORES_DEFECTO = {
    minutosSesion: 60,
    numeroSesiones: 3,
    minutosDescanso: 5,
  };

  // ========================================================================
  //  ESTADO DE CONFIGURACIÓN
  //  Se persiste en localStorage para que sobreviva entre sesiones de la app.
  // ========================================================================

  /**
   * Carga la configuración guardada o devuelve los valores por defecto.
   * @returns {{ minutosSesion: number, numeroSesiones: number, minutosDescanso: number }}
   */
  function cargarEstado() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_CONFIGURACION));
      if (guardado && guardado.minutosSesion != null && guardado.numeroSesiones != null && guardado.minutosDescanso != null) {
        return guardado;
      }
    } catch { /* ignorar datos corruptos */ }
    return { ...VALORES_DEFECTO };
  }

  /**
   * Persiste la configuración en localStorage.
   */
  function persistirEstado() {
    localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify({
      minutosSesion: estado.minutosSesion,
      numeroSesiones: estado.numeroSesiones,
      minutosDescanso: estado.minutosDescanso,
    }));
  }

  /** @type {{ minutosSesion: number, numeroSesiones: number, minutosDescanso: number }} */
  const estado = cargarEstado();

  // ========================================================================
  //  PERSISTENCIA DEL ESTADO DEL TEMPORIZADOR
  //  Permite que el pomodoro continúe funcionando aunque el usuario navegue
  //  a otras páginas o cierre y reabra la aplicación.
  // ========================================================================

  /**
   * Guarda el estado completo del temporizador en localStorage.
   * Incluye tanto las variables del temporizador como la configuración con la que
   * se inició, para poder restaurar correctamente al volver.
   */
  function persistirEstadoTemporizador() {
    localStorage.setItem(CLAVE_TEMPORIZADOR, JSON.stringify({
      estado: temporizador.estado,
      fase: temporizador.fase,
      sesionActual: temporizador.sesionActual,
      descansoActual: temporizador.descansoActual,
      segundosRestantes: temporizador.segundosRestantes,
      totalSegundosFase: temporizador.totalSegundosFase,
      marcaTiempo: Date.now(),
      instantaneaConfig: {
        minutosSesion: estado.minutosSesion,
        numeroSesiones: estado.numeroSesiones,
        minutosDescanso: estado.minutosDescanso,
      },
    }));
  }

  /**
   * Lee el estado del temporizador guardado en localStorage.
   * @returns {object|null} Estado guardado o null si no hay nada válido
   */
  function cargarEstadoTemporizador() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_TEMPORIZADOR));
      if (guardado && (guardado.estado === 'running' || guardado.estado === 'paused' || guardado.estado === 'completed')) {
        return guardado;
      }
    } catch { /* ignorar */ }
    return null;
  }

  /**
   * Elimina el estado del temporizador de localStorage.
   * Se llama al detener, reiniciar o completar el ciclo.
   */
  function limpiarEstadoTemporizador() {
    localStorage.removeItem(CLAVE_TEMPORIZADOR);
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
   * @param {object} guardado - Estado cargado de localStorage
   * @returns {boolean} true si se restauró el temporizador, false si no
   */
  function restaurarEstadoTemporizador(guardado) {
    // Restaurar la configuración con la que se inició el temporizador
    const configuracion = guardado.instantaneaConfig || VALORES_DEFECTO;
    estado.minutosSesion = configuracion.minutosSesion;
    estado.numeroSesiones = configuracion.numeroSesiones;
    estado.minutosDescanso = configuracion.minutosDescanso;
    persistirEstado();

    if (guardado.estado === 'completed') {
      // Mostrar pantalla de completado
      temporizador.estado = 'completed';
      temporizador.fase = guardado.fase || 'session';
      temporizador.sesionActual = guardado.sesionActual || 1;
      temporizador.descansoActual = guardado.descansoActual || 0;
      temporizador.segundosRestantes = 0;
      temporizador.totalSegundosFase = guardado.totalSegundosFase || 1;
      mostrarVistaTemporizador('completed');
      establecerControlesHabilitados(true);
      actualizarVistaPrevia();
      return true;
    }

    if (guardado.estado === 'paused') {
      temporizador.estado = 'paused';
      temporizador.fase = guardado.fase;
      temporizador.sesionActual = guardado.sesionActual;
      temporizador.descansoActual = guardado.descansoActual;
      temporizador.segundosRestantes = guardado.segundosRestantes;
      temporizador.totalSegundosFase = guardado.totalSegundosFase;
      mostrarVistaTemporizador('active');
      establecerControlesHabilitados(false);
      actualizarVistaPrevia();
      actualizarVistaTemporizador();
      dom.btnPausa.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Reanudar
      `;
      return true;
    }

    if (guardado.estado === 'running') {
      // Calcular el tiempo transcurrido mientras se estuvo fuera
      const segundosTranscurridos = Math.floor((Date.now() - guardado.marcaTiempo) / 1000);
      let restante = guardado.segundosRestantes - segundosTranscurridos;
      let fase = guardado.fase;
      let sesionActual = guardado.sesionActual;
      let descansoActual = guardado.descansoActual;
      const totalSegundosFase = guardado.totalSegundosFase;

      // Avanzar por las fases hasta ponerse al día
      while (restante <= 0) {
        if (fase === 'session') {
          if (sesionActual < configuracion.numeroSesiones) {
            // Pasar a descanso
            descansoActual++;
            fase = 'break';
            restante = configuracion.minutosDescanso * 60 + restante;
          } else {
            // Última sesión -> completado
            temporizador.estado = 'completed';
            temporizador.fase = 'session';
            temporizador.sesionActual = sesionActual;
            temporizador.descansoActual = descansoActual;
            temporizador.segundosRestantes = 0;
            temporizador.totalSegundosFase = totalSegundosFase;
            mostrarVistaTemporizador('completed');
            establecerControlesHabilitados(true);
            actualizarVistaPrevia();
            limpiarEstadoTemporizador();
            return true;
          }
        } else {
          // Viene de un descanso -> siguiente sesión
          sesionActual++;
          fase = 'session';
          restante = configuracion.minutosSesion * 60 + restante;
        }
      }

      // El temporizador sigue activo
      temporizador.estado = 'running';
      temporizador.fase = fase;
      temporizador.sesionActual = sesionActual;
      temporizador.descansoActual = descansoActual;
      temporizador.segundosRestantes = restante;
      temporizador.totalSegundosFase = fase === 'session'
        ? configuracion.minutosSesion * 60
        : configuracion.minutosDescanso * 60;

      mostrarVistaTemporizador('active');
      establecerControlesHabilitados(false);
      actualizarVistaPrevia();
      actualizarVistaTemporizador();
      dom.btnPausa.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        Pausa
      `;

      // Reanudar el intervalo
      temporizador.idIntervalo = setInterval(ejecutarTick, 1000);
      return true;
    }

    return false;
  }

  // ========================================================================
  //  ESTADO DEL TEMPORIZADOR
  //  Gestiona el ciclo de ejecución del pomodoro una vez iniciado.
  // ========================================================================

  /** @type {{ estado: string, fase: string, sesionActual: number, descansoActual: number, segundosRestantes: number, totalSegundosFase: number, idIntervalo: number|null }} */
  const temporizador = {
    estado: 'idle',
    fase: 'session',
    sesionActual: 1,
    descansoActual: 0,
    segundosRestantes: 0,
    totalSegundosFase: 0,
    idIntervalo: null,
  };

  // ========================================================================
  //  REFERENCIAS AL DOM
  // ========================================================================

  /** @type {Object<string, HTMLElement|NodeListOf<HTMLElement>>} */
  const dom = {
    botonesTiempoSesion: document.querySelectorAll('#session-time-buttons button'),
    contadorSesiones: document.getElementById('session-count'),
    btnRestarSesion: document.getElementById('session-count-minus'),
    btnSumarSesion: document.getElementById('session-count-plus'),
    botonesTiempoDescanso: document.querySelectorAll('#break-time-buttons button'),
    contadorDescansos: document.getElementById('break-count'),

    vistaPreviaSesiones: document.getElementById('preview-sessions'),
    vistaPreviaTotalHoras: document.getElementById('preview-total-hours'),
    vistaPreviaTotalMinutos: document.getElementById('preview-total-minutes'),
    vistaPreviaTiempoDescanso: document.getElementById('preview-break-time'),
    vistaPreviaTotalDescansos: document.getElementById('preview-total-breaks'),

    temporizadorInactivo: document.getElementById('timer-idle'),
    temporizadorActivo: document.getElementById('timer-active'),
    temporizadorCompletado: document.getElementById('timer-completed'),
    btnIniciar: document.getElementById('btn-start'),
    btnPausa: document.getElementById('btn-pause'),
    btnDetener: document.getElementById('btn-stop'),
    btnReiniciar: document.getElementById('btn-reset'),
    etiquetaFase: document.getElementById('timer-phase-label'),
    cuentaAtras: document.getElementById('timer-countdown'),
    barraProgreso: document.getElementById('timer-progress'),

    bloqueConfigSesion: document.getElementById('session-config-block'),
    bloqueConfigDescanso: document.getElementById('break-config-block'),
    controlesSesion: document.getElementById('session-controls'),
    controlesDescanso: document.getElementById('break-controls'),
  };

  // ========================================================================
  //  BLOQUEO DE APPS
  // ========================================================================

  /**
   * Calcula la duración total del pomodoro en minutos (sesiones + descansos).
   * @returns {number}
   */
  function calcularDuracionTotalMinutos() {
    const sesiones = estado.minutosSesion * estado.numeroSesiones;
    const descansos = estado.minutosDescanso * Math.max(0, estado.numeroSesiones - 1);
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
   * @param {number} minutos
   * @returns {string} Ej: "1 h", "1 h 30 min", "30 min"
   */
  function formatearEtiquetaSesion(minutos) {
    if (minutos === 60) return '1 h';
    if (minutos > 60 && minutos % 60 === 0) return `${minutos / 60} h`;
    if (minutos > 60) return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
    return `${minutos} min`;
  }

  /**
   * Convierte segundos a formato mm:ss o h:mm:ss.
   * @param {number} totalSegundos
   * @returns {string}
   */
  function formatearCuentaAtras(totalSegundos) {
    if (totalSegundos <= 0) return '00:00';
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    const rellenar = (numero) => String(numero).padStart(2, '0');
    if (h > 0) return `${rellenar(h)}:${rellenar(m)}:${rellenar(s)}`;
    return `${rellenar(m)}:${rellenar(s)}`;
  }

  // ========================================================================
  //  ACTUALIZACIÓN DE LA INTERFAZ
  // ========================================================================

  /**
   * Actualiza el panel Session Preview y los indicadores de configuración.
   */
  function actualizarVistaPrevia() {
    const { minutosSesion, numeroSesiones, minutosDescanso } = estado;
    const numeroDescansos = Math.max(0, numeroSesiones - 1);
    const totalMinutos = minutosSesion * numeroSesiones;
    const totalHoras = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;

    dom.contadorSesiones.textContent = numeroSesiones;
    dom.contadorDescansos.textContent = numeroDescansos;

    const etiquetaSesion = formatearEtiquetaSesion(minutosSesion);
    dom.vistaPreviaSesiones.textContent = `${numeroSesiones} sesiones de ${etiquetaSesion}`;

    if (totalHoras > 0 && minutosRestantes > 0) {
      dom.vistaPreviaTotalHoras.textContent = `${totalHoras} h ${minutosRestantes} min`;
    } else if (totalHoras > 0) {
      dom.vistaPreviaTotalHoras.textContent = `${totalHoras} h`;
    } else {
      dom.vistaPreviaTotalHoras.textContent = `${minutosRestantes} min`;
    }

    dom.vistaPreviaTotalMinutos.textContent = `${totalMinutos} min`;
    dom.vistaPreviaTiempoDescanso.textContent = `${minutosDescanso} min`;
    dom.vistaPreviaTotalDescansos.textContent = `${numeroDescansos} descanso${numeroDescansos !== 1 ? 's' : ''}`;
  }

  /**
   * Actualiza los elementos del temporizador en ejecución.
   */
  function actualizarVistaTemporizador() {
    const { fase, sesionActual, descansoActual, segundosRestantes, totalSegundosFase } = temporizador;
    const { numeroSesiones } = estado;
    const numeroDescansos = Math.max(0, numeroSesiones - 1);

    dom.etiquetaFase.textContent = fase === 'session'
      ? `SESIÓN ${sesionActual} de ${numeroSesiones}`
      : `DESCANSO ${descansoActual} de ${numeroDescansos}`;

    dom.cuentaAtras.textContent = formatearCuentaAtras(segundosRestantes);

    const progreso = totalSegundosFase > 0
      ? (segundosRestantes / totalSegundosFase) * 100
      : 0;
    dom.barraProgreso.style.width = `${Math.max(0, progreso)}%`;

    dom.barraProgreso.className = `h-2.5 rounded-full transition-all duration-700 ease-linear ${
      fase === 'session' ? 'bg-blue-600' : 'bg-green-500'
    }`;
  }

  /**
   * Muestra una de las tres vistas del panel temporizador.
   * @param {'idle'|'active'|'completed'} vista
   */
  function mostrarVistaTemporizador(vista) {
    dom.temporizadorInactivo.classList.toggle('hidden', vista !== 'idle');
    dom.temporizadorActivo.classList.toggle('hidden', vista !== 'active');
    dom.temporizadorCompletado.classList.toggle('hidden', vista !== 'completed');
  }

  /**
   * Habilita o deshabilita los controles de configuración.
   * @param {boolean} habilitado
   */
  function establecerControlesHabilitados(habilitado) {
    const deshabilitado = !habilitado;
    dom.botonesTiempoSesion.forEach(btn => btn.disabled = deshabilitado);
    dom.botonesTiempoDescanso.forEach(btn => btn.disabled = deshabilitado);
    dom.btnRestarSesion.disabled = deshabilitado;
    dom.btnSumarSesion.disabled = deshabilitado;

    dom.controlesSesion.classList.toggle('opacity-100', habilitado);
    dom.controlesSesion.classList.toggle('opacity-50', !habilitado);
    dom.controlesSesion.classList.toggle('pointer-events-none', !habilitado);
    dom.controlesDescanso.classList.toggle('opacity-100', habilitado);
    dom.controlesDescanso.classList.toggle('opacity-50', !habilitado);
    dom.controlesDescanso.classList.toggle('pointer-events-none', !habilitado);
  }

  // ========================================================================
  //  MARCADO VISUAL DE BOTONES ACTIVOS
  // ========================================================================

  /**
   * Marca el botón activo dentro de un grupo.
   * @param {NodeListOf<HTMLButtonElement>} botones
   * @param {number} valor
   */
  function marcarBotonActivo(botones, valor) {
    botones.forEach(btn => {
      const esActivo = parseInt(btn.dataset.minutes) === valor;
      const esSesion = botones === dom.botonesTiempoSesion;
      btn.classList.toggle('bg-blue-50', esActivo && esSesion);
      btn.classList.toggle('border-blue-500', esActivo && esSesion);
      btn.classList.toggle('text-blue-700', esActivo && esSesion);
      btn.classList.toggle('bg-green-50', esActivo && !esSesion);
      btn.classList.toggle('border-green-500', esActivo && !esSesion);
      btn.classList.toggle('text-green-700', esActivo && !esSesion);
      btn.classList.toggle('bg-white', !esActivo);
      btn.classList.toggle('border-gray-200', !esActivo);
      btn.classList.toggle('text-gray-600', !esActivo);
    });
  }

  // ========================================================================
  //  LÓGICA DEL TEMPORIZADOR
  // ========================================================================

  /**
   * Reproduce un sonido de aviso usando la Web Audio API.
   */
  function reproducirSonido() {
    try {
      const panelAudio = new (window.AudioContext || window.webkitAudioContext)();
      const ondaSonora = panelAudio.createOscillator();
      const volumenGain = panelAudio.createGain();
      ondaSonora.connect(volumenGain);
      volumenGain.connect(panelAudio.destination);

      ondaSonora.frequency.value = 880;
      ondaSonora.type = 'sine';

      volumenGain.gain.setValueAtTime(0.3, panelAudio.currentTime);
      volumenGain.gain.exponentialRampToValueAtTime(0.01, panelAudio.currentTime + 0.5);

      ondaSonora.start();
      ondaSonora.stop(panelAudio.currentTime + 0.5);
    } catch (_) {
      alertas('error', 'La generación del sonido de finalización de sesiones o descansos a fallado.');
    }
  }

  /**
   * Maneja la transición entre fases cuando el tiempo llega a cero.
   */
  function manejarFinFase() {
    const { numeroSesiones, minutosDescanso, minutosSesion } = estado;

    reproducirSonido();

    if (temporizador.fase === 'session') {
      if (temporizador.sesionActual < numeroSesiones) {
        temporizador.descansoActual++;
        temporizador.fase = 'break';
        temporizador.segundosRestantes = minutosDescanso * 60;
        temporizador.totalSegundosFase = temporizador.segundosRestantes;
      } else {
        temporizador.estado = 'completed';
        clearInterval(temporizador.idIntervalo);
        temporizador.idIntervalo = null;
        desbloquearTodasLasApps();
        mostrarVistaTemporizador('completed');
        establecerControlesHabilitados(true);
        limpiarEstadoTemporizador();
        return;
      }
    } else {
      temporizador.sesionActual++;
      temporizador.fase = 'session';
      temporizador.segundosRestantes = minutosSesion * 60;
      temporizador.totalSegundosFase = temporizador.segundosRestantes;
    }

    persistirEstadoTemporizador();
    actualizarVistaTemporizador();
  }

  /**
   * Ejecuta un tick del temporizador (cada segundo).
   */
  function ejecutarTick() {
    if (temporizador.estado !== 'running') return;

    temporizador.segundosRestantes--;

    if (temporizador.segundosRestantes <= 0) {
      manejarFinFase();
    } else {
      actualizarVistaTemporizador();
    }

    // Persistir en cada tick para que al navegar a otra página o al cerrar
    // la app se pierda como máximo 1 segundo de precisión
    persistirEstadoTemporizador();
  }

  /**
   * Inicia el temporizador con la configuración actual.
   */
  function iniciarTemporizador() {
    // Limpiar cualquier estado previo
    limpiarEstadoTemporizador();

    temporizador.estado = 'running';
    temporizador.fase = 'session';
    temporizador.sesionActual = 1;
    temporizador.descansoActual = 0;
    temporizador.segundosRestantes = estado.minutosSesion * 60;
    temporizador.totalSegundosFase = temporizador.segundosRestantes;

    mostrarVistaTemporizador('active');
    establecerControlesHabilitados(false);
    actualizarVistaTemporizador();

    bloquearAppsSeleccionadas();
    persistirEstadoTemporizador();

    temporizador.idIntervalo = setInterval(ejecutarTick, 1000);
  }

  /**
   * Pausa o reanuda el temporizador.
   */
  function alternarPausa() {
    if (temporizador.estado === 'running') {
      temporizador.estado = 'paused';
      clearInterval(temporizador.idIntervalo);
      temporizador.idIntervalo = null;
      dom.btnPausa.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Reanudar
      `;
      persistirEstadoTemporizador();
    } else if (temporizador.estado === 'paused') {
      temporizador.estado = 'running';
      temporizador.idIntervalo = setInterval(ejecutarTick, 1000);
      dom.btnPausa.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        Pausa
      `;
      persistirEstadoTemporizador();
    }
  }

  /**
   * Detiene el temporizador y vuelve al estado idle.
   */
  function detenerTemporizador() {
    clearInterval(temporizador.idIntervalo);
    temporizador.idIntervalo = null;
    temporizador.estado = 'idle';
    desbloquearTodasLasApps();
    limpiarEstadoTemporizador();
    mostrarVistaTemporizador('idle');
    establecerControlesHabilitados(true);
    dom.btnPausa.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
      Pausa
    `;
  }

  /**
   * Reinicia el pomodoro desde completed a idle.
   */
  function reiniciarTemporizador() {
    temporizador.estado = 'idle';
    desbloquearTodasLasApps();
    limpiarEstadoTemporizador();
    mostrarVistaTemporizador('idle');
  }

  // ========================================================================
  //  INICIALIZACIÓN
  // ========================================================================

  /**
   * Inicializa el componente.
   */
  function inicializar() {
    // -- Restaurar estado del temporizador si existe --
    const temporizadorGuardado = cargarEstadoTemporizador();
    if (temporizadorGuardado) {
      restaurarEstadoTemporizador(temporizadorGuardado);
    } else {
      // No hay temporizador previo, mostrar idle con la config guardada
      marcarBotonActivo(dom.botonesTiempoSesion, estado.minutosSesion);
      marcarBotonActivo(dom.botonesTiempoDescanso, estado.minutosDescanso);
      actualizarVistaPrevia();
      mostrarVistaTemporizador('idle');
      establecerControlesHabilitados(true);
    }

    // -- Eventos: selección de tiempo de sesión --
    dom.botonesTiempoSesion.forEach(btn => {
      btn.addEventListener('click', () => {
        estado.minutosSesion = parseInt(btn.dataset.minutes);
        marcarBotonActivo(dom.botonesTiempoSesion, estado.minutosSesion);
        persistirEstado();
        actualizarVistaPrevia();
      });
    });

    // -- Eventos: selección de tiempo de descanso --
    dom.botonesTiempoDescanso.forEach(btn => {
      btn.addEventListener('click', () => {
        estado.minutosDescanso = parseInt(btn.dataset.minutes);
        marcarBotonActivo(dom.botonesTiempoDescanso, estado.minutosDescanso);
        persistirEstado();
        actualizarVistaPrevia();
      });
    });

    // -- Eventos: contador de sesiones --
    dom.btnRestarSesion.addEventListener('click', () => {
      if (estado.numeroSesiones > 1) {
        estado.numeroSesiones--;
        persistirEstado();
        actualizarVistaPrevia();
      }
    });
    dom.btnSumarSesion.addEventListener('click', () => {
      if (estado.numeroSesiones < 50) {
        estado.numeroSesiones++;
        persistirEstado();
        actualizarVistaPrevia();
      }
    });

    // -- Eventos: temporizador --
    dom.btnIniciar.addEventListener('click', iniciarTemporizador);
    dom.btnPausa.addEventListener('click', alternarPausa);
    dom.btnDetener.addEventListener('click', detenerTemporizador);
    dom.btnReiniciar.addEventListener('click', reiniciarTemporizador);

    // -- Auto-inicio desde la barra lateral --
    if (window.iniciarPomodoroAuto) {
      window.iniciarPomodoroAuto = false;
      iniciarTemporizador();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
