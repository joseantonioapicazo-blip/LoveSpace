/**
 * LoveSpace - Aplicación Principal
 * Módulos organizados para facilitar el mantenimiento y escalabilidad
 */

// ============================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================
const AppState = {
  currentUser: null,
  userData: null,
  coupleData: null,
  coupleId: null,
  currentSection: 'home',
  currentMonth: new Date(),
  counterInterval: null,
  listeners: []
};

// ============================================
// ESPERAR A QUE FIREBASE ESTÉ LISTO
// ============================================
document.addEventListener('firebaseReady', () => {
  console.log('✓ Firebase listo, inicializando aplicación...');
  initializeApp();
});

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================
function initializeApp() {
  // Ocultar pantalla de carga
  setTimeout(() => {
    document.getElementById('loadingScreen').classList.add('hidden');
  }, 1000);
  
  // Configurar listeners de autenticación
  setupAuthListeners();
  
  // Configurar navegación
  setupNavigation();
  
  // Configurar modales
  setupModals();
  
  // Configurar formularios
  setupForms();
  
  // Cargar configuración guardada
  loadSettings();
  
  console.log('✓ Aplicación inicializada');
}

// ============================================
// MÓDULO DE AUTENTICACIÓN
// ============================================
function setupAuthListeners() {
  const auth = getAuth();
  
  // Listener de estado de autenticación
  auth.onAuthStateChanged(async (user) => {
    console.log('AUTH USER:', user);
    if (user) {
      AppState.currentUser = user;
      console.log('✓ Usuario autenticado:', user.email);
      
      // Iniciar listener principal de datos de usuario en tiempo real
      listenToUserData(user.uid);
      
      // La pantalla correcta se mostrará automáticamente cuando el listener reciba los primeros datos
    } else {
      AppState.currentUser = null;
      AppState.userData = null;
      AppState.coupleData = null;
      AppState.coupleId = null;
      showAuthScreen();
    }
  });
  
  // Botón de inicio de sesión con Google
  document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
  
  // Botón de cerrar sesión
  document.getElementById('signOutBtn').addEventListener('click', signOut);
}

async function signInWithGoogle() {
  try {
    const auth = getAuth();
    const provider = new firebase.auth.GoogleAuthProvider();
    
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Verificar si el usuario ya existe en Firestore
    const db = getDB();
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      // Crear nuevo usuario con código de pareja único
      const coupleCode = generateCoupleCode();
      
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        nombre: user.displayName,
        foto: user.photoURL,
        email: user.email,
        codigo: coupleCode,
        pareja: null,
        coupleId: null,
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✓ Nuevo usuario creado con código:', coupleCode);
    }
    
    showNotification('¡Bienvenido a LoveSpace!', 'success');
    
  } catch (error) {
    console.error('✗ Error al iniciar sesión:', error);
    showNotification('Error al iniciar sesión', 'error');
  }
}

async function signOut() {
  try {
    const auth = getAuth();
    await auth.signOut();
    
    // Limpiar todos los listeners activos
    AppState.listeners.forEach(unsubscribe => unsubscribe());
    AppState.listeners = [];
    
    // Limpiar estado
    AppState.currentUser = null;
    AppState.userData = null;
    AppState.coupleData = null;
    AppState.coupleId = null;
    
    // Detener contador
    if (AppState.counterInterval) {
      clearInterval(AppState.counterInterval);
    }
    
    showNotification('Sesión cerrada', 'success');
    
  } catch (error) {
    console.error('✗ Error al cerrar sesión:', error);
    showNotification('Error al cerrar sesión', 'error');
  }
}

async function loadUserData(uid) {
  try {
    const db = getDB();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Verificar si el usuario tiene código, si no, generar uno
      if (!userData.codigo) {
        const coupleCode = generateCoupleCode();
        await db.collection('users').doc(uid).update({
          codigo: coupleCode
        });
        userData.codigo = coupleCode;
        console.log('✓ Código de pareja generado:', coupleCode);
      }
      
      AppState.userData = userData;
      console.log('✓ Datos del usuario cargados');
    }
  } catch (error) {
    console.error('✗ Error al cargar datos del usuario:', error);
  }
}

// ============================================
// LISTENER PRINCIPAL DE DATOS DE USUARIO EN TIEMPO REAL
// ============================================
function listenToUserData(uid) {
  const db = getDB();
  
  const unsubscribe = db.collection('users').doc(uid).onSnapshot(async (doc) => {
    if (!doc.exists) {
      console.log('✗ Documento de usuario no existe');
      return;
    }
    
    const data = doc.data();
    console.log('📡 Datos de usuario actualizados:', data);
    
    // Verificar si el usuario tiene código, si no, generar uno
    if (!data.codigo) {
      const coupleCode = generateCoupleCode();
      await db.collection('users').doc(uid).update({
        codigo: coupleCode
      });
      data.codigo = coupleCode;
      console.log('✓ Código de pareja generado:', coupleCode);
    }
    
    // Actualizar AppState.userData
    const previousCoupleId = AppState.userData?.coupleId;
    const previousPareja = AppState.userData?.pareja;
    
    AppState.userData = data;
    
    // Detectar cambios en coupleId
    const currentCoupleId = data.coupleId;
    
    if (currentCoupleId && !previousCoupleId) {
      // Se creó un coupleId (se aceptó una solicitud)
      console.log('✓ coupleId creado:', currentCoupleId);
      AppState.coupleId = currentCoupleId;
      await loadCoupleData(currentCoupleId);
      showMainApp();
    } else if (!currentCoupleId && previousCoupleId) {
      // Se eliminó el coupleId (se desvinculó la pareja)
      console.log('✓ coupleId eliminado');
      AppState.coupleId = null;
      AppState.coupleData = null;
      showPairingScreen();
    } else if (currentCoupleId && currentCoupleId !== previousCoupleId) {
      // Cambió el coupleId (caso raro, pero posible)
      console.log('✓ coupleId cambiado:', currentCoupleId);
      AppState.coupleId = currentCoupleId;
      await loadCoupleData(currentCoupleId);
      showMainApp();
    }
    
    // Detectar solicitudes de pareja pendientes
    const currentPareja = data.pareja;
    
    if (currentPareja && currentPareja.status === 'pending' && currentPareja.from) {
      // Hay una solicitud pendiente
      console.log('📨 Solicitud de pareja pendiente de:', currentPareja.fromName);
      const incomingRequestEl = document.getElementById('incomingRequest');
      const requesterNameEl = document.getElementById('requesterName');
      
      if (incomingRequestEl) {
        incomingRequestEl.classList.remove('hidden');
      }
      if (requesterNameEl) {
        requesterNameEl.textContent = currentPareja.fromName;
      }
    } else if (previousPareja && previousPareja.status === 'pending' && (!currentPareja || currentPareja.status !== 'pending')) {
      // Se rechazó o se aceptó la solicitud
      console.log('✓ Solicitud de pareja resuelta');
      const incomingRequestEl = document.getElementById('incomingRequest');
      if (incomingRequestEl) {
        incomingRequestEl.classList.add('hidden');
      }
    }
    
    // Si estamos en la pantalla de emparejamiento y no hay coupleId, actualizar el código mostrado
    if (!currentCoupleId && data.codigo) {
      const myCoupleCodeEl = document.getElementById('myCoupleCode');
      if (myCoupleCodeEl) {
        myCoupleCodeEl.textContent = data.codigo;
      }
    }
  }, (error) => {
    console.error('✗ Error en listener de usuario:', error);
  });
  
  // Guardar unsubscribe para limpieza posterior
  AppState.listeners.push(unsubscribe);
  console.log('✓ Listener de usuario configurado');
  
  return unsubscribe;
}

async function loadCoupleData(coupleId) {
  try {
    const db = getDB();
    const coupleDoc = await db.collection('couples').doc(coupleId).get();
    
    if (coupleDoc.exists) {
      AppState.coupleData = coupleDoc.data();
      console.log('✓ Datos de la pareja cargados');
      
      // Iniciar contador
      startCounter();
      
      // Cargar evento mensual
      loadMonthlyEvent();
      
      // Cargar estadísticas
      loadStatistics();
    }
  } catch (error) {
    console.error('✗ Error al cargar datos de la pareja:', error);
  }
}

// ============================================
// MÓDULO DE EMPAREJAMIENTO
// ============================================
function showPairingScreen() {
  hideAllScreens();
  document.getElementById('pairingScreen').classList.remove('hidden');
  
  console.log('ANTES DE showPairingScreen');
  console.log('CONTENIDO ACTUAL DEL HTML:', document.getElementById('myCoupleCode')?.textContent);
  
  // Mostrar código del usuario
  if (AppState.userData) {
    document.getElementById('myCoupleCode').textContent = AppState.userData.codigo;
  }
  
  // Configurar listeners de emparejamiento
  setupPairingListeners();
}

// Flag para evitar listeners duplicados
let pairingListenersSetup = false;

function setupPairingListeners() {
  // Evitar registrar listeners múltiples veces
  if (pairingListenersSetup) {
    console.log('Listeners de emparejamiento ya configurados');
    return;
  }
  
  // Verificar que los elementos existan
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const regenerateCodeBtn = document.getElementById('regenerateCodeBtn');
  const sendRequestBtn = document.getElementById('sendRequestBtn');
  const cancelRequestBtn = document.getElementById('cancelRequestBtn');
  const acceptRequestBtn = document.getElementById('acceptRequestBtn');
  const rejectRequestBtn = document.getElementById('rejectRequestBtn');
  
  if (!copyCodeBtn || !regenerateCodeBtn || !sendRequestBtn || !cancelRequestBtn || !acceptRequestBtn || !rejectRequestBtn) {
    console.error('✗ Faltan elementos HTML para configurar listeners de emparejamiento');
    return;
  }
  
  // Copiar código con fallback
  copyCodeBtn.addEventListener('click', () => {
    if (!AppState.userData || !AppState.userData.codigo) {
      showNotification('No hay código disponible', 'error');
      return;
    }
    
    const code = AppState.userData.codigo;
    
    // Intentar usar navigator.clipboard primero
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showNotification('Código copiado al portapapeles', 'success');
      }).catch((err) => {
        console.error('Error con navigator.clipboard:', err);
        // Fallback a método antiguo
        fallbackCopyTextToClipboard(code);
      });
    } else {
      // Fallback directo para navegadores antiguos
      fallbackCopyTextToClipboard(code);
    }
  });
  
  // Regenerar código
  regenerateCodeBtn.addEventListener('click', async () => {
    if (!confirm('¿Estás seguro de que quieres generar un nuevo código? Tu código actual dejará de ser válido.')) {
      return;
    }
    
    try {
      const db = getDB();
      const newCode = generateCoupleCode();
      
      await db.collection('users').doc(AppState.currentUser.uid).update({
        codigo: newCode
      });
      
      AppState.userData.codigo = newCode;
      const myCoupleCodeEl = document.getElementById('myCoupleCode');
      if (myCoupleCodeEl) {
        myCoupleCodeEl.textContent = newCode;
      }
      
      showNotification('Nuevo código generado: ' + newCode, 'success');
    } catch (error) {
      console.error('✗ Error al regenerar código:', error);
      showNotification('Error al regenerar código', 'error');
    }
  });
  
  // Enviar solicitud
  sendRequestBtn.addEventListener('click', sendPairRequest);
  
  // Cancelar solicitud
  cancelRequestBtn.addEventListener('click', cancelPairRequest);
  
  // Aceptar solicitud
  acceptRequestBtn.addEventListener('click', acceptPairRequest);
  
  // Rechazar solicitud
  rejectRequestBtn.addEventListener('click', rejectPairRequest);
  
  // NOTA: Ya no necesitamos llamar a listenForIncomingRequests()
  // El listener principal listenToUserData() maneja la detección de solicitudes pendientes
  
  // Marcar como configurado
  pairingListenersSetup = true;
  console.log('✓ Listeners de emparejamiento configurados');
}

// Función de fallback para copiar al portapapeles
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Evitar scroll al textarea
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showNotification('Código copiado al portapapeles', 'success');
    } else {
      showNotification('Error al copiar código', 'error');
    }
  } catch (err) {
    console.error('✗ Error al copiar con fallback:', err);
    showNotification('Error al copiar código', 'error');
  }
  
  document.body.removeChild(textArea);
}

async function sendPairRequest() {
  const partnerCodeInput = document.getElementById('partnerCodeInput');
  if (!partnerCodeInput) {
    console.error('✗ Elemento partnerCodeInput no encontrado');
    showNotification('Error: elemento de entrada no encontrado', 'error');
    return;
  }
  
  const partnerCode = partnerCodeInput.value.toUpperCase().trim();
  
  if (partnerCode.length !== 6) {
    showNotification('El código debe tener 6 caracteres', 'error');
    return;
  }
  
  if (!AppState.userData || !AppState.userData.codigo) {
    showNotification('Error: no hay código de usuario disponible', 'error');
    return;
  }
  
  if (partnerCode === AppState.userData.codigo) {
    showNotification('No puedes usar tu propio código', 'error');
    return;
  }
  
  try {
    const db = getDB();
    
    // Buscar usuario con ese código
    const usersSnapshot = await db.collection('users')
      .where('codigo', '==', partnerCode)
      .where('pareja', '==', null)
      .get();
    
    if (usersSnapshot.empty) {
      showNotification('Código no válido o el usuario ya tiene pareja', 'error');
      return;
    }
    
    const partnerDoc = usersSnapshot.docs[0];
    const partnerId = partnerDoc.id;
    const partnerData = partnerDoc.data();
    
    // Enviar solicitud
    await db.collection('users').doc(partnerId).update({
      pareja: {
        from: AppState.currentUser.uid,
        fromName: AppState.userData.nombre,
        fromPhoto: AppState.userData.foto,
        status: 'pending'
      }
    });
    
    // Mostrar estado pendiente
    const pendingRequestEl = document.getElementById('pendingRequest');
    const sendRequestBtnEl = document.getElementById('sendRequestBtn');
    
    if (pendingRequestEl) {
      pendingRequestEl.classList.remove('hidden');
    }
    if (partnerCodeInput) {
      partnerCodeInput.disabled = true;
    }
    if (sendRequestBtnEl) {
      sendRequestBtnEl.disabled = true;
    }
    
    showNotification('Solicitud enviada', 'success');
    
  } catch (error) {
    console.error('✗ Error al enviar solicitud:', error);
    showNotification('Error al enviar solicitud', 'error');
  }
}

async function cancelPairRequest() {
  try {
    const db = getDB();
    
    // Buscar usuario con solicitud pendiente
    const usersSnapshot = await db.collection('users')
      .where('pareja.from', '==', AppState.currentUser.uid)
      .get();
    
    if (!usersSnapshot.empty) {
      const partnerDoc = usersSnapshot.docs[0];
      await partnerDoc.ref.update({
        pareja: null
      });
    }
    
    const pendingRequestEl = document.getElementById('pendingRequest');
    const partnerCodeInputEl = document.getElementById('partnerCodeInput');
    const sendRequestBtnEl = document.getElementById('sendRequestBtn');
    
    if (pendingRequestEl) {
      pendingRequestEl.classList.add('hidden');
    }
    if (partnerCodeInputEl) {
      partnerCodeInputEl.disabled = false;
    }
    if (sendRequestBtnEl) {
      sendRequestBtnEl.disabled = false;
    }
    
    showNotification('Solicitud cancelada', 'success');
    
  } catch (error) {
    console.error('✗ Error al cancelar solicitud:', error);
  }
}

// ============================================
// FUNCIÓN OBSOLETA - Funcionalidad integrada en listenToUserData()
// ============================================
function listenForIncomingRequests() {
  // Esta función es obsoleta. Su funcionalidad ha sido integrada en listenToUserData()
  // que escucha todos los cambios en el documento del usuario en tiempo real.
  console.warn('⚠️ listenForIncomingRequests() es obsoleta. Usar listenToUserData() en su lugar.');
}

async function acceptPairRequest() {
  try {
    const db = getDB();
    const userDoc = await db.collection('users').doc(AppState.currentUser.uid).get();
    const userData = userDoc.data();
    const partnerId = userData.pareja.from;
    
    // Generar nuevo coupleId
    const coupleId = generateId();
    
    // Crear documento de pareja
    await db.collection('couples').doc(coupleId).set({
      coupleId: coupleId,
      users: [AppState.currentUser.uid, partnerId],
      aniversario: null,
      primeraCita: null,
      primerBeso: null,
      cancionFavorita: null,
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Actualizar ambos usuarios
    await db.collection('users').doc(AppState.currentUser.uid).update({
      pareja: null,
      coupleId: coupleId
    });
    
    await db.collection('users').doc(partnerId).update({
      pareja: null,
      coupleId: coupleId
    });
    
    showNotification('¡Pareja conectada!', 'success');
    
    // NOTA: Ya no necesitamos llamar manualmente a loadCoupleData() y showMainApp()
    // El listener principal listenToUserData() detectará el cambio en coupleId
    // y ejecutará esas acciones automáticamente para ambos usuarios
    
  } catch (error) {
    console.error('✗ Error al aceptar solicitud:', error);
    showNotification('Error al aceptar solicitud', 'error');
  }
}

async function rejectPairRequest() {
  try {
    const db = getDB();
    
    await db.collection('users').doc(AppState.currentUser.uid).update({
      pareja: null
    });
    
    const incomingRequestEl = document.getElementById('incomingRequest');
    if (incomingRequestEl) {
      incomingRequestEl.classList.add('hidden');
    }
    
    showNotification('Solicitud rechazada', 'success');
    
  } catch (error) {
    console.error('✗ Error al rechazar solicitud:', error);
  }
}

async function unlinkPartner() {
  if (!confirm('¿Estás seguro de que quieres desvincular a tu pareja? Esta acción no se puede deshacer.')) {
    return;
  }
  
  try {
    const db = getDB();
    const coupleId = AppState.coupleId;
    
    // Obtener datos de la pareja
    const coupleDoc = await db.collection('couples').doc(coupleId).get();
    const coupleData = coupleDoc.data();
    const users = coupleData.users;
    
    // Actualizar ambos usuarios
    for (const userId of users) {
      await db.collection('users').doc(userId).update({
        coupleId: null,
        codigo: generateCoupleCode()
      });
    }
    
    // Eliminar documento de pareja
    await db.collection('couples').doc(coupleId).delete();
    
    AppState.coupleId = null;
    AppState.coupleData = null;
    
    showNotification('Pareja desvinculada', 'success');
    showPairingScreen();
    
  } catch (error) {
    console.error('✗ Error al desvincular pareja:', error);
    showNotification('Error al desvincular pareja', 'error');
  }
}

// ============================================
// NAVEGACIÓN
// ============================================
function setupNavigation() {
  // Navegación inferior (móvil)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      navigateTo(section);
    });
  });

  // Navegación lateral (desktop)
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      navigateTo(section);
    });
  });

  // Accesos rápidos
  const quickAccessCards = document.querySelectorAll('.quick-access-card');
  quickAccessCards.forEach(card => {
    card.addEventListener('click', () => {
      const section = card.dataset.section;
      navigateTo(section);
    });
  });
}

function navigateTo(section) {
  // Actualizar estado
  AppState.currentSection = section;

  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });

  // Mostrar sección seleccionada
  const targetSection = document.getElementById(section + 'Section');
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Actualizar navegación inferior (móvil)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === section) {
      item.classList.add('active');
    }
  });

  // Actualizar navegación lateral (desktop)
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === section) {
      item.classList.add('active');
    }
  });

  // Cargar datos específicos de la sección
  loadSectionData(section);
}

function loadSectionData(section) {
  switch (section) {
    case 'home':
      loadHomeData();
      break;
    case 'calendar':
      loadCalendar();
      break;
    case 'album':
      loadAlbum();
      break;
    case 'notes':
      loadNotes();
      break;
    case 'thoughts':
      loadThoughts();
      break;
    case 'poems':
      loadPoems();
      break;
    case 'letters':
      loadLetters();
      break;
    case 'location':
      loadLocation();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'event':
      loadEventSection();
      break;
  }
}

// ============================================
// PANTALLAS
// ============================================
function showAuthScreen() {
  hideAllScreens();
  document.getElementById('authScreen').classList.remove('hidden');
}

function showMainApp() {
  hideAllScreens();
  document.getElementById('mainApp').classList.remove('hidden');
  
  // Cargar datos del home
  loadHomeData();
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('mainApp').classList.add('hidden');
}

// ============================================
// HOME DASHBOARD
// ============================================
function loadHomeData() {
  if (!AppState.coupleData) return;
  
  // Actualizar nombre de usuario
  document.getElementById('userName').textContent = AppState.userData.nombre.split(' ')[0];
  
  // Actualizar fotos de la pareja
  const users = AppState.coupleData.users || [];
  if (users.length === 2) {
    // Cargar fotos de ambos usuarios
    loadCouplePhotos(users);
  }
  
  // Actualizar nombres de la pareja
  loadCoupleNames(users);
  
  // Actualizar fecha de aniversario
  if (AppState.coupleData.aniversario) {
    const anniversaryDate = AppState.coupleData.aniversario.toDate();
    document.getElementById('togetherSince').textContent = 
      `Juntos desde ${anniversaryDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  
  // Cargar actividad reciente
  loadRecentActivity();
}

async function loadCouplePhotos(users) {
  try {
    const db = getDB();
    
    const user1Doc = await db.collection('users').doc(users[0]).get();
    const user2Doc = await db.collection('users').doc(users[1]).get();
    
    if (user1Doc.exists && user2Doc.exists) {
      const user1Data = user1Doc.data();
      const user2Data = user2Doc.data();
      
      document.getElementById('user1Photo').src = user1Data.foto || '';
      document.getElementById('user2Photo').src = user2Data.foto || '';
      document.getElementById('headerUserPhoto').src = AppState.userData.foto || '';
    }
  } catch (error) {
    console.error('✗ Error al cargar fotos:', error);
  }
}

async function loadCoupleNames(users) {
  try {
    const db = getDB();
    
    const user1Doc = await db.collection('users').doc(users[0]).get();
    const user2Doc = await db.collection('users').doc(users[1]).get();
    
    if (user1Doc.exists && user2Doc.exists) {
      const user1Data = user1Doc.data();
      const user2Data = user2Doc.data();
      
      const name1 = user1Data.nombre.split(' ')[0];
      const name2 = user2Data.nombre.split(' ')[0];
      
      document.getElementById('coupleNames').textContent = `${name1} & ${name2}`;
    }
  } catch (error) {
    console.error('✗ Error al cargar nombres:', error);
  }
}

async function loadRecentActivity() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const activityList = document.getElementById('recentActivityList');
    
    // Obtener actividad reciente (pensamientos, fotos, notas)
    const thoughtsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('pensamientos')
      .orderBy('fecha', 'desc')
      .limit(5)
      .get();
    
    const photosSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('fotos')
      .orderBy('fecha', 'desc')
      .limit(5)
      .get();
    
    const notesSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('notas')
      .orderBy('fecha', 'desc')
      .limit(5)
      .get();
    
    // Combinar y ordenar por fecha
    const activities = [];
    
    thoughtsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'thought',
        icon: '💭',
        text: `Nuevo pensamiento de ${data.autorNombre}`,
        date: data.fecha
      });
    });
    
    photosSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'photo',
        icon: '📸',
        text: `Nueva foto de ${data.autorNombre}`,
        date: data.fecha
      });
    });
    
    notesSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'note',
        icon: '📝',
        text: `Nueva nota de ${data.autorNombre}`,
        date: data.fecha
      });
    });
    
    // Ordenar por fecha
    activities.sort((a, b) => b.date - a.date);
    
    // Mostrar actividades
    if (activities.length > 0) {
      activityList.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="activity-item">
          <div class="activity-icon">${activity.icon}</div>
          <div class="activity-content">
            <p>${activity.text}</p>
            <span>${formatFirestoreDateTime(activity.date)}</span>
          </div>
        </div>
      `).join('');
    } else {
      activityList.innerHTML = '<p class="empty-state">No hay actividad reciente</p>';
    }
    
  } catch (error) {
    console.error('✗ Error al cargar actividad reciente:', error);
  }
}

// ============================================
// CONTADOR DE TIEMPO
// ============================================
function startCounter() {
  if (!AppState.coupleData || !AppState.coupleData.aniversario) {
    return;
  }
  
  const anniversaryDate = AppState.coupleData.aniversario.toDate();
  
  // Actualizar contador inmediatamente
  updateCounter(anniversaryDate);
  
  // Actualizar cada segundo
  AppState.counterInterval = setInterval(() => {
    updateCounter(anniversaryDate);
  }, 1000);
}

function updateCounter(anniversaryDate) {
  const now = new Date();
  const diff = now - anniversaryDate;
  
  // Calcular tiempo
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30)) % 12;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) % 30;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const seconds = Math.floor(diff / 1000) % 60;
  
  // Actualizar DOM
  document.getElementById('counterYears').textContent = years;
  document.getElementById('counterMonths').textContent = months;
  document.getElementById('counterDays').textContent = days;
  document.getElementById('counterHours').textContent = hours;
  document.getElementById('counterMinutes').textContent = minutes;
  document.getElementById('counterSeconds').textContent = seconds;
}

// ============================================
// CALENDARIO
// ============================================
function loadCalendar() {
  renderCalendar();
  
  // Listeners de navegación
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() - 1);
    renderCalendar();
  });
  
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    AppState.currentMonth.setMonth(AppState.currentMonth.getMonth() + 1);
    renderCalendar();
  });
}

async function renderCalendar() {
  const year = AppState.currentMonth.getFullYear();
  const month = AppState.currentMonth.getMonth();
  
  // Actualizar título
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;
  
  // Calcular días del mes
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  
  // Cargar eventos del mes
  const events = await loadMonthEvents(year, month);
  
  // Renderizar días
  const calendarDays = document.getElementById('calendarDays');
  calendarDays.innerHTML = '';
  
  // Días vacíos antes del primer día
  for (let i = 0; i < startingDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    calendarDays.appendChild(emptyDay);
  }
  
  // Días del mes
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    dayElement.textContent = day;
    
    // Marcar hoy
    if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
      dayElement.classList.add('today');
    }
    
    // Marcar días con eventos
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (events[dateStr] && events[dateStr].length > 0) {
      dayElement.classList.add('has-event');
    }
    
    // Click para ver eventos del día
    dayElement.addEventListener('click', () => showDayEvents(dateStr, events[dateStr] || []));
    
    calendarDays.appendChild(dayElement);
  }
}

async function loadMonthEvents(year, month) {
  if (!AppState.coupleId) return {};
  
  try {
    const db = getDB();
    const eventsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('calendario')
      .where('fecha', '>=', new Date(year, month, 1))
      .where('fecha', '<=', new Date(year, month + 1, 0))
      .get();
    
    const events = {};
    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      const dateStr = data.fecha.toDate().toISOString().split('T')[0];
      if (!events[dateStr]) {
        events[dateStr] = [];
      }
      events[dateStr].push(data);
    });
    
    return events;
    
  } catch (error) {
    console.error('✗ Error al cargar eventos:', error);
    return {};
  }
}

function showDayEvents(dateStr, events) {
  const dayEventsCard = document.getElementById('selectedDayEvents');
  const dayEventsList = document.getElementById('dayEventsList');
  const selectedDateTitle = document.getElementById('selectedDateTitle');
  
  // Formatear fecha
  const date = new Date(dateStr);
  selectedDateTitle.textContent = date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  
  // Mostrar eventos
  if (events.length > 0) {
    dayEventsList.innerHTML = events.map(event => `
      <div class="day-event-item">
        <div class="day-event-color" style="background: ${event.color}"></div>
        <div class="day-event-info">
          <h4>${event.titulo}</h4>
          <p>${event.descripcion || ''}</p>
        </div>
      </div>
    `).join('');
  } else {
    dayEventsList.innerHTML = '<p class="empty-state">No hay eventos este día</p>';
  }
  
  dayEventsCard.classList.remove('hidden');
}

// ============================================
// SISTEMA DE EVENTOS MENSUALES (FEATURE PRINCIPAL)
// ============================================
const monthlyEvents = [
  {
    month: 0,
    title: 'Preguntas profundas',
    description: 'Contesten estas preguntas profundas sobre su relación y luego compartan sus respuestas.',
    type: 'questions',
    questions: [
      '¿Qué fue lo primero que te atrayó de mí?',
      '¿Cuál es tu recuerdo favorito de nosotros?',
      '¿Qué te hace sentir más amado/a?',
      '¿Cuál es tu mayor miedo en nuestra relación?',
      '¿Qué te gustaría que hiciéramos más juntos?'
    ]
  },
  {
    month: 1,
    title: 'Verdad o Reto',
    description: 'Túrnense para hacerse preguntas divertidas o completar retos románticos.',
    type: 'truth_dare',
    truths: [
      '¿Cuál fue tu momento más vergonzoso conmigo?',
      '¿Qué es lo que más te gusta de mi apariencia?',
      '¿Alguna vez has mentido sobre algo pequeño? ¿Qué fue?',
      '¿Cuál es tu fantasía romántica?'
    ],
    dares: [
      'Escribe una carta de amor de 10 líneas',
      'Canta una canción romántica',
      'Dame 10 besos seguidos',
      'Prepara mi comida favorita'
    ]
  },
  {
    month: 2,
    title: 'Recrear una foto',
    description: 'Encuentren una foto antigua de ustedes y recréenla exactamente igual.',
    type: 'photo_challenge',
    instructions: 'Busquen una foto de cuando empezaron a salir o de un momento especial y recréenla con la misma pose, lugar y ropa si es posible.'
  },
  {
    month: 3,
    title: 'Playlist compartida',
    description: 'Creen una playlist juntos con 10 canciones que representen su relación.',
    type: 'playlist',
    instructions: 'Cada uno elige 5 canciones que les recuerden momentos especiales de su relación. Compartan la playlist y escúchenla juntos.'
  },
  {
    month: 4,
    title: 'Carta para el futuro',
    description: 'Escriban una carta para leerla dentro de un año.',
    type: 'future_letter',
    instructions: 'Escriban una carta para su pareja, expresando sus sentimientos actuales y esperanzas para el futuro. Guárdenla en la sección de Cartas para abrir el próximo año.'
  },
  {
    month: 5,
    title: 'Cocinar juntos',
    description: 'Preparen una cena especial juntos, siguiendo una receta nueva.',
    type: 'cooking',
    instructions: 'Elijan una receta que nunca hayan preparado antes y cóctenla juntos. Tomen fotos del proceso y del resultado final.'
  },
  {
    month: 6,
    title: 'Dibujo compartido',
    description: 'Dibujen algo juntos, cada uno añadiendo partes al dibujo.',
    type: 'drawing',
    instructions: 'Empiecen uno con un trazo, luego el otro continúa. Alternen hasta crear una obra de arte juntos.'
  },
  {
    month: 7,
    title: 'Película del mes',
    description: 'Vean una película juntos y compartan sus opiniones.',
    type: 'movie',
    instructions: 'Elijan una película que ambos quieran ver. Después, compartan qué les gustó, qué no, y qué escenas les recordaron a su relación.'
  },
  {
    month: 8,
    title: 'Explorar un lugar nuevo',
    description: 'Visiten un lugar nuevo juntos (parque, restaurante, ciudad, etc.).',
    type: 'exploration',
    instructions: 'Elijan un lugar donde nunca hayan estado juntos y visitenlo. Tomen fotos y compartan su experiencia.'
  },
  {
    month: 9,
    title: 'Adivinar respuestas',
    description: 'Intenten adivinar cómo respondería la pareja a ciertas preguntas.',
    type: 'guessing',
    questions: [
      '¿Cuál es mi comida favorita?',
      '¿Qué me da más miedo?',
      '¿Cuál es mi mayor sueño?',
      '¿Qué es lo que más valoro de ti?',
      '¿Cuál sería mi destino ideal de vacaciones?'
    ]
  },
  {
    month: 10,
    title: 'Cuestionario de amor',
    description: 'Completen este cuestionario sobre su relación.',
    type: 'quiz',
    questions: [
      '¿En qué fecha nos conocimos?',
      '¿Cuál fue nuestra primera cita?',
      '¿Qué me regalaste en nuestro primer aniversario?',
      '¿Cuál es mi canción favorita?',
      '¿Qué es lo que más me hace reír?'
    ]
  },
  {
    month: 11,
    title: 'Actividad sorpresa',
    description: 'Planeen una sorpresa especial para el otro.',
    type: 'surprise',
    instructions: 'Cada uno planea una sorpresa pequeña para el otro. Puede ser un regalo, una actividad especial, o un gesto romántico.'
  }
];

async function loadMonthlyEvent() {
  if (!AppState.coupleId) return;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Verificar si ya completaron el evento de este mes
  const db = getDB();
  const eventDoc = await db.collection('couples').doc(AppState.coupleId)
    .collection('eventos')
    .doc(`${currentYear}-${currentMonth}`)
    .get();
  
  const eventData = eventDoc.exists ? eventDoc.data() : null;
  const eventTemplate = monthlyEvents[currentMonth];
  
  // Actualizar UI del home
  document.getElementById('eventTitle').textContent = eventTemplate.title;
  document.getElementById('eventDescription').textContent = eventTemplate.description;
  
  if (eventData && eventData.completado) {
    document.getElementById('eventBadge').textContent = 'Completado';
    document.getElementById('openEventBtn').textContent = 'Ver detalles';
  } else {
    document.getElementById('eventBadge').textContent = 'Nuevo';
    document.getElementById('openEventBtn').textContent = 'Completar evento';
  }
  
  // Listener para abrir evento
  document.getElementById('openEventBtn').addEventListener('click', () => {
    openEventModal(eventTemplate, eventData);
  });
}

function loadEventSection() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const eventTemplate = monthlyEvents[currentMonth];
  
  // Actualizar información del evento actual
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  document.getElementById('currentEventMonth').textContent = monthNames[currentMonth];
  document.getElementById('currentEventTitle').textContent = eventTemplate.title;
  document.getElementById('currentEventDescription').textContent = eventTemplate.description;
  
  const typeLabels = {
    questions: 'Preguntas',
    truth_dare: 'Verdad o Reto',
    photo_challenge: 'Fotografía',
    playlist: 'Música',
    future_letter: 'Carta',
    cooking: 'Cocina',
    drawing: 'Arte',
    movie: 'Cine',
    exploration: 'Aventura',
    guessing: 'Adivinanza',
    quiz: 'Cuestionario',
    surprise: 'Sorpresa'
  };
  document.getElementById('currentEventType').textContent = typeLabels[eventTemplate.type] || 'Actividad';
  
  // Cargar estado del evento
  loadEventStatus(currentYear, currentMonth);
  
  // Cargar historial
  loadEventHistory();
  
  // Cargar insignias
  loadBadges();
  
  // Listener para comenzar evento
  document.getElementById('startEventBtn').addEventListener('click', () => {
    openEventModal(eventTemplate, null);
  });
}

async function loadEventStatus(year, month) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const eventDoc = await db.collection('couples').doc(AppState.coupleId)
      .collection('eventos')
      .doc(`${year}-${month}`)
      .get();
    
    if (eventDoc.exists) {
      const eventData = eventDoc.data();
      document.getElementById('currentEventStatus').textContent = eventData.completado ? 'Completado' : 'En progreso';
      
      if (eventData.completado) {
        document.getElementById('eventActionArea').innerHTML = `
          <button class="btn btn-secondary btn-full" disabled>Evento completado</button>
        `;
      }
    } else {
      document.getElementById('currentEventStatus').textContent = 'Pendiente';
    }
  } catch (error) {
    console.error('✗ Error al cargar estado del evento:', error);
  }
}

async function loadEventHistory() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const eventsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('eventos')
      .orderBy('fecha', 'desc')
      .get();
    
    const eventHistoryList = document.getElementById('eventHistoryList');
    
    if (eventsSnapshot.empty) {
      eventHistoryList.innerHTML = '<p class="empty-state">No hay eventos completados aún</p>';
      return;
    }
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    eventHistoryList.innerHTML = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      const [year, month] = doc.id.split('-');
      const eventTemplate = monthlyEvents[parseInt(month)];
      
      return `
        <div class="event-history-item">
          <div class="event-history-icon">🎁</div>
          <div class="event-history-info">
            <h4>${eventTemplate.title}</h4>
            <p>${monthNames[parseInt(month)]} ${year}</p>
          </div>
          ${data.completado ? '<span class="event-badge">✓</span>' : ''}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar historial de eventos:', error);
  }
}

async function loadBadges() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const badgesSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('insignias')
      .get();
    
    const badgesList = document.getElementById('badgesList');
    
    if (badgesSnapshot.empty) {
      badgesList.innerHTML = '<p class="empty-state">Completa eventos para ganar insignias</p>';
      return;
    }
    
    const badgeIcons = {
      'first_event': '🏆',
      'six_months': '⭐',
      'twelve_months': '🌟',
      'fifty_notes': '📝',
      'hundred_thoughts': '💭',
      'hundred_photos': '📸',
      'first_letter': '✉️',
      'first_trip': '✈️',
      'first_anniversary': '💍',
      'year_active': '🎉'
    };
    
    badgesList.innerHTML = badgesSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="badge-item">
          <div class="badge-icon">${badgeIcons[data.tipo] || '🏅'}</div>
          <div class="badge-info">
            <h4>${data.nombre}</h4>
            <p>${data.descripcion}</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar insignias:', error);
  }
}

function openEventModal(eventTemplate, eventData) {
  const modal = document.getElementById('eventModal');
  const modalBody = document.getElementById('modalEventBody');
  document.getElementById('modalEventTitle').textContent = eventTemplate.title;
  
  // Generar contenido según el tipo de evento
  let content = '';
  
  switch (eventTemplate.type) {
    case 'questions':
      content = generateQuestionsEvent(eventTemplate.questions, eventData);
      break;
    case 'truth_dare':
      content = generateTruthDareEvent(eventTemplate.truths, eventTemplate.dares, eventData);
      break;
    case 'photo_challenge':
      content = generatePhotoChallengeEvent(eventTemplate.instructions, eventData);
      break;
    case 'playlist':
      content = generatePlaylistEvent(eventTemplate.instructions, eventData);
      break;
    case 'future_letter':
      content = generateFutureLetterEvent(eventTemplate.instructions, eventData);
      break;
    case 'cooking':
      content = generateCookingEvent(eventTemplate.instructions, eventData);
      break;
    case 'drawing':
      content = generateDrawingEvent(eventTemplate.instructions, eventData);
      break;
    case 'movie':
      content = generateMovieEvent(eventTemplate.instructions, eventData);
      break;
    case 'exploration':
      content = generateExplorationEvent(eventTemplate.instructions, eventData);
      break;
    case 'guessing':
      content = generateGuessingEvent(eventTemplate.questions, eventData);
      break;
    case 'quiz':
      content = generateQuizEvent(eventTemplate.questions, eventData);
      break;
    case 'surprise':
      content = generateSurpriseEvent(eventTemplate.instructions, eventData);
      break;
    default:
      content = `<p>${eventTemplate.instructions || eventTemplate.description}</p>`;
  }
  
  modalBody.innerHTML = content;
  modal.classList.remove('hidden');
}

function generateQuestionsEvent(questions, eventData) {
  const userAnswers = eventData?.respuestas?.[AppState.currentUser.uid] || {};
  
  return `
    <p class="event-instructions">${eventData?.instructions || 'Responde estas preguntas profundamente. Tu pareja no verá tus respuestas hasta que ambos hayan completado el evento.'}</p>
    <form id="eventForm">
      ${questions.map((q, i) => `
        <div class="form-group">
          <label>${q}</label>
          <textarea class="input textarea" name="q${i}" rows="3">${userAnswers[`q${i}`] || ''}</textarea>
        </div>
      `).join('')}
      <button type="submit" class="btn btn-primary btn-full">Guardar respuestas</button>
    </form>
  `;
}

function generateTruthDareEvent(truths, dares, eventData) {
  return `
    <p class="event-instructions">Túrnense para elegir verdad o reto.</p>
    <div class="truth-dare-container">
      <button class="btn btn-primary btn-full" id="truthBtn">🎭 Verdad</button>
      <button class="btn btn-secondary btn-full" id="dareBtn">🎯 Reto</button>
    </div>
    <div id="truthDareResult" class="truth-dare-result"></div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generatePhotoChallengeEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>Sube la foto recreada</label>
      <input type="file" class="input" accept="image/*" id="challengePhoto">
    </div>
    <div class="form-group">
      <label>Notas sobre la experiencia</label>
      <textarea class="input textarea" rows="3" id="challengeNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generatePlaylistEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>Enlace a tu playlist (Spotify, Apple Music, etc.)</label>
      <input type="url" class="input" id="playlistLink" value="${eventData?.link || ''}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label>Descripción de las canciones elegidas</label>
      <textarea class="input textarea" rows="3" id="playlistNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generateFutureLetterEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>Fecha para abrir la carta</label>
      <input type="date" class="input" id="letterDate">
    </div>
    <div class="form-group">
      <label>Tu carta</label>
      <textarea class="input textarea" rows="8" id="letterContent">${eventData?.contenido || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Guardar carta y completar evento</button>
  `;
}

function generateCookingEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>¿Qué receta prepararon?</label>
      <input type="text" class="input" id="cookingRecipe" value="${eventData?.receta || ''}">
    </div>
    <div class="form-group">
      <label>Sube una foto del resultado</label>
      <input type="file" class="input" accept="image/*" id="cookingPhoto">
    </div>
    <div class="form-group">
      <label>¿Cómo fue la experiencia?</label>
      <textarea class="input textarea" rows="3" id="cookingNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generateDrawingEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>Sube una foto del dibujo</label>
      <input type="file" class="input" accept="image/*" id="drawingPhoto">
    </div>
    <div class="form-group">
      <label>¿Qué representa el dibujo?</label>
      <textarea class="input textarea" rows="3" id="drawingNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generateMovieEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>¿Qué película vieron?</label>
      <input type="text" class="input" id="movieTitle" value="${eventData?.pelicula || ''}">
    </div>
    <div class="form-group">
      <label>Tu opinión</label>
      <textarea class="input textarea" rows="3" id="movieNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generateExplorationEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>¿Qué lugar visitaron?</label>
      <input type="text" class="input" id="explorationPlace" value="${eventData?.lugar || ''}">
    </div>
    <div class="form-group">
      <label>Sube fotos del lugar</label>
      <input type="file" class="input" accept="image/*" id="explorationPhoto">
    </div>
    <div class="form-group">
      <label>¿Qué les pareció el lugar?</label>
      <textarea class="input textarea" rows="3" id="explorationNotes">${eventData?.notas || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

function generateGuessingEvent(questions, eventData) {
  const userAnswers = eventData?.respuestas?.[AppState.currentUser.uid] || {};
  
  return `
    <p class="event-instructions">Intenta adivinar cómo respondería tu pareja. Luego compara respuestas.</p>
    <form id="eventForm">
      ${questions.map((q, i) => `
        <div class="form-group">
          <label>${q}</label>
          <input type="text" class="input" name="q${i}" value="${userAnswers[`q${i}`] || ''}">
        </div>
      `).join('')}
      <button type="submit" class="btn btn-primary btn-full">Guardar respuestas</button>
    </form>
  `;
}

function generateQuizEvent(questions, eventData) {
  const userAnswers = eventData?.respuestas?.[AppState.currentUser.uid] || {};
  
  return `
    <p class="event-instructions">¿Cuánto conoces a tu pareja? Responde estas preguntas.</p>
    <form id="eventForm">
      ${questions.map((q, i) => `
        <div class="form-group">
          <label>${q}</label>
          <input type="text" class="input" name="q${i}" value="${userAnswers[`q${i}`] || ''}">
        </div>
      `).join('')}
      <button type="submit" class="btn btn-primary btn-full">Guardar respuestas</button>
    </form>
  `;
}

function generateSurpriseEvent(instructions, eventData) {
  return `
    <p class="event-instructions">${instructions}</p>
    <div class="form-group">
      <label>¿Qué sorpresa preparaste?</label>
      <textarea class="input textarea" rows="3" id="surpriseNotes">${eventData?.notas || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Sube una foto (opcional)</label>
      <input type="file" class="input" accept="image/*" id="surprisePhoto">
    </div>
    <button class="btn btn-primary btn-full" id="completeEventBtn">Completar evento</button>
  `;
}

async function completeEvent(eventData) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const eventId = `${currentYear}-${currentMonth}`;
    
    // Actualizar o crear documento de evento
    const eventRef = db.collection('couples').doc(AppState.coupleId).collection('eventos').doc(eventId);
    
    const existingData = (await eventRef.get()).data() || {};
    
    await eventRef.set({
      ...existingData,
      respuestas: {
        ...existingData.respuestas,
        [AppState.currentUser.uid]: eventData
      },
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Verificar si ambos completaron
    const updatedDoc = await eventRef.get();
    const updatedData = updatedDoc.data();
    
    if (updatedData.respuestas && Object.keys(updatedData.respuestas).length === 2) {
      // Marcar como completado
      await eventRef.update({
        completado: true
      });
      
      // Otorgar insignia si es el primer evento
      await awardBadge('first_event', 'Primer evento', 'Completaste tu primer evento mensual');
      
      showNotification('¡Evento completado! Insignia obtenida', 'success');
    } else {
      showNotification('Respuestas guardadas. Esperando a tu pareja...', 'success');
    }
    
    // Cerrar modal
    document.getElementById('eventModal').classList.add('hidden');
    
    // Recargar datos
    loadEventSection();
    loadMonthlyEvent();
    
  } catch (error) {
    console.error('✗ Error al completar evento:', error);
    showNotification('Error al completar evento', 'error');
  }
}

async function awardBadge(type, name, description) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const badgeRef = db.collection('couples').doc(AppState.coupleId)
      .collection('insignias')
      .doc(type);
    
    const badgeDoc = await badgeRef.get();
    
    if (!badgeDoc.exists) {
      await badgeRef.set({
        tipo: type,
        nombre: name,
        descripcion: description,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('✗ Error al otorgar insignia:', error);
  }
}

// ============================================
// ÁLBUM DE FOTOS
// ============================================
async function loadAlbum() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const photosSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('fotos')
      .orderBy('fecha', 'desc')
      .get();
    
    const albumGrid = document.getElementById('albumGrid');
    
    if (photosSnapshot.empty) {
      albumGrid.innerHTML = '<p class="empty-state">No hay fotos aún. ¡Añade la primera!</p>';
      return;
    }
    
    albumGrid.innerHTML = photosSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="album-item">
          <img src="${data.url}" alt="${data.descripcion || 'Foto'}">
          <div class="album-item-overlay">
            <p>${data.descripcion || 'Sin descripción'}</p>
            <div class="album-reactions">
              <span>❤️ ${data.reacciones || 0}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar álbum:', error);
  }
}

async function uploadPhoto(file, description, location) {
  if (!AppState.coupleId || !file) return;
  
  try {
    const storage = getStorage();
    const db = getDB();
    
    // Subir imagen a Storage
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = storage.ref(`couples/${AppState.coupleId}/photos/${fileName}`);
    await storageRef.put(file);
    
    // Obtener URL
    const url = await storageRef.getDownloadURL();
    
    // Guardar en Firestore
    await db.collection('couples').doc(AppState.coupleId).collection('fotos').add({
      url: url,
      descripcion: description,
      ubicacion: location,
      autor: AppState.currentUser.uid,
      autorNombre: AppState.userData.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      reacciones: 0
    });
    
    showNotification('Foto subida correctamente', 'success');
    document.getElementById('addPhotoModal').classList.add('hidden');
    loadAlbum();
    
    // Verificar insignia
    checkPhotoBadge();
    
  } catch (error) {
    console.error('✗ Error al subir foto:', error);
    showNotification('Error al subir foto', 'error');
  }
}

async function checkPhotoBadge() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const snapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('fotos')
      .get();
    
    if (snapshot.size === 100) {
      await awardBadge('hundred_photos', '100 fotos', 'Han compartido 100 fotos juntos');
    }
  } catch (error) {
    console.error('✗ Error al verificar insignia:', error);
  }
}

// ============================================
// NOTAS
// ============================================
async function loadNotes() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const notesSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('notas')
      .orderBy('fecha', 'desc')
      .get();
    
    const notesList = document.getElementById('notesList');
    
    if (notesSnapshot.empty) {
      notesList.innerHTML = '<p class="empty-state">No hay notas aún</p>';
      return;
    }
    
    // Cargar fotos de autores
    const authors = {};
    for (const doc of notesSnapshot.docs) {
      const authorId = doc.data().autor;
      if (!authors[authorId]) {
        const userDoc = await db.collection('users').doc(authorId).get();
        if (userDoc.exists) {
          authors[authorId] = userDoc.data().foto;
        }
      }
    }
    
    notesList.innerHTML = notesSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="note-item">
          <div class="note-header">
            <img src="${authors[data.autor] || ''}" alt="${data.autorNombre}" class="note-author">
            <div class="note-info">
              <span>${data.autorNombre}</span>
              <p>${formatFirestoreDateTime(data.fecha)}</p>
            </div>
          </div>
          <div class="note-content">${data.contenido}</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar notas:', error);
  }
}

async function addNote(content) {
  if (!AppState.coupleId || !content) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).collection('notas').add({
      contenido: content,
      autor: AppState.currentUser.uid,
      autorNombre: AppState.userData.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Nota guardada', 'success');
    document.getElementById('addNoteModal').classList.add('hidden');
    loadNotes();
    
    // Verificar insignia
    checkNotesBadge();
    
  } catch (error) {
    console.error('✗ Error al añadir nota:', error);
    showNotification('Error al añadir nota', 'error');
  }
}

async function checkNotesBadge() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const snapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('notas')
      .get();
    
    if (snapshot.size === 50) {
      await awardBadge('fifty_notes', '50 notas', 'Han creado 50 notas juntos');
    }
  } catch (error) {
    console.error('✗ Error al verificar insignia:', error);
  }
}

// ============================================
// PENSAMIENTOS
// ============================================
async function loadThoughts() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const thoughtsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('pensamientos')
      .orderBy('fecha', 'desc')
      .get();
    
    const thoughtsList = document.getElementById('thoughtsList');
    
    if (thoughtsSnapshot.empty) {
      thoughtsList.innerHTML = '<p class="empty-state">No hay pensamientos aún</p>';
      return;
    }
    
    // Cargar fotos de autores
    const authors = {};
    for (const doc of thoughtsSnapshot.docs) {
      const authorId = doc.data().autor;
      if (!authors[authorId]) {
        const userDoc = await db.collection('users').doc(authorId).get();
        if (userDoc.exists) {
          authors[authorId] = userDoc.data().foto;
        }
      }
    }
    
    thoughtsList.innerHTML = thoughtsSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="thought-item">
          <div class="thought-header">
            <img src="${authors[data.autor] || ''}" alt="${data.autorNombre}" class="thought-author">
            <div class="thought-info">
              <span>${data.autorNombre}</span>
              <p>${formatFirestoreDateTime(data.fecha)}</p>
            </div>
          </div>
          <div class="thought-content">${data.contenido}</div>
          <div class="thought-actions">
            <button class="thought-reaction" data-id="${doc.id}" data-reactions="${data.reacciones || 0}">
              <span>❤️</span>
              <span>${data.reacciones || 0}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Configurar listeners de reacciones
    document.querySelectorAll('.thought-reaction').forEach(btn => {
      btn.addEventListener('click', () => reactToThought(btn.dataset.id, btn));
    });
    
  } catch (error) {
    console.error('✗ Error al cargar pensamientos:', error);
  }
}

async function postThought(content) {
  if (!AppState.coupleId || !content) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).collection('pensamientos').add({
      contenido: content,
      autor: AppState.currentUser.uid,
      autorNombre: AppState.userData.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      reacciones: 0
    });
    
    showNotification('Pensamiento publicado', 'success');
    document.getElementById('thoughtInput').value = '';
    loadThoughts();
    
    // Verificar insignia
    checkThoughtsBadge();
    
  } catch (error) {
    console.error('✗ Error al publicar pensamiento:', error);
    showNotification('Error al publicar pensamiento', 'error');
  }
}

async function reactToThought(thoughtId, button) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const thoughtRef = db.collection('couples').doc(AppState.coupleId)
      .collection('pensamientos')
      .doc(thoughtId);
    
    const thoughtDoc = await thoughtRef.get();
    const currentReactions = thoughtDoc.data().reacciones || 0;
    
    await thoughtRef.update({
      reacciones: currentReactions + 1
    });
    
    // Actualizar UI
    button.querySelector('span:last-child').textContent = currentReactions + 1;
    button.classList.add('active');
    
  } catch (error) {
    console.error('✗ Error al reaccionar:', error);
  }
}

async function checkThoughtsBadge() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const snapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('pensamientos')
      .get();
    
    if (snapshot.size === 100) {
      await awardBadge('hundred_thoughts', '100 pensamientos', 'Han compartido 100 pensamientos');
    }
  } catch (error) {
    console.error('✗ Error al verificar insignia:', error);
  }
}

// ============================================
// POEMAS
// ============================================
async function loadPoems() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const poemsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('poemas')
      .orderBy('fecha', 'desc')
      .get();
    
    const poemsList = document.getElementById('poemsList');
    
    if (poemsSnapshot.empty) {
      poemsList.innerHTML = '<p class="empty-state">No hay poemas aún</p>';
      return;
    }
    
    poemsList.innerHTML = poemsSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="poem-item">
          <h3 class="poem-title">${data.titulo}</h3>
          <div class="poem-content">${data.contenido}</div>
          <div class="poem-footer">
            <span>Por ${data.autorNombre}</span>
            <span>${formatFirestoreDate(data.fecha)}</span>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar poemas:', error);
  }
}

async function addPoem(title, content) {
  if (!AppState.coupleId || !title || !content) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).collection('poemas').add({
      titulo: title,
      contenido: content,
      autor: AppState.currentUser.uid,
      autorNombre: AppState.userData.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Poema guardado', 'success');
    document.getElementById('addPoemModal').classList.add('hidden');
    loadPoems();
    
  } catch (error) {
    console.error('✗ Error al añadir poema:', error);
    showNotification('Error al añadir poema', 'error');
  }
}

// ============================================
// CARTAS
// ============================================
async function loadLetters() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    const lettersSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('cartas')
      .orderBy('fechaApertura', 'asc')
      .get();
    
    const lettersList = document.getElementById('lettersList');
    
    if (lettersSnapshot.empty) {
      lettersList.innerHTML = '<p class="empty-state">No hay cartas aún</p>';
      return;
    }
    
    const now = new Date();
    
    lettersList.innerHTML = lettersSnapshot.docs.map(doc => {
      const data = doc.data();
      const isOpened = now >= data.fechaApertura.toDate();
      
      return `
        <div class="letter-item ${!isOpened ? 'locked' : ''}">
          <div class="letter-header">
            <span class="letter-to">Para: ${data.paraNombre || 'Mi pareja'}</span>
            <span class="letter-open-date">
              ${isOpened ? '📬 Abierta' : '🔒 ' + formatFirestoreDate(data.fechaApertura)}
            </span>
          </div>
          <div class="letter-preview">${data.contenido}</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('✗ Error al cargar cartas:', error);
  }
}

async function addLetter(recipient, openDate, content) {
  if (!AppState.coupleId || !openDate || !content) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).collection('cartas').add({
      para: recipient,
      paraNombre: 'Mi pareja',
      fechaApertura: new Date(openDate),
      contenido: content,
      autor: AppState.currentUser.uid,
      autorNombre: AppState.userData.nombre,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Carta guardada', 'success');
    document.getElementById('addLetterModal').classList.add('hidden');
    loadLetters();
    
    // Otorgar insignia si es la primera carta
    await awardBadge('first_letter', 'Primera carta', 'Escribiste tu primera carta');
    
  } catch (error) {
    console.error('✗ Error al añadir carta:', error);
    showNotification('Error al añadir carta', 'error');
  }
}

// ============================================
// UBICACIÓN
// ============================================
async function loadLocation() {
  if (!AppState.coupleId) return;
  
  try {
    // Solicitar ubicación
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Actualizar ubicación del usuario
          await updateLocation(latitude, longitude);
          
          // Mostrar ubicación
          document.getElementById('myLocation').textContent = 
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          // Cargar ubicación de la pareja
          await loadPartnerLocation();
        },
        (error) => {
          console.error('✗ Error al obtener ubicación:', error);
          showNotification('Error al obtener ubicación', 'error');
        }
      );
    }
  } catch (error) {
    console.error('✗ Error al cargar ubicación:', error);
  }
}

async function updateLocation(lat, lng) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).update({
      [`ubicacion.${AppState.currentUser.uid}`]: {
        latitud: lat,
        longitud: lng,
        actualizado: firebase.firestore.FieldValue.serverTimestamp()
      }
    });
    
  } catch (error) {
    console.error('✗ Error al actualizar ubicación:', error);
  }
}

async function loadPartnerLocation() {
  if (!AppState.coupleId || !AppState.coupleData) return;
  
  try {
    const db = getDB();
    const coupleDoc = await db.collection('couples').doc(AppState.coupleId).get();
    const coupleData = coupleDoc.data();
    
    const locations = coupleData.ubicacion || {};
    const partnerId = AppState.coupleData.users.find(id => id !== AppState.currentUser.uid);
    
    if (partnerId && locations[partnerId]) {
      const partnerLocation = locations[partnerId];
      document.getElementById('partnerLocation').textContent = 
        `${partnerLocation.latitud.toFixed(4)}, ${partnerLocation.longitud.toFixed(4)}`;
      document.getElementById('locationLastUpdate').textContent = 
        formatFirestoreDateTime(partnerLocation.actualizado);
    } else {
      document.getElementById('partnerLocation').textContent = 'No disponible';
    }
    
  } catch (error) {
    console.error('✗ Error al cargar ubicación de la pareja:', error);
  }
}

// ============================================
// PERFIL
// ============================================
// Flag para evitar listeners duplicados en perfil
let profileListenersSetup = false;

async function loadProfile() {
  if (!AppState.userData) return;
  
  // Información del usuario
  const profilePhotoEl = document.getElementById('profilePhoto');
  const profileNameEl = document.getElementById('profileName');
  const profileEmailEl = document.getElementById('profileEmail');
  const profileCoupleCodeEl = document.getElementById('profileCoupleCode');
  const profileMemberSinceEl = document.getElementById('profileMemberSince');
  
  if (profilePhotoEl) profilePhotoEl.src = AppState.userData.foto || '';
  if (profileNameEl) profileNameEl.textContent = AppState.userData.nombre;
  if (profileEmailEl) profileEmailEl.textContent = AppState.userData.email;
  if (profileCoupleCodeEl) profileCoupleCodeEl.textContent = AppState.userData.codigo || '--';
  if (profileMemberSinceEl) {
    profileMemberSinceEl.textContent = 
      AppState.userData.creado ? formatFirestoreDate(AppState.userData.creado) : '--';
  }
  
  // Información de la pareja
  if (AppState.coupleData) {
    const profileAnniversaryEl = document.getElementById('profileAnniversary');
    const profileFirstDateEl = document.getElementById('profileFirstDate');
    const profileSongEl = document.getElementById('profileSong');
    
    if (profileAnniversaryEl) {
      profileAnniversaryEl.textContent = 
        AppState.coupleData.aniversario ? formatFirestoreDate(AppState.coupleData.aniversario) : '--';
    }
    if (profileFirstDateEl) {
      profileFirstDateEl.textContent = 
        AppState.coupleData.primeraCita ? formatFirestoreDate(AppState.coupleData.primeraCita) : '--';
    }
    if (profileSongEl) {
      profileSongEl.textContent = AppState.coupleData.cancionFavorita || '--';
    }
  }
  
  // Configurar listener para desvincular (solo una vez)
  if (!profileListenersSetup) {
    const unlinkPartnerBtn = document.getElementById('unlinkPartnerBtn');
    if (unlinkPartnerBtn) {
      unlinkPartnerBtn.addEventListener('click', unlinkPartner);
      profileListenersSetup = true;
      console.log('✓ Listener de perfil configurado');
    }
  }
}

// ============================================
// ESTADÍSTICAS
// ============================================
async function loadStatistics() {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    
    // Contar documentos de cada colección
    const eventsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('eventos').get();
    const photosSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('fotos').get();
    const notesSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('notas').get();
    const thoughtsSnapshot = await db.collection('couples').doc(AppState.coupleId)
      .collection('pensamientos').get();
    
    document.getElementById('statEvents').textContent = eventsSnapshot.size;
    document.getElementById('statPhotos').textContent = photosSnapshot.size;
    document.getElementById('statNotes').textContent = notesSnapshot.size;
    document.getElementById('statThoughts').textContent = thoughtsSnapshot.size;
    
  } catch (error) {
    console.error('✗ Error al cargar estadísticas:', error);
  }
}

// ============================================
// CONFIGURACIÓN
// ============================================
function loadSettings() {
  // Cargar tema
  const savedTheme = localStorage.getItem('theme') || 'pink';
  document.getElementById('themeSelect').value = savedTheme;
  applyTheme(savedTheme);
  
  // Cargar modo oscuro
  const darkMode = localStorage.getItem('darkMode') === 'true';
  document.getElementById('darkModeToggle').checked = darkMode;
  if (darkMode) {
    document.body.classList.add('dark-mode');
  }
  
  // Listeners de configuración
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    const theme = e.target.value;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  });
  
  document.getElementById('darkModeToggle').addEventListener('change', (e) => {
    const darkMode = e.target.checked;
    localStorage.setItem('darkMode', darkMode.toString());
    document.body.classList.toggle('dark-mode', darkMode);
  });
}

function applyTheme(theme) {
  const themes = {
    pink: { primary: '#ff6b9d', primaryLight: '#ff8fb5', primaryDark: '#e84a7f' },
    blue: { primary: '#45b7d1', primaryLight: '#6bc5de', primaryDark: '#3a9fc4' },
    purple: { primary: '#a55eea', primaryLight: '#b777ed', primaryDark: '#8e4cd1' },
    green: { primary: '#4ecdc4', primaryLight: '#6ed9d1', primaryDark: '#3db8b0' }
  };
  
  const selectedTheme = themes[theme] || themes.pink;
  document.documentElement.style.setProperty('--primary', selectedTheme.primary);
  document.documentElement.style.setProperty('--primary-light', selectedTheme.primaryLight);
  document.documentElement.style.setProperty('--primary-dark', selectedTheme.primaryDark);
}

// ============================================
// MODALES
// ============================================
function setupModals() {
  // Cerrar modales
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  
  // Cerrar al hacer clic fuera
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
  
  // Modal de evento
  document.getElementById('closeEventModal').addEventListener('click', () => {
    document.getElementById('eventModal').classList.add('hidden');
  });
  
  // Modal de añadir evento
  document.getElementById('addEventBtn').addEventListener('click', () => {
    document.getElementById('addEventModal').classList.remove('hidden');
  });
  
  document.getElementById('closeAddEventModal').addEventListener('click', () => {
    document.getElementById('addEventModal').classList.add('hidden');
  });
  
  // Modal de añadir foto
  document.getElementById('addPhotoBtn').addEventListener('click', () => {
    document.getElementById('addPhotoModal').classList.remove('hidden');
  });
  
  document.getElementById('closeAddPhotoModal').addEventListener('click', () => {
    document.getElementById('addPhotoModal').classList.add('hidden');
  });
  
  // Modal de añadir nota
  document.getElementById('addNoteBtn').addEventListener('click', () => {
    document.getElementById('addNoteModal').classList.remove('hidden');
  });
  
  document.getElementById('closeAddNoteModal').addEventListener('click', () => {
    document.getElementById('addNoteModal').classList.add('hidden');
  });
  
  // Modal de añadir poema
  document.getElementById('addPoemBtn').addEventListener('click', () => {
    document.getElementById('addPoemModal').classList.remove('hidden');
  });
  
  document.getElementById('closeAddPoemModal').addEventListener('click', () => {
    document.getElementById('addPoemModal').classList.add('hidden');
  });
  
  // Modal de añadir carta
  document.getElementById('addLetterBtn').addEventListener('click', () => {
    document.getElementById('addLetterModal').classList.remove('hidden');
  });
  
  document.getElementById('closeAddLetterModal').addEventListener('click', () => {
    document.getElementById('addLetterModal').classList.add('hidden');
  });
  
  // Modal de editar información de pareja
  document.getElementById('editCoupleInfoBtn').addEventListener('click', () => {
    document.getElementById('editCoupleModal').classList.remove('hidden');
    
    // Cargar datos actuales
    if (AppState.coupleData) {
      if (AppState.coupleData.aniversario) {
        document.getElementById('anniversaryInput').value = 
          AppState.coupleData.aniversario.toDate().toISOString().split('T')[0];
      }
      if (AppState.coupleData.primeraCita) {
        document.getElementById('firstDateInput').value = 
          AppState.coupleData.primeraCita.toDate().toISOString().split('T')[0];
      }
      if (AppState.coupleData.primerBeso) {
        document.getElementById('firstKissInput').value = 
          AppState.coupleData.primerBeso.toDate().toISOString().split('T')[0];
      }
      document.getElementById('songInput').value = AppState.coupleData.cancionFavorita || '';
    }
  });
  
  document.getElementById('closeEditCoupleModal').addEventListener('click', () => {
    document.getElementById('editCoupleModal').classList.add('hidden');
  });
}

// ============================================
// FORMULARIOS
// ============================================
function setupForms() {
  // Formulario de añadir evento al calendario
  document.getElementById('addEventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('eventTitleInput').value;
    const description = document.getElementById('eventDescInput').value;
    const date = document.getElementById('eventDateInput').value;
    const type = document.getElementById('eventTypeInput').value;
    const color = document.querySelector('input[name="eventColor"]:checked').value;
    
    await addCalendarEvent(title, description, date, type, color);
  });
  
  // Formulario de añadir foto
  document.getElementById('addPhotoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = document.getElementById('photoFileInput').files[0];
    const description = document.getElementById('photoDescInput').value;
    const location = document.getElementById('photoLocationInput').value;
    
    await uploadPhoto(file, description, location);
  });
  
  // Formulario de añadir nota
  document.getElementById('addNoteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = document.getElementById('noteContentInput').value;
    await addNote(content);
  });
  
  // Formulario de añadir poema
  document.getElementById('addPoemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('poemTitleInput').value;
    const content = document.getElementById('poemContentInput').value;
    await addPoem(title, content);
  });
  
  // Formulario de añadir carta
  document.getElementById('addLetterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const recipient = document.getElementById('letterRecipientInput').value;
    const openDate = document.getElementById('letterOpenDateInput').value;
    const content = document.getElementById('letterContentInput').value;
    
    await addLetter(recipient, openDate, content);
  });
  
  // Formulario de editar información de pareja
  document.getElementById('editCoupleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const anniversary = document.getElementById('anniversaryInput').value;
    const firstDate = document.getElementById('firstDateInput').value;
    const firstKiss = document.getElementById('firstKissInput').value;
    const song = document.getElementById('songInput').value;
    
    await updateCoupleInfo(anniversary, firstDate, firstKiss, song);
  });
  
  // Publicar pensamiento
  document.getElementById('postThoughtBtn').addEventListener('click', async () => {
    const content = document.getElementById('thoughtInput').value.trim();
    if (content) {
      await postThought(content);
    }
  });
  
  // Botón de completar evento (delegación de eventos)
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'completeEventBtn') {
      const eventData = {};
      
      // Recopilar datos según el tipo de evento
      const notesInput = document.getElementById('challengeNotes') || 
                       document.getElementById('playlistNotes') ||
                       document.getElementById('cookingNotes') ||
                       document.getElementById('drawingNotes') ||
                       document.getElementById('movieNotes') ||
                       document.getElementById('explorationNotes') ||
                       document.getElementById('surpriseNotes');
      
      if (notesInput) {
        eventData.notas = notesInput.value;
      }
      
      const linkInput = document.getElementById('playlistLink');
      if (linkInput) {
        eventData.link = linkInput.value;
      }
      
      const recipeInput = document.getElementById('cookingRecipe');
      if (recipeInput) {
        eventData.receta = recipeInput.value;
      }
      
      const movieInput = document.getElementById('movieTitle');
      if (movieInput) {
        eventData.pelicula = movieInput.value;
      }
      
      const placeInput = document.getElementById('explorationPlace');
      if (placeInput) {
        eventData.lugar = placeInput.value;
      }
      
      await completeEvent(eventData);
    }
  });
  
  // Formulario de evento (preguntas, quiz, etc.)
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'eventForm') {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const answers = {};
      
      for (const [key, value] of formData.entries()) {
        answers[key] = value;
      }
      
      await completeEvent(answers);
    }
  });
  
  // Botones de verdad o reto
  document.addEventListener('click', (e) => {
    if (e.target.id === 'truthBtn') {
      const truths = ['¿Cuál fue tu momento más vergonzoso conmigo?', 
                     '¿Qué es lo que más te gusta de mi apariencia?',
                     '¿Alguna vez has mentido sobre algo pequeño? ¿Qué fue?',
                     '¿Cuál es tu fantasía romántica?'];
      const randomTruth = truths[Math.floor(Math.random() * truths.length)];
      document.getElementById('truthDareResult').innerHTML = `<p class="truth-dare-question">${randomTruth}</p>`;
    }
    
    if (e.target.id === 'dareBtn') {
      const dares = ['Escribe una carta de amor de 10 líneas',
                    'Canta una canción romántica',
                    'Dame 10 besos seguidos',
                    'Prepara mi comida favorita'];
      const randomDare = dares[Math.floor(Math.random() * dares.length)];
      document.getElementById('truthDareResult').innerHTML = `<p class="truth-dare-question">${randomDare}</p>`;
    }
  });
}

async function addCalendarEvent(title, description, date, type, color) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(AppState.coupleId).collection('calendario').add({
      titulo: title,
      descripcion: description,
      fecha: new Date(date),
      tipo: type,
      color: color,
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Evento añadido al calendario', 'success');
    document.getElementById('addEventModal').classList.add('hidden');
    document.getElementById('addEventForm').reset();
    loadCalendar();
    
  } catch (error) {
    console.error('✗ Error al añadir evento:', error);
    showNotification('Error al añadir evento', 'error');
  }
}

async function updateCoupleInfo(anniversary, firstDate, firstKiss, song) {
  if (!AppState.coupleId) return;
  
  try {
    const db = getDB();
    
    const updates = {};
    if (anniversary) updates.aniversario = new Date(anniversary);
    if (firstDate) updates.primeraCita = new Date(firstDate);
    if (firstKiss) updates.primerBeso = new Date(firstKiss);
    if (song) updates.cancionFavorita = song;
    
    await db.collection('couples').doc(AppState.coupleId).update(updates);
    
    showNotification('Información actualizada', 'success');
    document.getElementById('editCoupleModal').classList.add('hidden');
    
    // Recargar datos
    await loadCoupleData(AppState.coupleId);
    loadProfile();
    loadHomeData();
    
    // Reiniciar contador si se actualizó el aniversario
    if (anniversary) {
      if (AppState.counterInterval) {
        clearInterval(AppState.counterInterval);
      }
      startCounter();
    }
    
  } catch (error) {
    console.error('✗ Error al actualizar información:', error);
    showNotification('Error al actualizar información', 'error');
  }
}

// ============================================
// NOTIFICACIONES
// ============================================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notificationMessage');
  
  notificationMessage.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// ============================================
// INICIAR APLICACIÓN
// ============================================
console.log('LoveSpace cargando...');
