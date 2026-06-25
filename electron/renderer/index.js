function cargarPagina(e, pagina) {
    e.preventDefault();
    const divApp = document.getElementById('app');

    const rutas = {
        appblocker: 'AppBlocker/appBlocker.html',
        pomodoro: 'Pomodoro/pomodoro.html',
        aichat: 'chatAI/chat.html',
        music: '',
        notes: '',
    };

    const ruta = rutas[pagina];
    if (!ruta) {
        divApp.innerHTML = '<p class="text-gray-500">Página en construcción</p>';
        return;
    }

    fetch(ruta)
        .then(res => res.text())
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
        });
}

function alertas(tipo, mensaje) {
    const overlay = document.getElementById('modal-overlay');
    const icono = document.getElementById('modal-icono');
    const texto = document.getElementById('modal-mensaje');
    const boton = document.getElementById('modal-boton');

    const config = {
        info:    { color: 'bg-blue-500', hover: 'hover:bg-blue-600', icono: 'ℹ️' },
        warning: { color: 'bg-yellow-500', hover: 'hover:bg-yellow-600', icono: '⚠️' },
        success: { color: 'bg-green-500', hover: 'hover:bg-green-600', icono: '✅' },
        error:   { color: 'bg-red-500', hover: 'hover:bg-red-600', icono: '❌' },
    };

    const c = config[tipo] || config.info;

    texto.textContent = mensaje;
    icono.textContent = c.icono;
    boton.className = `px-4 py-2 text-white rounded-md transition-colors duration-200 ${c.color} ${c.hover}`;
    overlay.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}