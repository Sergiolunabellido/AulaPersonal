/**
 * Welcome - Página de bienvenida de Aula Personal.
 *
 * Adjunta listeners a las tarjetas de herramientas usando data-pagina.
 * Se recrea desde cargarPagina() (index.js) en cada navegación a bienvenida,
 * por lo que corre cuando el DOM del parcial ya está inyectado.
 */
(function () {
    'use strict';

    document.querySelectorAll('#app a[data-pagina]').forEach(function (enlace) {
        enlace.addEventListener('click', function (evento) {
            evento.preventDefault();
            cargarPagina(evento, enlace.getAttribute('data-pagina'));
        });
    });
})();