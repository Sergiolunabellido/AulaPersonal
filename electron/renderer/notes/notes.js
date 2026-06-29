(function () {
  'use strict';

  const URL_API = 'http://localhost:8080/api/notas';
  let idNotaActual = null;

  const dom = {
    lista: document.getElementById('lista-notas'),
    sinNotas: document.getElementById('sin-notas'),
    editorVacio: document.getElementById('editor-vacio'),
    editorActivo: document.getElementById('editor-activo'),
    inputTitulo: document.getElementById('input-titulo'),
    inputContenido: document.getElementById('input-contenido'),
    btnNueva: document.getElementById('btn-nueva-nota'),
    btnGuardar: document.getElementById('btn-guardar'),
    btnEliminar: document.getElementById('btn-eliminar'),
  };

  async function peticion(metodo, ruta, cuerpo) {
    const opciones = {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
    };
    if (cuerpo) opciones.body = JSON.stringify(cuerpo);
    const respuesta = await fetch(`${URL_API}${ruta}`, opciones);
    if (!respuesta.ok) throw new Error(`${metodo} ${ruta} → ${respuesta.status}`);
    if (respuesta.status === 204) return null;
    return respuesta.json();
  }

  function mostrarNotaEnLista(nota) {
    const div = document.createElement('div');
    div.className = `p-3 border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors ${idNotaActual === nota.id ? 'bg-blue-50 border-l-4 border-l-blue-800' : ''}`;
    div.dataset.id = nota.id;

    const titulo = document.createElement('p');
    titulo.className = 'text-sm font-medium text-gray-800 truncate';
    titulo.textContent = nota.titulo;

    const fecha = document.createElement('p');
    fecha.className = 'text-xs text-gray-400 mt-0.5';
    const d = new Date(nota.actualizadoEn);
    fecha.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.appendChild(titulo);
    div.appendChild(fecha);
    div.addEventListener('click', () => seleccionarNota(nota.id));
    return div;
  }

  function renderizarLista(notas) {
    dom.lista.innerHTML = '';
    if (notas.length === 0) {
      dom.lista.appendChild(dom.sinNotas);
      return;
    }
    for (const nota of notas) {
      dom.lista.appendChild(mostrarNotaEnLista(nota));
    }
  }

  function mostrarEditor(nota) {
    idNotaActual = nota.id;
    dom.editorVacio.classList.add('hidden');
    dom.editorActivo.classList.remove('hidden');
    dom.inputTitulo.value = nota.titulo;
    dom.inputContenido.value = nota.contenido;
  }

  function limpiarEditor() {
    idNotaActual = null;
    dom.editorVacio.classList.remove('hidden');
    dom.editorActivo.classList.add('hidden');
    dom.inputTitulo.value = '';
    dom.inputContenido.value = '';
  }

  async function seleccionarNota(idNota) {
    try {
      const nota = await peticion('GET', `/${idNota}`);
      mostrarEditor(nota);
      const elementos = dom.lista.querySelectorAll('[data-id]');
      elementos.forEach(item => {
        item.classList.toggle('bg-blue-50', parseInt(item.dataset.id) === idNota);
        item.classList.toggle('border-l-4', parseInt(item.dataset.id) === idNota);
        item.classList.toggle('border-l-blue-800', parseInt(item.dataset.id) === idNota);
      });
    } catch (_) {
      alertas('error', 'Error al cargar la nota');
    }
  }

  async function guardarNota() {
    const titulo = dom.inputTitulo.value.trim();
    const contenido = dom.inputContenido.value.trim();
    if (!titulo) {
      alertas('warning', 'La nota debe tener un título');
      return;
    }

    try {
      if (idNotaActual) {
        await peticion('PUT', `/${idNotaActual}`, { titulo, contenido });
        alertas('success', 'Nota guardada');
      } else {
        const nota = await peticion('POST', '', { titulo, contenido });
        idNotaActual = nota.id;
        alertas('success', 'Nota creada');
      }
      await cargarNotas();
      if (idNotaActual) {
        const elementos = dom.lista.querySelectorAll('[data-id]');
        elementos.forEach(item => {
          if (parseInt(item.dataset.id) === idNotaActual) {
            item.classList.add('bg-blue-50', 'border-l-4', 'border-l-blue-800');
          }
        });
      }
    } catch (_) {
      alertas('error', 'Error al guardar la nota');
    }
  }

  async function eliminarNota() {
    if (!idNotaActual) return;
    try {
      await peticion('DELETE', `/${idNotaActual}`);
      limpiarEditor();
      await cargarNotas();
      alertas('success', 'Nota eliminada');
    } catch (_) {
      alertas('error', 'Error al eliminar la nota');
    }
  }

  async function cargarNotas() {
    try {
      const notas = await peticion('GET', '');
      renderizarLista(notas);
    } catch (_) {
      dom.lista.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Error al conectar con el servidor</div>';
    }
  }

  function nuevaNota() {
    limpiarEditor();
    dom.editorVacio.classList.add('hidden');
    dom.editorActivo.classList.remove('hidden');
    dom.inputTitulo.focus();
    dom.lista.querySelectorAll('[data-id]').forEach(item => {
      item.classList.remove('bg-blue-50', 'border-l-4', 'border-l-blue-800');
    });
  }

  dom.btnNueva.addEventListener('click', nuevaNota);
  dom.btnGuardar.addEventListener('click', guardarNota);
  dom.btnEliminar.addEventListener('click', eliminarNota);

  document.addEventListener('keydown', (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && evento.key === 's') {
      evento.preventDefault();
      guardarNota();
    }
  });

  cargarNotas();
})();
