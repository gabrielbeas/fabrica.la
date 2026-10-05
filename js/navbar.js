// 🧭 Navbar Dinámico
// Muestra opciones según el rol del usuario

import {
  getCurrentUser,
  logout,
  getSeccionesPermitidas,
  isAuthenticated,
  basePath,
  onAuthChange
} from './auth.js?v=20261004-1';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Crear navbar dinámicamente
 */
export function crearNavbar() {
  // Verificar autenticación
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  const user = getCurrentUser();
  const secciones = getSeccionesPermitidas();

  // Crear HTML del navbar
  const navbarHTML = `
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <a href="${basePath()}" title="Inicio">
            <img class="logo-img" src="${basePath()}css/logo.png" alt="La Fábrica de Chocolate">
          </a>
        </div>

        <div class="navbar-menu" id="navbarMenu">
          ${secciones.map(seccion => `
            <a href="${seccion.url}" class="nav-link" data-id="${seccion.id}">
              <span class="text">${seccion.nombre}</span>
            </a>
          `).join('')}
          <div class="menu-usuario">
            <span>${esc(user.nombre || user.email)}<small>${getRoleLabel(user.rol)}</small></span>
            <button class="logout-btn" id="logoutBtnMovil">Salir</button>
          </div>
        </div>

        <div class="navbar-user">
          <div class="user-info">
            <div class="user-details">
              <div class="user-name">${esc(user.nombre || user.email)}</div>
              <div class="user-role">${getRoleLabel(user.rol)}</div>
            </div>
          </div>
          <button class="logout-btn" id="logoutBtn">
            <span>Salir</span>
          </button>
        </div>

        <button class="navbar-toggle" id="navbarToggle">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  `;

  // Inyectar navbar al DOM
  const navContainer = document.querySelector('body');
  const navbar = document.createElement('div');
  navbar.innerHTML = navbarHTML;
  navContainer.insertBefore(navbar.firstElementChild, navContainer.firstChild);

  // Agregar estilos del navbar y la capa para celular
  agregarEstilosNavbar();
  agregarEstilosMovil();
  etiquetarTablas();

  // La copia del perfil en localStorage solo sirve para pintar rápido la página.
  // Aquí se confirma con Firebase: si la sesión expiró o el usuario fue desactivado
  // se manda al login, y si cambió su rol o su nombre se recarga con el perfil nuevo.
  onAuthChange(actual => {
    if (!actual) { window.location.href = '/login.html'; return; }
    if (actual.rol !== user.rol || actual.nombre !== user.nombre) window.location.reload();
  });

  // Event listeners
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('logoutBtnMovil').addEventListener('click', handleLogout);
  document.getElementById('navbarToggle').addEventListener('click', toggleMenu);

  // Marcar sección activa
  marcarSeccionActiva(secciones);
}

/**
 * Manejar logout
 */
async function handleLogout() {
  const confirmacion = confirm('¿Deseas cerrar sesión?');
  if (confirmacion) {
    const result = await logout();
    if (result.success) {
      window.location.href = '/login.html';
    }
  }
}

/**
 * Toggle del menú móvil
 */
function toggleMenu() {
  const menu = document.getElementById('navbarMenu');
  menu.classList.toggle('active');
}

/**
 * Obtener etiqueta del rol
 */
function getRoleLabel(rol) {
  const labels = {
    admin: 'Administrador',
    operario: 'Operario'
  };
  return labels[rol] || 'Usuario';
}

/**
 * Marcar sección activa
 */
function marcarSeccionActiva(secciones) {
  // Ruta relativa a la base ('' = Inicio) y vista interna de Inicio (#directorio, #metrajes)
  const calcular = () => {
    const resto = window.location.pathname.slice(basePath().length).replace(/(^|\/)index\.html$/, '$1');
    const hash = window.location.hash;
    const activa = secciones.find(s => {
      const rel = s.url.slice(basePath().length);
      if (rel.startsWith('#')) return resto === '' && hash === rel;
      if (rel === '') return resto === '' && !secciones.some(x => x.url.endsWith(hash) && hash.length > 1);
      if (rel.endsWith('/')) return resto.startsWith(rel);
      return resto === rel;
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', !!activa && link.dataset.id === activa.id);
    });
  };
  calcular();
  window.addEventListener('hashchange', calcular);
}

/**
 * Agregar estilos del navbar
 */
function agregarEstilosNavbar() {
  const style = document.createElement('style');
  style.textContent = `
    /* Colores y medidas del sistema «Panel LFdC» (css/panel.css); el valor tras la coma es el respaldo */
    .navbar {
      background: var(--fondo, #ffffff);
      border-bottom: 1px solid var(--linea, #dfe3e8);
      position: sticky;
      top: 0;
      z-index: 1000;
      font-family: var(--font-sans, Roboto, system-ui, sans-serif);
    }

    .navbar-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      max-width: 100%;
      height: var(--alto-barra, 64px);
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      text-decoration: none;
    }

    .navbar-brand a {
      display: flex;
      align-items: center;
      text-decoration: none;
    }

    .navbar-brand .logo-img {
      height: 30px;
      width: auto;
      display: block;
    }

    .navbar-menu {
      display: flex;
      gap: 4px;
      flex: 1;
      margin-left: 32px;
      align-self: stretch;
      align-items: stretch;
    }

    .nav-link {
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: var(--tinta-suave, #5f6670);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      border-top: 3px solid transparent;
      border-bottom: 3px solid transparent;
    }

    .nav-link:hover {
      color: var(--tinta, #1b2430);
    }

    .nav-link.active {
      color: var(--tinta, #1b2430);
      font-weight: 600;
      border-bottom-color: var(--ambar, #d08a1e);
    }

    .nav-link:focus-visible, .logout-btn:focus-visible, .navbar-toggle:focus-visible {
      outline: 2px solid var(--foco, #1f4e79);
      outline-offset: 2px;
    }

    .navbar-user {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: 16px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      text-align: right;
    }

    .user-name {
      font-weight: 600;
      color: var(--tinta, #1b2430);
      font-size: 13px;
      line-height: 16px;
    }

    .user-role {
      font-size: 11px;
      line-height: 14px;
      color: var(--tinta-suave, #5f6670);
    }

    .logout-btn {
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      height: var(--alto-control-compacto, 32px);
      padding: 0 12px;
      background: var(--fondo, #ffffff);
      border: 1px solid var(--borde-control, #8a929c);
      border-radius: var(--radio-sm, 4px);
      cursor: pointer;
      color: var(--tinta, #1b2430);
    }

    .logout-btn:hover {
      background: var(--fondo-hundido, #f2f4f7);
    }

    .navbar-toggle {
      display: none;
      flex-direction: column;
      background: none;
      border: none;
      cursor: pointer;
      gap: 5px;
    }

    .navbar-toggle span {
      width: 24px;
      height: 2px;
      background: var(--tinta, #1b2430);
      border-radius: 2px;
    }

    .menu-usuario {
      display: none;
    }

    /* Responsive: el menú completo (9 secciones) no cabe por debajo de ~1180px */
    @media (max-width: 1180px) {
      .navbar-container {
        height: 60px;
        padding: 0 16px;
      }

      .navbar-brand .logo-img {
        height: 30px;
      }

      .navbar-toggle {
        display: flex;
        padding: 10px;
        margin-right: -10px;
      }

      .navbar-menu {
        display: none;
        position: absolute;
        top: 60px;
        align-self: auto;
        left: 0;
        right: 0;
        background: var(--fondo, #ffffff);
        flex-direction: column;
        gap: 0;
        margin-left: 0;
        border-bottom: 1px solid var(--linea, #dfe3e8);
        box-shadow: var(--sombra-modal, 0 12px 32px rgba(27, 36, 48, 0.18));
        max-height: calc(100vh - 60px);
        overflow-y: auto;
      }

      .navbar-menu.active {
        display: flex;
      }

      .nav-link {
        width: 100%;
        padding: 14px 20px;
        font-size: 15px;
        border-top: none;
        border-bottom: 1px solid var(--linea, #dfe3e8);
        border-right: 3px solid transparent;
      }

      .menu-usuario {
        display: flex;
        align-self: stretch;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 20px;
        background: var(--fondo-hundido, #f2f4f7);
        font-size: 14px;
        font-weight: 600;
        color: var(--tinta, #1b2430);
      }

      .menu-usuario small {
        display: block;
        font-weight: 400;
        font-size: 12px;
        color: var(--tinta-suave, #5f6670);
      }

      .nav-link.active {
        border-bottom: 1px solid var(--linea, #dfe3e8);
        border-right-color: var(--ambar, #d08a1e);
      }

      .navbar-user {
        display: none;
      }

      .navbar-menu {
        gap: 0;
      }

      .nav-link .text {
        display: block;
      }
    }

  `;

  document.head.appendChild(style);
}

/**
 * Capa compartida para celular. Cada página trae sus propios estilos;
 * esto solo corrige lo común en pantallas angostas (márgenes, letra de los
 * campos, botones, rejillas) y convierte en tarjetas las tablas marcadas
 * con la clase "tabla-movil".
 */
function agregarEstilosMovil() {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 700px) {
      .main { padding: 18px 14px 50px !important; }
      h1 { font-size: 22px !important; }
      .sub { font-size: 13px; margin-bottom: 18px; }

      /* 16px evita que iPhone haga zoom al tocar un campo */
      input, select, textarea { font-size: 16px !important; }
      .buscar { width: 100% !important; }

      .btn, .btn-sec { padding: 11px 16px; }
      .barra, .acciones { flex-wrap: wrap; }

      /* Rejillas de tarjetas de resumen: dos por renglón */
      .tarjetas { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
      .tarjeta { padding: 12px 14px !important; }
      .tarjeta .val { font-size: 19px !important; overflow-wrap: anywhere; }

      /* Listas de datos (dt/dd): etiqueta arriba, valor abajo */
      dl { grid-template-columns: minmax(0, 1fr) !important; gap: 2px !important; }
      dt { margin-top: 8px; font-size: 12px; }
      dd { overflow-wrap: anywhere; }

      .resumen, .resumen-dep { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
      .secciones, .layout { grid-template-columns: minmax(0, 1fr) !important; }
      .panel { padding: 16px 14px !important; }
      .panel .tabla-movil tbody tr { padding: 6px 12px; }

      /* Ventanas emergentes a casi toda la pantalla */
      .modal-fondo { padding: 12px 8px !important; }
      .modal { padding: 18px 16px !important; border-radius: 10px !important; }
      .modal-cab { flex-wrap: wrap; gap: 10px !important; }

      /* Tablas que siguen siendo tabla: se desplazan dentro de su caja */
      .secciones table, .modal table, table.tabla-h { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }

      /* Tablas en tarjetas: cada renglón es una tarjeta con "etiqueta: valor" */
      .tabla-wrap:has(> .tabla-movil) { border: none !important; overflow: visible !important; }
      table.tabla-movil, .tabla-movil tbody, .tabla-movil tfoot, .tabla-movil tr, .tabla-movil td { display: block; width: 100%; }
      .tabla-movil thead tr { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .tabla-movil thead th { display: none; }
      .tabla-movil thead th.ord { display: inline-flex; align-items: center; background: var(--fondo, #ffffff); border: 1px solid var(--linea, #dfe3e8); border-radius: 999px; padding: 5px 10px; font-size: 11px; }
      .tabla-movil thead th.ord.act { border-color: var(--ambar, #d08a1e); }
      .tabla-movil tbody tr, .tabla-movil tfoot tr { border: 1px solid var(--linea, #dfe3e8) !important; border-radius: var(--radio-md, 8px); padding: 8px 14px; margin-bottom: 10px; background: var(--fondo, #ffffff); }
      .tabla-movil tr[style*="display: none"], .tabla-movil tr[hidden] { display: none !important; }
      .tabla-movil td { padding: 6px 0 !important; border: none !important; text-align: right !important; background: none !important; white-space: normal !important; overflow-wrap: anywhere; }
      .tabla-movil td::after { content: ""; display: block; clear: both; }
      .tabla-movil td::before { content: attr(data-label); float: left; max-width: 45%; margin-right: 12px; text-align: left; color: var(--tinta-suave, #5f6670); font-size: 12px; font-weight: 500; text-transform: none; letter-spacing: 0; line-height: 1.6; }
      .tabla-movil td:not([data-label])::before, .tabla-movil td[data-label=""]::before { display: none; }
      .tabla-movil td:not([data-label]), .tabla-movil td[data-label=""] { text-align: left !important; }
      .tabla-movil td:empty { display: none; }
      .tabla-movil td:first-child { font-size: 15px; font-weight: 600; }
      .tabla-movil td input[type=number], .tabla-movil td input[type=text] { width: 150px !important; max-width: 55%; }
      .tabla-movil tfoot tr, .tabla-movil tr.tot { background: var(--fondo-hundido, #f2f4f7); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Pone a cada celda de las tablas "tabla-movil" el texto de su encabezado
 * (data-label), que la vista de celular muestra como etiqueta. Las tablas se
 * vuelven a dibujar seguido, así que se observa el DOM.
 */
function etiquetarTablas() {
  const etiquetar = () => {
    document.querySelectorAll('table.tabla-movil').forEach(tabla => {
      const encabezados = [...tabla.querySelectorAll('thead th')].map(th => (th.firstChild?.textContent ?? th.textContent).trim());
      tabla.querySelectorAll('tbody tr, tfoot tr').forEach(tr => {
        let col = 0;
        [...tr.children].forEach(td => {
          if (!td.hasAttribute('data-label') && encabezados[col] !== undefined) td.setAttribute('data-label', (td.colSpan || 1) > 1 ? '' : encabezados[col]);
          col += td.colSpan || 1;
        });
      });
    });
  };
  let pendiente = false;
  new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; etiquetar(); });
  }).observe(document.body, { childList: true, subtree: true });
  etiquetar();
}
