// Token management
export const tokenManager = {
  getToken() {
    return localStorage.getItem('adminToken');
  },

  setToken(token) {
    localStorage.setItem('adminToken', token);
  },

  removeToken() {
    localStorage.removeItem('adminToken');
  },

  hasToken() {
    return !!this.getToken();
  }
};

// User management
export const userManager = {
  getUser() {
    const user = localStorage.getItem('adminUser');
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem('adminUser', JSON.stringify(user));
  },

  removeUser() {
    localStorage.removeItem('adminUser');
  }
};

// Format utilities
export const formatters = {
  formatCurrency(value) {
    if (!value) return 'N/A';
    return value.toString().includes('$') ? value : `$${value}`;
  },

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  },

  formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// Status utilities
export const statusHelpers = {
  getStatusClass(status) {
    switch(status) {
      case 'active': return 'status-active';
      case 'expiring': return 'status-expiring';
      case 'expired': return 'status-expired';
      case 'available': return 'status-available';
      default: return '';
    }
  },

  getStatusText(status) {
    switch(status) {
      case 'active': return 'Activo';
      case 'expiring': return 'Por vencer';
      case 'expired': return 'Vencido';
      case 'available': return 'Disponible';
      default: return status;
    }
  }
};

// DOM utilities
export const domUtils = {
  showElement(selector) {
    const element = document.querySelector(selector);
    if (element) element.style.display = 'block';
  },

  hideElement(selector) {
    const element = document.querySelector(selector);
    if (element) element.style.display = 'none';
  },

  toggleClass(selector, className) {
    const element = document.querySelector(selector);
    if (element) element.classList.toggle(className);
  },

  addClass(selector, className) {
    const element = document.querySelector(selector);
    if (element) element.classList.add(className);
  },

  removeClass(selector, className) {
    const element = document.querySelector(selector);
    if (element) element.classList.remove(className);
  },

  setTextContent(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }
};

// Validation utilities
export const validators = {
  isEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  isValidPassword(password) {
    return password && password.length >= 6;
  },

  isEmpty(value) {
    return !value || (typeof value === 'string' && value.trim() === '');
  }
};

// Notification utilities
export const notifications = {
  show(message, type = 'info') {
    // Por ahora solo log, se puede expandir con UI
    console.log(`[${type.toUpperCase()}] ${message}`);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  warning(message) {
    this.show(message, 'warning');
  }
};

// Export all utilities as default object
export default {
  tokenManager,
  userManager,
  formatters,
  statusHelpers,
  domUtils,
  validators,
  notifications
};
