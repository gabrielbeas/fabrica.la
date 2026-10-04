// 🔐 Sistema de Autenticación y Roles
// Gestiona login, logout y permisos de usuario

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// AUTENTICACIÓN
// ============================================

/**
 * Login con email y contraseña
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Obtener datos del usuario (rol, permisos)
    const userData = await getUserData(user.uid);

    // Solo entran usuarios dados de alta en Firestore y activos
    if (!userData || userData.activo === false) {
      await signOut(auth);
      localStorage.removeItem('currentUser');
      return { success: false, error: 'Usuario no autorizado. Contacta al administrador.' };
    }

    // Guardar en localStorage
    localStorage.setItem('currentUser', JSON.stringify({
      uid: user.uid,
      email: user.email,
      ...userData
    }));

    return { success: true, user };
  } catch (error) {
    console.error('Error en login:', error.code, error.message);
    const mensajes = {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/invalid-email': 'El correo no es válido.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
      'auth/network-request-failed': 'Sin conexión. Revisa tu internet.'
    };
    return { success: false, error: mensajes[error.code] || 'No se pudo iniciar sesión.' };
  }
}

/**
 * Logout
 */
export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem('currentUser');
    return { success: true };
  } catch (error) {
    console.error('Error en logout:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener usuario actual
 */
export function getCurrentUser() {
  const userJSON = localStorage.getItem('currentUser');
  return userJSON ? JSON.parse(userJSON) : null;
}

/**
 * Verificar si está autenticado
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Obtener rol del usuario actual
 */
export function getCurrentUserRole() {
  const user = getCurrentUser();
  return user ? user.rol : null;
}

// ============================================
// FIRESTORE - USUARIOS
// ============================================

/**
 * Obtener datos del usuario desde Firestore
 */
export async function getUserData(uid) {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    // Si no hay perfil en Firestore, el usuario no tiene acceso
    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error('Error obteniendo datos de usuario:', error);
    return null;
  }
}

/**
 * Verificar si usuario es admin
 */
export function esAdmin() {
  return getCurrentUserRole() === 'admin';
}

/**
 * Verificar si usuario es operario
 */
export function esOperario() {
  return getCurrentUserRole() === 'operario';
}

/**
 * Obtener secciones permitidas según rol
 */
/**
 * Ruta base del panel.
 * Local (python http.server en la raíz del repo): /admin/public/
 * Publicado (GitHub Pages): /admin/
 */
export function basePath() {
  const p = window.location.pathname;
  const i = p.indexOf('/admin/public/');
  return i >= 0 ? p.slice(0, i) + '/admin/public/' : '/admin/';
}

export function getSeccionesPermitidas() {
  const role = getCurrentUserRole();
  const b = basePath();

  const todas = {
    inicio:      { id: 'inicio',      nombre: 'Inicio',           url: b },
    locales:     { id: 'locales',     nombre: 'Contratos',        url: b + 'locales/' },
    facturacion: { id: 'facturacion', nombre: 'Facturación',      url: b + 'facturacion/' },
    agua:        { id: 'agua',        nombre: 'Lecturas de Agua', url: b + 'agua/lecturas.html' },
    calendarios: { id: 'calendarios', nombre: 'Calendarios',      url: b + 'calendarios/' },
    config:      { id: 'config',      nombre: 'Configuración',    url: b + 'config/' },
    cajaChica:   { id: 'cajaChica',   nombre: 'Caja Chica',       url: b + 'caja-chica/' },
    bitacora:    { id: 'bitacora',    nombre: 'Bitácora',         url: b + 'bitacora/' }
  };

  const porRol = {
    admin: ['inicio', 'locales', 'facturacion', 'agua', 'calendarios', 'config', 'cajaChica', 'bitacora'],
    operario: ['inicio', 'agua', 'calendarios', 'cajaChica', 'bitacora']
  };

  return (porRol[role] || []).map(id => todas[id]);
}

// ============================================
// MONITOREAR CAMBIOS DE AUTENTICACIÓN
// ============================================

/**
 * Escuchar cambios de estado de autenticación
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuario autenticado. Si no se puede leer el perfil (sin red), se conserva
      // la sesión con la copia guardada en vez de sacar al usuario.
      let userData;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        userData = snap.exists() ? snap.data() : null;
      } catch (error) {
        console.error('No se pudo verificar el perfil:', error);
        callback(getCurrentUser());
        return;
      }
      if (!userData || userData.activo === false) {
        await signOut(auth);
        localStorage.removeItem('currentUser');
        callback(null);
        return;
      }
      const currentUser = {
        uid: user.uid,
        email: user.email,
        ...userData
      };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      callback(currentUser);
    } else {
      // Usuario no autenticado
      localStorage.removeItem('currentUser');
      callback(null);
    }
  });
}

export { auth, db };
