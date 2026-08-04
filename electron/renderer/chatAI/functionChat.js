(function () {
    'use strict';

    const API_BASE = 'http://localhost:8080/api/chat';
    const CLAVE_CONFIG = 'chat-config';
    const OLLAMA_ENDPOINT = 'http://localhost:11434';

    const MODELO_AUTO = {
        id: 'auto',
        nombre: 'Auto',
        provider: 'auto',
        requiereApiKey: false,
        contextoMaximo: 128000,
    };

    let config = {
        modeloId: '',
        provider: 'ollama',
        endpoint: OLLAMA_ENDPOINT,
        customModel: '',
        customEndpoint: '',
        apiKeys: {},
        apiKeysEncrypted: {},
        modoAuto: true,
    };

    let modelosGratuitos = [];
    let modelosDePago = [];
    let proveedoresDePago = [];
    let modeloActivo = null;
    let sesionActiva = null;
    let mensajesSesion = [];
    let modeloResueltoInfo = null;
    let contextoGestionadoAuto = false;
    let dropdownModelosAbierto = false;
    let enviando = false;
    let setupActivo = false;

    const dom = {};

    function obtenerDom() {
        dom.historial = document.getElementById('chat-historial');
        dom.mensajes = document.getElementById('chat-mensajes');
        dom.emptyState = document.getElementById('chat-empty-state');
        dom.input = document.getElementById('chat-input');
        dom.subtitulo = document.getElementById('chat-subtitulo');
        dom.modeloLabel = document.getElementById('modelo-label');
        dom.modeloBadge = document.getElementById('modelo-badge');
        dom.dropdownModelos = document.getElementById('dropdown-modelos');
        dom.listaGratuitos = document.getElementById('lista-modelos-gratuitos');
        dom.listaAuto = document.getElementById('lista-modelos-auto');
        dom.listaPago = document.getElementById('lista-modelos-pago');
        dom.modelosVacio = document.getElementById('modelos-vacio');
        dom.panelApiKey = document.getElementById('panel-api-key');
        dom.btnApiKey = document.getElementById('btn-api-key');
        dom.inputApiKey = document.getElementById('input-api-key');
        dom.apiKeyDescripcion = document.getElementById('api-key-descripcion');
        dom.customFields = document.getElementById('custom-model-fields');
        dom.inputCustomModel = document.getElementById('input-custom-model');
        dom.inputCustomEndpoint = document.getElementById('input-custom-endpoint');
        dom.btnEnviar = document.getElementById('btn-enviar');
        dom.chatContenido = document.getElementById('chat-contenido');
        dom.setupOverlay = document.getElementById('chat-setup-overlay');
        dom.ollamaBadge = document.getElementById('ollama-status-badge');
        dom.setupText = document.getElementById('ollama-setup-text');
        dom.setupPct = document.getElementById('ollama-setup-pct');
        dom.setupBar = document.getElementById('ollama-setup-bar');
        dom.contextoIndicador = document.getElementById('contexto-indicador');
        dom.contextoLabel = document.getElementById('contexto-label');
        dom.contextoRingProgreso = document.getElementById('contexto-ring-progreso');
    }

    function bloquearChat() {
        setupActivo = true;
        if (dom.chatContenido) {
            dom.chatContenido.classList.add('opacity-40', 'pointer-events-none', 'select-none');
        }
        if (dom.setupOverlay) {
            dom.setupOverlay.classList.remove('hidden');
        }
        if (dom.btnEnviar) dom.btnEnviar.disabled = true;
        if (dom.input) dom.input.disabled = true;
    }

    function desbloquearChat() {
        setupActivo = false;
        if (dom.chatContenido) {
            dom.chatContenido.classList.remove('opacity-40', 'pointer-events-none', 'select-none');
        }
        if (dom.setupOverlay) {
            dom.setupOverlay.classList.add('hidden');
        }
        if (dom.btnEnviar) dom.btnEnviar.disabled = false;
        if (dom.input) {
            dom.input.disabled = false;
            dom.input.focus();
        }
    }

    function actualizarProgresoSetup(payload) {
        const pct = payload.progresoGlobal != null ? payload.progresoGlobal : 0;
        if (dom.setupBar) dom.setupBar.style.width = pct + '%';
        if (dom.setupPct) dom.setupPct.textContent = pct + '%';
        if (dom.setupText && payload.mensaje) {
            dom.setupText.textContent = payload.mensaje;
        }
    }

    async function cargarConfig() {
        try {
            const guardada = localStorage.getItem(CLAVE_CONFIG);
            if (guardada) {
                const parsed = JSON.parse(guardada);
                const modoAuto = typeof parsed.modoAuto === 'boolean'
                    ? parsed.modoAuto
                    : !parsed.modeloId;
                config = {
                    ...config,
                    ...parsed,
                    apiKeys: parsed.apiKeys || {},
                    apiKeysEncrypted: parsed.apiKeysEncrypted || {},
                    modoAuto,
                };
            }
            await descifrarApiKeys();
        } catch (_) { /* ignorar */ }
    }

    async function descifrarApiKeys() {
        if (!window.electronAPI?.obtenerApiKey) return;
        for (const [provider, encrypted] of Object.entries(config.apiKeysEncrypted || {})) {
            if (encrypted && !config.apiKeys[provider]) {
                const res = await window.electronAPI.obtenerApiKey(encrypted);
                if (res?.ok && res.value) {
                    config.apiKeys[provider] = res.value;
                }
            }
        }
    }

    function guardarConfig() {
        const persistir = {
            modeloId: config.modeloId,
            provider: config.provider,
            endpoint: config.endpoint,
            customModel: config.customModel,
            customEndpoint: config.customEndpoint,
            apiKeysEncrypted: config.apiKeysEncrypted || {},
            modoAuto: config.modoAuto !== false,
        };
        localStorage.setItem(CLAVE_CONFIG, JSON.stringify(persistir));
    }

    async function peticion(metodo, ruta, cuerpo) {
        const opciones = {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
        };
        if (cuerpo) opciones.body = JSON.stringify(cuerpo);
        const res = await fetch(API_BASE + ruta, opciones);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (res.status === 204) return null;
        return res.json();
    }

    function escaparHTML(texto) {
        const d = document.createElement('div');
        d.textContent = texto;
        return d.innerHTML;
    }

    /**
     * Convierte markdown del LLM a HTML seguro.
     * marked → HTML; DOMPurify → evita XSS si el modelo inventa tags maliciosos.
     * Si las libs no cargaron, cae a texto plano escapado.
     */
    function formatearMarkdown(texto) {
        if (texto == null) return '';
        const crudo = String(texto);

        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            return escaparHTML(crudo).replace(/\n/g, '<br>');
        }

        try {
            if (typeof marked.setOptions === 'function') {
                marked.setOptions({ breaks: true, gfm: true });
            }
            const html = typeof marked.parse === 'function'
                ? marked.parse(crudo)
                : marked(crudo);
            return DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true },
            });
        } catch (_) {
            return escaparHTML(crudo).replace(/\n/g, '<br>');
        }
    }

    function formatearFecha(fechaStr) {
        if (!fechaStr) return '';
        const d = new Date(fechaStr);
        const hoy = new Date();
        const esHoy = d.toDateString() === hoy.toDateString();
        const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (esHoy) return 'Hoy · ' + hora;
        return d.toLocaleDateString() + ' · ' + hora;
    }

    const CONTEXTO_OLLAMA_DEFECTO = {
        'qwen2.5-coder:0.5b': 32768,
        'qwen2.5-coder:1.5b': 32768,
        'qwen2.5-coder:3b': 32768,
        'qwen2.5-coder:7b': 32768,
        'qwen2.5-coder:14b': 32768,
        'qwen2.5-coder:32b': 32768,
    };

    const CIRCUNFERENCIA_CONTEXTO = 2 * Math.PI * 8;

    function estimarTokens(texto) {
        if (!texto) return 0;
        return Math.ceil(texto.length / 4);
    }

    function formatearTokens(cantidad) {
        if (cantidad >= 1_000_000) {
            return (cantidad / 1_000_000).toFixed(cantidad >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M';
        }
        if (cantidad >= 1000) {
            return (cantidad / 1000).toFixed(cantidad >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
        }
        return String(cantidad);
    }

    function obtenerContextoMaximo(modelo) {
        if (config.modoAuto) {
            if (modeloResueltoInfo?.contextoMaximo) {
                return modeloResueltoInfo.contextoMaximo;
            }
            const candidatos = [...modelosGratuitos].sort(
                (a, b) => obtenerContextoMaximoModelo(b) - obtenerContextoMaximoModelo(a)
            );
            return candidatos.length > 0 ? obtenerContextoMaximoModelo(candidatos[0]) : 32768;
        }

        return obtenerContextoMaximoModelo(modelo || modeloActivo);
    }

    function obtenerContextoMaximoModelo(modelo) {
        if (!modelo) return 8192;
        if (modelo.contextoMaximo) return modelo.contextoMaximo;
        if (modelo.provider === 'custom') return 128000;
        return CONTEXTO_OLLAMA_DEFECTO[modelo.id] || 8192;
    }

    function calcularTokensUsados() {
        const tokensMensajes = mensajesSesion.reduce(
            (total, mensaje) => total + estimarTokens(mensaje.contenido),
            0
        );
        return tokensMensajes + (mensajesSesion.length > 0 ? 150 : 0);
    }

    function colorAnilloContexto(porcentaje) {
        if (config.modoAuto) return '#7c3aed';
        if (porcentaje >= 85) return '#ef4444';
        if (porcentaje >= 60) return '#f59e0b';
        return '#3b82f6';
    }

    function actualizarIndicadorContexto() {
        if (!dom.contextoLabel || !dom.contextoRingProgreso) return;

        const maximo = obtenerContextoMaximo();
        const usado = calcularTokensUsados();
        const porcentaje = maximo > 0 ? Math.min(100, (usado / maximo) * 100) : 0;
        const excedeVentana = config.modoAuto && usado > maximo;

        dom.contextoLabel.textContent = config.modoAuto
            ? formatearTokens(usado) + ' / ' + formatearTokens(maximo) + ' · Auto'
            : formatearTokens(usado) + ' / ' + formatearTokens(maximo);

        dom.contextoRingProgreso.setAttribute(
            'stroke-dashoffset',
            String(CIRCUNFERENCIA_CONTEXTO * (1 - (excedeVentana ? 1 : porcentaje) / 100))
        );
        dom.contextoRingProgreso.setAttribute('stroke', colorAnilloContexto(porcentaje));

        if (dom.contextoIndicador) {
            let titulo = 'Contexto usado: ' + Math.round(porcentaje) + '% (' +
                formatearTokens(usado) + ' de ' + formatearTokens(maximo) + ' tokens estimados)';
            if (config.modoAuto) {
                titulo += '. Modo Auto: elige el modelo local y recorta el historial si hace falta.';
                if (modeloResueltoInfo?.id) {
                    titulo += ' Modelo activo: ' + modeloResueltoInfo.id + '.';
                }
                if (contextoGestionadoAuto) {
                    titulo += ' Parte del historial se omitió en el último envío para mantener el chat operativo.';
                }
            }
            dom.contextoIndicador.title = titulo;
        }
    }

    // ── Sidebar historial ──

    async function cargarHistorial(mensajeCarga) {
        if (!dom.historial) return;
        if (mensajeCarga) {
            dom.historial.innerHTML = '<p class="text-sm text-gray-400 text-center py-8 px-2">' +
                escaparHTML(mensajeCarga) + '</p>';
        }
        try {
            const sesiones = await peticion('GET', '/sessions');
            dom.historial.innerHTML = '';

            if (!sesiones || sesiones.length === 0) {
                dom.historial.innerHTML = '<p class="text-sm text-gray-400 text-center py-8 px-2">Aún no hay conversaciones</p>';
                return;
            }

            sesiones.forEach(s => {
                const activa = sesionActiva && sesionActiva.id === s.id;
                const item = document.createElement('div');
                item.className = 'group flex items-center gap-1 rounded-xl transition-colors ' +
                    (activa ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent');

                const btnSeleccion = document.createElement('button');
                btnSeleccion.type = 'button';
                btnSeleccion.className = 'flex-1 min-w-0 text-left p-3 rounded-xl';
                btnSeleccion.innerHTML =
                    '<p class="text-sm font-medium text-gray-800 truncate">' + escaparHTML(s.titulo || 'Sin título') + '</p>' +
                    '<p class="text-xs text-gray-400 mt-0.5">' + escaparHTML(formatearFecha(s.actualizadoEn)) + '</p>';
                btnSeleccion.onclick = () => window.seleccionarSesion(s.id);

                const btnEliminar = document.createElement('button');
                btnEliminar.type = 'button';
                btnEliminar.title = 'Eliminar conversación';
                btnEliminar.setAttribute('aria-label', 'Eliminar conversación');
                btnEliminar.className = 'shrink-0 mr-2 p-1.5 rounded-lg text-gray-400 opacity-60 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 focus:opacity-100 transition-all';
                btnEliminar.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
                    '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
                    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
                    '<path d="M10 11v6"/><path d="M14 11v6"/></svg>';
                btnEliminar.onclick = (evento) => {
                    evento.stopPropagation();
                    window.eliminarSesion(s.id);
                };

                item.appendChild(btnSeleccion);
                item.appendChild(btnEliminar);
                dom.historial.appendChild(item);
            });
        } catch (_) {
            dom.historial.innerHTML = '<p class="text-sm text-red-400 text-center py-8">Error al cargar el historial</p>';
        }
    }

    // ── Modelos ──

    const CACHE_MODELOS_TTL_MS = 60 * 60 * 1000;
    const NOMBRES_PROVEEDOR = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        google: 'Google Gemini',
        mistral: 'Mistral',
        deepseek: 'DeepSeek',
        custom: 'Personalizado',
    };

    const PROVEEDORES_PAGO_DEFECTO = [
        { id: 'openai', nombre: 'OpenAI', endpoint: 'https://api.openai.com/v1', requiereApiKey: true },
        { id: 'anthropic', nombre: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', requiereApiKey: true },
        { id: 'google', nombre: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', requiereApiKey: true },
        { id: 'mistral', nombre: 'Mistral', endpoint: 'https://api.mistral.ai/v1', requiereApiKey: true },
        { id: 'deepseek', nombre: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', requiereApiKey: true },
        { id: 'custom', nombre: 'Personalizado', endpoint: '', requiereApiKey: true },
    ];

    function claveCacheModelos(provider) {
        return 'chat-models-cache:' + provider;
    }

    function leerCacheModelos(provider) {
        try {
            const raw = localStorage.getItem(claveCacheModelos(provider));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.modelos) || !parsed.guardadoEn) return null;
            if (Date.now() - parsed.guardadoEn > CACHE_MODELOS_TTL_MS) return null;
            return parsed.modelos;
        } catch (_) {
            return null;
        }
    }

    function guardarCacheModelos(provider, modelos) {
        try {
            localStorage.setItem(claveCacheModelos(provider), JSON.stringify({
                guardadoEn: Date.now(),
                modelos: modelos || [],
            }));
        } catch (_) { /* ignore */ }
    }

    function invalidarCacheModelos(provider) {
        try {
            localStorage.removeItem(claveCacheModelos(provider));
        } catch (_) { /* ignore */ }
    }

    function placeholderProveedor(prov) {
        return {
            id: '__needs_key__:' + prov.id,
            nombre: (prov.nombre || NOMBRES_PROVEEDOR[prov.id] || prov.id) + ' · introduce API key',
            provider: prov.id,
            endpoint: prov.endpoint || '',
            requiereApiKey: true,
            esPlaceholderKey: true,
            contextoMaximo: 128000,
        };
    }

    function endpointProveedor(provider) {
        if (provider === 'custom') {
            return config.customEndpoint || '';
        }
        const found = (proveedoresDePago || []).find(p => p.id === provider);
        return found?.endpoint || '';
    }

    async function obtenerModelosRemotosProveedor(provider, forzar) {
        const apiKey = config.apiKeys[provider];
        if (!apiKey) return [];

        if (!forzar) {
            const cache = leerCacheModelos(provider);
            if (cache && cache.length > 0) return cache;
        }

        try {
            const data = await peticion('POST', '/models/remote', {
                provider,
                apiKey,
                endpoint: endpointProveedor(provider),
            });
            const modelos = data.modelos || [];
            if (modelos.length > 0) {
                guardarCacheModelos(provider, modelos);
            }
            return modelos;
        } catch (_) {
            const cache = leerCacheModelos(provider);
            return cache || [];
        }
    }

    async function cargarModelos() {
        let fallbackPago = [];
        try {
            const data = await peticion('GET', '/models?ollamaEndpoint=' + encodeURIComponent(OLLAMA_ENDPOINT));
            modelosGratuitos = data.gratuitos || [];
            fallbackPago = data.dePago || [];
            proveedoresDePago = data.proveedoresDePago || PROVEEDORES_PAGO_DEFECTO;
        } catch (_) {
            modelosGratuitos = [];
            proveedoresDePago = PROVEEDORES_PAGO_DEFECTO;
        }

        if (modelosGratuitos.length === 0) {
            modelosGratuitos = [
                { id: 'qwen2.5-coder:1.5b', nombre: 'Qwen2.5 Coder 1.5B', provider: 'ollama', endpoint: OLLAMA_ENDPOINT, requiereApiKey: false, contextoMaximo: 32768 },
                { id: 'qwen2.5-coder:3b', nombre: 'Qwen2.5 Coder 3B', provider: 'ollama', endpoint: OLLAMA_ENDPOINT, requiereApiKey: false, contextoMaximo: 32768 },
                { id: 'qwen2.5-coder:7b', nombre: 'Qwen2.5 Coder 7B', provider: 'ollama', endpoint: OLLAMA_ENDPOINT, requiereApiKey: false, contextoMaximo: 32768 },
            ];
        }

        const pago = [];
        for (const prov of proveedoresDePago) {
            const key = config.apiKeys[prov.id];
            if (key) {
                let remotos = await obtenerModelosRemotosProveedor(prov.id, false);
                if (remotos.length === 0) {
                    remotos = fallbackPago.filter(m => m.provider === prov.id);
                }
                if (remotos.length === 0 && prov.id === 'custom') {
                    remotos = [{
                        id: config.customModel || 'custom',
                        nombre: config.customModel || 'Modelo personalizado',
                        provider: 'custom',
                        endpoint: config.customEndpoint || '',
                        requiereApiKey: true,
                        contextoMaximo: 128000,
                    }];
                }
                pago.push(...remotos);
            } else {
                pago.push(placeholderProveedor(prov));
            }
        }
        modelosDePago = pago;

        await actualizarEstadoOllama();
        renderizarDropdownModelos();
        restaurarModeloSeleccionado();
    }

    async function refrescarModelosProveedor(provider) {
        if (!provider || provider === 'ollama') return;
        invalidarCacheModelos(provider);
        const remotos = await obtenerModelosRemotosProveedor(provider, true);
        modelosDePago = modelosDePago.filter(m => m.provider !== provider);
        if (remotos.length > 0) {
            modelosDePago.push(...remotos);
        } else {
            const prov = (proveedoresDePago || []).find(p => p.id === provider)
                || PROVEEDORES_PAGO_DEFECTO.find(p => p.id === provider);
            if (prov) modelosDePago.push(placeholderProveedor(prov));
        }
        renderizarDropdownModelos(document.getElementById('buscar-modelo')?.value || '');

        if (modeloActivo?.provider === provider) {
            const sigue = modelosDePago.find(m =>
                m.provider === provider && m.id === modeloActivo.id && !m.esPlaceholderKey
            );
            if (!sigue) {
                const primero = modelosDePago.find(m => m.provider === provider && !m.esPlaceholderKey);
                if (primero) seleccionarModelo(primero);
            }
        }
    }

    async function actualizarEstadoOllama() {
        if (!dom.ollamaBadge) return;
        try {
            const estado = await peticion('GET', '/status');
            const online = estado?.ollama?.online;
            dom.ollamaBadge.classList.remove('hidden');
            if (online) {
                dom.ollamaBadge.textContent = 'Ollama online';
                dom.ollamaBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700';
            } else {
                dom.ollamaBadge.textContent = 'Ollama offline';
                dom.ollamaBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700';
            }
        } catch (_) {
            dom.ollamaBadge.classList.remove('hidden');
            dom.ollamaBadge.textContent = 'Sin conexión';
            dom.ollamaBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600';
        }
    }

    function configurarSetupOllama() {
        if (!window.electronAPI?.onOllamaSetupProgress) return;

        window.electronAPI.onOllamaSetupProgress((payload) => {
            if (payload.fase === 'completo' || payload.skipped || payload.alreadyComplete) {
                desbloquearChat();
                actualizarEstadoOllama();
                recargarModelos();
                return;
            }

            if (payload.fase === 'error') {
                desbloquearChat();
                alertas('warning', payload.mensaje || 'No se pudieron descargar los modelos locales');
                return;
            }

            if (payload.fase === 'descargando') {
                bloquearChat();
                actualizarProgresoSetup(payload);
            }
        });
    }

    async function comprobarSetupAlCargar() {
        if (!window.electronAPI?.getOllamaSetupStatus) return;
        try {
            const estado = await window.electronAPI.getOllamaSetupStatus();
            if (estado.enProgreso) {
                bloquearChat();
                actualizarProgresoSetup({
                    progresoGlobal: 0,
                    mensaje: 'Descargando modelos de IA locales…',
                });
            }
        } catch (_) { /* ignorar */ }
    }

    window.recargarModelos = async function () {
        dom.modeloLabel.textContent = 'Actualizando…';
        await cargarModelos();
    };

    function renderizarDropdownModelos(filtro) {
        const termino = (filtro || '').toLowerCase().trim();

        const filtrar = lista => lista.filter(m => {
            const nombre = (m.nombre || m.id || '').toLowerCase();
            const provider = (m.provider || '').toLowerCase();
            const label = (NOMBRES_PROVEEDOR[m.provider] || '').toLowerCase();
            return !termino || nombre.includes(termino) || provider.includes(termino) || label.includes(termino);
        });

        const gratuitos = filtrar(modelosGratuitos);
        const pago = filtrar(modelosDePago);

        dom.listaGratuitos.innerHTML =
            '<p class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Gratuitos · Código · Ollama</p>';
        dom.listaPago.innerHTML =
            '<p class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">De pago · API</p>';

        if (dom.listaAuto) {
            dom.listaAuto.innerHTML =
                '<p class="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recomendado</p>';
            dom.listaAuto.appendChild(crearOpcionAuto());
        }

        gratuitos.forEach(m => dom.listaGratuitos.appendChild(crearOpcionModelo(m)));

        const porProveedor = new Map();
        pago.forEach(m => {
            const key = m.provider || 'custom';
            if (!porProveedor.has(key)) porProveedor.set(key, []);
            porProveedor.get(key).push(m);
        });

        for (const [provider, modelos] of porProveedor) {
            const titulo = document.createElement('p');
            titulo.className = 'px-2 pt-2 pb-1 text-xs font-semibold text-amber-700/80 uppercase tracking-wide';
            titulo.textContent = NOMBRES_PROVEEDOR[provider] || provider;
            dom.listaPago.appendChild(titulo);
            modelos.forEach(m => dom.listaPago.appendChild(crearOpcionModelo(m)));
        }

        const hayResultados = gratuitos.length > 0 || pago.length > 0;
        dom.modelosVacio.classList.toggle('hidden', hayResultados);
    }

    function crearOpcionAuto() {
        const btn = document.createElement('button');
        btn.type = 'button';
        const activo = config.modoAuto;
        btn.className = 'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors ' +
            (activo ? 'bg-violet-50 text-violet-800' : 'hover:bg-gray-50 text-gray-700');

        btn.innerHTML =
            '<span class="w-2 h-2 rounded-full shrink-0 bg-violet-500"></span>' +
            '<span class="flex-1 min-w-0 truncate font-medium">Auto</span>' +
            '<span class="text-xs text-violet-500 shrink-0">Siempre operativo</span>';

        btn.onclick = () => activarModoAuto();
        return btn;
    }

    function crearOpcionModelo(modelo) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const activo = !config.modoAuto && modeloActivo &&
            modeloActivo.id === modelo.id && modeloActivo.provider === modelo.provider;
        btn.className = 'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors ' +
            (activo ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-700');

        const esGratis = !modelo.requiereApiKey;
        const contextoMaximo = modelo.esPlaceholderKey
            ? 'Key'
            : formatearTokens(obtenerContextoMaximo(modelo));
        btn.innerHTML =
            '<span class="w-2 h-2 rounded-full shrink-0 ' + (esGratis ? 'bg-green-500' : 'bg-amber-500') + '"></span>' +
            '<span class="flex-1 min-w-0 truncate font-medium">' + escaparHTML(modelo.nombre || modelo.id) + '</span>' +
            '<span class="text-xs text-gray-400 shrink-0">' + contextoMaximo + '</span>' +
            '<span class="text-xs text-gray-400 shrink-0">' + (esGratis ? 'Gratis' : (modelo.esPlaceholderKey ? 'API' : 'API')) + '</span>';

        btn.onclick = () => seleccionarModelo(modelo);
        return btn;
    }

    function activarModoAuto() {
        config.modoAuto = true;
        modeloActivo = MODELO_AUTO;
        modeloResueltoInfo = null;
        contextoGestionadoAuto = false;

        dom.modeloLabel.textContent = 'Auto';
        dom.modeloBadge.className = 'w-2 h-2 rounded-full shrink-0 bg-violet-500';
        dom.btnApiKey.classList.add('hidden');
        dom.btnApiKey.classList.remove('flex');
        dom.panelApiKey.classList.add('hidden');
        dom.customFields.classList.add('hidden');

        dom.subtitulo.textContent = 'Auto · elige el mejor modelo local y gestiona el contexto';

        guardarConfig();
        renderizarDropdownModelos(document.getElementById('buscar-modelo')?.value || '');
        cerrarSelectorModelo();
        actualizarIndicadorContexto();
    }

    function seleccionarModelo(modelo) {
        if (modelo?.esPlaceholderKey) {
            config.modoAuto = false;
            modeloActivo = modelo;
            config.modeloId = modelo.id;
            config.provider = modelo.provider;
            config.endpoint = modelo.endpoint || '';
            dom.modeloLabel.textContent = NOMBRES_PROVEEDOR[modelo.provider] || modelo.provider;
            dom.modeloBadge.className = 'w-2 h-2 rounded-full shrink-0 bg-amber-500';
            dom.btnApiKey.classList.remove('hidden');
            dom.btnApiKey.classList.add('flex');
            dom.customFields.classList.toggle('hidden', modelo.provider !== 'custom');
            actualizarPanelApiKey();
            dom.panelApiKey.classList.remove('hidden');
            guardarConfig();
            renderizarDropdownModelos(document.getElementById('buscar-modelo')?.value || '');
            cerrarSelectorModelo();
            dom.subtitulo.textContent = 'Introduce tu API key para cargar los modelos de este proveedor';
            return;
        }

        config.modoAuto = false;
        modeloActivo = modelo;
        config.modeloId = modelo.id;
        config.provider = modelo.provider;
        config.endpoint = modelo.endpoint || OLLAMA_ENDPOINT;

        dom.modeloLabel.textContent = modelo.nombre || modelo.id;
        dom.modeloBadge.className = 'w-2 h-2 rounded-full shrink-0 ' +
            (modelo.requiereApiKey ? 'bg-amber-500' : 'bg-green-500');

        const requiereKey = modelo.requiereApiKey === true;
        dom.btnApiKey.classList.toggle('hidden', !requiereKey);
        dom.btnApiKey.classList.toggle('flex', requiereKey);

        dom.customFields.classList.toggle('hidden', modelo.provider !== 'custom');
        if (modelo.provider === 'custom') {
            dom.inputCustomModel.value = config.customModel || '';
            dom.inputCustomEndpoint.value = config.customEndpoint || '';
        }

        actualizarPanelApiKey();
        guardarConfig();
        renderizarDropdownModelos(document.getElementById('buscar-modelo')?.value || '');
        cerrarSelectorModelo();

        dom.subtitulo.textContent = requiereKey
            ? 'Modelo de pago · requiere API key'
            : 'Modelo gratuito · Ollama local';
        actualizarIndicadorContexto();
    }

    function restaurarModeloSeleccionado() {
        if (config.modoAuto !== false) {
            activarModoAuto();
            return;
        }

        const todos = [...modelosGratuitos, ...modelosDePago.filter(m => !m.esPlaceholderKey)];
        let encontrado = todos.find(m => m.id === config.modeloId && m.provider === config.provider);

        if (!encontrado && config.modeloId && !String(config.modeloId).startsWith('__needs_key__:')) {
            encontrado = todos.find(m => m.id === config.modeloId);
        }
        if (!encontrado && modelosGratuitos.length > 0) {
            encontrado = modelosGratuitos[0];
        }
        if (!encontrado) {
            encontrado = modelosDePago.find(m => !m.esPlaceholderKey);
        }

        if (encontrado) seleccionarModelo(encontrado);
    }

    window.toggleSelectorModelo = function () {
        dropdownModelosAbierto = !dropdownModelosAbierto;
        dom.dropdownModelos.classList.toggle('hidden', !dropdownModelosAbierto);
    };

    function cerrarSelectorModelo() {
        dropdownModelosAbierto = false;
        dom.dropdownModelos.classList.add('hidden');
    }

    window.filtrarModelos = function (valor) {
        renderizarDropdownModelos(valor);
    };

    // ── API Key ──

    function claveApiProvider(provider) {
        return provider || 'custom';
    }

    function obtenerApiKeyActual() {
        return config.apiKeys[claveApiProvider(modeloActivo?.provider)] || '';
    }

    function actualizarPanelApiKey() {
        if (!modeloActivo || !modeloActivo.requiereApiKey) {
            dom.panelApiKey.classList.add('hidden');
            return;
        }

        const provider = modeloActivo.provider;
        const nombres = NOMBRES_PROVEEDOR;

        dom.apiKeyDescripcion.textContent =
            'Introduce tu API key de ' + (nombres[provider] || provider) +
            (modeloActivo.esPlaceholderKey
                ? ' para cargar los modelos disponibles.'
                : ' para usar ' + (modeloActivo.nombre || modeloActivo.id) + '.');
        dom.inputApiKey.value = obtenerApiKeyActual();

        const tieneKey = obtenerApiKeyActual().length > 0;
        dom.btnApiKey.classList.toggle('border-green-300', tieneKey);
        dom.btnApiKey.classList.toggle('bg-green-50', tieneKey);
        dom.btnApiKey.classList.toggle('text-green-700', tieneKey);
    }

    window.togglePanelApiKey = function () {
        if (!modeloActivo?.requiereApiKey) return;
        dom.panelApiKey.classList.toggle('hidden');
        actualizarPanelApiKey();
    };

    window.guardarApiKey = async function () {
        const provider = claveApiProvider(modeloActivo?.provider);
        const key = dom.inputApiKey.value.trim();
        config.apiKeys[provider] = key;

        if (modeloActivo?.provider === 'custom') {
            config.customModel = dom.inputCustomModel.value.trim();
            config.customEndpoint = dom.inputCustomEndpoint.value.trim();
        }

        if (window.electronAPI?.guardarApiKey && key) {
            const res = await window.electronAPI.guardarApiKey(provider, key);
            if (res?.ok) {
                config.apiKeysEncrypted = config.apiKeysEncrypted || {};
                config.apiKeysEncrypted[provider] = res.data;
            }
        }

        guardarConfig();
        actualizarPanelApiKey();
        if (key) {
            await refrescarModelosProveedor(provider);
            alertas('success', 'API key guardada. Modelos actualizados.');
        } else {
            invalidarCacheModelos(provider);
            await cargarModelos();
            alertas('success', 'API key eliminada');
        }
    };

    window.validarApiKey = async function () {
        const provider = claveApiProvider(modeloActivo?.provider);
        const apiKey = dom.inputApiKey.value.trim() || obtenerApiKeyActual();
        if (!apiKey) {
            alertas('warning', 'Introduce una API key para validar');
            return;
        }
        try {
            const model = modeloActivo?.provider === 'custom'
                ? config.customModel
                : (modeloActivo?.esPlaceholderKey ? '' : modeloActivo?.id);
            const endpoint = modeloActivo?.provider === 'custom'
                ? config.customEndpoint
                : (modeloActivo?.endpoint || endpointProveedor(provider));
            const res = await peticion('POST', '/keys/validate', {
                provider,
                apiKey,
                model,
                endpoint,
            });

            config.apiKeys[provider] = apiKey;
            guardarConfig();

            if (Array.isArray(res.modelos) && res.modelos.length > 0) {
                guardarCacheModelos(provider, res.modelos);
                modelosDePago = modelosDePago.filter(m => m.provider !== provider);
                modelosDePago.push(...res.modelos);
                renderizarDropdownModelos(document.getElementById('buscar-modelo')?.value || '');
                const primero = res.modelos[0];
                if (primero && (modeloActivo?.esPlaceholderKey || modeloActivo?.provider === provider)) {
                    seleccionarModelo(primero);
                }
            } else {
                await refrescarModelosProveedor(provider);
            }

            if (res.valid) {
                alertas('success', res.message || 'API key válida');
            } else {
                alertas('error', res.message || 'API key no válida');
            }
        } catch (_) {
            alertas('error', 'No se pudo validar la API key');
        }
    };

    function construirConfigSnapshot(incluirApiKey) {
        const payload = {
            endpoint: OLLAMA_ENDPOINT,
            nivel: 'medium',
            tipoModelo: 'general',
            tipoTrabajo: 'general',
            modoAuto: config.modoAuto === true,
        };

        if (config.modoAuto) {
            payload.provider = 'ollama';
            payload.model = 'auto';
        } else {
            const provider = modeloActivo?.provider || 'ollama';
            payload.provider = provider;
            payload.model = provider === 'custom'
                ? (config.customModel || 'gpt-4o-mini')
                : (modeloActivo?.id || 'qwen2.5-coder:3b');
            payload.endpoint = provider === 'custom'
                ? (config.customEndpoint || 'https://api.openai.com/v1')
                : (modeloActivo?.endpoint || OLLAMA_ENDPOINT);

            if (incluirApiKey && modeloActivo?.requiereApiKey) {
                payload.apiKey = obtenerApiKeyActual();
            }
        }

        return JSON.stringify(payload);
    }

    function construirConfigPersistido() {
        return construirConfigSnapshot(false);
    }

    // ── Sesiones y mensajes ──

    function mostrarEmptyState(visible) {
        if (dom.emptyState) {
            dom.emptyState.classList.toggle('hidden', !visible);
        }
    }

    function limpiarMensajesUI() {
        dom.mensajes.innerHTML = '';
        if (dom.emptyState) {
            dom.mensajes.appendChild(dom.emptyState);
        }
        mensajesSesion = [];
        mostrarEmptyState(true);
        actualizarIndicadorContexto();
    }

    async function descartarSesionVaciaSiAplica() {
        if (!sesionActiva?.id || mensajesSesion.length > 0) {
            return;
        }

        try {
            const mensajes = await peticion('GET', '/sessions/' + sesionActiva.id + '/messages');
            if (mensajes && mensajes.length > 0) {
                mensajesSesion = mensajes;
                return;
            }
            await peticion('DELETE', '/sessions/' + sesionActiva.id);
            sesionActiva = null;
        } catch (_) { /* ignorar */ }
    }

    window.nuevaSesion = async function () {
        await descartarSesionVaciaSiAplica();
        sesionActiva = null;
        limpiarMensajesUI();
        dom.subtitulo.textContent = 'Escribe un mensaje para empezar';
        await cargarHistorial();
        dom.input.focus();
    };

    window.seleccionarSesion = async function (id) {
        try {
            await descartarSesionVaciaSiAplica();

            const data = await peticion('GET', '/sessions/' + id);
            sesionActiva = data.conversacion;
            mensajesSesion = data.mensajes || [];

            dom.mensajes.innerHTML = '';
            const mensajes = mensajesSesion;

            if (mensajes.length === 0) {
                limpiarMensajesUI();
            } else {
                mostrarEmptyState(false);
                mensajes.forEach(m => agregarMensajeAlChat(m.rol, m.contenido, false));
                actualizarIndicadorContexto();
            }

            dom.subtitulo.textContent = sesionActiva.titulo || 'Conversación';
            await cargarHistorial();
        } catch (_) {
            alertas('error', 'No se pudo cargar la conversación');
        }
    };

    window.eliminarSesion = async function (id) {
        const confirmado = await confirmarModal(
            '¿Eliminar esta conversación? Esta acción no se puede deshacer.',
            {
                titulo: 'Eliminar conversación',
                tipo: 'error',
                confirmar: 'Eliminar',
                cancelar: 'Cancelar',
            }
        );
        if (!confirmado) return;

        try {
            await peticion('DELETE', '/sessions/' + id);

            if (sesionActiva?.id === id) {
                sesionActiva = null;
                limpiarMensajesUI();
                dom.subtitulo.textContent = 'Selecciona un modelo y empieza a chatear';
            }

            await cargarHistorial();
            alertas('success', 'Conversación eliminada');
        } catch (_) {
            alertas('error', 'No se pudo eliminar la conversación');
        }
    };

    async function asegurarSesionActiva() {
        if (sesionActiva?.id) return true;
        try {
            const data = await peticion('POST', '/sessions', {
                titulo: '',
                configSnapshot: construirConfigPersistido(),
            });
            sesionActiva = data;
            return true;
        } catch (_) {
            return false;
        }
    }

    window.enviarMensaje = async function () {
        if (enviando || setupActivo) return;

        const contenido = dom.input.value.trim();
        if (!contenido) return;

        if (!config.modoAuto && !modeloActivo) {
            alertas('warning', 'Selecciona un modelo antes de enviar');
            return;
        }

        if (!config.modoAuto && modeloActivo.requiereApiKey && !obtenerApiKeyActual()) {
            dom.panelApiKey.classList.remove('hidden');
            actualizarPanelApiKey();
            alertas('warning', 'Introduce y guarda tu API key para usar este modelo');
            return;
        }

        if (!config.modoAuto && modeloActivo.esPlaceholderKey) {
            dom.panelApiKey.classList.remove('hidden');
            actualizarPanelApiKey();
            alertas('warning', 'Guarda tu API key para cargar los modelos de este proveedor');
            return;
        }

        if (!config.modoAuto && modeloActivo.provider === 'custom') {
            if (!config.customModel?.trim() || !config.customEndpoint?.trim()) {
                dom.panelApiKey.classList.remove('hidden');
                dom.customFields.classList.remove('hidden');
                alertas('warning', 'Configura el nombre del modelo y el endpoint');
                return;
            }
        }

        if (!(await asegurarSesionActiva())) {
            alertas('error', 'No se pudo iniciar la conversación');
            return;
        }

        enviando = true;
        dom.btnEnviar.disabled = true;
        dom.input.value = '';
        dom.input.style.height = 'auto';

        mostrarEmptyState(false);
        agregarMensajeAlChat('user', contenido, true);
        mensajesSesion.push({ rol: 'user', contenido });
        actualizarIndicadorContexto();

        const thinking = document.createElement('div');
        thinking.id = 'chat-thinking';
        thinking.className = 'flex justify-start mb-4';
        thinking.innerHTML =
            '<div class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 text-gray-500 text-sm">' +
            '<span class="inline-flex gap-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>' +
            '<span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.15s"></span>' +
            '<span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.3s"></span></span>' +
            ' Pensando…</div>';
        dom.mensajes.appendChild(thinking);
        scrollAbajo();

        try {
            const data = await peticion('POST', '/sessions/' + sesionActiva.id + '/messages', {
                contenido,
                configSnapshot: construirConfigSnapshot(true),
            });

            thinking.remove();

            if (data?.respuesta) {
                agregarMensajeAlChat('assistant', data.respuesta, true);
                mensajesSesion = data.mensajes || mensajesSesion.concat([
                    { rol: 'assistant', contenido: data.respuesta },
                ]);
                if (data.modeloResuelto) {
                    modeloResueltoInfo = {
                        id: data.modeloResuelto,
                        contextoMaximo: data.contextoMaximo || modeloResueltoInfo?.contextoMaximo,
                    };
                }
                contextoGestionadoAuto = !!data.contextoRecortado;
                if (data.titulo) {
                    sesionActiva.titulo = data.titulo;
                    dom.subtitulo.textContent = data.titulo;
                } else if (config.modoAuto && data.modeloResuelto) {
                    dom.subtitulo.textContent = 'Auto · usando ' + data.modeloResuelto +
                        (data.contextoRecortado ? ' · contexto gestionado' : '');
                }
                actualizarIndicadorContexto();
                await cargarHistorial();
            } else {
                agregarMensajeAlChat('assistant', 'No se pudo obtener respuesta del modelo. Comprueba que Ollama esté activo o que tu API key sea válida.', true);
                mensajesSesion.push({
                    rol: 'assistant',
                    contenido: 'No se pudo obtener respuesta del modelo. Comprueba que Ollama esté activo o que tu API key sea válida.',
                });
                actualizarIndicadorContexto();
            }
        } catch (_) {
            thinking.remove();
            mensajesSesion.pop();
            const mensajesEnDom = dom.mensajes.querySelectorAll(':scope > .flex.mb-4');
            if (mensajesEnDom.length > 0) {
                mensajesEnDom[mensajesEnDom.length - 1].remove();
            }
            await descartarSesionVaciaSiAplica();
            if (mensajesSesion.length === 0) {
                mostrarEmptyState(true);
            }
            actualizarIndicadorContexto();
            alertas('error', 'Error de conexión con el servidor. ¿Está el backend en marcha?');
        } finally {
            enviando = false;
            dom.btnEnviar.disabled = false;
            dom.input.focus();
        }
    };

    function agregarMensajeAlChat(rol, contenido, scroll) {
        const div = document.createElement('div');
        div.className = 'flex mb-4 ' + (rol === 'user' ? 'justify-end' : 'justify-start');

        if (rol === 'user') {
            // Usuario: texto plano (sin markdown) para no interpretar lo que escribe
            div.innerHTML =
                '<div class="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-blue-800 text-white text-sm leading-relaxed whitespace-pre-wrap shadow-sm">' +
                escaparHTML(contenido) + '</div>';
        } else {
            // Asistente: markdown formateado (código, listas, negritas…)
            const esError = typeof contenido === 'string' && contenido.trim().startsWith('Error');
            const cuerpo = esError
                ? escaparHTML(contenido)
                : formatearMarkdown(contenido);

            div.innerHTML =
                '<div class="flex gap-3 max-w-[85%]">' +
                '<div class="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-600"><path d="M6 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -4"/><path d="M9 18h6"/></svg></div>' +
                '<div class="px-4 py-3 rounded-2xl rounded-bl-md bg-gray-100 text-gray-800 text-sm leading-relaxed ' +
                (esError ? 'whitespace-pre-wrap text-red-600' : 'chat-md') + '">' +
                cuerpo + '</div></div>';
        }

        dom.mensajes.appendChild(div);
        if (scroll) scrollAbajo();
    }

    function scrollAbajo() {
        dom.mensajes.scrollTop = dom.mensajes.scrollHeight;
    }

    // ── Inicialización ──

    function configurarEventos() {
        document.addEventListener('click', (e) => {
            const selector = document.getElementById('btn-selector-modelo');
            const dropdown = dom.dropdownModelos;
            if (dropdownModelosAbierto && selector && dropdown &&
                !selector.contains(e.target) && !dropdown.contains(e.target)) {
                cerrarSelectorModelo();
            }
        });
    }

    async function inicializar() {
        if (!document.getElementById('chat-app')) return;

        obtenerDom();
        await cargarConfig();
        configurarEventos();
        configurarSetupOllama();
        await comprobarSetupAlCargar();

        await cargarModelos();
        await cargarHistorial('Generando títulos…');
        try {
            await peticion('POST', '/sessions/renombrar-pendientes');
        } catch (_) { /* ignorar si falla */ }
        await cargarHistorial();
        actualizarIndicadorContexto();

        if (!setupActivo) dom.input.focus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
