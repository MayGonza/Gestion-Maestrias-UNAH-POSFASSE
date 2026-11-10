/**
 * =============================================================================
 * SISTEMA INTEGRADO DE CONTROL ACADÉMICO Y ESCOLAR - POSFACE UNAH
 * Universidad Nacional Autónoma de Honduras (UNAH)
 * Facultad de Ciencias Económicas, Administrativas y Contables
 * Dirección del Sistema de Posgrados de la Facultad de Ciencias Económicas
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de datos oficiales
  const data = window.POSFASSE_DATA;
  if (!data) {
    console.error("Error: No se encontraron los datos POSFASSE_DATA");
    return;
  }

  // ===========================================================================
  // 1. ESTADO GLOBAL E INTEGRACIÓN DE DATOS (FIREBASE / LOCAL)
  // ===========================================================================
  // Inicialización resiliente: leer siempre de LocalStorage primero (incluso si es lista vacía [])
  let initialEstudiantes = [];
  try {
    const local = localStorage.getItem('posface_estudiantes_data');
    if (local !== null) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        initialEstudiantes = parsed;
      }
    } else if (Array.isArray(data.estudiantes) && data.estudiantes.length > 0) {
      initialEstudiantes = [...data.estudiantes];
    }
  } catch (e) {
    initialEstudiantes = [];
  }

  let estudiantesList = initialEstudiantes;
  let maestriasList = [...data.maestrias];

  // Sincronizar estudiantes con PosfaceDB (Firestore o Local)
  if (window.PosfaceDB) {
    window.PosfaceDB.fetchEstudiantes(initialEstudiantes).then(list => {
      if (Array.isArray(list)) {
        estudiantesList = list;
        filtrarEstudiantes();
        renderDashboard();
      }
    });
  }

  // Escucha reactiva en tiempo real para nuevos estudiantes o eliminaciones en otra pestaña
  window.addEventListener('storage', (e) => {
    if (e.key === 'posface_estudiantes_data') {
      try {
        const updated = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(updated)) {
          estudiantesList = updated;
          filtrarEstudiantes();
          renderDashboard();
        }
      } catch (err) { }
    }
  });

  window.addEventListener('posface_estudiante_agregado', (e) => {
    if (e.detail) {
      if (!estudiantesList.some(est => est.id === e.detail.id)) {
        estudiantesList.unshift(e.detail);
        filtrarEstudiantes();
        renderDashboard();
      }
    }
  });

  window.addEventListener('posface_estudiante_eliminado', (e) => {
    if (e.detail) {
      if (e.detail.all) {
        estudiantesList = [];
      } else if (e.detail.id) {
        estudiantesList = estudiantesList.filter(est => est.id !== e.detail.id);
      }
      filtrarEstudiantes();
      renderDashboard();
    }
  });

  // Helper para clases visuales de estados de estudiantes
  function getBadgeClassForEstado(estado) {
    if (estado === 'En Tesis') return 'badge-tesis';
    if (estado === 'Egresado') return 'badge-egresado';
    if (estado === 'Graduado') return 'badge-graduado';
    if (estado === 'Inactivo') return 'badge-inactivo';
    return 'badge-activo';
  }

  // Función para cambiar estado del estudiante
  function cambiarEstadoEstudiante(estId, nuevoEstado) {
    const est = estudiantesList.find(e => e.id === estId);
    if (!est) return;

    est.estado = nuevoEstado;

    // Guardar en Firebase Firestore o LocalStorage con datos completos del estudiante
    if (window.PosfaceDB) {
      window.PosfaceDB.updateEstadoEstudiante(estId, nuevoEstado, estudiantesList, est);
    } else {
      try {
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(estudiantesList));
      } catch (e) {
        console.warn('No se pudo guardar en localStorage', e);
      }
    }

    // Actualizar modal si está abierto
    const selectModal = document.getElementById('selectEstadoExpediente');
    if (selectModal && selectModal.getAttribute('data-id') === estId) {
      selectModal.value = nuevoEstado;
      selectModal.className = `badge-status-select badge ${getBadgeClassForEstado(nuevoEstado)}`;
      const expEstadoPrint = document.getElementById('expEstadoPrint');
      if (expEstadoPrint) expEstadoPrint.textContent = nuevoEstado.toUpperCase();
    }

    filtrarEstudiantes();
    renderDashboard();
    showToast(`Estado de ${est.nombres} ${est.apellidos} actualizado a: "${nuevoEstado}"`, 'success');
  }

  // =========================================================================
  // CONTROL Y ELIMINACIÓN DE ESTUDIANTES DE PREVIA INSCRIPCIÓN
  // =========================================================================
  let estudianteIdAEliminar = null;
  const modalConfirmarEliminar = document.getElementById('modalConfirmarEliminar');
  const nombreEstudianteEliminar = document.getElementById('nombreEstudianteEliminar');
  const btnConfirmarEliminar = document.getElementById('btnConfirmarEliminar');
  const btnEliminarExpedienteActual = document.getElementById('btnEliminarExpedienteActual');

  function solicitarEliminarEstudiante(estId, nombre) {
    estudianteIdAEliminar = estId;
    if (nombreEstudianteEliminar) {
      nombreEstudianteEliminar.textContent = nombre || 'este estudiante';
    }
    openModal(modalConfirmarEliminar);
  }

  function ejecutarEliminacionEstudiante() {
    if (!estudianteIdAEliminar) return;
    const est = estudiantesList.find(e => e.id === estudianteIdAEliminar);
    const nombreCompleto = est ? `${est.nombres} ${est.apellidos}` : 'Estudiante';

    // 1. Filtrar de la lista local
    estudiantesList = estudiantesList.filter(e => e.id !== estudianteIdAEliminar);

    // 2. Persistir en Firestore y/o LocalStorage con datos completos del estudiante eliminado
    if (window.PosfaceDB) {
      window.PosfaceDB.deleteEstudiante(estudianteIdAEliminar, estudiantesList, est);
    } else {
      try {
        localStorage.setItem('posface_estudiantes_data', JSON.stringify(estudiantesList));
      } catch (e) { }
    }

    // 3. Cerrar modales si están abiertos
    closeModal(modalConfirmarEliminar);
    if (modalExpediente) closeModal(modalExpediente);

    // 4. Refrescar listado y estadísticas
    filtrarEstudiantes();
    renderDashboard();

    showToast(`✓ Registro de ${nombreCompleto} eliminado exitosamente de la previa inscripción`, 'success');
    estudianteIdAEliminar = null;
    currentExpedienteEstudiante = null;
  }

  if (btnConfirmarEliminar) {
    btnConfirmarEliminar.addEventListener('click', ejecutarEliminacionEstudiante);
  }

  if (btnEliminarExpedienteActual) {
    btnEliminarExpedienteActual.addEventListener('click', () => {
      if (currentExpedienteEstudiante) {
        solicitarEliminarEstudiante(
          currentExpedienteEstudiante.id,
          `${currentExpedienteEstudiante.nombres} ${currentExpedienteEstudiante.apellidos}`
        );
      }
    });
  }

  const btnAnularDocumentoQR = document.getElementById('btnAnularDocumentoQR');
  const btnReactivarDocumentoQR = document.getElementById('btnReactivarDocumentoQR');
  const btnRegenerarDocumentoQR = document.getElementById('btnRegenerarDocumentoQR');

  if (btnAnularDocumentoQR) {
    btnAnularDocumentoQR.addEventListener('click', async () => {
      if (currentExpedienteEstudiante && currentExpedienteEstudiante.qr_token) {
        if (confirm('¿Está seguro de que desea REVOCAR el código QR de este documento? El código actual mostrará estado "ANULADO" a quien lo escanee.')) {
          try {
            await window.PosfaceDB.revokeDocumentToken(currentExpedienteEstudiante.qr_token);
            showToast('Documento revocado exitosamente.', 'success');
            btnAnularDocumentoQR.style.display = 'none';
            if (btnReactivarDocumentoQR) btnReactivarDocumentoQR.style.display = 'flex';
          } catch (err) {
            console.error("Error al revocar QR:", err);
            showToast('Hubo un error al intentar revocar el documento.', 'danger');
          }
        }
      } else {
        showToast('Este expediente aún no tiene un QR emitido válido para revocar.', 'warning');
      }
    });
  }

  if (btnReactivarDocumentoQR) {
    btnReactivarDocumentoQR.addEventListener('click', async () => {
      if (currentExpedienteEstudiante && currentExpedienteEstudiante.qr_token) {
        if (confirm('¿Desea volver a ACTIVAR la validez de este documento?')) {
          try {
            await window.PosfaceDB.activateDocumentToken(currentExpedienteEstudiante.qr_token);
            showToast('Documento reactivado exitosamente.', 'success');
            btnReactivarDocumentoQR.style.display = 'none';
            if (btnAnularDocumentoQR) btnAnularDocumentoQR.style.display = 'flex';
          } catch (err) {
            console.error("Error al reactivar QR:", err);
            showToast('Hubo un error al reactivar el documento.', 'danger');
          }
        }
      }
    });
  }

  if (btnRegenerarDocumentoQR) {
    btnRegenerarDocumentoQR.addEventListener('click', async () => {
      if (currentExpedienteEstudiante) {
        if (confirm('¿Desea ELIMINAR el código QR actual y GENERAR uno nuevo para este estudiante? El código anterior quedará inválido permanentemente.')) {
          try {
            if (currentExpedienteEstudiante.qr_token) {
              await window.PosfaceDB.revokeDocumentToken(currentExpedienteEstudiante.qr_token);
            }
            if (window.PosfaceDB.isCloudActive()) {
              await firebase.firestore().collection('estudiantes').doc(currentExpedienteEstudiante.id).update({ qr_token: firebase.firestore.FieldValue.delete() });
            }
            delete currentExpedienteEstudiante.qr_token;
            showToast('QR anterior eliminado. Abriendo expediente para generar uno nuevo...', 'success');
            closeModal(document.getElementById('modalExpediente'));
            setTimeout(() => {
              openExpedienteModal(currentExpedienteEstudiante.id);
            }, 500);
          } catch (err) {
            console.error("Error al regenerar QR:", err);
            showToast('Error al intentar regenerar el documento.', 'danger');
          }
        }
      }
    });
  }

  // Botón para vaciar lista de prueba y dejar el sistema limpio
  const btnLimpiarDatosPrueba = document.getElementById('btnLimpiarDatosPrueba');
  if (btnLimpiarDatosPrueba) {
    btnLimpiarDatosPrueba.addEventListener('click', () => {
      if (!estudiantesList || estudiantesList.length === 0) {
        showToast('La lista ya se encuentra completamente vacía.', 'info');
        return;
      }
      if (confirm('¿Deseas vaciar la lista de estudiantes y limpiar todos los registros para iniciar desde cero con las inscripciones reales?')) {
        estudiantesList = [];
        if (window.PosfaceDB && typeof window.PosfaceDB.clearAllEstudiantes === 'function') {
          window.PosfaceDB.clearAllEstudiantes();
        } else {
          localStorage.setItem('posface_estudiantes_data', JSON.stringify([]));
        }
        filtrarEstudiantes();
        renderDashboard();
        showToast('✓ Se han eliminado todos los registros. El sistema está listo para inscripciones reales.', 'success');
      }
    });
  }

  // Elementos de la interfaz
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');
  const breadcrumbTitle = document.getElementById('breadcrumbTitle');
  const breadcrumbSection = document.getElementById('breadcrumbSection');

  // =========================================================================
  // 2. SISTEMA DE NAVEGACIÓN Y VISTAS
  // =========================================================================
  function switchView(viewId) {
    currentView = viewId;

    // Actualizar sidebar
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Actualizar secciones
    viewSections.forEach(section => {
      if (section.id === `view-${viewId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Actualizar migas de pan y títulos de cabecera
    const viewNames = {
      'dashboard': { sec: 'Principal', title: 'Panel de Control General y Admisiones' },
      'estudiantes': { sec: 'Gestión Académica', title: 'Directorio Oficial de Estudiantes POSFACE' },
      'maestrias': { sec: 'Oferta Académica', title: 'Catálogo Oficial de Posgrados POSFACE' },
      'bitacora': { sec: 'Bitácora', title: 'Bitácora de Coordinación' }
    };

    if (viewNames[viewId]) {
      breadcrumbSection.textContent = viewNames[viewId].sec;
      breadcrumbTitle.textContent = viewNames[viewId].title;
    }

    // Acciones específicas al entrar a cada vista
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'estudiantes') renderEstudiantes();
    if (viewId === 'maestrias') renderMaestrias();
    if (viewId === 'bitacora') {
      const currentUser = window.PosfaceAuth ? window.PosfaceAuth.getCurrentUser() : null;
      if (!isCoordinadorGeneralUser(currentUser)) {
        showToast('Acceso restringido: La Bitácora es exclusiva para la Coordinación General', 'danger');
        switchView('dashboard');
        return;
      }
      renderBitacora();
    }


    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-view');
      if (target) switchView(target);
    });
  });

  // =========================================================================
  // 3. RENDERIZADO DEL DASHBOARD Y MÉTRICAS ADMINISTRATIVAS
  // =========================================================================
  function renderDashboard() {
    const totalEst = estudiantesList.length;
    const totalMae = maestriasList.filter(m => m.estado === 'Activo').length;

    // Contar universidades de procedencia distintas
    const uniSet = new Set(
      estudiantesList
        .map(e => (e.universidadProcedencia || '').split('-')[0].trim())
        .filter(Boolean)
    );
    const totalUni = uniSet.size;

    // Cálculo del promedio general de índice de ingreso (pregrado)
    const avgIngreso = totalEst > 0
      ? (estudiantesList.reduce((acc, e) => acc + (Number(e.indicePregrado) || 0), 0) / totalEst).toFixed(1)
      : '85.0';

    const statEst = document.getElementById('statTotalEstudiantes');
    const statMae = document.getElementById('statTotalMaestrias');
    const statUni = document.getElementById('statTotalUniversidades');
    const statProm = document.getElementById('statPromedioIngreso');
    const badgeEst = document.getElementById('navBadgeEstudiantes');

    if (statEst) statEst.textContent = totalEst;
    if (statMae) statMae.textContent = totalMae;
    if (statUni) statUni.textContent = totalUni;
    if (statProm) statProm.textContent = `${avgIngreso}%`;
    if (badgeEst) badgeEst.textContent = totalEst;

    // 2. Distribución de estudiantes por Programa POSFACE
    const containerBars = document.getElementById('dashboardProgramBars');
    if (containerBars) {
      containerBars.innerHTML = '';

      // Agrupar programas por tipo
      const programasPorTipo = maestriasList.reduce((acc, m) => {
        const tipo = m.tipo || 'Otros';
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push(m);
        return acc;
      }, {});

      // Definir el orden de presentación de las categorías
      const ordenTipos = ['Posdoctorado', 'Doctorado', 'Maestría', 'Formación Continua', 'Diplomado', 'Otros'];

      ordenTipos.forEach(tipo => {
        if (programasPorTipo[tipo] && programasPorTipo[tipo].length > 0) {

          // Añadir título de categoría
          const tituloCat = document.createElement('div');
          tituloCat.style.cssText = 'padding: 8px 0 4px 0; font-size: 0.8rem; font-weight: 700; color: var(--unah-gold); text-transform: uppercase; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; margin-top: 5px;';
          tituloCat.textContent = tipo + 'S';
          containerBars.appendChild(tituloCat);

          // Renderizar barras de esa categoría
          programasPorTipo[tipo].forEach(m => {
            const count = estudiantesList.filter(e => e.maestriaId === m.id).length;
            const pct = Math.round((count / (totalEst || 1)) * 100);

            const barItem = document.createElement('div');
            barItem.className = 'program-bar-item';
            barItem.innerHTML = `
              <div class="program-bar-header">
                <span style="color: var(--unah-navy); font-weight: 600;">${m.nombre}</span>
                <span style="color: var(--text-muted); font-size: 0.78rem;">${count} alumnos (${pct}%)</span>
              </div>
              <div class="program-bar-bg">
                <div class="program-bar-fill" style="width: ${Math.max(pct, 8)}%; background: ${m.color || '#002855'};"></div>
              </div>
            `;
            containerBars.appendChild(barItem);
          });
        }
      });
    }

    // 3. Distribución por Universidad de Procedencia (Pregrado)
    const containerUni = document.getElementById('dashboardUniversidadesList');
    if (containerUni) {
      containerUni.innerHTML = '';

      const uniCounts = {};
      estudiantesList.forEach(e => {
        const u = (e.universidadProcedencia || 'UNAH').split('-')[0].trim();
        uniCounts[u] = (uniCounts[u] || 0) + 1;
      });

      const colorsUni = {
        'UNAH': '#002855',
        'UNITEC': '#c2410c',
        'CEUTEC': '#b45309',
        'UTH': '#4338ca',
        'UPNFM': '#047857',
        'UNICAH': '#0e7490',
        'USAP': '#6d28d9',
        'Extranjera': '#0891b2'
      };

      Object.entries(uniCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([uni, count]) => {
          const pct = Math.round((count / (totalEst || 1)) * 100);
          const color = colorsUni[uni] || 'var(--unah-navy)';
          const item = document.createElement('div');
          item.className = 'program-bar-item';
          item.innerHTML = `
            <div class="program-bar-header">
              <span style="color: var(--unah-navy); font-weight: 600;">${uni}</span>
              <span style="color: var(--text-muted); font-size: 0.78rem;">${count} aspirantes (${pct}%)</span>
            </div>
            <div class="program-bar-bg">
              <div class="program-bar-fill" style="width: ${Math.max(pct, 10)}%; background: ${color};"></div>
            </div>
          `;
          containerUni.appendChild(item);
        });
    }
  }

  // =========================================================================
  // 4. RENDERIZADO DEL CATÁLOGO DE POSGRADOS (POSFACE)
  // =========================================================================
  function renderMaestrias(filtroModalidad = 'todas', busqueda = '') {
    const grid = document.getElementById('maestriasGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtradas = maestriasList.filter(m => {
      const matchMod = filtroModalidad === 'todas' || m.modalidad.toLowerCase() === filtroModalidad.toLowerCase();
      const matchBusq = m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.descripcion.toLowerCase().includes(busqueda.toLowerCase());
      return matchMod && matchBusq;
    });

    if (filtradas.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        No se encontraron programas con los filtros seleccionados.
      </div>`;
      return;
    }

    filtradas.forEach(m => {
      // Calcular alumnos dinámicamente según las inscripciones reales
      const numEstudiantes = estudiantesList.filter(e => e.maestriaId === m.id).length;

      const card = document.createElement('div');
      card.className = 'program-card';
      card.innerHTML = `
        <div>
          <div class="program-card-header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="program-code-badge">${m.codigo}</span>
              <span class="badge badge-modalidad">${m.modalidad}</span>
            </div>
            <h3 class="program-title">${m.nombre}</h3>
            <span class="program-degree">${m.grado}</span>
          </div>

          <p class="program-desc">${m.descripcion}</p>

          <div class="program-meta-list">
            <div class="program-meta-item">
              <span class="lbl">Duración:</span>
              <span class="val">${m.duracionMeses} meses</span>
            </div>
            <div class="program-meta-item">
              <span class="lbl">Total Créditos:</span>
              <span class="val">${m.totalUV} UV</span>
            </div>
            <div class="program-meta-item">
              <span class="lbl">Modalidad:</span>
              <span class="val">${m.modalidad}</span>
            </div>
            <div class="program-meta-item">
              <span class="lbl">Alumnos Activos:</span>
              <span class="val" style="color: var(--unah-navy); font-weight: 700;">${numEstudiantes}</span>
            </div>
          </div>

          <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 14px; border-top: 1px dashed var(--border-color); padding-top: 10px;">
            <strong>Unidad Académica:</strong> Dirección de Posgrados POSFACE · UNAH<br>
            <span style="color: var(--color-accent-blue);">posface@unah.edu.hn</span>
          </div>
        </div>
        <div class="program-card-footer">
          <button class="btn btn-primary btn-sm btn-ver-estudiantes-mae" data-id="${m.id}" style="width: 100%;">
            Ver Expedientes de Alumnos
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.btn-ver-estudiantes-mae').forEach(btn => {
      btn.addEventListener('click', () => {
        const maeId = btn.getAttribute('data-id');
        if (filtroEstudianteMaestria) filtroEstudianteMaestria.value = maeId;
        switchView('estudiantes');
        filtrarEstudiantes();
      });
    });
  }

  // Filtros de Maestrías
  const filtroModalidadSelect = document.getElementById('filtroMaestriaModalidad');
  const busquedaMaestriaInput = document.getElementById('busquedaMaestriaInput');

  if (filtroModalidadSelect) {
    filtroModalidadSelect.addEventListener('change', () => {
      renderMaestrias(filtroModalidadSelect.value, busquedaMaestriaInput ? busquedaMaestriaInput.value : '');
    });
  }
  if (busquedaMaestriaInput) {
    busquedaMaestriaInput.addEventListener('input', () => {
      renderMaestrias(filtroModalidadSelect ? filtroModalidadSelect.value : 'todas', busquedaMaestriaInput.value);
    });
  }

  // =========================================================================
  // 5. DIRECTORIO Y CONTROL ESCOLAR DE ESTUDIANTES
  // =========================================================================
  function renderEstudiantes(lista = estudiantesList) {
    const tbody = document.getElementById('tablaEstudiantesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const contador = document.getElementById('contadorEstudiantes');
    if (contador) contador.textContent = `${lista.length} estudiantes registrados`;

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
        No se encontraron estudiantes registrados con los criterios seleccionados.
      </td></tr>`;
      return;
    }

    lista.forEach(est => {
      const maestria = maestriasList.find(m => m.id === est.maestriaId) || { nombre: 'Posgrado', modalidad: 'Oficial' };
      const initials = (est.nombres.charAt(0) || '') + (est.apellidos.charAt(0) || '');
      const badgeClass = getBadgeClassForEstado(est.estado);

      // Identificar categoría de universidad para styling
      const uniName = est.universidadProcedencia || 'UNAH';
      let uniBadgeClass = 'badge-universidad';
      if (uniName.includes('UNAH')) {
        uniBadgeClass += ' badge-unah';
      } else if (uniName.includes('Extranjera') || uniName.includes('Internacional')) {
        uniBadgeClass += ' badge-extranjera';
      } else {
        uniBadgeClass += ' badge-privada';
      }

      // Badge de cumplimiento de índice de pregrado (UNAH posgrado >= 70%)
      const indVal = Number(est.indicePregrado) || 0;
      const indBadge = indVal >= 70
        ? `<span class="badge-indice badge-indice-ok" title="Cumple índice normativo de posgrado (&ge; 70%)">✓ ${indVal.toFixed(1)}%</span>`
        : `<span class="badge-indice badge-indice-danger" title="No cumple índice normativo mínimo (&lt; 70%)">✕ ${indVal.toFixed(1)}%</span>`;

      const cuentaDisplay = est.cuentaUNAH && est.cuentaUNAH !== 'Pendiente'
        ? `<span class="cuenta-unah-tag" title="Copiar No. de Cuenta UNAH" style="cursor: pointer;">${est.cuentaUNAH}</span>`
        : `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.72rem; border: 1px dashed #cbd5e1; font-weight: 500;" title="Aspirante sin número de cuenta UNAH previo (procedencia externa)">Pendiente</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          ${cuentaDisplay}
        </td>
        <td>
          <div class="student-cell">
            <div class="student-avatar">${initials}</div>
            <div>
              <div class="student-name">${est.nombres} ${est.apellidos}</div>
              <div class="student-email">
                ${est.correoInstitucional}
                ${(est.ciudad || est.departamento) ? `<span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 4px;" title="Procedencia: ${est.ciudad ? est.ciudad + ', ' : ''}${est.departamento || ''}">📍 ${est.ciudad || est.departamento}</span>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${est.dni}</td>
        <td>
          <span class="${uniBadgeClass}" title="${uniName}">
            ${uniName.split('-')[0].trim()}
          </span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            ${est.carreraPregrado ? est.carreraPregrado.slice(0, 24) + '...' : 'Pregrado'}
          </div>
        </td>
        <td>
          ${indBadge}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--unah-navy); font-size: 0.82rem;">${maestria.nombre}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 3px;">
            <span class="badge" style="background: ${(est.modalidad || maestria.modalidad) === 'Virtual' ? '#f0fdf4' : '#eff6ff'}; color: ${(est.modalidad || maestria.modalidad) === 'Virtual' ? '#15803d' : '#1d4ed8'}; border: 1px solid ${(est.modalidad || maestria.modalidad) === 'Virtual' ? '#bbf7d0' : '#bfdbfe'}; font-size: 0.7rem; padding: 1px 6px; font-weight: 600;">
              ${(est.modalidad || maestria.modalidad) === 'Virtual' ? '💻 Virtual' : '🏫 Presencial'}
            </span>
          </div>
        </td>
        <td>
          <select class="badge-status-select badge ${badgeClass} select-estado-estudiante-row" data-id="${est.id}" title="Cambiar estado del estudiante">
            <option value="Activo" ${est.estado === 'Activo' ? 'selected' : ''}>Activo</option>
            <option value="En Tesis" ${est.estado === 'En Tesis' ? 'selected' : ''}>En Tesis</option>
            <option value="Egresado" ${est.estado === 'Egresado' ? 'selected' : ''}>Egresado</option>
            <option value="Graduado" ${est.estado === 'Graduado' ? 'selected' : ''}>Graduado</option>
            <option value="Inactivo" ${est.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
          </select>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
            <button class="btn btn-outline btn-sm btn-ver-expediente" data-id="${est.id}" title="Ver expediente académico y antecedentes">
              Ver Expediente
            </button>
            <button class="btn btn-danger-outline btn-sm btn-eliminar-estudiante" data-id="${est.id}" data-nombre="${est.nombres} ${est.apellidos}" title="Eliminar registro de previa inscripción">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Eliminar</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Eventos para cambiar estado directamente desde la fila
    tbody.querySelectorAll('.select-estado-estudiante-row').forEach(sel => {
      sel.addEventListener('change', () => {
        const estId = sel.getAttribute('data-id');
        const nuevo = sel.value;
        cambiarEstadoEstudiante(estId, nuevo);
      });
    });

    // Eventos para ver expediente
    tbody.querySelectorAll('.btn-ver-expediente').forEach(btn => {
      btn.addEventListener('click', () => {
        const estId = btn.getAttribute('data-id');
        openExpedienteModal(estId);
      });
    });

    // Eventos para eliminar estudiante desde la fila
    tbody.querySelectorAll('.btn-eliminar-estudiante').forEach(btn => {
      bt.addEventListener('click', () => {
        const estId = btn.getAttribute('data-id');
        const estNombre = btn.getAttribute('data-nombre');
        solicitarEliminarEstudiante(estId, estNombre);
      });
    });

    // Copiar cuenta al portapapeles
    tbody.querySelectorAll('.cuenta-unah-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        navigator.clipboard.writeText(tag.textContent.trim());
        showToast(`Cuenta ${tag.textContent.trim()} copiada al portapapeles`, 'success');
      });
    });
  }

  // Filtrado reactivo de estudiantes (con soporte para Universidad de Procedencia)
  const inputBusquedaEstudiante = document.getElementById('inputBusquedaEstudiante');
  const filtroEstudianteMaestria = document.getElementById('filtroEstudianteMaestria');
  const filtroEstudianteUniversidad = document.getElementById('filtroEstudianteUniversidad');
  const filtroEstudianteEstado = document.getElementById('filtroEstudianteEstado');

  function filtrarEstudiantes() {
    const q = (inputBusquedaEstudiante?.value || '').toLowerCase().trim();
    const mae = filtroEstudianteMaestria?.value || 'todas';
    const uni = filtroEstudianteUniversidad?.value || 'todas';
    const est = filtroEstudianteEstado?.value || 'todos';

    const filtrados = estudiantesList.filter(item => {
      const matchTexto =
        (item.cuentaUNAH ? item.cuentaUNAH.toLowerCase().includes(q) : false) ||
        item.dni.toLowerCase().includes(q) ||
        item.nombres.toLowerCase().includes(q) ||
        item.apellidos.toLowerCase().includes(q) ||
        item.correoInstitucional.toLowerCase().includes(q) ||
        (item.universidadProcedencia && item.universidadProcedencia.toLowerCase().includes(q)) ||
        (item.departamento && item.departamento.toLowerCase().includes(q)) ||
        (item.ciudad && item.ciudad.toLowerCase().includes(q));

      const matchMae = mae === 'todas' || item.maestriaId === mae;
      const matchEst = est === 'todos' || item.estado === est;
      const matchUni = uni === 'todas' ||
        (item.universidadProcedencia && item.universidadProcedencia.toLowerCase().includes(uni.toLowerCase()));

      return matchTexto && matchMae && matchEst && matchUni;
    });

    renderEstudiantes(filtrados);
  }

  if (inputBusquedaEstudiante) inputBusquedaEstudiante.addEventListener('input', filtrarEstudiantes);
  if (filtroEstudianteMaestria) filtroEstudianteMaestria.addEventListener('change', filtrarEstudiantes);
  if (filtroEstudianteUniversidad) filtroEstudianteUniversidad.addEventListener('change', filtrarEstudiantes);
  if (filtroEstudianteEstado) filtroEstudianteEstado.addEventListener('change', filtrarEstudiantes);

  // Llenar select de maestrías en filtro de estudiantes con optgroups
  function populateFiltroMaestriasSelect() {
    if (!filtroEstudianteMaestria) return;
    filtroEstudianteMaestria.innerHTML = '<option value="todas">Todos los Programas POSFACE</option>';

    const grupos = [
      { label: 'Posdoctorado', tipos: ['Posdoctorado'] },
      { label: 'Doctorados', tipos: ['Doctorado'] },
      { label: 'Maestrías', tipos: ['Maestría'] },
      { label: 'Formación Continua', tipos: ['Centro Empresarial', 'Diplomado'] }
    ];

    grupos.forEach(grupo => {
      const programasGrupo = maestriasList.filter(m => grupo.tipos.includes(m.tipo));
      if (programasGrupo.length === 0) return;
      const optgroup = document.createElement('optgroup');
      optgroup.label = grupo.label;
      programasGrupo.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.codigo} - ${m.nombre}`;
        optgroup.appendChild(opt);
      });
      filtroEstudianteMaestria.appendChild(optgroup);
    });
  }
  populateFiltroMaestriasSelect();

  // =========================================================================
  // 6. EXPEDIENTE ACADÉMICO Y CONSTANCIA OFICIAL IMPRIMIBLE
  // =========================================================================
  const modalExpediente = document.getElementById('modalExpediente');
  let currentExpedienteEstudiante = null;

  async function openExpedienteModal(estudianteId) {
    const est = estudiantesList.find(e => e.id === estudianteId);
    if (!est) return;

    currentExpedienteEstudiante = est;

    const mae = maestriasList.find(m => m.id === est.maestriaId) || { nombre: 'Programa de Posgrado POSFACE', codigo: 'POS', totalUV: 52 };
    const coh = (window.POSFASSE_DATA && Array.isArray(window.POSFASSE_DATA.cohortes))
      ? window.POSFASSE_DATA.cohortes.find(c => c.id === est.cohorteId)
      : null;

    // 1. Encabezado y Metadatos de Folio Oficial
    const expFolioNumero = document.getElementById('expFolioNumero');
    if (expFolioNumero) {
      const num = (est.cuentaUNAH ? est.cuentaUNAH.slice(-4) : (est.dni ? est.dni.slice(-4) : '0042'));
      expFolioNumero.textContent = `EXP-2026-${num}`;
    }

    const expFechaEmision = document.getElementById('expFechaEmision');
    if (expFechaEmision) {
      const ahora = new Date();
      expFechaEmision.textContent = ahora.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const expCodigoVerif = document.getElementById('expCodigoVerif');
    if (expCodigoVerif) {
      const hashSource = (est.dni || est.id || 'POSFACE').replace(/[^a-zA-Z0-9]/g, '');
      expCodigoVerif.textContent = `UNAH-PF-${hashSource.slice(-4).toUpperCase() || '8921'}`;
    }

    // 2. Datos de Identificación Personal
    const expNombre = document.getElementById('expNombre');
    if (expNombre) expNombre.textContent = `${est.nombres} ${est.apellidos}`;

    const expCuenta = document.getElementById('expCuenta');
    if (expCuenta) expCuenta.textContent = est.cuentaUNAH || 'Pendiente (Graduado Externo)';

    const expDni = document.getElementById('expDni');
    if (expDni) expDni.textContent = est.dni || 'No registrado';

    const expCorreo = document.getElementById('expCorreo');
    if (expCorreo) expCorreo.textContent = est.correoInstitucional || 'estudiante@unah.edu.hn';

    const expTelefono = document.getElementById('expTelefono');
    if (expTelefono) expTelefono.textContent = est.telefono || '+504 0000-0000';

    const expProcedencia = document.getElementById('expProcedencia');
    if (expProcedencia) {
      const depto = est.departamento || '';
      const ciudad = est.ciudad || '';
      expProcedencia.textContent = (ciudad && depto) ? `${ciudad}, ${depto}` : (ciudad || depto || 'Honduras');
    }

    // 3. Antecedentes Académicos (Pregrado)
    const expUni = document.getElementById('expUniversidad');
    if (expUni) expUni.textContent = est.universidadProcedencia || 'UNAH - Universidad Nacional Autónoma de Honduras';

    const expCarrera = document.getElementById('expCarreraPrevia');
    if (expCarrera) expCarrera.textContent = est.carreraPregrado || 'Licenciatura / Grado Universitario';

    const expIndiceVal = document.getElementById('expIndicePregradoVal');
    const expIndiceBadge = document.getElementById('expIndiceCumpleBadge');
    const ind = Number(est.indicePregrado) || 0;
    if (expIndiceVal) expIndiceVal.textContent = `${ind.toFixed(1)}%`;
    if (expIndiceBadge) {
      if (ind >= 70) {
        expIndiceBadge.innerHTML = '<span style="color: #15803d; font-weight: 700;">✓ Requisito Normativo Cumplido (&ge; 70.00%)</span>';
      } else {
        expIndiceBadge.innerHTML = '<span style="color: #dc2626; font-weight: 700;">✕ No Cumple Requisito Normativo (&lt; 70.00%)</span>';
      }
    }

    // 3. Validación Institucional de Título (UNAH)
    const expTituloValidadoVal = document.getElementById('expTituloValidadoVal');
    if (expTituloValidadoVal) {
      const isUnah = (est.universidadProcedencia || '').toLowerCase().includes('unah -') || (est.universidadProcedencia || '').toLowerCase() === 'unah';
      const val = est.tituloValidadoUNAH || (isUnah ? 'Exento' : 'Si');
      if (isUnah || val === 'Exento') {
        expTituloValidadoVal.innerHTML = '<span style="color: #15803d; font-weight: 700;">✓ Título Emitido Directamente por la UNAH (Exento de Trámite de Incorporación)</span>';
      } else if (val === 'Si' || val === 'Validado') {
        expTituloValidadoVal.innerHTML = '<span style="color: #15803d; font-weight: 700;">✓ Título Validado e Incorporado por la UNAH (Dirección de Educación Superior)</span>';
      } else if (val === 'En Tramite') {
        expTituloValidadoVal.innerHTML = '<span style="color: #b45309; font-weight: 700;">⏳ En Trámite de Incorporación ante la UNAH / Dirección de Educación Superior</span>';
      } else {
        expTituloValidadoVal.innerHTML = '<span style="color: #dc2626; font-weight: 700;">⚠️ Título Pendiente de Incorporación / Validación ante la UNAH</span>';
      }
    }

    // 4. Programa y Situación de Posgrado
    const expMaestria = document.getElementById('expMaestria');
    if (expMaestria) expMaestria.textContent = mae.nombre;

    const expModalidad = document.getElementById('expModalidad');
    if (expModalidad) expModalidad.textContent = est.modalidad || mae.modalidad || 'Presencial';

    const expFechaIngreso = document.getElementById('expFechaIngreso');
    if (expFechaIngreso) expFechaIngreso.textContent = est.fechaIngreso || '--/--/----';

    // Selector de estado en pantalla vs texto de impresión
    const selectModal = document.getElementById('selectEstadoExpediente');
    if (selectModal) {
      selectModal.setAttribute('data-id', est.id);
      selectModal.value = est.estado;
      selectModal.className = `badge-status-select badge ${getBadgeClassForEstado(est.estado)}`;
    }

    const expEstadoPrint = document.getElementById('expEstadoPrint');
    if (expEstadoPrint) expEstadoPrint.textContent = (est.estado || 'Activo').toUpperCase();

    // 5. Firma y Conformidad del Estudiante
    const expFirmaEstudianteNombre = document.getElementById('expFirmaEstudianteNombre');
    if (expFirmaEstudianteNombre) {
      expFirmaEstudianteNombre.textContent = `${est.nombres} ${est.apellidos}`;
    }

    // 6. Generación Dinámica de Código QR
    const qrPlaceholder = document.querySelector('.qr-placeholder');
    if (qrPlaceholder) {
      qrPlaceholder.innerHTML = ''; // Limpiar QR anterior

      // Mostrar estado de carga temporal
      qrPlaceholder.innerHTML = '<span class="qr-lbl" style="font-size: 0.7rem; color: #64748b;">Generando Seguridad...</span>';

      // Obtener o crear token de documento
      let token = est.qr_token;
      let qrStatus = 'VALIDO';

      if (!token) {
        try {
          token = await window.PosfaceDB.generateDocumentToken(est.id, 'EXPEDIENTE', `${est.nombres} ${est.apellidos}`, mae.nombre);

          // Actualizar estudiante en Firestore con el nuevo token para no regenerarlo
          if (window.PosfaceDB.isCloudActive()) {
            await firebase.firestore().collection('estudiantes').doc(est.id).update({ qr_token: token });
            est.qr_token = token; // Update local memory
          }
        } catch (err) {
          console.warn("No se pudo generar QR en nube:", err);
          token = 'error-conexion';
        }
      } else {
        // Fetch real status
        try {
          qrStatus = await window.PosfaceDB.getDocumentTokenStatus(token);
        } catch (e) {
          console.warn("No se pudo obtener estado del QR:", e);
        }
      }

      // Configure Action Buttons
      const btnAnular = document.getElementById('btnAnularDocumentoQR');
      const btnReactivar = document.getElementById('btnReactivarDocumentoQR');
      if (btnAnular && btnReactivar) {
        if (qrStatus === 'ANULADO') {
          btnAnular.style.display = 'none';
          btnReactivar.style.display = 'flex';
        } else {
          btnAnular.style.display = 'flex';
          btnReactivar.style.display = 'none';
        }
      }

      // Dibujar código QR
      qrPlaceholder.innerHTML = ''; // Limpiar "Generando..."
      try {
        const verifyUrl = `${window.location.origin}/verificar.html?token=${token}`;
        new QRCode(qrPlaceholder, {
          text: verifyUrl,
          width: 85,
          height: 85,
          colorDark: "#002D62",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L
        });
      } catch (e) {
        console.error("Error al renderizar QR:", e);
        qrPlaceholder.innerHTML = '<span class="qr-lbl" style="color:red; font-size:10px;">Error QR</span>';
      }
    }

    openModal(modalExpediente);
  }

  // =========================================================================
  // 7. INSCRIPCIÓN Y ADMISIÓN DE NUEVOS ASPIRANTES (NORMATIVA >= 70%)
  // =========================================================================
  const modalNuevoEstudiante = document.getElementById('modalNuevoEstudiante');
  const formNuevoEstudiante = document.getElementById('formNuevoEstudiante');
  const selectNuevoEstMaestria = document.getElementById('nuevoEstMaestria');

  // Llenar select de nuevo estudiante con optgroups (igual que portal externo)
  function populateNuevoEstudianteSelects() {
    if (!selectNuevoEstMaestria) return;
    selectNuevoEstMaestria.innerHTML = '<option value="">Seleccione el programa de posgrado al que aspira...</option>';

    // Definir grupos en orden: Posdoctorado → Doctorados → Maestrías → Formación Continua
    const grupos = [
      { label: 'Posdoctorado (1)', tipos: ['Posdoctorado'] },
      { label: 'Doctorados (2)', tipos: ['Doctorado'] },
      { label: 'Maestrías (7)', tipos: ['Maestría'] },
      { label: 'Formación Continua y Educación Empresarial (2)', tipos: ['Centro Empresarial', 'Diplomado'] }
    ];

    grupos.forEach(grupo => {
      const programasGrupo = maestriasList.filter(m => grupo.tipos.includes(m.tipo));
      if (programasGrupo.length === 0) return;
      const optgroup = document.createElement('optgroup');
      optgroup.label = grupo.label;
      programasGrupo.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.codigo} - ${m.nombre}`;
        optgroup.appendChild(opt);
      });
      selectNuevoEstMaestria.appendChild(optgroup);
    });
  }
  populateNuevoEstudianteSelects();

  if (selectNuevoEstMaestria) {
    selectNuevoEstMaestria.addEventListener('change', () => {
      const selectedMae = maestriasList.find(m => m.id === selectNuevoEstMaestria.value);
      const selMod = document.getElementById('nuevoEstModalidad');
      if (selectedMae && selMod) {
        if (selectedMae.modalidad && selectedMae.modalidad.toLowerCase().includes('virtual')) {
          selMod.value = 'Virtual';
        } else {
          selMod.value = 'Presencial';
        }
      }
    });
  }

  const selectNuevoEstUniversidad = document.getElementById('nuevoEstUniversidad');
  const boxNuevoEstTituloValidado = document.getElementById('boxNuevoEstTituloValidado');
  const selectNuevoEstTituloValidado = document.getElementById('nuevoEstTituloValidadoUNAH');

  if (selectNuevoEstUniversidad) {
    selectNuevoEstUniversidad.addEventListener('change', () => {
      const val = selectNuevoEstUniversidad.value.trim();
      const isUnah = val.toLowerCase().includes('unah -') || val.toLowerCase() === 'unah';
      if (boxNuevoEstTituloValidado) {
        if (!val || isUnah) {
          boxNuevoEstTituloValidado.style.display = 'none';
          if (selectNuevoEstTituloValidado) selectNuevoEstTituloValidado.value = 'Exento';
        } else {
          boxNuevoEstTituloValidado.style.display = 'block';
          if (selectNuevoEstTituloValidado && selectNuevoEstTituloValidado.value === 'Exento') {
            selectNuevoEstTituloValidado.value = 'Si';
          }
        }
      }
    });
  }

  const inputNuevoEstIndice = document.getElementById('nuevoEstIndicePregrado');
  const feedbackNuevoEstIndice = document.getElementById('nuevoEstIndiceFeedback');
  if (inputNuevoEstIndice) {
    inputNuevoEstIndice.addEventListener('input', () => {
      const val = parseFloat(inputNuevoEstIndice.value);
      if (!feedbackNuevoEstIndice) return;
      if (isNaN(val)) {
        feedbackNuevoEstIndice.style.display = 'none';
        inputNuevoEstIndice.style.borderColor = '';
        return;
      }
      feedbackNuevoEstIndice.style.display = 'block';
      if (val >= 70 && val <= 100) {
        feedbackNuevoEstIndice.style.color = '#15803d';
        feedbackNuevoEstIndice.innerHTML = `✓ Cumple requisito de índice mínimo de posgrados (&ge; 70.00%)`;
        inputNuevoEstIndice.style.borderColor = '#15803d';
      } else if (val < 70) {
        feedbackNuevoEstIndice.style.color = '#dc2626';
        feedbackNuevoEstIndice.innerHTML = `✕ No cumple requisito: El índice mínimo para inscribir es de 70.00%.`;
        inputNuevoEstIndice.style.borderColor = '#dc2626';
      } else {
        feedbackNuevoEstIndice.style.color = '#dc2626';
        feedbackNuevoEstIndice.innerHTML = `✕ El índice no puede ser superior a 100.00%.`;
        inputNuevoEstIndice.style.borderColor = '#dc2626';
      }
    });
  }

  if (formNuevoEstudiante) {
    formNuevoEstudiante.addEventListener('submit', (e) => {
      e.preventDefault();

      const cuenta = (document.getElementById('nuevoEstCuenta')?.value || '').trim();
      const dni = document.getElementById('nuevoEstDni').value.trim();
      const nombres = document.getElementById('nuevoEstNombres').value.trim();
      const apellidos = document.getElementById('nuevoEstApellidos').value.trim();
      const correo = document.getElementById('nuevoEstCorreo').value.trim();
      const telefono = document.getElementById('nuevoEstTelefono').value.trim();
      const departamento = (document.getElementById('nuevoEstDepartamento')?.value || '').trim();
      const ciudad = (document.getElementById('nuevoEstCiudad')?.value || '').trim();
      const universidad = document.getElementById('nuevoEstUniversidad').value.trim();
      const indiceRaw = document.getElementById('nuevoEstIndicePregrado').value.trim();
      const carreraPrevia = (document.getElementById('nuevoEstCarreraPrevia')?.value || '').trim();
      const modalidad = document.getElementById('nuevoEstModalidad')?.value || 'Presencial';
      const maestriaId = selectNuevoEstMaestria.value;
      const indice = parseFloat(indiceRaw);

      const isUnah = universidad.toLowerCase().includes('unah -') || universidad.toLowerCase() === 'unah';
      const tituloValidado = isUnah ? 'Exento' : (selectNuevoEstTituloValidado?.value || 'Si');

      if (!dni || !nombres || !apellidos || !maestriaId || !universidad || !departamento || isNaN(indice)) {
        showToast('Por favor completa todos los campos requeridos (incluyendo Departamento, Universidad e Índice de Pregrado)', 'warning');
        return;
      }

      if (indice < 0 || indice > 100) {
        showToast('El índice académico debe estar en un rango válido entre 0% y 100%', 'danger');
        return;
      }

      if (indice < 70) {
        showToast('No puede inscribirse: El aspirante debe cumplir con un índice académico de al menos 70.00% mínimo.', 'danger');
        return;
      }

      // Validar si ya existe cuenta UNAH (solo si fue proporcionada)
      if (cuenta && estudiantesList.some(est => est.cuentaUNAH && est.cuentaUNAH.toLowerCase() === cuenta.toLowerCase())) {
        showToast('El Número de Cuenta UNAH ya se encuentra registrado en el sistema', 'danger');
        return;
      }

      const selectedMae = maestriasList.find(m => m.id === maestriaId);

      const nuevoEst = {
        id: `EST-${String(estudiantesList.length + 1).padStart(2, '0')}`,
        cuentaUNAH: cuenta || 'Pendiente',
        dni: dni,
        nombres: nombres,
        apellidos: apellidos,
        correoInstitucional: correo || `${nombres.toLowerCase().replace(/\s+/g, '.')}.${apellidos.toLowerCase().replace(/\s+/g, '.')}@unah.hn`,
        telefono: telefono || '+504 9000-0000',
        departamento: departamento,
        ciudad: ciudad,
        universidadProcedencia: universidad,
        tituloValidadoUNAH: tituloValidado,
        indicePregrado: indice,
        carreraPregrado: carreraPrevia || 'Licenciatura Universitaria',
        maestriaId: maestriaId,
        modalidad: modalidad || 'Presencial',
        estado: 'Activo',
        fechaIngreso: new Date().toLocaleDateString('es-HN')
      };

      estudiantesList.unshift(nuevoEst);
      if (window.PosfaceDB) {
        window.PosfaceDB.addEstudiante(nuevoEst);
      } else {
        try {
          localStorage.setItem('posface_estudiantes_data', JSON.stringify(estudiantesList));
        } catch (e) {
          console.warn('Error guardando en localStorage', e);
        }
      }
      filtrarEstudiantes();
      renderDashboard();
      closeModal(modalNuevoEstudiante);
      formNuevoEstudiante.reset();
      if (boxNuevoEstTituloValidado) boxNuevoEstTituloValidado.style.display = 'none';
      if (feedbackNuevoEstIndice) {
        feedbackNuevoEstIndice.style.display = 'none';
        if (inputNuevoEstIndice) inputNuevoEstIndice.style.borderColor = '';
      }

      showToast(`✓ Estudiante ${nombres} ${apellidos} inscrito con éxito`, 'success');

      // Abrir inmediatamente la Ficha Oficial de Inscripción (Expediente) del nuevo estudiante
      setTimeout(() => {
        openExpedienteModal(nuevoEst.id);
        showToast('📄 Se ha generado la Ficha Oficial de Inscripción. Lista para revisión e impresión.', 'info');
      }, 250);
    });
  }

  // =========================================================================
  // 8. EXPORTACIÓN DE REPORTES ADMINISTRATIVOS (CSV / EXCEL)
  // =========================================================================
  const btnExportarCSV = document.getElementById('btnExportarEstudiantesCSV');
  if (btnExportarCSV) {
    btnExportarCSV.addEventListener('click', () => {
      exportarEstudiantesCSV();
    });
  }

  function exportarEstudiantesCSV() {
    if (!estudiantesList || estudiantesList.length === 0) {
      showToast('No hay datos de estudiantes para exportar', 'warning');
      return;
    }

    const headers = [
      "No. Cuenta UNAH",
      "Nombres",
      "Apellidos",
      "DNI / Identidad",
      "Correo Institucional",
      "Teléfono",
      "Departamento",
      "Ciudad",
      "Universidad de Procedencia",
      "Título Validado UNAH",
      "Índice Pregrado (%)",
      "Carrera Previa",
      "Programa POSFACE",
      "Modalidad",
      "Estado"
    ];

    const rows = estudiantesList.map(est => {
      const mae = maestriasList.find(m => m.id === est.maestriaId) || { nombre: '' };
      return [
        `"${est.cuentaUNAH}"`,
        `"${est.nombres}"`,
        `"${est.apellidos}"`,
        `"${est.dni}"`,
        `"${est.correoInstitucional}"`,
        `"${est.telefono || ''}"`,
        `"${est.departamento || ''}"`,
        `"${est.ciudad || ''}"`,
        `"${est.universidadProcedencia || ''}"`,
        `"${est.tituloValidadoUNAH || 'Exento'}"`,
        est.indicePregrado || 0,
        `"${est.carreraPregrado || ''}"`,
        `"${mae.nombre}"`,
        `"${est.modalidad || mae.modalidad || 'Presencial'}"`,
        `"${est.estado}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inscripcion_posface_unah_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Reporte oficial CSV descargado correctamente', 'success');
  }



  // =========================================================================
  // 9. UTILIDADES DE VENTANAS MODALES Y NOTIFICACIONES TOAST
  // =========================================================================
  function openModal(modalEl) {
    if (modalEl) modalEl.classList.add('show');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.remove('show');
  }

  // Botones de cierre de modal
  document.querySelectorAll('.btn-close-modal, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) closeModal(modal);
    });
  });

  // Cerrar al hacer clic en backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach(m => closeModal(m));
    }
  });

  // Botones para abrir nuevo estudiante
  document.querySelectorAll('.btn-abrir-nuevo-estudiante').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal(modalNuevoEstudiante);
    });
  });

  // Botón imprimir ficha / expediente oficial
  const btnImprimirExpediente = document.getElementById('btnImprimirExpediente');
  if (btnImprimirExpediente) {
    btnImprimirExpediente.addEventListener('click', () => {
      const est = currentExpedienteEstudiante;
      const originalTitle = document.title;
      if (est) {
        const cleanApellidos = (est.apellidos || 'Estudiante').replace(/[^a-zA-Z0-9]/g, '_');
        const numId = est.cuentaUNAH || est.dni || 'Expediente';
        document.title = `Expediente_Academico_POSFACE_${numId}_${cleanApellidos}`;
      }

      showToast('Generando formato oficial de impresión del expediente...', 'info');

      document.body.classList.add('printing-expediente');

      const cleanupPrint = () => {
        document.body.classList.remove('printing-expediente');
        document.title = originalTitle;
        window.removeEventListener('afterprint', cleanupPrint);
      };
      window.addEventListener('afterprint', cleanupPrint);

      setTimeout(() => {
        window.print();
        setTimeout(cleanupPrint, 1500);
      }, 300);
    });
  }

  // Función de Toast Notificaciones
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; color: var(--unah-navy);">POSFACE UNAH:</span>
        <span>${message}</span>
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // =========================================================================
  // 10. GESTIÓN DEL PERÍODO ACADÉMICO ACTIVO
  // =========================================================================
  const selectPeriodoActual = document.getElementById('selectPeriodoActual');
  const btnEditarPeriodoCustom = document.getElementById('btnEditarPeriodoCustom');
  const printPeriodoActual = document.getElementById('printPeriodoActual');

  // Recuperar período guardado
  const periodoGuardado = localStorage.getItem('posface_periodo_activo');
  if (periodoGuardado && selectPeriodoActual) {
    let exists = false;
    for (let opt of selectPeriodoActual.options) {
      if (opt.value.toLowerCase() === periodoGuardado.toLowerCase()) {
        selectPeriodoActual.value = opt.value;
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = periodoGuardado;
      opt.textContent = periodoGuardado;
      selectPeriodoActual.appendChild(opt);
      selectPeriodoActual.value = periodoGuardado;
    }
    data.institucion.periodoActual = periodoGuardado;
    if (printPeriodoActual) printPeriodoActual.textContent = periodoGuardado;
  }

  if (selectPeriodoActual) {
    selectPeriodoActual.addEventListener('change', () => {
      const nuevo = selectPeriodoActual.value;
      data.institucion.periodoActual = nuevo;
      if (window.PosfaceDB) {
        window.PosfaceDB.savePeriodoActivo(nuevo);
      } else {
        localStorage.setItem('posface_periodo_activo', nuevo);
      }
      if (printPeriodoActual) printPeriodoActual.textContent = nuevo;
      showToast(`Período académico cambiado a: ${nuevo}`, 'gold');
    });
  }

  if (btnEditarPeriodoCustom) {
    btnEditarPeriodoCustom.addEventListener('click', () => {
      const actual = selectPeriodoActual ? selectPeriodoActual.value : 'II Período Académico 2026';
      const custom = prompt('Ingresa el nombre del período académico deseado (ej. III PAC 2026, I PAC 2027):', actual);
      if (custom && custom.trim()) {
        const val = custom.trim();
        let exists = false;
        if (selectPeriodoActual) {
          for (let opt of selectPeriodoActual.options) {
            if (opt.value.toLowerCase() === val.toLowerCase()) {
              selectPeriodoActual.value = opt.value;
              exists = true;
              break;
            }
          }
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            selectPeriodoActual.appendChild(opt);
            selectPeriodoActual.value = val;
          }
          selectPeriodoActual.dispatchEvent(new Event('change'));
        }
      }
    });
  }

  // Listener para cambiar estado desde el modal de expediente
  const selectModalEstado = document.getElementById('selectEstadoExpediente');
  if (selectModalEstado) {
    selectModalEstado.addEventListener('change', () => {
      const estId = selectModalEstado.getAttribute('data-id');
      const nuevo = selectModalEstado.value;
      if (estId) {
        cambiarEstadoEstudiante(estId, nuevo);
      }
    });
  }

  // =========================================================================
  // 11. GESTIÓN DE AUTENTICACIÓN: LOGIN Y REGISTRO INSTITUCIONAL
  // =========================================================================
  const formLoginPosface = document.getElementById('formLoginPosface');
  const formRegisterPosface = document.getElementById('formRegisterPosface');
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const btnSwitchToRegister = document.getElementById('btnSwitchToRegister');
  const btnSwitchToLogin = document.getElementById('btnSwitchToLogin');
  const btnQuickLogin = document.getElementById('btnQuickLogin');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const loginPassword = document.getElementById('loginPassword');
  const btnSidebarLogout = document.getElementById('btnSidebarLogout');
  const fbStatusText = document.getElementById('fbStatusText');
  const loginCloudStatus = document.getElementById('loginCloudStatus');
  const btnSoporteTecnico = document.getElementById('btnSoporteTecnico');
  const modalSoporteTecnico = document.getElementById('modalSoporteTecnico');

  const loginAlertBox = document.getElementById('loginAlertBox');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginEmailBox = document.getElementById('loginEmailBox');
  const loginEmailError = document.getElementById('loginEmailError');
  const loginPasswordBox = document.getElementById('loginPasswordBox');
  const loginPasswordError = document.getElementById('loginPasswordError');

  // Soporte Técnico modal
  if (btnSoporteTecnico && modalSoporteTecnico) {
    btnSoporteTecnico.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalSoporteTecnico);
    });
  }

  // Limpiar estados de error visuales en login
  function clearLoginErrors() {
    if (loginAlertBox) {
      loginAlertBox.style.display = 'none';
      loginAlertBox.innerHTML = '';
      loginAlertBox.className = 'login-alert-banner';
      delete loginAlertBox.dataset.field;
    }
    if (loginEmailBox) loginEmailBox.classList.remove('has-error');
    if (loginPasswordBox) loginPasswordBox.classList.remove('has-error');
    if (loginEmailError) {
      loginEmailError.style.display = 'none';
      loginEmailError.textContent = '';
    }
    if (loginPasswordError) {
      loginPasswordError.style.display = 'none';
      loginPasswordError.textContent = '';
    }
  }

  // Mostrar mensaje de alerta visual interactivo en el login
  function showLoginAlert(type, title, message, actionText, onActionClick) {
    if (!loginAlertBox) return;
    loginAlertBox.className = `login-alert-banner alert-${type || 'danger'}`;
    loginAlertBox.innerHTML = `
      <div class="login-alert-banner-header">
        <span>${type === 'warning' ? '⚠️' : '❌'}</span>
        <span>${title}</span>
      </div>
      <div class="login-alert-banner-body">${message}</div>
      ${actionText ? `<button type="button" class="login-alert-banner-btn" id="btnAlertAction">${actionText}</button>` : ''}
    `;
    loginAlertBox.style.display = 'flex';

    if (actionText && onActionClick) {
      const btn = document.getElementById('btnAlertAction');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          onActionClick();
        });
      }
    }
  }

  // Quitar errores en tiempo real cuando el usuario escribe
  if (loginEmailInput) {
    loginEmailInput.addEventListener('input', () => {
      if (loginEmailBox) loginEmailBox.classList.remove('has-error');
      if (loginEmailError) {
        loginEmailError.style.display = 'none';
        loginEmailError.textContent = '';
      }
      if (loginAlertBox && loginAlertBox.dataset.field === 'email') {
        loginAlertBox.style.display = 'none';
      }
    });
  }

  if (loginPassword) {
    loginPassword.addEventListener('input', () => {
      if (loginPasswordBox) loginPasswordBox.classList.remove('has-error');
      if (loginPasswordError) {
        loginPasswordError.style.display = 'none';
        loginPasswordError.textContent = '';
      }
      if (loginAlertBox && loginAlertBox.dataset.field === 'password') {
        loginAlertBox.style.display = 'none';
      }
    });
  }

  // Alternar entre pestaña de Iniciar Sesión y Registro
  function showLoginForm() {
    clearLoginErrors();
    if (tabBtnLogin) tabBtnLogin.classList.add('active');
    if (tabBtnRegister) tabBtnRegister.classList.remove('active');
    if (formLoginPosface) formLoginPosface.style.display = 'flex';
    if (formRegisterPosface) formRegisterPosface.style.display = 'none';
  }

  function showRegisterForm() {
    clearLoginErrors();
    if (tabBtnRegister) tabBtnRegister.classList.add('active');
    if (tabBtnLogin) tabBtnLogin.classList.remove('active');
    if (formRegisterPosface) formRegisterPosface.style.display = 'flex';
    if (formLoginPosface) formLoginPosface.style.display = 'none';
  }

  if (tabBtnLogin) tabBtnLogin.addEventListener('click', showLoginForm);
  if (tabBtnRegister) tabBtnRegister.addEventListener('click', showRegisterForm);
  if (btnSwitchToRegister) btnSwitchToRegister.addEventListener('click', showRegisterForm);
  if (btnSwitchToLogin) btnSwitchToLogin.addEventListener('click', showLoginForm);

  // Actualizar estado visual de Firebase en el formulario de Login
  if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
    if (fbStatusText) fbStatusText.innerHTML = '<strong style="color: #059669;">Conectado a Firebase Cloud</strong>';
    if (loginCloudStatus) loginCloudStatus.textContent = 'Base de Datos en la Nube (Firestore)';
  } else {
    if (fbStatusText) fbStatusText.innerHTML = 'Camino preparado en <code>js/firebase-config.js</code>';
    if (loginCloudStatus) loginCloudStatus.textContent = 'Modo Seguro Administrativo Activo';
  }

  // Toggle de visibilidad de contraseña
  if (btnTogglePassword && loginPassword) {
    btnTogglePassword.addEventListener('click', () => {
      const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
      loginPassword.setAttribute('type', type);
      btnTogglePassword.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  // =========================================================================
  // GESTIÓN Y RENDERIZADO DE BITÁCORA DE COORDINACIÓN
  // =========================================================================
  let bitacoraAllLogs = [];

  // Comprobar si el usuario posee rol de Coordinador General o Administrador
  function isCoordinadorGeneralUser(user) {
    if (!user) return false;
    const roleStr = (user.role || '').toLowerCase().trim();
    const emailStr = (user.email || '').toLowerCase().trim();
    if (roleStr.includes('coordinador general') || roleStr.includes('coordinadora general')) return true;
    if (roleStr.includes('administrador') || roleStr === 'admin') return true;
    if (roleStr.includes('dirección') || roleStr.includes('direccion')) return true;
    if (emailStr === 'maygonza.cs@gmail.com' || emailStr === 'coordinador.general@unah.edu.hn' || emailStr === 'admin@unah.edu.hn') return true;
    return false;
  }

  // Formatear fecha y hora para la visualización amigable en Honduras
  function formatLogDate(log) {
    let dateObj = null;
    if (log.normalizedTimestamp) {
      dateObj = new Date(log.normalizedTimestamp);
    } else if (log.serverTimestamp) {
      if (typeof log.serverTimestamp.toDate === 'function') {
        dateObj = log.serverTimestamp.toDate();
      } else if (log.serverTimestamp.seconds) {
        dateObj = new Date(log.serverTimestamp.seconds * 1000);
      } else {
        dateObj = new Date(log.serverTimestamp);
      }
    } else if (log.timestamp) {
      dateObj = new Date(log.timestamp);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    const fecha = dateObj.toLocaleDateString('es-HN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const hora = dateObj.toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return `${fecha} · ${hora}`;
  }

  // Generar badge con estilo distintivo según la acción
  function getActionBadgeHtml(action) {
    const act = (action || 'Acción General').trim();
    const actLower = act.toLowerCase();

    if (actLower.includes('inicio de sesión') || actLower.includes('login')) {
      return `<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #10b981;"></span> ${act}
      </span>`;
    }
    if (actLower.includes('cierre de sesión') || actLower.includes('logout')) {
      return `<span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #64748b;"></span> ${act}
      </span>`;
    }
    if (actLower.includes('inscripción') || actLower.includes('aspirante')) {
      return `<span class="badge" style="background: #fefce8; color: #b45309; border: 1px solid #fde047; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #eab308;"></span> ${act}
      </span>`;
    }
    if (actLower.includes('eliminación') || actLower.includes('eliminar')) {
      return `<span class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #ef4444;"></span> ${act}
      </span>`;
    }
    if (actLower.includes('estado') || actLower.includes('actualización') || actLower.includes('actualizacion')) {
      return `<span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #3b82f6;"></span> ${act}
      </span>`;
    }
    if (actLower.includes('contraseña') || actLower.includes('password')) {
      return `<span class="badge" style="background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; font-weight: 700; font-size: 0.8rem;">
        <span class="badge-dot" style="background: #a855f7;"></span> ${act}
      </span>`;
    }
    return `<span class="badge" style="background: rgba(0, 51, 102, 0.06); color: var(--unah-navy); border: 1px solid rgba(0, 51, 102, 0.15); font-weight: 700; font-size: 0.8rem;">
      <span class="badge-dot" style="background: var(--unah-navy);"></span> ${act}
    </span>`;
  }

  // Función auxiliar de sanitización
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Formatear detalles de operaciones para mostrar información enriquecida (nombres, DNI, programa, chips)
  function formatLogDetails(log) {
    let details = (log.details || '').trim();
    const act = (log.action || '').toLowerCase();

    // Sanitizar cadenas undefined residuales si las hubiera
    if (details.includes('undefined')) {
      details = details.replace(/undefined\s*\(undefined\)/g, 'Aspirante registrado')
                       .replace(/undefined/g, 'N/A');
    }

    // Caso 1: Estructura enriquecida con separador vertical '|'
    if (details.includes('|')) {
      const parts = details.split('|').map(p => p.trim());
      const mainTitle = parts[0];
      const attributes = parts.slice(1);

      const isEliminacion = act.includes('eliminación') || act.includes('eliminar');
      const titleColor = isEliminacion ? '#991b1b' : 'var(--unah-navy)';
      const icon = isEliminacion ? '🗑️' : (act.includes('inscripción') || act.includes('aspirante') ? '🎓' : '📌');

      return `
        <div>
          <div style="font-weight: 700; color: ${titleColor}; font-size: 0.93rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>${icon}</span>
            <span>${escapeHtml(mainTitle)}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${attributes.map(attr => {
              const colonIndex = attr.indexOf(':');
              if (colonIndex === -1) {
                return `<span style="display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; color: #475569;">${escapeHtml(attr)}</span>`;
              }
              const key = attr.substring(0, colonIndex).trim();
              const val = attr.substring(colonIndex + 1).trim();

              let badgeBg = '#f1f5f9';
              let badgeBorder = '#cbd5e1';
              let keyColor = 'var(--unah-navy)';

              if (key.toLowerCase().includes('dni') || key.toLowerCase().includes('cuenta')) {
                badgeBg = '#f0f9ff';
                badgeBorder = '#bae6fd';
                keyColor = '#0369a1';
              } else if (key.toLowerCase().includes('programa')) {
                badgeBg = '#fefce8';
                badgeBorder = '#fef08a';
                keyColor = '#854d0e';
              } else if (key.toLowerCase().includes('folio') || key.toLowerCase().includes('expediente')) {
                badgeBg = '#faf5ff';
                badgeBorder = '#e9d5ff';
                keyColor = '#6b21a8';
              }

              return `<span style="display: inline-flex; align-items: center; gap: 4px; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;">
                <strong style="color: ${keyColor}; font-weight: 700;">${escapeHtml(key)}:</strong>
                <span style="color: #1e293b; font-weight: 600;">${escapeHtml(val)}</span>
              </span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Caso 2: Eliminación sin separador vertical
    if (act.includes('eliminación') || act.includes('eliminar')) {
      return `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="color: #dc2626; font-size: 1.1rem; line-height: 1;">🗑️</span>
          <div>
            <div style="font-weight: 700; color: #991b1b; font-size: 0.88rem;">${escapeHtml(details)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">Expediente removido de la base de datos</div>
          </div>
        </div>
      `;
    }

    // Caso 3: Inicios de sesión
    if (act.includes('inicio de sesión') || act.includes('login')) {
      return `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1rem;">🔑</span>
          <span style="color: var(--text-main); font-size: 0.86rem; font-weight: 500;">${escapeHtml(details)}</span>
        </div>
      `;
    }

    // Caso 4: Cierres de sesión
    if (act.includes('cierre de sesión') || act.includes('logout')) {
      return `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1rem;">🚪</span>
          <span style="color: var(--text-muted); font-size: 0.86rem;">${escapeHtml(details)}</span>
        </div>
      `;
    }

    // Caso 5: Contraseñas
    if (act.includes('contraseña') || act.includes('password')) {
      return `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1rem;">🛡️</span>
          <span style="color: #7e22ce; font-size: 0.86rem; font-weight: 600;">${escapeHtml(details)}</span>
        </div>
      `;
    }

    return `<div style="font-size: 0.86rem; color: var(--text-main); line-height: 1.4;">${escapeHtml(details || 'Operación registrada en el sistema')}</div>`;
  }

  // Renderizar filas de la tabla de bitácora
  function renderBitacoraTable(logs) {
    const tbody = document.getElementById('tbodyBitacora');
    const lblMostrando = document.getElementById('lblBitacoraMostrando');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 36px 20px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📋</div>
            <div style="font-weight: 700; color: var(--unah-navy); font-size: 1.05rem;">No se encontraron registros en la bitácora</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Ajusta los filtros de búsqueda o realiza operaciones en el sistema.</div>
          </td>
        </tr>
      `;
      if (lblMostrando) lblMostrando.textContent = 'Mostrando 0 registros';
      return;
    }

    if (lblMostrando) {
      lblMostrando.textContent = `Mostrando ${logs.length} de ${bitacoraAllLogs.length} registros`;
    }

    tbody.innerHTML = '';
    logs.forEach((log, index) => {
      const formattedDate = formatLogDate(log);
      const actionBadge = getActionBadgeHtml(log.action);
      const userName = log.user || 'Sistema';
      const userInitials = (userName || 'UN').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'UN';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space: nowrap;">
          <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${formattedDate}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">#${log.id || ('reg-' + (bitacoraAllLogs.length - index))}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0, 51, 102, 0.08); color: var(--unah-navy); display: flex; align-items: center; justify-content: center; font-size: 0.76rem; font-weight: 800; flex-shrink: 0; border: 1px solid rgba(0, 51, 102, 0.15);">
              ${userInitials}
            </div>
            <div>
              <div style="font-weight: 700; color: var(--unah-navy); font-size: 0.88rem;">${userName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${log.email || 'Acción institucional'}</div>
            </div>
          </div>
        </td>
        <td>
          ${actionBadge}
        </td>
        <td style="font-size: 0.86rem; color: var(--text-main); line-height: 1.45;">
          ${formatLogDetails(log)}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Filtrado reactivo de registros de bitácora
  function filterAndRenderBitacora() {
    const inputBuscar = document.getElementById('filtroBitacoraBuscar');
    const selectAccion = document.getElementById('filtroBitacoraAccion');

    const query = inputBuscar ? inputBuscar.value.trim().toLowerCase() : '';
    const filterAction = selectAccion ? selectAccion.value : '';

    let filtered = bitacoraAllLogs;

    if (filterAction) {
      filtered = filtered.filter(log => {
        const act = (log.action || '').toLowerCase();
        return act.includes(filterAction.toLowerCase());
      });
    }

    if (query) {
      filtered = filtered.filter(log => {
        const u = (log.user || '').toLowerCase();
        const em = (log.email || '').toLowerCase();
        const act = (log.action || '').toLowerCase();
        const det = (log.details || '').toLowerCase();
        const d = formatLogDate(log).toLowerCase();
        return u.includes(query) || em.includes(query) || act.includes(query) || det.includes(query) || d.includes(query);
      });
    }

    renderBitacoraTable(filtered);
  }

  // Carga y renderizado principal de la Bitácora
  async function renderBitacora() {
    const tbody = document.getElementById('tbodyBitacora');
    const lblTotal = document.getElementById('lblBitacoraTotal');
    const navBadge = document.getElementById('navBadgeBitacora');

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 36px 20px;">
            <div class="spinner-border" style="display: inline-block; width: 26px; height: 26px; border: 3px solid rgba(0, 51, 102, 0.15); border-top-color: var(--unah-navy); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <div style="margin-top: 12px; font-weight: 600; color: var(--unah-navy);">Cargando historial de actividades desde la base de datos...</div>
          </td>
        </tr>
      `;
    }

    if (window.PosfaceDB && window.PosfaceDB.fetchBitacora) {
      bitacoraAllLogs = await window.PosfaceDB.fetchBitacora();
    } else {
      bitacoraAllLogs = [];
    }

    const totalCount = bitacoraAllLogs.length;
    if (lblTotal) lblTotal.textContent = `${totalCount} registro${totalCount === 1 ? '' : 's'}`;
    if (navBadge) {
      navBadge.textContent = totalCount;
      navBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }

    filterAndRenderBitacora();
  }

  // Verificación y actualización de estado de autenticación
  function checkAuthState() {
    const user = window.PosfaceAuth ? window.PosfaceAuth.getCurrentUser() : null;
    const body = document.body;
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');

    if (user) {
      body.classList.remove('not-logged-in');
      body.classList.add('logged-in');
      if (loginScreen) loginScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';

      // Actualizar perfil de usuario en el sidebar
      const avatarEl = document.getElementById('sidebarUserAvatar');
      const nameEl = document.getElementById('sidebarUserName');
      const roleEl = document.getElementById('sidebarUserRole');

      if (avatarEl) {
        const initials = (user.name || 'PF').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        avatarEl.textContent = initials || 'PF';
      }
      if (nameEl) nameEl.textContent = user.name || 'Secretaría Académica';
      if (roleEl) roleEl.textContent = `${user.role || 'POSFACE'} · ${user.email || 'posface@unah.edu.hn'}`;

      // Control estricto de visibilidad de la Bitácora para el rol de Coordinador General
      const navBitacora = document.getElementById('nav-bitacora');
      const isCoordGen = isCoordinadorGeneralUser(user);
      if (navBitacora) {
        if (isCoordGen) {
          navBitacora.style.display = 'flex';
          const navBadge = document.getElementById('navBadgeBitacora');
          if (navBadge) {
            try {
              const raw = localStorage.getItem('posface_bitacora');
              if (raw) {
                const logs = JSON.parse(raw);
                if (Array.isArray(logs) && logs.length > 0) {
                  navBadge.textContent = logs.length;
                  navBadge.style.display = 'inline-block';
                }
              }
            } catch(e) {}
          }
        } else {
          navBitacora.style.display = 'none';
          // Si el usuario no es coordinador general y se encuentra en la vista bitácora, volver a dashboard
          const currentSection = document.querySelector('.view-section.active');
          if (currentSection && currentSection.id === 'view-bitacora') {
            switchView('dashboard');
          }
        }
      }
    } else {
      body.classList.remove('logged-in');
      body.classList.add('not-logged-in');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
    }
  }

  // Envío del formulario de Login con indicadores visuales
  if (formLoginPosface) {
    formLoginPosface.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearLoginErrors();

      const email = (loginEmailInput ? loginEmailInput.value : '').trim();
      const password = (loginPassword ? loginPassword.value : '').trim();
      const btnSubmit = document.getElementById('btnLoginSubmit');
      const btnText = document.getElementById('btnLoginText');

      if (!email) {
        if (loginEmailBox) loginEmailBox.classList.add('has-error');
        if (loginEmailError) {
          loginEmailError.textContent = 'Por favor ingresa tu correo institucional UNAH.';
          loginEmailError.style.display = 'flex';
        }
        if (loginEmailInput) loginEmailInput.focus();
        showLoginAlert('warning', 'Campo Requerido', 'Debes ingresar tu correo institucional para iniciar sesión.');
        return;
      }

      if (!password) {
        if (loginPasswordBox) loginPasswordBox.classList.add('has-error');
        if (loginPasswordError) {
          loginPasswordError.textContent = 'Por favor ingresa tu contraseña.';
          loginPasswordError.style.display = 'flex';
        }
        if (loginPassword) loginPassword.focus();
        showLoginAlert('warning', 'Campo Requerido', 'Debes ingresar tu contraseña institucional para continuar.');
        return;
      }

      if (btnSubmit) btnSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Autenticando...';

      try {
        const user = await window.PosfaceAuth.login(email, password);
        clearLoginErrors();
        showToast(`Bienvenido(a) a POSFACE UNAH: ${user.name}`, 'success');
        checkAuthState();
        if (window.PosfaceDB && window.PosfaceDB.logActivity) window.PosfaceDB.logActivity("Inicio de Sesión", "Usuario accedió al sistema administrativo");
        switchView('dashboard');
      } catch (err) {
        console.warn("Error de autenticación:", err);

        if (err.code === 'USER_NOT_FOUND') {
          // Indicador para cuenta NO registrada
          if (loginEmailBox) loginEmailBox.classList.add('has-error');
          if (loginEmailError) {
            loginEmailError.textContent = 'Esta cuenta no está registrada en el sistema.';
            loginEmailError.style.display = 'flex';
          }
          if (loginAlertBox) loginAlertBox.dataset.field = 'email';

          showLoginAlert(
            'danger',
            'Cuenta no Registrada',
            `El correo institucional <strong>"${email}"</strong> no está registrado en el sistema. Puedes crear tu cuenta institucional de acceso en pocos segundos.`,
            '👉 Registrarme con esta cuenta ahora',
            () => {
              const regEmail = document.getElementById('regEmail');
              if (regEmail) regEmail.value = email;
              showRegisterForm();
            }
          );
          if (loginEmailInput) loginEmailInput.focus();
          showToast(`La cuenta "${email}" no está registrada`, 'danger');

        } else if (err.code === 'WRONG_PASSWORD') {
          // Indicador para contraseña incorrecta
          if (loginPasswordBox) loginPasswordBox.classList.add('has-error');
          if (loginPasswordError) {
            loginPasswordError.textContent = 'La contraseña no coincide con este usuario.';
            loginPasswordError.style.display = 'flex';
          }
          if (loginAlertBox) loginAlertBox.dataset.field = 'password';

          showLoginAlert(
            'danger',
            'Contraseña Incorrecta',
            `La contraseña ingresada no coincide con el usuario <strong>"${email}"</strong>. Por favor verifica tus credenciales o solicita asistencia a Soporte Técnico.`,
            '🛠️ Solicitar Ayuda a Soporte Técnico',
            () => {
              if (modalSoporteTecnico) openModal(modalSoporteTecnico);
            }
          );
          if (loginPassword) {
            loginPassword.focus();
            loginPassword.select();
          }
          showToast('La contraseña ingresada no coincide con el usuario', 'danger');

        } else {
          // Indicador general
          showLoginAlert('danger', 'Error de Autenticación', err.message || 'No fue posible iniciar sesión.');
          showToast(err.message || 'Error al iniciar sesión', 'danger');
        }
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Ingresar al Sistema POSFACE';
      }
    });
  }

  // Envío del formulario de Registro
  if (formRegisterPosface) {
    // Función auxiliar: resaltar campo con error de duplicado
    function markFieldDuplicate(fieldId, hasDuplicate) {
      const input = document.getElementById(fieldId);
      if (!input) return;
      if (hasDuplicate) {
        input.style.borderColor = '#dc2626';
        input.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)';
        // Limpiar resaltado al retomar foco
        input.addEventListener('focus', function clearMark() {
          input.style.borderColor = '';
          input.style.boxShadow = '';
          input.removeEventListener('focus', clearMark);
        });
      } else {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      }
    }

    formRegisterPosface.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Limpiar cualquier resaltado previo
      markFieldDuplicate('regNombre', false);
      markFieldDuplicate('regEmail', false);

      const nombre = document.getElementById('regNombre').value.trim();
      const rol = document.getElementById('regRol').value;
      const email = document.getElementById('regEmail').value.trim().toLowerCase();
      const pwd = document.getElementById('regPassword').value.trim();
      const pwdConfirm = document.getElementById('regPasswordConfirm').value.trim();
      const btnSubmit = document.getElementById('btnRegisterSubmit');
      const btnText = document.getElementById('btnRegisterText');

      if (!nombre || !email || !pwd || !pwdConfirm) {
        showToast('Por favor completa todos los campos requeridos', 'warning');
        return;
      }

      if (pwd !== pwdConfirm) {
        showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'danger');
        return;
      }

      if (pwd.length < 6) {
        showToast('La contraseña debe contener al menos 6 caracteres', 'warning');
        return;
      }

      if (btnSubmit) btnSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Verificando datos...';

      try {
        if (btnText) btnText.textContent = 'Creando cuenta...';
        const newUser = await window.PosfaceAuth.register(nombre, email, pwd, rol);
        showToast(`¡Cuenta creada exitosamente! Por favor, verifica el correo "${email}" antes de iniciar sesión.`, 'success');
        if (newUser.authWarning) {
          setTimeout(() => { showToast(newUser.authWarning, 'warning'); }, 2500);
        }
        formRegisterPosface.reset();
        showLoginForm();

      } catch (err) {
        // ── Manejo de errores de duplicado (409 Conflict) ─────────────────────
        if (err.name === 'DuplicateError' && err.fields) {
          const hasEmailDup = err.fields.includes('EMAIL');
          const hasNameDup = err.fields.includes('NAME');

          // Resaltar campos conflictivos
          markFieldDuplicate('regEmail', hasEmailDup);
          markFieldDuplicate('regNombre', hasNameDup);

          // Mensaje descriptivo con icono
          let icon = '⚠️';
          let toastMsg = err.message;

          if (hasEmailDup && hasNameDup) {
            toastMsg = `${icon} Registro duplicado: el correo y el nombre ya existen en el sistema POSFACE. Usa datos diferentes.`;
          } else if (hasEmailDup) {
            toastMsg = `${icon} Correo ya registrado: "${email}" ya tiene una cuenta activa. Inicia sesión o utiliza otro correo institucional.`;
          } else {
            toastMsg = `${icon} Nombre ya registrado en el sistema. Diferéncialo con tu grado académico (ej. "Lic. Mario Valladares").`;
          }

          showToast(toastMsg, 'danger');

        } else {
          // Error genérico
          showToast(err.message || 'Error al crear la cuenta. Intenta nuevamente.', 'danger');
        }
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Crear Cuenta POSFACE';
      }
    });
  }

  // Botón de Acceso Rápido para Coordinador General
  const btnQuickLoginCoord = document.getElementById('btnQuickLoginCoord');
  if (btnQuickLoginCoord) {
    btnQuickLoginCoord.addEventListener('click', async (e) => {
      e.preventDefault();
      clearLoginErrors();
      const emailInput = document.getElementById('loginEmail');
      const pwdInput = document.getElementById('loginPassword');
      if (emailInput) emailInput.value = 'maygonza.cs@gmail.com';
      if (pwdInput) pwdInput.value = 'posface2026';

      const btnSubmit = document.getElementById('btnLoginSubmit');
      const btnText = document.getElementById('btnLoginText');
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Accediendo como Coordinador...';

      try {
        const user = await window.PosfaceAuth.login('maygonza.cs@gmail.com', 'posface2026');
        clearLoginErrors();
        showToast(`Bienvenido(a) Coordinación General: ${user.name}`, 'success');
        checkAuthState();
        if (window.PosfaceDB && window.PosfaceDB.logActivity) window.PosfaceDB.logActivity("Inicio de Sesión", "Coordinador General accedió al sistema");
        switchView('dashboard');
      } catch (err) {
        showLoginAlert('danger', 'Error al acceder como Coordinador General', err.message);
        showToast(err.message || 'Error al acceder como Coordinador General', 'danger');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Ingresar al Sistema POSFACE';
      }
    });
  }

  // Botón de Acceso Rápido Demostración
  if (btnQuickLogin) {
    btnQuickLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      clearLoginErrors();
      const emailInput = document.getElementById('loginEmail');
      const pwdInput = document.getElementById('loginPassword');
      if (emailInput) emailInput.value = 'secretaria.posface@unah.edu.hn';
      if (pwdInput) pwdInput.value = 'posface2026';

      const btnSubmit = document.getElementById('btnLoginSubmit');
      const btnText = document.getElementById('btnLoginText');
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Accediendo...';

      try {
        const user = await window.PosfaceAuth.login('secretaria.posface@unah.edu.hn', 'posface2026');
        clearLoginErrors();
        showToast(`Bienvenido(a) a POSFACE UNAH: ${user.name}`, 'success');
        checkAuthState();
        if (window.PosfaceDB && window.PosfaceDB.logActivity) window.PosfaceDB.logActivity("Inicio de Sesión", "Usuario ingresó mediante acceso rápido");
        switchView('dashboard');
      } catch (err) {
        showLoginAlert('danger', 'Error al acceder con cuenta demo', err.message);
        showToast(err.message || 'Error al acceder con cuenta demo', 'danger');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Ingresar al Sistema POSFACE';
      }
    });
  }

  // Controles interactivos de la Bitácora
  const btnRefreshBitacora = document.getElementById('btnRefreshBitacora');
  if (btnRefreshBitacora) {
    btnRefreshBitacora.addEventListener('click', async () => {
      btnRefreshBitacora.disabled = true;
      showToast('Sincronizando bitácora con la base de datos...', 'info');
      await renderBitacora();
      btnRefreshBitacora.disabled = false;
      showToast('Bitácora actualizada correctamente desde la BD', 'success');
    });
  }

  const filtroBitacoraBuscar = document.getElementById('filtroBitacoraBuscar');
  if (filtroBitacoraBuscar) {
    filtroBitacoraBuscar.addEventListener('input', filterAndRenderBitacora);
  }

  const filtroBitacoraAccion = document.getElementById('filtroBitacoraAccion');
  if (filtroBitacoraAccion) {
    filtroBitacoraAccion.addEventListener('change', filterAndRenderBitacora);
  }

  // Botón de Cerrar Sesión en Sidebar
  if (btnSidebarLogout) {
    btnSidebarLogout.addEventListener('click', async () => {
      if (window.PosfaceDB && window.PosfaceDB.logActivity) await window.PosfaceDB.logActivity("Cierre de Sesión", "Usuario cerró su sesión en el sistema");
      await window.PosfaceAuth.logout();
      clearLoginErrors();
      showToast('Has cerrado sesión correctamente', 'info');
      checkAuthState();
    });
  }

  // Ejecutar verificación inicial de sesión
  checkAuthState();

  // Sincronizar en segundo plano el perfil del usuario con Firestore
  if (window.PosfaceAuth && window.PosfaceAuth.syncCurrentUser) {
    window.PosfaceAuth.syncCurrentUser().then(syncedUser => {
      if (syncedUser) checkAuthState();
    }).catch(() => {});
  }

  // Inicializar vistas principales
  renderDashboard();
  renderMaestrias();
  renderEstudiantes();

  // Navegación por hash URL
  const initialHash = window.location.hash ? window.location.hash.substring(1) : '';
  if (['dashboard', 'estudiantes', 'maestrias', 'bitacora'].includes(initialHash)) {
    switchView(initialHash);
  }

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash ? window.location.hash.substring(1) : '';
    if (['dashboard', 'estudiantes', 'maestrias', 'bitacora'].includes(newHash)) {
      switchView(newHash);
    }
  });

  // =========================================================================
  // MÓDULO DE GESTIÓN DE CONTRASEÑAS
  // =========================================================================

  // Elementos de Recuperación de Contraseña
  const btnOlvidePassword = document.getElementById('btnOlvidePassword');
  const modalResetPassword = document.getElementById('modalResetPassword');
  const btnCloseResetModal = document.getElementById('btnCloseResetModal');
  const btnCancelReset = document.getElementById('btnCancelReset');
  const formResetPassword = document.getElementById('formResetPassword');

  // Elementos de Cambio de Contraseña
  const btnChangePasswordMenu = document.getElementById('btnChangePasswordMenu');
  const modalChangePassword = document.getElementById('modalChangePassword');
  const btnCloseChangeModal = document.getElementById('btnCloseChangeModal');
  const btnCancelChange = document.getElementById('btnCancelChange');
  const formChangePassword = document.getElementById('formChangePassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
  const pwdStrengthBar = document.getElementById('pwdStrengthBar');
  const pwdStrengthText = document.getElementById('pwdStrengthText');
  const pwdMatchError = document.getElementById('pwdMatchError');

  // Abrir / Cerrar Modales
  if (btnOlvidePassword) btnOlvidePassword.addEventListener('click', () => { if (modalResetPassword) modalResetPassword.classList.add('show'); });
  if (btnCloseResetModal) btnCloseResetModal.addEventListener('click', () => { if (modalResetPassword) modalResetPassword.classList.remove('show'); });
  if (btnCancelReset) btnCancelReset.addEventListener('click', () => { if (modalResetPassword) modalResetPassword.classList.remove('show'); });

  if (btnChangePasswordMenu) btnChangePasswordMenu.addEventListener('click', () => { if (modalChangePassword) modalChangePassword.classList.add('show'); });
  if (btnCloseChangeModal) btnCloseChangeModal.addEventListener('click', () => { if (modalChangePassword) modalChangePassword.classList.remove('show'); formChangePassword.reset(); updateStrengthBar(); });
  if (btnCancelChange) btnCancelChange.addEventListener('click', () => { if (modalChangePassword) modalChangePassword.classList.remove('show'); formChangePassword.reset(); updateStrengthBar(); });

  // Enviar formulario Recuperación
  if (formResetPassword) {
    formResetPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('resetEmail').value.trim();
      const btnSubmit = document.getElementById('btnSubmitReset');
      if (!email) return;

      const originalText = btnSubmit.textContent;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Procesando...';

      try {
        await window.PosfaceAuth.sendPasswordReset(email);
        showToast('Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.', 'success');
        modalResetPassword.classList.remove('show');
        formResetPassword.reset();
      } catch (err) {
        showToast(err.message || 'Error al intentar procesar la solicitud.', 'warning');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
      }
    });
  }

  // Evaluar Fortaleza de la Contraseña en Tiempo Real
  function updateStrengthBar() {
    if (!newPasswordInput || !pwdStrengthBar || !pwdStrengthText) return;
    const pwd = newPasswordInput.value;
    if (!pwd) {
      pwdStrengthBar.style.width = '0%';
      pwdStrengthText.textContent = 'Sin evaluar';
      pwdStrengthText.style.color = 'var(--text-muted)';
      return;
    }

    let score = 0;
    if (pwd.length >= 8) score += 20;
    if (pwd.length >= 12) score += 10;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 20;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;

    pwdStrengthBar.style.width = `${score}%`;
    if (score < 50) {
      pwdStrengthBar.style.backgroundColor = '#ef4444'; // Rojo (Débil)
      pwdStrengthText.textContent = 'Débil';
      pwdStrengthText.style.color = '#ef4444';
    } else if (score < 80) {
      pwdStrengthBar.style.backgroundColor = '#eab308'; // Amarillo (Media)
      pwdStrengthText.textContent = 'Media';
      pwdStrengthText.style.color = '#eab308';
    } else {
      pwdStrengthBar.style.backgroundColor = '#22c55e'; // Verde (Fuerte)
      pwdStrengthText.textContent = 'Fuerte';
      pwdStrengthText.style.color = '#22c55e';
    }
  }

  if (newPasswordInput) newPasswordInput.addEventListener('input', updateStrengthBar);

  // Enviar formulario Cambio de Contraseña
  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPwd = document.getElementById('currentPassword').value;
      const newPwd = newPasswordInput.value;
      const confirmPwd = confirmNewPasswordInput.value;
      const btnSubmit = document.getElementById('btnSubmitChange');

      if (pwdMatchError) pwdMatchError.style.display = 'none';

      if (newPwd !== confirmPwd) {
        if (pwdMatchError) pwdMatchError.style.display = 'block';
        return;
      }

      // Validar complejidad básica requerida (al menos 8 char, mayúscula, minúscula, número)
      const isStrong = newPwd.length >= 8 && /[A-Z]/.test(newPwd) && /[a-z]/.test(newPwd) && /[0-9]/.test(newPwd);
      if (!isStrong) {
        showToast('La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas y números.', 'warning');
        return;
      }

      const originalText = btnSubmit.textContent;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Actualizando...';

      try {
        await window.PosfaceAuth.changePassword(currentPwd, newPwd);
        showToast('Tu contraseña ha sido actualizada con éxito.', 'success');
        if (window.PosfaceDB && window.PosfaceDB.logActivity) await window.PosfaceDB.logActivity("Cambio de Contraseña", "El usuario actualizó su contraseña de acceso");
        modalChangePassword.classList.remove('show');
        formChangePassword.reset();
        updateStrengthBar();
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
      }
    });
  }

  // =========================================================================
  // MANEJO DE REDIRECCIÓN AUTOMÁTICA DE FIREBASE AUTH (VERIFICACIÓN DE CORREO)
  // =========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const actionCode = urlParams.get('oobCode');

  if (mode === 'verifyEmail' && actionCode && window.firebase) {
    window.firebase.auth().applyActionCode(actionCode).then(() => {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('¡Tu correo electrónico ha sido verificado exitosamente!', 'success');
      // Redirigir al inicio de sesión limpiando pantalla si es necesario
      if (document.body.classList.contains('not-logged-in')) {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'flex';
      }
    }).catch(err => {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('El enlace de verificación es inválido o ya expiró.', 'warning');
    });
  }

});
