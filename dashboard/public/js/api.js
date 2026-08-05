import { tokenManager } from './utils.js';

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE;
  }

  getAuthHeaders() {
    const token = tokenManager.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado o inválido
          tokenManager.removeToken();
          window.location.href = '/';
        }
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async verifyAuth() {
    return this.request('/auth/verify', {
      method: 'GET'
    });
  }

  // Contracts endpoints
  async getContracts() {
    return this.request('/contracts', {
      method: 'GET'
    });
  }

  async getContractById(id) {
    return this.request(`/contracts/${id}`, {
      method: 'GET'
    });
  }

  async createContract(contractData) {
    return this.request('/contracts', {
      method: 'POST',
      body: JSON.stringify(contractData)
    });
  }

  async updateContract(id, contractData) {
    return this.request(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contractData)
    });
  }

  async deleteContract(id) {
    return this.request(`/contracts/${id}`, {
      method: 'DELETE'
    });
  }

  // Building endpoints
  async getBuilding() {
    return this.request('/building', {
      method: 'GET'
    });
  }

  async updateBuilding(buildingData) {
    return this.request('/building', {
      method: 'PUT',
      body: JSON.stringify(buildingData)
    });
  }
}

export default new ApiClient();
