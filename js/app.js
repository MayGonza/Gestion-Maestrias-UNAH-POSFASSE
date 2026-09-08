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
  let currentView = 'dashboard';
  let estudiantesList = [...data.estudiantes];
  let maestriasList = [...data.maestrias];

  // Sincronizar estudiantes con PosfaceDB (Firestore o Local)
  if (window.PosfaceDB) {
    window.PosfaceDB.fetchEstudiantes(data.estudiantes).then(list => {
      if (list && list.length > 0) {
        estudiantesList = list;
        filtrarEstudiantes();
        renderDashboard();
      }
    });
  }

  // Escucha reactiva en tiempo real para nuevos estudiantes agregados (inscripción pública u otra pestaña)
  window.addEventListener('storage', (e) => {
    if (e.key === 'posface_estudiantes_data' && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        if (Array.isArray(updated) && updated.length > 0) {
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

    // Guardar en Firebase Firestore o LocalStorage
    if (window.PosfaceDB) {
      window.PosfaceDB.updateEstadoEstudiante(estId, nuevoEstado, estudiantesList);
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
    }

    filtrarEstudiantes();
    renderDashboard();
    showToast(`Estado de ${est.nombres} ${est.apellidos} actualizado a: "${nuevoEstado}"`, 'success');
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
    };

    if (viewNames[viewId]) {
      breadcrumbSection.textContent = viewNames[viewId].sec;
      breadcrumbTitle.textContent = viewNames[viewId].title;
    }

    // Acciones específicas al entrar a cada vista
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'estudiantes') renderEstudiantes();
    if (viewId === 'maestrias') renderMaestrias();


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
      maestriasList.slice(0, 6).forEach(m => {
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
            <div class="program-bar-fill" style="width: ${Math.max(pct, 8)}%; background: ${m.color};"></div>
          </div>
        `;
        containerBars.appendChild(barItem);
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
              <span class="val" style="color: var(--unah-navy); font-weight: 700;">${m.estudiantesActivos}</span>
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
        : `<span class="badge-indice badge-indice-warn" title="Ingreso con índice menor al 70%">⚠️ ${indVal.toFixed(1)}%</span>`;

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
        <td style="text-align: right;">
          <button class="btn btn-outline btn-sm btn-ver-expediente" data-id="${est.id}" title="Ver expediente académico y antecedentes">
            Ver Expediente
          </button>
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

  // Llenar select de maestrías en filtro de estudiantes
  function populateFiltroMaestriasSelect() {
    if (!filtroEstudianteMaestria) return;
    filtroEstudianteMaestria.innerHTML = '<option value="todas">Todos los Programas POSFACE</option>';
    maestriasList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nombre;
      filtroEstudianteMaestria.appendChild(opt);
    });
  }
  populateFiltroMaestriasSelect();

  // =========================================================================
  // 6. EXPEDIENTE ACADÉMICO Y CONSTANCIA OFICIAL IMPRIMIBLE
  // =========================================================================
  const modalExpediente = document.getElementById('modalExpediente');

  function openExpedienteModal(estudianteId) {
    const est = estudiantesList.find(e => e.id === estudianteId);
    if (!est) return;

    const mae = maestriasList.find(m => m.id === est.maestriaId) || { nombre: 'Programa POSFACE' };
    document.getElementById('expNombre').textContent = `${est.nombres} ${est.apellidos}`;
    document.getElementById('expCuenta').textContent = est.cuentaUNAH || 'Pendiente (Graduado Externo)';
    document.getElementById('expMaestria').textContent = `${mae.nombre} · Modalidad ${est.modalidad || mae.modalidad || 'Presencial'}`;

    // Selector de estado en modal
    const selectModal = document.getElementById('selectEstadoExpediente');
    if (selectModal) {
      selectModal.setAttribute('data-id', est.id);
      selectModal.value = est.estado;
      selectModal.className = `badge-status-select badge ${getBadgeClassForEstado(est.estado)}`;
    }

    const badgeExp = document.getElementById('expEstadoBadge');
    if (badgeExp) badgeExp.textContent = est.estado;
    const expIndiceFicha = document.getElementById('expIndicePregradoFicha');
    if (expIndiceFicha) expIndiceFicha.textContent = `${Number(est.indicePregrado || 0).toFixed(1)}%`;
    document.getElementById('expDni').textContent = est.dni;
    document.getElementById('expCorreo').textContent = est.correoInstitucional;
    document.getElementById('expTelefono').textContent = est.telefono;
    document.getElementById('expFechaIngreso').textContent = est.fechaIngreso;

    // Procedencia geográfica (Departamento / Ciudad)
    const expProcedencia = document.getElementById('expProcedencia');
    if (expProcedencia) {
      const depto = est.departamento || '';
      const ciudad = est.ciudad || '';
      expProcedencia.textContent = (ciudad && depto) ? `${ciudad}, ${depto}` : (ciudad || depto || 'Honduras');
    }

    // Datos de Procedencia e Índice de Pregrado (Campos Solicitados)
    const expUni = document.getElementById('expUniversidad');
    if (expUni) expUni.textContent = est.universidadProcedencia || 'UNAH - Universidad Nacional Autónoma de Honduras';

    const expCarrera = document.getElementById('expCarreraPrevia');
    if (expCarrera) expCarrera.textContent = est.carreraPregrado || 'Licenciatura / Título Universitario';

    const expIndiceVal = document.getElementById('expIndicePregradoVal');
    const expIndiceBadge = document.getElementById('expIndiceCumpleBadge');
    const ind = Number(est.indicePregrado) || 0;
    if (expIndiceVal) expIndiceVal.textContent = `${ind.toFixed(1)}%`;
    if (expIndiceBadge) {
      if (ind >= 70) {
        expIndiceBadge.className = 'badge-indice badge-indice-ok';
        expIndiceBadge.textContent = '✓ ≥ 70% Requisito Cumplido';
      } else {
        expIndiceBadge.className = 'badge-indice badge-indice-warn';
        expIndiceBadge.textContent = '⚠️ < 70% Matrícula Condicional';
      }
    }

    openModal(modalExpediente);
  }

  // =========================================================================
  // 7. MATRÍCULA Y ADMISIÓN DE NUEVOS ASPIRANTES (NORMATIVA >= 70%)
  // =========================================================================
  const modalNuevoEstudiante = document.getElementById('modalNuevoEstudiante');
  const formNuevoEstudiante = document.getElementById('formNuevoEstudiante');
  const selectNuevoEstMaestria = document.getElementById('nuevoEstMaestria');

  // Llenar select de nuevo estudiante
  function populateNuevoEstudianteSelects() {
    if (!selectNuevoEstMaestria) return;
    selectNuevoEstMaestria.innerHTML = '<option value="">Seleccione el programa...</option>';
    maestriasList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.codigo} - ${m.nombre}`;
      selectNuevoEstMaestria.appendChild(opt);
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
      const tituloTesis = (document.getElementById('nuevoEstTituloTesis')?.value || '').trim();
      const tutorTesis = (document.getElementById('nuevoEstTutorTesis')?.value || '').trim();
      const maestriaId = selectNuevoEstMaestria.value;
      const indice = parseFloat(indiceRaw);

      if (!dni || !nombres || !apellidos || !maestriaId || !universidad || !departamento || isNaN(indice)) {
        showToast('Por favor completa todos los campos requeridos (incluyendo Departamento, Universidad e Índice de Pregrado)', 'warning');
        return;
      }

      if (indice < 0 || indice > 100) {
        showToast('El índice académico debe estar en un rango válido entre 0% y 100%', 'danger');
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
        indicePregrado: indice,
        carreraPregrado: carreraPrevia || 'Licenciatura Universitaria',
        maestriaId: maestriaId,
        modalidad: modalidad,
        estado: 'Activo',
        fechaIngreso: new Date().toLocaleDateString('es-HN'),
        promedio: 0.0,
        uvsAprobadas: 0,
        totalUVs: selectedMae ? selectedMae.totalUV : 50,
        tituloTesis: tituloTesis || 'Tema en proceso de formulación',
        tutorTesis: tutorTesis || 'Pendiente de designación',
        calificacionesRecientes: []
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

      if (indice < 70) {
        showToast(`Aspirante inscrito condicionalmente (Índice pregrado: ${indice.toFixed(1)}% <  70 % normativo)`, 'warning');
      } else {
        showToast(`Estudiante ${nombres} ${apellidos} inscrito con éxito (${universidad.split('-')[0].trim()})`, 'success');
      }
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
      "Índice Pregrado (%)",
      "Carrera Previa",
      "Programa POSFACE",
      "Modalidad",
      "Estado",
      "Proyecto de Tesis",
      "Tutor Asignado"
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
        est.indicePregrado || 0,
        `"${est.carreraPregrado || ''}"`,
        `"${mae.nombre}"`,
        `"${est.modalidad || mae.modalidad || 'Presencial'}"`,
        `"${est.estado}"`,
        `"${est.tituloTesis || 'En formulación'}"`,
        `"${est.tutorTesis || 'Pendiente'}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `matricula_posface_unah_${new Date().toISOString().slice(0, 10)}.csv`);
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

  // Botón imprimir ficha / expediente
  const btnImprimirExpediente = document.getElementById('btnImprimirExpediente');
  if (btnImprimirExpediente) {
    btnImprimirExpediente.addEventListener('click', () => {
      showToast('Preparando vista de impresión de Ficha Oficial POSFACE...', 'gold');
      setTimeout(() => {
        window.print();
      }, 400);
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
    formRegisterPosface.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('regNombre').value.trim();
      const rol = document.getElementById('regRol').value;
      const email = document.getElementById('regEmail').value.trim();
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
      if (btnText) btnText.textContent = 'Creando cuenta...';

      try {
        const newUser = await window.PosfaceAuth.register(nombre, email, pwd, rol);
        showToast(`¡Cuenta creada exitosamente! Bienvenido(a) ${newUser.name}`, 'success');
        if (newUser.authWarning) {
          setTimeout(() => {
            showToast(newUser.authWarning, 'warning');
          }, 2500);
        }
        checkAuthState();
        switchView('dashboard');
        formRegisterPosface.reset();
        showLoginForm();
      } catch (err) {
        showToast(err.message || 'Error al crear la cuenta', 'danger');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = 'Crear Cuenta POSFACE';
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

  // Rellenar automáticamente credenciales institucionales de prueba
  document.querySelectorAll('.btn-fill-account').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      clearLoginErrors();
      const email = btn.getAttribute('data-email');
      const pass = btn.getAttribute('data-pass');
      if (loginEmailInput) loginEmailInput.value = email;
      if (loginPassword) loginPassword.value = pass;
      if (loginEmailInput) loginEmailInput.focus();
    });
  });

  // Botón de Cerrar Sesión en Sidebar
  if (btnSidebarLogout) {
    btnSidebarLogout.addEventListener('click', async () => {
      await window.PosfaceAuth.logout();
      clearLoginErrors();
      showToast('Has cerrado sesión correctamente', 'info');
      checkAuthState();
    });
  }

  // Ejecutar verificación inicial de sesión
  checkAuthState();

  // Inicializar vistas
  renderDashboard();
  renderMaestrias();
  renderEstudiantes();

});
