(function () {
    'use strict';

    var API_BASE = 'http://localhost:8080/api/musica';

    if (!window.__radioPlayer) {
        window.__radioPlayer = {
            audio: new Audio(),
            currentStation: null,
            isPlaying: false,
            volume: 0.8,
            muted: false,
            ready: false
        };

        var p = window.__radioPlayer;
        var a = p.audio;
        a.volume = p.volume;

        a.addEventListener('error', function () {
            p.isPlaying = false;
            var btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '\u25B6\uFE0F';
        });
        a.addEventListener('ended', function () {
            p.isPlaying = false;
            var btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '\u25B6\uFE0F';
        });
        a.addEventListener('play', function () {
            p.isPlaying = true;
            var btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '\u23F8\uFE0F';
        });
        a.addEventListener('pause', function () {
            p.isPlaying = false;
            var btn = document.getElementById('btn-play');
            if (btn) btn.textContent = '\u25B6\uFE0F';
        });
        p.ready = true;
    }

    var player = window.__radioPlayer;
    var audio = player.audio;

    var allStations = [];
    var searchQuery = '';
    var searchTimeout = null;

    function $(id) { return document.getElementById(id); }

    function escapar(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    window.cargarEmisoras = async function () {
        $('loading-indicator').classList.remove('hidden');
        $('station-grid').classList.add('hidden');
        $('empty-state').classList.add('hidden');
        $('error-state').classList.add('hidden');

        try {
            var url;
            if (searchQuery.trim()) {
                url = API_BASE + '/radios/buscar?query=' + encodeURIComponent(searchQuery.trim());
            } else {
                url = API_BASE + '/radios';
            }

            var res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);

            allStations = await res.json();
            $('loading-indicator').classList.add('hidden');

            if (allStations.length === 0) {
                $('empty-state').classList.remove('hidden');
                return;
            }

            renderizarStations(allStations);
            $('station-count').textContent = allStations.length + ' emisoras';
        } catch (e) {
            $('loading-indicator').classList.add('hidden');
            $('error-state').classList.remove('hidden');
        }
    };

    function renderizarStations(stations) {
        var grid = $('station-grid');
        grid.innerHTML = stations.map(function (s, i) {
            var favicon = s.favicon || '';
            var name = s.name || 'Sin nombre';
            var tags = s.tags || '';
            var genre = tags ? tags.split(',')[0].trim() : '';
            var country = s.country || '';
            var bitrate = s.bitrate || '';
            var codec = s.codec || '';

            return '<div class="bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow flex flex-col">'
                + '<div class="flex items-start gap-3 mb-2">'
                + '<div class="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden">'
                + (favicon
                    ? '<img src="' + escapar(favicon) + '" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.textContent=\'\uD83D\uDCFB\'">'
                    : '<span class="text-sm">\uD83D\uDCFB</span>')
                + '</div>'
                + '<div class="min-w-0 flex-1">'
                + '<div class="text-sm font-semibold text-gray-800 truncate" title="' + escapar(name) + '">' + escapar(name) + '</div>'
                + '<div class="text-xs text-gray-400 truncate">'
                + (genre ? escapar(genre) : '')
                + (country ? (genre ? ' \u00b7 ' : '') + '<span class="font-medium">' + escapar(country) + '</span>' : '')
                + '</div>'
                + '</div>'
                + '</div>'
                + '<div class="flex items-center gap-2 mt-auto">'
                + (bitrate ? '<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">' + bitrate + ' kbps</span>' : '')
                + (codec ? '<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium uppercase">' + escapar(codec) + '</span>' : '')
                + '<button onclick="window.reproducirEmisora(' + i + ')" class="ml-auto px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">\u25B6 Reproducir</button>'
                + '</div>'
                + '</div>';
        }).join('');

        $('station-grid').classList.remove('hidden');
    }

    window.reproducirEmisora = function (index) {
        var s = allStations[index];
        if (!s) return;

        var streamUrl = s.url_resolved || s.url;
        if (!streamUrl) return;

        var name = s.name || 'Sin nombre';
        var tags = s.tags || '';
        var genre = tags ? tags.split(',')[0].trim() : '';
        var country = s.country || '';
        var favicon = s.favicon || '';
        var meta = genre + (country ? ' \u00b7 ' + country : '') || 'Transmisi\u00f3n en vivo';

        player.currentStation = { name: name, meta: meta, favicon: favicon, url: streamUrl };
        audio.src = streamUrl;
        audio.volume = parseFloat($('volume-slider').value) || 0.8;
        player.volume = audio.volume;

        audio.play().then(function () {
            player.isPlaying = true;
            $('btn-play').textContent = '\u23F8\uFE0F';
            actualizarNowPlaying(player.currentStation);
        }).catch(function () {
            player.isPlaying = false;
            $('btn-play').textContent = '\u25B6\uFE0F';
        });
    };

    function actualizarNowPlaying(station) {
        $('player-name').textContent = station.name || 'Sin nombre';
        $('player-meta').textContent = station.meta || 'Transmisi\u00f3n en vivo';
        var playerIcon = $('player-favicon');
        if (station.favicon) {
            playerIcon.innerHTML = '<img src="' + escapar(station.favicon) + '" alt="" class="w-full h-full object-cover" onerror="this.style.display=\'none\';this.parentElement.textContent=\'\uD83D\uDCFB\'">';
        } else {
            playerIcon.innerHTML = '<span class="text-lg">\uD83D\uDCFB</span>';
        }
        $('btn-play').disabled = false;
    }

    window.togglePlay = function () {
        if (!player.currentStation) return;
        if (player.isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(function () { });
        }
    };

    window.toggleMute = function () {
        audio.muted = !audio.muted;
        player.muted = audio.muted;
        var icon = audio.muted ? '\uD83D\uDD07' : (audio.volume > 0 ? '\uD83D\uDD0A' : '\uD83D\uDD08');
        $('btn-mute').textContent = icon;
        var mobileMute = $('btn-mute-mobile');
        if (mobileMute) mobileMute.textContent = icon;
    };

    window.ajustarVolumen = function (val) {
        var v = parseFloat(val);
        audio.volume = v;
        player.volume = v;
        if (audio.muted && v > 0) {
            audio.muted = false;
            player.muted = false;
        }
        var icon = audio.muted ? '\uD83D\uDD07' : (v > 0 ? '\uD83D\uDD0A' : '\uD83D\uDD08');
        $('btn-mute').textContent = icon;
        var mobileMute = $('btn-mute-mobile');
        if (mobileMute) mobileMute.textContent = icon;
    };

    function inicializar() {
        $('btn-play').addEventListener('click', window.togglePlay);
        $('btn-mute').addEventListener('click', window.toggleMute);
        var mobileMute = $('btn-mute-mobile');
        if (mobileMute) mobileMute.addEventListener('click', window.toggleMute);
        $('volume-slider').addEventListener('input', function () { window.ajustarVolumen(this.value); });
        $('search-input').addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function () {
                searchQuery = $('search-input').value;
                window.cargarEmisoras();
            }, 400);
        });

        if (player.currentStation) {
            actualizarNowPlaying(player.currentStation);
            $('btn-play').textContent = player.isPlaying ? '\u23F8\uFE0F' : '\u25B6\uFE0F';
            $('volume-slider').value = player.volume;
            var icon = player.muted ? '\uD83D\uDD07' : (player.volume > 0 ? '\uD83D\uDD0A' : '\uD83D\uDD08');
            $('btn-mute').textContent = icon;
            if (mobileMute) mobileMute.textContent = icon;
            $('btn-play').disabled = false;
        }

        window.cargarEmisoras();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
