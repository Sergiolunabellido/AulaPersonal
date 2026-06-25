(function () {
  'use strict';

  const API_BASE = 'http://localhost:8080/api/notas';
  let notaActualId = null;

  const el = {
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

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    if (res.status === 204) return null;
    return res.json();
  }

  function mostrarNotaEnLista(nota) {
    const div = document.createElement('div');
    div.className = `p-3 border-b border-gray-50 cursor-pointer hover:bg-blue-50 transition-colors ${notaActualId === nota.id ? 'bg-blue-50 border-l-4 border-l-blue-800' : ''}`;
    div.dataset.id = nota.id;

    const titulo = document.createElement('p');
    titulo.className = 'text-sm font-medium text-gray-800 truncate';
    titulo.textContent = nota.titulo;

    const fecha = document.createElement('p');
    fecha.className = 'text-xs text-gray-400 mt-0.5';
    const d = new Date(nota.updatedAt);
    fecha.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.appendChild(titulo);
    div.appendChild(fecha);
    div.addEventListener('click', () => seleccionarNota(nota.id));
    return div;
  }

  function renderizarLista(notas) {
    el.lista.innerHTML = '';
    if (notas.length === 0) {
      el.lista.appendChild(el.sinNotas);
      return;
    }
    for (const nota of notas) {
      el.lista.appendChild(mostrarNotaEnLista(nota));
    }
  }

  function mostrarEditor(nota) {
    notaActualId = nota.id;
    el.editorVacio.classList.add('hidden');
    el.editorActivo.classList.remove('hidden');
    el.inputTitulo.value = nota.titulo;
    el.inputContenido.value = nota.contenido;
  }

  function limpiarEditor() {
    notaActualId = null;
    el.editorVacio.classList.remove('hidden');
    el.editorActivo.classList.add('hidden');
    el.inputTitulo.value = '';
    el.inputContenido.value = '';
  }

  async function seleccionarNota(id) {
    try {
      const nota = await api('GET', `/${id}`);
      mostrarEditor(nota);
      const items = el.lista.querySelectorAll('[data-id]');
      items.forEach(item => {
        item.classList.toggle('bg-blue-50', parseInt(item.dataset.id) === id);
        item.classList.toggle('border-l-4', parseInt(item.dataset.id) === id);
        item.classList.toggle('border-l-blue-800', parseInt(item.dataset.id) === id);
      });
    } catch (_) {
      alertas('error', 'Error al cargar la nota');
    }
  }

  async function guardarNota() {
    const titulo = el.inputTitulo.value.trim();
    const contenido = el.inputContenido.value.trim();
    if (!titulo) {
      alertas('warning', 'La nota debe tener un título');
      return;
    }

    try {
      if (notaActualId) {
        await api('PUT', `/${notaActualId}`, { titulo, contenido });
        alertas('success', 'Nota guardada');
      } else {
        const nota = await api('POST', '', { titulo, contenido });
        notaActualId = nota.id;
        alertas('success', 'Nota creada');
      }
      await cargarNotas();
      if (notaActualId) {
        const items = el.lista.querySelectorAll('[data-id]');
        items.forEach(item => {
          if (parseInt(item.dataset.id) === notaActualId) {
            item.classList.add('bg-blue-50', 'border-l-4', 'border-l-blue-800');
          }
        });
      }
    } catch (_) {
      alertas('error', 'Error al guardar la nota');
    }
  }

  async function eliminarNota() {
    if (!notaActualId) return;
    try {
      await api('DELETE', `/${notaActualId}`);
      limpiarEditor();
      await cargarNotas();
      alertas('success', 'Nota eliminada');
    } catch (_) {
      alertas('error', 'Error al eliminar la nota');
    }
  }

  async function cargarNotas() {
    try {
      const notas = await api('GET', '');
      renderizarLista(notas);
    } catch (_) {
      el.lista.innerHTML = '<div class="p-4 text-center text-red-400 text-sm">Error al conectar con el servidor</div>';
    }
  }

  function nuevaNota() {
    limpiarEditor();
    el.editorVacio.classList.add('hidden');
    el.editorActivo.classList.remove('hidden');
    el.inputTitulo.focus();
    el.lista.querySelectorAll('[data-id]').forEach(item => {
      item.classList.remove('bg-blue-50', 'border-l-4', 'border-l-blue-800');
    });
  }

  el.btnNueva.addEventListener('click', nuevaNota);
  el.btnGuardar.addEventListener('click', guardarNota);
  el.btnEliminar.addEventListener('click', eliminarNota);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      guardarNota();
    }
  });

  cargarNotas();
})();
