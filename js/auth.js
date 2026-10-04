// 🔐 Sistema de Autenticación y Roles
// Gestiona login, logout y permisos de usuario

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
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
 * Crear usuario en Firestore (solo admin)
 */
export async function crearUsuario(uid, email, nombre, rol, permisos = []) {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      email,
      nombre,
      rol,
      permisos,
      createdAt: new Date(),
      activo: true
    });
    return { success: true };
  } catch (error) {
    console.error('Error creando usuario:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registrar nuevo operario (solo admin)
 */
export async function registrarOperario(email, password, nombre) {
  try {
    // Crear usuario en Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Crear documento en Firestore
    await crearUsuario(uid, email, nombre, 'operario', [
      'ver_lecturas',
      'crear_lecturas',
      'editar_lecturas_mes_actual',
      'ver_dashboard'
    ]);

    return { success: true, uid };
  } catch (error) {
    console.error('Error registrando operario:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CONTROL DE ACCESO
// ============================================

/**
 * Verificar si usuario tiene permiso
 */
export function tienePermiso(permiso) {
  const user = getCurrentUser();
  if (!user) return false;

  if (user.rol === 'admin') return true; // Admin tiene todos los permisos

  return user.permisos && user.permisos.includes(permiso);
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
    cajaChica:   { id: 'cajaChica',   nombre: 'Caja Chica',       url: b + 'caja-chica/' }
  };

  const porRol = {
    admin: ['inicio', 'locales', 'facturacion', 'agua', 'calendarios', 'config', 'cajaChica'],
    operario: ['inicio', 'agua', 'calendarios', 'cajaChica']
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
      // Usuario autenticado
      const userData = await getUserData(user.uid);
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
