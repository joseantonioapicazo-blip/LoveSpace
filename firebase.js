/**
 * Firebase Configuration Module
 * 
 * Este archivo contiene toda la configuración e inicialización de Firebase.
 * Reemplaza los valores de configuración con los de tu proyecto Firebase.
 */

// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyCYLpL86Xc9LJGNMuqo5IUejphHpWKpTTw",
  authDomain: "lovespace-e93ab.firebaseapp.com",
  projectId: "lovespace-e93ab",
  storageBucket: "lovespace-e93ab.firebasestorage.app",
  messagingSenderId: "445049925991",
  appId: "1:445049925991:web:781b4c4b6fd2b0e048ffc2",
  measurementId: "G-E8XCC7PSCQ"
};

// ============================================
// INICIALIZACIÓN DE FIREBASE
// ============================================
let auth, db, storage;

// Inicializar Firebase cuando el script cargue
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Cargar Firebase SDK desde CDN
    await loadFirebaseSDK();
    
    // Inicializar servicios
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    
    console.log('✓ Firebase inicializado correctamente');
    
    // Notificar que Firebase está listo
    document.dispatchEvent(new CustomEvent('firebaseReady'));
    
  } catch (error) {
    console.error('✗ Error al inicializar Firebase:', error);
    showNotification('Error al conectar con Firebase', 'error');
  }
});

// ============================================
// CARGAR FIREBASE SDK DESDE CDN
// ============================================
function loadFirebaseSDK() {
  return new Promise((resolve, reject) => {
    // Cargar Firebase App
    const appScript = document.createElement('script');
    appScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
    appScript.onload = () => {
      // Cargar Firebase Auth
      const authScript = document.createElement('script');
      authScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
      authScript.onload = () => {
        // Cargar Firestore
        const firestoreScript = document.createElement('script');
        firestoreScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
        firestoreScript.onload = () => {
          // Cargar Storage
          const storageScript = document.createElement('script');
          storageScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js';
          storageScript.onload = () => {
            // Inicializar Firebase con configuración
            firebase.initializeApp(firebaseConfig);
            resolve();
          };
          storageScript.onerror = reject;
          document.head.appendChild(storageScript);
        };
        firestoreScript.onerror = reject;
        document.head.appendChild(firestoreScript);
      };
      authScript.onerror = reject;
      document.head.appendChild(authScript);
    };
    appScript.onerror = reject;
    document.head.appendChild(appScript);
  });
}

// ============================================
// EXPORTAR SERVICIOS
// ============================================
function getAuth() {
  return auth;
}

function getDB() {
  return db;
}

function getStorage() {
  return storage;
}

// ============================================
// UTILIDADES DE FIREBASE
// ============================================

/**
 * Genera un código único de 6 caracteres para emparejar
 */
function generateCoupleCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Genera un ID único para documentos
 */
function generateId() {
  return db.collection('_').doc().id;
}

/**
 * Formatea fecha de Firestore
 */
function formatFirestoreDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatea fecha y hora de Firestore
 */
function formatFirestoreDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
