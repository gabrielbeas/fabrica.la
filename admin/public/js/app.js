import api from './api.js';
import { tokenManager, userManager, formatters, statusHelpers } from './utils.js';

class AdminPanel {
  constructor() {
    this.contracts = [];
    this.building = {};
    this.init();
  }

  async init() {
    // Verificar autenticación
    if (!tokenManager.hasToken()) {
      this.showLoginPage();
      return;
    }

    // Intentar verificar token
    try {
      await api.verifyAuth();
      this.showAdminPanel();
      await this.loadData();
    } catch (error) {
      console.error('Auth verification failed:', error);
      tokenManager.removeToken();
      userManager.removeUser();
      this.showLoginPage();
    }
  }

  // ===== LOGIN PAGE =====
  showLoginPage() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <h2>🏗️ Admin Panel</h2>
          <h3 style="text-align: center; color: #999; font-size: 1em; margin-bottom: 30px;">
            La Fábrica de Chocolate
          </h3>
          <form id="loginForm">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="admin@fabrica.la"
                required
              >
            </div>
            <div class="form-group">
              <label for="password">Contraseña</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                required
              >
            </div>
            <div id="errorMessage" class="error-message" style="display: none;"></div>
            <button type="submit" class="btn-login" id="loginBtn">
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('loginForm').addEventListener('submit',
      (e) => this.handleLogin(e)
    );
  }

  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="loading"></span>';

      const response = await api.login(email, password);

      if (response.success && response.token) {
        tokenManager.setToken(response.token);
        userManager.setUser(response.user);
        this.showAdminPanel();
        await this.loadData();
      }
    } catch (error) {
      errorDiv.textContent = 'Credenciales inválidas. Intenta de nuevo.';
      errorDiv.style.display = 'block';
      console.error('Login error:', error);
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Iniciar Sesión';
    }
  }

  // ===== ADMIN PANEL =====
  showAdminPanel() {
    const user = userManager.getUser();
    const root = document.getElementById('app');
    root.innerHTML = `
      <div class="container">
        <header>
          <div>
            <h1>🏗️ La Fábrica de Chocolate</h1>
            <p class="header-subtitle">Panel de Administración</p>
          </div>
          <div class="header-right">
            <div class="user-info">
              <div class="user-name">${user.email}</div>
              <div class="user-role">${user.role}</div>
            </div>
            <button class="logout-btn" id="logoutBtn">Cerrar Sesión</button>
          </div>
        </header>

        <div class="tabs">
          <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
          <button class="tab-btn" data-tab="building">Edificio Completo</button>
          <button class="tab-btn" data-tab="contracts">Contratos (<span id="contractsCount">${this.contracts.length}</span>)</button>
        </div>

        <!-- DASHBOARD TAB -->
        <div id="dashboard" class="tab-content active">
          <div class="stats-grid" id="statsGrid"></div>
          <div class="building-card">
            <div class="building-header">
              <div class="building-icon">📊</div>
              <div class="building-title">
                <h2>Resumen General</h2>
                <p>Estado actual del edificio y operaciones</p>
              </div>
            </div>
            <div class="info-grid" id="dashboardInfo"></div>
          </div>
        </div>

        <!-- BUILDING TAB -->
        <div id="building" class="tab-content">
          <div class="building-card" id="buildingCard"></div>
        </div>

        <!-- CONTRACTS TAB -->
        <div id="contracts" class="tab-content">
          <div class="search-filter">
            <input type="text" id="searchInput" placeholder="Buscar por inquilino, local o estado...">
            <select id="filterStatus">
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="expiring">Por vencer</option>
              <option value="expired">Vencido</option>
              <option value="available">Disponible</option>
            </select>
          </div>
          <div class="cards-grid" id="cardsContainer"></div>
        </div>
      </div>
    `;

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click',
      () => this.handleLogout()
    );

    this.setupTabs();
    this.setupSearch();
  }

  async loadData() {
    try {
      const [contractsRes, buildingRes] = await Promise.all([
        api.getContracts(),
        api.getBuilding()
      ]);

      this.contracts = contractsRes.data || [];
      this.building = buildingRes.data || {};

      const countBadge = document.getElementById('contractsCount');
      if (countBadge) countBadge.textContent = this.contracts.length;

      this.renderDashboard();
      this.renderBuilding();
      this.renderContracts();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // ===== DASHBOARD RENDERING =====
  renderDashboard() {
    const activeContracts = this.contracts.filter(c => c.status === 'active').length;
    const totalArea = this.contracts.reduce((sum, c) => {
      const area = parseInt(c.area) || 0;
      return sum + area;
    }, 0);

    const stats = [
      { label: 'Contratos Activos', value: activeContracts },
      { label: 'Superficie Total', value: `${totalArea} m²` },
      { label: 'Ingresos Mensuales', value: this.building.status?.monthlyIncome || 'N/D' },
      { label: 'Ocupación', value: `${this.building.status?.occupancyPercentage ?? 'N/D'}%` }
    ];

    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = stats.map(stat => `
      <div class="stat-card">
        <div class="stat-number">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `).join('');

    const dashboardInfo = document.getElementById('dashboardInfo');
    dashboardInfo.innerHTML = `
      <div class="info-section">
        <h3>📊 Ocupación</h3>
        <div class="info-item">
          <div class="info-label">Locales Ocupados</div>
          <div class="info-value">${activeContracts} de ${this.contracts.length}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Locales Disponibles</div>
          <div class="info-value">${this.contracts.length - activeContracts}</div>
        </div>
      </div>

      <div class="info-section">
        <h3>⚠️ Alertas</h3>
        <div class="info-item">
          <div class="info-label">Contratos por Vencer (3 meses)</div>
          <div class="info-value">${this.contracts.filter(c => c.status === 'expiring').length}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Contratos Vencidos</div>
          <div class="info-value">${this.contracts.filter(c => c.status === 'expired').length}</div>
        </div>
      </div>

      <div class="info-section">
        <h3>💰 Finanzas</h3>
        <div class="info-item">
          <div class="info-label">Ingreso Total Mensual</div>
          <div class="info-value">${this.building.status?.monthlyIncome || 'N/D'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Próximo Vencimiento</div>
          <div class="info-value">${this.getNextExpiringDate()}</div>
        </div>
      </div>
    `;
  }

  getNextExpiringDate() {
    const expiringContracts = this.contracts
      .filter(c => c.endDate)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

    if (expiringContracts.length > 0) {
      return formatters.formatDate(expiringContracts[0].endDate);
    }
    return 'N/A';
  }

  // ===== BUILDING RENDERING =====
  renderBuilding() {
    const buildingCard = document.getElementById('buildingCard');
    const building = this.building;

    buildingCard.innerHTML = `
      <div class="building-header">
        <div class="building-icon">🏗️</div>
        <div class="building-title">
          <h2>${building.name || 'La Fábrica de Chocolate'}</h2>
          <p>${building.description || 'Ficha maestra de la propiedad'}</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-section">
          <h3>📍 Ubicación</h3>
          <div class="info-item">
            <div class="info-label">Dirección</div>
            <div class="info-value">${building.address || '[No especificada]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ciudad/Municipio</div>
            <div class="info-value">${building.city || '[No especificada]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">País</div>
            <div class="info-value">${building.country || 'México'}</div>
          </div>
        </div>

        <div class="info-section">
          <h3>🏢 Características Físicas</h3>
          <div class="info-item">
            <div class="info-label">Superficie Total</div>
            <div class="info-value">${building.totalArea || '[No especificada]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Número de Locales</div>
            <div class="info-value">${building.numberOfLocals ?? '[No especificado]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Niveles</div>
            <div class="info-value">${building.numberOfFloors || '[No especificado]'}</div>
          </div>
        </div>

        <div class="info-section">
          <h3>👤 Propietario</h3>
          <div class="info-item">
            <div class="info-label">Nombre</div>
            <div class="info-value">${building.owner?.name || '[No especificado]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Teléfono</div>
            <div class="info-value">${building.owner?.phone || '[No especificado]'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${building.owner?.email || '[No especificado]'}</div>
          </div>
        </div>

        <div class="info-section">
          <h3>⚙️ Servicios</h3>
          <div class="info-item">
            <div class="info-label">Electricidad</div>
            <div class="info-value">${building.services?.electricity || '✓ Incluida'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Agua</div>
            <div class="info-value">${building.services?.water || '✓ Incluida'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Internet/WiFi</div>
            <div class="info-value">${building.services?.internet || '✓ Disponible'}</div>
          </div>
        </div>

        <div class="info-section">
          <h3>📊 Estado Operacional</h3>
          <div class="info-item">
            <div class="info-label">Ocupación Actual</div>
            <div class="info-value">${building.status?.occupancyPercentage ?? 'N/D'}%</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ingresos Mensuales</div>
            <div class="info-value">${building.status?.monthlyIncome || 'N/D'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Estado General</div>
            <div class="info-value">✓ ${building.operationalStatus || 'Óptimo'}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--border-color); text-align: center; color: var(--text-muted);">
        <p><small>Última actualización: ${formatters.formatDateTime(building.updatedAt)}</small></p>
      </div>
    `;
  }

  // ===== CONTRACTS RENDERING =====
  renderContracts(contractsToShow = this.contracts) {
    const container = document.getElementById('cardsContainer');

    if (contractsToShow.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>No se encontraron resultados</h3>
            <p>Intenta con otros términos de búsqueda</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = contractsToShow.map(contract => `
      <div class="contract-card">
        <div class="card-header">
          <span class="card-number">Local ${contract.number}</span>
          <span class="card-status">${statusHelpers.getStatusText(contract.status)}</span>
        </div>
        <div class="card-body">
          <div class="card-title">${contract.name}</div>

          <div class="card-field">
            <div class="card-label">Inquilino</div>
            <div class="card-value">${contract.tenant}</div>
          </div>

          <div class="card-field">
            <div class="card-label">Superficie</div>
            <div class="card-value">${contract.area}</div>
          </div>

          <div class="card-field">
            <div class="card-label">Alquiler Mensual</div>
            <div class="card-value">${contract.rent}</div>
          </div>

          <div class="card-field">
            <div class="card-label">Período</div>
            <div class="card-value">
              ${contract.startDate ? formatters.formatDate(contract.startDate) : '-'} -
              ${contract.endDate ? formatters.formatDate(contract.endDate) : '-'}
            </div>
          </div>

          <div class="card-field">
            <div class="card-label">Contacto</div>
            <div class="card-value">${contract.contact}</div>
          </div>

          <div class="card-field">
            <div class="card-label">Email</div>
            <div class="card-value" style="font-size: 0.9em; word-break: break-all;">${contract.email}</div>
          </div>

          ${contract.notes ? `
          <div class="card-field">
            <div class="card-label">Notas</div>
            <div class="card-value">${contract.notes}</div>
          </div>
          ` : ''}
        </div>
        <div class="card-footer">
          <span class="${statusHelpers.getStatusClass(contract.status)}">
            ${statusHelpers.getStatusText(contract.status)}
          </span>
          <span>Actualizado: ${formatters.formatDate(contract.updatedAt)}</span>
        </div>
      </div>
    `).join('');
  }

  // ===== TAB MANAGEMENT =====
  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(tabName).classList.add('active');
      });
    });
  }

  // ===== SEARCH & FILTER =====
  setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const filterStatus = document.getElementById('filterStatus');

    searchInput.addEventListener('input', () => this.filterContracts());
    filterStatus.addEventListener('change', () => this.filterContracts());
  }

  filterContracts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    const filtered = this.contracts.filter(contract => {
      const matchesSearch =
        contract.name.toLowerCase().includes(searchTerm) ||
        contract.tenant.toLowerCase().includes(searchTerm) ||
        contract.number.toString().includes(searchTerm);

      const matchesStatus = !statusFilter || contract.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.renderContracts(filtered);
  }

  // ===== LOGOUT =====
  handleLogout() {
    tokenManager.removeToken();
    userManager.removeUser();
    this.showLoginPage();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdminPanel();
});
