function cargarPagina(evento, pagina) {
    if (evento) evento.preventDefault();
    const divApp = document.getElementById('app');

    const rutas = {
        bienvenida: 'welcome/welcome.html',
        bloqueoApps: 'AppBlocker/appBlocker.html',
        pomodoro: 'Pomodoro/pomodoro.html',
        chatIA: 'chatAI/chat.html',
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
