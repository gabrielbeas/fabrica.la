// 🧭 Navbar Dinámico
// Muestra opciones según el rol del usuario

import {
  getCurrentUser,
  logout,
  getSeccionesPermitidas,
  isAuthenticated,
  basePath
} from './auth.js';

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
          <a href="${basePath()}">
            <span class="logo">F</span>
            <span class="title">La Fábrica</span>
          </a>
        </div>

        <div class="navbar-menu" id="navbarMenu">
          ${secciones.map(seccion => `
            <a href="${seccion.url}" class="nav-link" data-id="${seccion.id}">
              <span class="text">${seccion.nombre}</span>
            </a>
          `).join('')}
        </div>

        <div class="navbar-user">
          <div class="user-info">
            <div class="user-details">
              <div class="user-name">${user.nombre || user.email}</div>
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

  // Agregar estilos del navbar
  agregarEstilosNavbar();

  // Event listeners
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
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
  // Sección = primera carpeta después de la base (agua/, locales/...). Sin carpeta = inicio.
  const resto = window.location.pathname.slice(basePath().length);
  const carpeta = resto.includes('/') ? resto.split('/')[0] : '';
  const activa = secciones.find(s => s.id !== 'inicio' && s.url.slice(basePath().length).split('/')[0] === carpeta);
  const id = activa ? activa.id : (carpeta === '' ? 'inicio' : null);

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.id === id);
  });
}

/**
 * Agregar estilos del navbar
 */
function agregarEstilosNavbar() {
  const style = document.createElement('style');
  style.textContent = `
    .navbar {
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .navbar-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      max-width: 100%;
      height: 70px;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      text-decoration: none;
      color: #333;
      font-weight: 600;
      font-size: 18px;
    }

    .navbar-brand a {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #333;
    }

    .navbar-brand .logo {
      font-size: 28px;
    }

    .navbar-menu {
      display: flex;
      gap: 0;
      flex: 1;
      margin-left: 40px;
      align-items: center;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 15px;
      color: #666;
      text-decoration: none;
      transition: all 0.3s;
      white-space: nowrap;
      border-bottom: 3px solid transparent;
    }

    .nav-link:hover {
      color: #667eea;
      background: rgba(102, 126, 234, 0.05);
    }

    .nav-link.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }

    .nav-link .icon {
      font-size: 18px;
    }

    .navbar-user {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-left: 20px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-icon {
      font-size: 32px;
      background: #f0f0f0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }

    .user-role {
      font-size: 12px;
      color: #999;
    }

    .logout-btn {
      padding: 10px 20px;
      background: #f5f5f5;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 500;
      color: #666;
      transition: all 0.3s;
    }

    .logout-btn:hover {
      background: #ee5a6f;
      color: white;
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
      width: 25px;
      height: 3px;
      background: #333;
      border-radius: 2px;
      transition: all 0.3s;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .navbar-toggle {
        display: flex;
      }

      .navbar-menu {
        display: none;
        position: absolute;
        top: 70px;
        left: 0;
        right: 0;
        background: white;
        flex-direction: column;
        gap: 0;
        margin-left: 0;
        border-bottom: 1px solid #eee;
      }

      .navbar-menu.active {
        display: flex;
      }

      .nav-link {
        width: 100%;
        border-bottom: 1px solid #f0f0f0;
        border-right: 3px solid transparent;
      }

      .nav-link.active {
        border-bottom: 1px solid #f0f0f0;
        border-right-color: #667eea;
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

    @media (max-width: 480px) {
      .navbar-container {
        padding: 0 10px;
      }

      .navbar-brand .title {
        display: none;
      }

      .nav-link .text {
        font-size: 12px;
      }
    }
  `;

  document.head.appendChild(style);
}
