(function () {
    'use strict';

    const API_BASE = 'http://localhost:8080/api/musica';

    // Player state
    const player = {
        audio: new Audio(),
        isPlaying: false,
        isMuted: false,
        shuffle: false,
        repeat: 'off', // 'off', 'one', 'all'
        currentSource: null, // { type: 'radio'|'local'|'playlist', data: ... }
        queue: [],
        queueIndex: -1,
        volume: 0.8,
    };

    let currentTab = 'radios';
    let todasLasRadios = [];
    let cancionesLocales = [];

    // ===================== DOM refs =====================
    function $(id) { return document.getElementById(id); }

    // ===================== Audio player controls =====================
    window.togglePlay = function () {
        if (!player.currentSource) return;
        if (player.isPlaying) {
            player.audio.pause();
            player.isPlaying = false;
            $('btn-play').textContent = '▶️';
        } else {
            player.audio.play().catch(() => {});
            player.isPlaying = true;
            $('btn-play').textContent = '⏸️';
        }
    };

    window.toggleMute = function () {
        player.isMuted = !player.isMuted;
        player.audio.muted = player.isMuted;
        $('btn-mute').textContent = player.isMuted ? '🔇' : (player.volume > 0 ? '🔊' : '🔈');
    };

    window.ajustarVolumen = function (val) {
        player.volume = parseFloat(val);
        player.audio.volume = player.volume;
        $('btn-mute').textContent = player.volume > 0 ? '🔊' : '🔈';
        if (player.isMuted && player.volume > 0) {
            player.isMuted = false;
            player.audio.muted = false;
        }
    };

    window.buscarEnCancion = function (val) {
        if (!player.audio.duration) return;
        player.audio.currentTime = (val / 100) * player.audio.duration;
    };

    window.toggleShuffle = function () {
        player.shuffle = !player.shuffle;
        $('btn-shuffle').style.opacity = player.shuffle ? '1' : '0.4';
    };

    window.toggleRepeat = function () {
        const modes = ['off', 'one', 'all'];
        const idx = modes.indexOf(player.repeat);
        player.repeat = modes[(idx + 1) % modes.length];
        $('btn-repeat').style.opacity = player.repeat === 'off' ? '0.4' : '1';
        $('btn-repeat').textContent = player.repeat === 'one' ? '🔂' : '🔁';
    };

    window.anteriorCancion = function () {
        if (player.queue.length === 0) return;
        if (player.audio.currentTime > 3) {
            player.audio.currentTime = 0;
            return;
        }
        if (player.shuffle) {
            player.queueIndex = Math.floor(Math.random() * player.queue.length);
        } else {
            player.queueIndex = (player.queueIndex - 1 + player.queue.length) % player.queue.length;
        }
        reproducirColaActual();
    };

    window.siguienteCancion = function () {
        if (player.queue.length === 0) return;
        if (player.repeat === 'one') {
            player.audio.currentTime = 0;
            player.audio.play().catch(() => {});
            return;
        }
        if (player.shuffle) {
            player.queueIndex = Math.floor(Math.random() * player.queue.length);
        } else {
            player.queueIndex = (player.queueIndex + 1) % player.queue.length;
            if (player.queueIndex === 0 && player.repeat !== 'all') {
                player.audio.pause();
                player.isPlaying = false;
                $('btn-play').textContent = '▶️';
                return;
            }
        }
        reproducirColaActual();
    };

    function reproducirColaActual() {
        const item = player.queue[player.queueIndex];
        if (!item) return;
        reproducir(item);
    }

    // ===================== Play a source =====================
    function reproducir(source) {
        player.currentSource = source;

        if (source.type === 'radio') {
            player.audio.src = source.urlStream;
        } else if (source.type === 'local' || source.type === 'playlist') {
            player.audio.src = 'local-audio://' + source.ruta.replace(/\\/g, '/');
        }

        player.audio.volume = player.volume;
        player.audio.play().then(() => {
            player.isPlaying = true;
            $('btn-play').textContent = '⏸️';
            actualizarNowPlaying(source);
        }).catch((err) => {
            alertas('error', 'No se puede reproducir: ' + (source.titulo || source.nombre));
            player.isPlaying = false;
            $('btn-play').textContent = '▶️';
        });
    }

    function actualizarNowPlaying(source) {
        $('player-title').textContent = source.titulo || source.nombre || 'Sin título';
        $('player-artist').textContent = source.artista || source.genero || '';
        $('player-now-icon').textContent = source.type === 'radio' ? '📻' : '🎵';
    }

    // Audio event listeners
    player.audio.addEventListener('timeupdate', function () {
        if (!player.audio.duration) return;
        const pct = (player.audio.currentTime / player.audio.duration) * 100;
        $('player-progress').value = pct;
        $('player-current-time').textContent = formatearTiempo(player.audio.currentTime);
        $('player-duration').textContent = formatearTiempo(player.audio.duration);
    });

    player.audio.addEventListener('ended', function () {
        window.siguienteCancion();
    });

    player.audio.addEventListener('error', function () {
        player.isPlaying = false;
        $('btn-play').textContent = '▶️';
    });

    function formatearTiempo(seg) {
        if (!seg || isNaN(seg)) return '0:00';
        const m = Math.floor(seg / 60);
        const s = Math.floor(seg % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // ===================== Tab switching =====================
    window.cambiarTab = function (tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('bg-purple-100', 'text-purple-700');
            el.classList.add('text-gray-600', 'hover:bg-gray-100');
        });
        $('content-' + tab).classList.remove('hidden');
        const tabBtn = $('tab-' + tab);
        tabBtn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        tabBtn.classList.add('bg-purple-100', 'text-purple-700');

        if (tab === 'radios') cargarRadios();
        else if (tab === 'playlists') cargarPlaylists();
        else if (tab === 'local') cargarLocal();
    };

    // ===================== Radios =====================
    async function cargarRadios() {
        try {
            const res = await fetch(API_BASE + '/radios');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            todasLasRadios = await res.json();
            renderizarRadios(todasLasRadios);
        } catch (e) {
            $('radio-grid').innerHTML = '<p class="text-gray-400">Error al cargar radios</p>';
        }
    }

    window.filtrarRadios = function (genero, btn) {
        document.querySelectorAll('.genero-btn').forEach(b => {
            b.classList.remove('bg-purple-600', 'text-white');
            b.classList.add('bg-gray-100', 'text-gray-600');
        });
        btn.classList.remove('bg-gray-100', 'text-gray-600');
        btn.classList.add('bg-purple-600', 'text-white');

        if (genero === 'all') renderizarRadios(todasLasRadios);
        else renderizarRadios(todasLasRadios.filter(r => r.genero === genero));
    };

    function renderizarRadios(radios) {
        const grid = $('radio-grid');
        grid.innerHTML = radios.map(r => `
            <div class="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow ${r.favorita ? 'ring-2 ring-purple-300' : ''}">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <div class="text-sm font-semibold text-gray-800">${r.nombre}</div>
                        <div class="text-xs text-gray-400">${r.genero}</div>
                    </div>
                    <button onclick="window.toggleRadioFav(${r.id}, this)" class="text-lg ${r.favorita ? 'text-purple-500' : 'text-gray-300 hover:text-purple-400'} transition-colors">${r.favorita ? '♥' : '♡'}</button>
                </div>
                <button onclick="window.reproducirRadio(${r.id})" class="w-full mt-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-1">
                    ▶ Reproducir
                </button>
            </div>
        `).join('');
    }

    window.reproducirRadio = function (id) {
        const radio = todasLasRadios.find(r => r.id === id);
        if (!radio) return;
        player.queue = [];
        player.queueIndex = -1;
        reproducir({
            type: 'radio',
            id: radio.id,
            nombre: radio.nombre,
            titulo: radio.nombre,
            artista: radio.genero,
            genero: radio.genero,
            urlStream: radio.urlStream,
        });
    };

    window.toggleRadioFav = async function (id, btn) {
        try {
            const res = await fetch(API_BASE + '/radios/' + id + '/favorito', { method: 'POST' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const radio = await res.json();
            btn.textContent = radio.favorita ? '♥' : '♡';
            btn.classList.toggle('text-purple-500', radio.favorita);
            btn.classList.toggle('text-gray-300', !radio.favorita);
            btn.parentElement.parentElement.classList.toggle('ring-2', radio.favorita);
            btn.parentElement.parentElement.classList.toggle('ring-purple-300', radio.favorita);
        } catch (e) {
            alertas('error', 'Error al cambiar favorito');
        }
    };

    // ===================== Playlists =====================
    async function cargarPlaylists() {
        try {
            const res = await fetch(API_BASE + '/playlists');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const playlists = await res.json();
            const grid = $('playlists-grid');
            if (playlists.length === 0) {
                grid.innerHTML = '<p class="text-gray-400 col-span-full text-center mt-8">No tienes listas aún. Crea una para empezar.</p>';
                return;
            }
            grid.innerHTML = playlists.map(p => `
                <div class="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                    <div class="text-sm font-semibold text-gray-800 mb-1">${p.nombre}</div>
                    <div class="text-xs text-gray-400 mb-3">${p.descripcion || 'Sin descripción'}</div>
                    <div class="flex gap-2">
                        <button onclick="window.reproducirPlaylist(${p.id})" class="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">▶ Reproducir</button>
                        <button onclick="window.eliminarPlaylist(${p.id})" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">✕</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('playlists-grid').innerHTML = '<p class="text-gray-400">Error al cargar listas</p>';
        }
    }

    window.crearPlaylist = async function () {
        const nombre = prompt('Nombre de la lista:');
        if (!nombre || !nombre.trim()) return;
        try {
            const res = await fetch(API_BASE + '/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombre.trim(), descripcion: '' }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            cargarPlaylists();
        } catch (e) {
            alertas('error', 'Error al crear lista');
        }
    };

    window.eliminarPlaylist = async function (id) {
        const ok = await confirmarModal('¿Eliminar esta lista?', { confirmar: 'Eliminar' });
        if (!ok) return;
        try {
            const res = await fetch(API_BASE + '/playlists/' + id, { method: 'DELETE' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            cargarPlaylists();
        } catch (e) {
            alertas('error', 'Error al eliminar lista');
        }
    };

    window.reproducirPlaylist = async function (id) {
        try {
            const res = await fetch(API_BASE + '/playlists/' + id + '/canciones');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const canciones = await res.json();
            if (canciones.length === 0) {
                alertas('info', 'Esta lista está vacía');
                return;
            }
            player.queue = canciones.map(c => ({
                type: 'playlist',
                ruta: c.rutaArchivo,
                titulo: c.titulo || 'Sin título',
                artista: c.artista || '',
                album: c.album || '',
                duracion: c.duracion || 0,
                id: c.id,
                playlistId: c.playlistId,
            }));
            player.queueIndex = 0;
            reproducirColaActual();
        } catch (e) {
            alertas('error', 'Error al cargar canciones');
        }
    };

    // ===================== Local Music =====================
    async function cargarLocal() {
        try {
            const res = await fetch(API_BASE + '/carpetas');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const carpetas = await res.json();
            const lista = $('carpetas-lista');
            if (carpetas.length === 0) {
                lista.innerHTML = '<p class="text-sm text-gray-400">No hay carpetas añadidas. Haz clic en "Añadir carpeta" para escanear tu música.</p>';
                $('local-songs').innerHTML = '';
                return;
            }
            lista.innerHTML = carpetas.map(c => `
                <div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span class="text-sm text-gray-700 truncate">📁 ${c.ruta}</span>
                    <button onclick="window.eliminarCarpeta(${c.id})" class="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
            `).join('');

            // Scan all folders and show songs
            let todasLasCanciones = [];
            for (const c of carpetas) {
                const canciones = await window.electronAPI.escanearCarpeta(c.ruta);
                todasLasCanciones = todasLasCanciones.concat(canciones);
            }
            renderizarCancionesLocales(todasLasCanciones);
        } catch (e) {
            $('carpetas-lista').innerHTML = '<p class="text-sm text-gray-400">Error al cargar carpetas</p>';
        }
    }

    function renderizarCancionesLocales(canciones) {
        const container = $('local-songs');
        if (canciones.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 mt-4">No se encontraron archivos de música en las carpetas seleccionadas.</p>';
            return;
        }
        container.innerHTML = canciones.map((c, i) => `
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group" onclick="window.reproducirLocal(${i})" data-index="${i}">
                <span class="text-gray-400 text-sm">${i + 1}</span>
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-gray-800 truncate">${c.titulo}</div>
                    <div class="text-xs text-gray-400 truncate">${c.artista || 'Artista desconocido'}</div>
                </div>
                <span class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
            </div>
        `).join('');

        // Store songs for playback
        cancionesLocales = canciones;
    }

    window.reproducirLocal = function (index) {
        const canciones = cancionesLocales;
        const c = canciones[index];
        if (!c) return;

        player.queue = canciones.map((song, i) => ({
            type: 'local',
            ruta: song.ruta,
            titulo: song.titulo || song.nombre,
            artista: song.artista || '',
            nombre: song.nombre,
        }));
        player.queueIndex = index;
        reproducirColaActual();
    };

    window.seleccionarCarpeta = async function () {
        const ruta = await window.electronAPI.escogerCarpeta();
        if (!ruta) return;
        try {
            const res = await fetch(API_BASE + '/carpetas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruta }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            cargarLocal();
        } catch (e) {
            alertas('error', 'Error al guardar la carpeta');
        }
    };

    window.eliminarCarpeta = async function (id) {
        try {
            const res = await fetch(API_BASE + '/carpetas/' + id, { method: 'DELETE' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            cargarLocal();
        } catch (e) {
            alertas('error', 'Error al eliminar carpeta');
        }
    };

    // ===================== Init =====================
    function inicializar() {
        // Set initial volume
        player.audio.volume = player.volume;
        $('player-volume').value = player.volume;

        // Load default tab
        cargarRadios();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
