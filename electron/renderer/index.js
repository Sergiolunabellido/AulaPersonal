function cargarPagina(evento, pagina) {
    if (evento) evento.preventDefault();
    const divApp = document.getElementById('app');

    const rutas = {
        bienvenida: 'welcome/welcome.html',
        bloqueoApps: 'AppBlocker/appBlocker.html',
        pomodoro: 'Pomodoro/pomodoro.html',
        chatIA: '',
        musica: '',
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

function alertas(tipo, mensaje) {
    const overlay = document.getElementById('modal-overlay');
    const icono = document.getElementById('modal-icono');
    const texto = document.getElementById('modal-mensaje');
    const boton = document.getElementById('modal-boton');

    const colores = {
        info:    { color: 'bg-blue-500', hover: 'hover:bg-blue-600', icono: 'ℹ️' },
        warning: { color: 'bg-yellow-500', hover: 'hover:bg-yellow-600', icono: '⚠️' },
        success: { color: 'bg-green-500', hover: 'hover:bg-green-600', icono: '✅' },
        error:   { color: 'bg-red-500', hover: 'hover:bg-red-600', icono: '❌' },
    };

    const c = colores[tipo] || colores.info;

    texto.textContent = mensaje;
    icono.textContent = c.icono;
    boton.className = `px-4 py-2 text-white rounded-md transition-colors duration-200 ${c.color} ${c.hover}`;
    overlay.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}
