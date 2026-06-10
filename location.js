/**
 * LoveSpace - Sistema de Ubicación
 * Módulo dedicado a la gestión de ubicación en tiempo real
 * Integración con Leaflet + OpenStreetMap
 */

// ============================================
// ESTADO DEL MÓDULO DE UBICACIÓN
// ============================================
const LocationState = {
  map: null,
  userMarker: null,
  partnerMarker: null,
  watchId: null,
  lastLocation: null,
  lastUpdateTime: null,
  partnerLocation: null,
  partnerListener: null,
  isTracking: false,
  minDistanceUpdate: 20, // 20 metros
  minTimeUpdate: 2 * 60 * 1000, // 2 minutos
  coupleId: null,
  currentUserId: null,
  partnerId: null
};

// ================================
// INICIALIZACIÓN DEL SISTEMA
// ================================
function initializeLocationSystem(coupleId, currentUserId, partnerId) {
  console.log('📍 Inicializando sistema de ubicación...');
  
  LocationState.coupleId = coupleId;
  LocationState.currentUserId = currentUserId;
  LocationState.partnerId = partnerId;
  
  // Inicializar mapa
  initializeMap();
  
  // Iniciar seguimiento de ubicación
  startLocationTracking();
  
  // Escuchar ubicación de la pareja
  listenToPartnerLocation();
  
  console.log('✓ Sistema de ubicación inicializado');
}

// ============================================
// INICIALIZACIÓN DEL MAPA LEAFLET
// ============================================
function initializeMap() {
  if (typeof L === 'undefined') {
    console.error('✗ Leaflet no está cargado');
    return;
  }
  
  const mapContainer = document.getElementById('locationMap');
  if (!mapContainer) {
    console.error('✗ Contenedor del mapa no encontrado');
    return;
  }
  
  // Crear mapa
  LocationState.map = L.map('locationMap').setView([0, 0], 2);
  
  // Agregar capa de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(LocationState.map);
  
  console.log('✓ Mapa Leaflet inicializado');
}

// ============================================
// SEGUIMIENTO DE UBICACIÓN EN TIEMPO REAL
// ============================================
function startLocationTracking() {
  if (!navigator.geolocation) {
    console.error('✗ Geolocation no soportado');
    showLocationError('Tu navegador no soporta geolocalización');
    return;
  }
  
  if (LocationState.isTracking) {
    console.log('⚠ El seguimiento ya está activo');
    return;
  }
  
  LocationState.isTracking = true;
  
  // Usar watchPosition para seguimiento continuo
  LocationState.watchId = navigator.geolocation.watchPosition(
    handleLocationUpdate,
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
  
  console.log('✓ Seguimiento de ubicación iniciado');
}

function stopLocationTracking() {
  if (LocationState.watchId !== null) {
    navigator.geolocation.clearWatch(LocationState.watchId);
    LocationState.watchId = null;
  }
  
  LocationState.isTracking = false;
  console.log('✓ Seguimiento de ubicación detenido');
}

// ============================================
// MANEJO DE ACTUALIZACIONES DE UBICACIÓN
// ============================================
function handleLocationUpdate(position) {
  const { latitude, longitude, accuracy, speed } = position.coords;
  const currentTime = Date.now();
  
  const newLocation = {
    latitud: latitude,
    longitud: longitude,
    precision: accuracy,
    velocidad: speed || 0,
    actualizado: new Date(currentTime)
  };
  
  // Verificar si debemos actualizar en Firestore
  const shouldUpdate = shouldUpdateLocation(newLocation);
  
  if (shouldUpdate) {
    // Actualizar en Firestore
    updateLocationInFirestore(newLocation);
    
    // Actualizar estado local
    LocationState.lastLocation = newLocation;
    LocationState.lastUpdateTime = currentTime;
  }
  
  // Actualizar marcador en el mapa siempre
  updateUserMarker(newLocation);
  
  // Actualizar UI
  updateLocationUI(newLocation);
  
  // Calcular distancia si tenemos ubicación de la pareja
  if (LocationState.partnerLocation) {
    calculateAndShowDistance(newLocation, LocationState.partnerLocation);
  }
}

function shouldUpdateLocation(newLocation) {
  // Si es la primera ubicación, actualizar
  if (!LocationState.lastLocation) {
    return true;
  }
  
  const distance = calculateDistance(
    LocationState.lastLocation.latitud,
    LocationState.lastLocation.longitud,
    newLocation.latitud,
    newLocation.longitud
  );
  
  const timeDiff = Date.now() - LocationState.lastUpdateTime;
  
  // Actualizar si se movió más de 20 metros o pasaron más de 2 minutos
  return distance > LocationState.minDistanceUpdate || timeDiff > LocationState.minTimeUpdate;
}

// ============================================
// ACTUALIZACIÓN EN FIRESTORE
// ============================================
async function updateLocationInFirestore(locationData) {
  if (!LocationState.coupleId || !LocationState.currentUserId) {
    console.error('✗ No hay coupleId o currentUserId');
    return;
  }
  
  try {
    const db = getDB();
    
    await db.collection('couples').doc(LocationState.coupleId).update({
      [`ubicacion.${LocationState.currentUserId}`]: {
        latitud: locationData.latitud,
        longitud: locationData.longitud,
        precision: locationData.precision,
        velocidad: locationData.velocidad,
        actualizado: firebase.firestore.FieldValue.serverTimestamp(),
        compartiendo: true
      }
    });
    
    console.log('✓ Ubicación actualizada en Firestore');
  } catch (error) {
    console.error('✗ Error al actualizar ubicación en Firestore:', error);
  }
}

// ============================================
// ESCUCHA DE UBICACIÓN DE LA PAREJA
// ============================================
function listenToPartnerLocation() {
  if (!LocationState.coupleId || !LocationState.partnerId) {
    console.log('⚠ No hay coupleId o partnerId para escuchar ubicación');
    return;
  }
  
  try {
    const db = getDB();
    
    LocationState.partnerListener = db.collection('couples')
      .doc(LocationState.coupleId)
      .onSnapshot((doc) => {
        if (!doc.exists) return;
        
        const coupleData = doc.data();
        const locations = coupleData.ubicacion || {};
        const partnerLocation = locations[LocationState.partnerId];
        
        if (partnerLocation) {
          LocationState.partnerLocation = {
            latitud: partnerLocation.latitud,
            longitud: partnerLocation.longitud,
            actualizado: partnerLocation.actualizado
          };
          
          // Actualizar marcador de la pareja
          updatePartnerMarker(LocationState.partnerLocation);
          
          // Actualizar UI
          updatePartnerLocationUI(LocationState.partnerLocation);
          
          // Calcular distancia
          if (LocationState.lastLocation) {
            calculateAndShowDistance(LocationState.lastLocation, LocationState.partnerLocation);
          }
          
          // Ajustar vista del mapa
          fitMapToBothLocations();
        }
      });
    
    console.log('✓ Escucha de ubicación de pareja iniciada');
  } catch (error) {
    console.error('✗ Error al escuchar ubicación de pareja:', error);
  }
}

function stopListeningToPartnerLocation() {
  if (LocationState.partnerListener) {
    LocationState.partnerListener();
    LocationState.partnerListener = null;
    console.log('✓ Escucha de ubicación de pareja detenida');
  }
}

// ============================================
// MARCADORES EN EL MAPA
// ============================================
function updateUserMarker(location) {
  if (!LocationState.map) return;
  
  // Crear icono personalizado para el usuario
  const userIcon = L.divIcon({
    className: 'location-marker user-marker',
    html: '<div class="marker-icon user-icon">🩷</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
  
  if (LocationState.userMarker) {
    LocationState.userMarker.setLatLng([location.latitud, location.longitud]);
  } else {
    LocationState.userMarker = L.marker([location.latitud, location.longitud], { icon: userIcon })
      .addTo(LocationState.map)
      .bindPopup('Tu ubicación');
  }
}

function updatePartnerMarker(location) {
  if (!LocationState.map) return;
  
  // Crear icono personalizado para la pareja
  const partnerIcon = L.divIcon({
    className: 'location-marker partner-marker',
    html: '<div class="marker-icon partner-icon">💜</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
  
  if (LocationState.partnerMarker) {
    LocationState.partnerMarker.setLatLng([location.latitud, location.longitud]);
  } else {
    LocationState.partnerMarker = L.marker([location.latitud, location.longitud], { icon: partnerIcon })
      .addTo(LocationState.map)
      .bindPopup('Ubicación de tu pareja');
  }
}

function fitMapToBothLocations() {
  if (!LocationState.map || !LocationState.lastLocation || !LocationState.partnerLocation) return;
  
  const bounds = L.latLngBounds([
    [LocationState.lastLocation.latitud, LocationState.lastLocation.longitud],
    [LocationState.partnerLocation.latitud, LocationState.partnerLocation.longitud]
  ]);
  
  LocationState.map.fitBounds(bounds, { padding: [50, 50] });
}

// ============================================
// CÁLCULO DE DISTANCIA (FÓRMULA HAVERSINE)
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distancia en km
  
  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} metros`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function calculateAndShowDistance(userLocation, partnerLocation) {
  const distance = calculateDistance(
    userLocation.latitud,
    userLocation.longitud,
    partnerLocation.latitud,
    partnerLocation.longitud
  );
  
  const formattedDistance = formatDistance(distance);
  updateDistanceUI(formattedDistance);
}

// ============================================
// ACTUALIZACIÓN DE UI
// ============================================
function updateLocationUI(location) {
  const myLocationEl = document.getElementById('myLocation');
  if (myLocationEl) {
    myLocationEl.textContent = `${location.latitud.toFixed(4)}, ${location.longitud.toFixed(4)}`;
  }
  
  updateLocationStatus('active');
}

function updatePartnerLocationUI(location) {
  const partnerLocationEl = document.getElementById('partnerLocation');
  if (partnerLocationEl) {
    partnerLocationEl.textContent = `${location.latitud.toFixed(4)}, ${location.longitud.toFixed(4)}`;
  }
  
  const lastUpdateEl = document.getElementById('locationLastUpdate');
  if (lastUpdateEl && location.actualizado) {
    lastUpdateEl.textContent = formatFirestoreDateTime(location.actualizado);
  }
}

function updateDistanceUI(distance) {
  const distanceEl = document.getElementById('distanceIndicator');
  if (distanceEl) {
    distanceEl.innerHTML = `❤️ Están a ${distance} de distancia`;
  }
}

function updateLocationStatus(status) {
  const statusEl = document.getElementById('locationStatus');
  if (!statusEl) return;
  
  const now = Date.now();
  const timeSinceUpdate = LocationState.lastUpdateTime ? (now - LocationState.lastUpdateTime) / 1000 : Infinity;
  
  if (timeSinceUpdate < 60) {
    statusEl.innerHTML = '🟢 Ubicación actualizada hace menos de 1 minuto';
    statusEl.className = 'location-status status-active';
  } else if (timeSinceUpdate < 300) {
    statusEl.innerHTML = `🟡 Última actualización hace ${Math.floor(timeSinceUpdate / 60)} minutos`;
    statusEl.className = 'location-status status-warning';
  } else {
    statusEl.innerHTML = '🔴 Ubicación desactualizada';
    statusEl.className = 'location-status status-inactive';
  }
}

// ============================================
// ACTUALIZACIÓN MANUAL
// ============================================
function forceLocationUpdate() {
  console.log('🔄 Forzando actualización de ubicación...');
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords;
        
        const locationData = {
          latitud: latitude,
          longitud: longitude,
          precision: accuracy,
          velocidad: speed || 0,
          actualizado: new Date()
        };
        
        // Forzar actualización en Firestore
        updateLocationInFirestore(locationData);
        
        // Actualizar estado local
        LocationState.lastLocation = locationData;
        LocationState.lastUpdateTime = Date.now();
        
        // Actualizar mapa y UI
        updateUserMarker(locationData);
        updateLocationUI(locationData);
        
        console.log('✓ Actualización forzada completada');
      },
      (error) => {
        console.error('✗ Error al forzar actualización:', error);
        showLocationError('Error al obtener ubicación');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }
}

// ============================================
// LIMPIEZA
// ============================================
function cleanupLocationSystem() {
  stopLocationTracking();
  stopListeningToPartnerLocation();
  
  if (LocationState.map) {
    LocationState.map.remove();
    LocationState.map = null;
  }
  
  LocationState.userMarker = null;
  LocationState.partnerMarker = null;
  LocationState.lastLocation = null;
  LocationState.lastUpdateTime = null;
  LocationState.partnerLocation = null;
  LocationState.coupleId = null;
  LocationState.currentUserId = null;
  LocationState.partnerId = null;
  
  console.log('✓ Sistema de ubicación limpiado');
}

// ============================================
// UTILIDADES
// ============================================
function showLocationError(message) {
  const notificationEl = document.getElementById('notification');
  const notificationMessageEl = document.getElementById('notificationMessage');
  
  if (notificationEl && notificationMessageEl) {
    notificationMessageEl.textContent = message;
    notificationEl.classList.remove('hidden');
    
    setTimeout(() => {
      notificationEl.classList.add('hidden');
    }, 3000);
  }
}

// Función auxiliar para formatear fecha (debe existir en app.js o firebase.js)
function formatFirestoreDateTime(timestamp) {
  if (!timestamp) return '--';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) {
    return 'Ahora mismo';
  } else if (diff < 3600000) {
    return `Hace ${Math.floor(diff / 60000)} minutos`;
  } else if (diff < 86400000) {
    return `Hace ${Math.floor(diff / 3600000)} horas`;
  } else {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// ============================================
// EXPORTAR FUNCIONES PARA app.js
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLocationSystem,
    cleanupLocationSystem,
    forceLocationUpdate
  };
}
