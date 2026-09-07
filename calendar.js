// ============================================
// CALENDARIO TWO-COFFE - SISTEMA COMPLETO
// ============================================

const CalendarState = {
  currentDate: new Date(),
  selectedDate: null,
  events: {},
  isInitialized: false,
  listenersSetup: false,
  currentMonthQuery: `${new Date().getFullYear()}-${new Date().getMonth()}`, // Para rastrear la consulta actual
  selectedPhotos: [], // Array para almacenar fotos seleccionadas temporalmente
  selectedSong: null // Objeto para almacenar canción seleccionada temporalmente
};

// ============================================
// ELEMENTOS (cacheados después de la inicialización)
// ============================================
let monthTitle, calendarGrid, selectedDayTitle, selectedDayEvents, eventModal, eventForm, eventTitle, eventDate, eventDescription, eventColor, photoUploadArea, photoInput, photoPreviewGallery, songUrl, addSongButton, songPreview;

// ============================================
// UTILIDADES DE FECHA
// ============================================
function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(key) {
  return parseDateKey(key).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================
// INICIALIZACIÓN
// ============================================
function initializeCalendar() {
  console.log('📅 Inicializando calendario...');

  // Cache elementos del DOM
  cacheCalendarElements();

  // Verificar que existan los elementos
  if (!validateCalendarElements()) {
    console.error('✗ Elementos del calendario no encontrados');
    return;
  }

  // Configurar listeners solo una vez
  if (!CalendarState.listenersSetup) {
    setupCalendarListeners();
    CalendarState.listenersSetup = true;
  }

  // Renderizar calendario
  renderCalendar();

  // Cargar eventos del mes actual
  loadCalendarEvents();

  CalendarState.isInitialized = true;
  console.log('✓ Calendario inicializado');
}

// ============================================
// CACHEAR ELEMENTOS DEL DOM
// ============================================
function cacheCalendarElements() {
  monthTitle = document.getElementById("monthTitle");
  calendarGrid = document.getElementById("calendarGrid");
  selectedDayTitle = document.getElementById("selectedDayTitle");
  selectedDayEvents = document.getElementById("selectedDayEvents");
  eventModal = document.getElementById("eventModal");
  eventForm = document.getElementById("eventForm");
  eventTitle = document.getElementById("eventTitle");
  eventDate = document.getElementById("eventDate");
  eventDescription = document.getElementById("eventDescription");
  eventColor = document.getElementById("eventColor");
  photoUploadArea = document.getElementById("photoUploadArea");
  photoInput = document.getElementById("photoInput");
  photoPreviewGallery = document.getElementById("photoPreviewGallery");
  songUrl = document.getElementById("songUrl");
  addSongButton = document.getElementById("addSongButton");
  songPreview = document.getElementById("songPreview");
}

// ============================================
// VALIDAR ELEMENTOS DEL DOM
// ============================================
function validateCalendarElements() {
  return monthTitle && calendarGrid && selectedDayTitle && selectedDayEvents &&
         eventModal && eventForm && eventTitle && eventDate && eventDescription && eventColor &&
         photoUploadArea && photoInput && photoPreviewGallery && songUrl && addSongButton && songPreview;
}

// ============================================
// LISTENERS
// ============================================
function setupCalendarListeners() {
  console.log('📅 Configurando listeners del calendario...');

  // Navegación de meses
  document.getElementById("previousMonth").addEventListener("click", () => {
    CalendarState.currentDate = new Date(
      CalendarState.currentDate.getFullYear(),
      CalendarState.currentDate.getMonth() - 1,
      1
    );
    CalendarState.currentMonthQuery = `${CalendarState.currentDate.getFullYear()}-${CalendarState.currentDate.getMonth()}`;
    renderCalendar();
    loadCalendarEvents();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    CalendarState.currentDate = new Date(
      CalendarState.currentDate.getFullYear(),
      CalendarState.currentDate.getMonth() + 1,
      1
    );
    CalendarState.currentMonthQuery = `${CalendarState.currentDate.getFullYear()}-${CalendarState.currentDate.getMonth()}`;
    renderCalendar();
    loadCalendarEvents();
  });

  // Botón hoy
  document.getElementById("todayButton").addEventListener("click", () => {
    const today = new Date();
    CalendarState.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
    CalendarState.selectedDate = dateKey(today);
    CalendarState.currentMonthQuery = `${today.getFullYear()}-${today.getMonth()}`;
    renderCalendar();
    renderSelectedDay();
    loadCalendarEvents();
  });

  // Botones agregar
  document.getElementById("addEventButton").addEventListener("click", () => openEventModal());
  document.getElementById("addSelectedDayEvent").addEventListener("click", () => {
    if (CalendarState.selectedDate) {
      openEventModal(CalendarState.selectedDate);
    } else {
      openEventModal();
    }
  });

  // Formulario
  eventForm.addEventListener("submit", saveEvent);

  // Modal
  document.getElementById("closeModal").addEventListener("click", closeEventModal);
  document.getElementById("cancelModal").addEventListener("click", closeEventModal);
  eventModal.addEventListener("click", (event) => {
    if (event.target === eventModal) closeEventModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && eventModal.classList.contains("open")) closeEventModal();
  });

  // Selección de color
  document.querySelectorAll(".color-option").forEach(option => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".color-option").forEach(item => item.classList.remove("selected"));
      option.classList.add("selected");
      eventColor.value = option.dataset.color;
    });
  });

  // Upload de fotos
  photoUploadArea.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", handlePhotoUpload);

  // Agregar canción
  addSongButton.addEventListener("click", handleAddSong);

  console.log('✓ Listeners del calendario configurados');
}

// ============================================
// RENDERIZADO DEL CALENDARIO
// ============================================
function renderCalendar() {
  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth();

  monthTitle.textContent = new Date(year, month, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric"
  });

  calendarGrid.innerHTML = "";

  // JS devuelve domingo = 0. Convertimos para que lunes sea el primer día.
  const firstDay = new Date(year, month, 1).getDay();
  const mondayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();

  // 42 celdas garantizan una cuadrícula completa de 6 semanas.
  for (let i = 0; i < 42; i++) {
    let dayNumber;
    let cellDate;
    let isOtherMonth = false;

    if (i < mondayIndex) {
      dayNumber = daysInPreviousMonth - mondayIndex + i + 1;
      cellDate = new Date(year, month - 1, dayNumber);
      isOtherMonth = true;
    } else if (i >= mondayIndex + daysInMonth) {
      dayNumber = i - mondayIndex - daysInMonth + 1;
      cellDate = new Date(year, month + 1, dayNumber);
      isOtherMonth = true;
    } else {
      dayNumber = i - mondayIndex + 1;
      cellDate = new Date(year, month, dayNumber);
    }

    const key = dateKey(cellDate);
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    if (isOtherMonth) {
      cell.classList.add("other-month");
    }

    if (key === dateKey(new Date())) {
      cell.classList.add("today");
    }

    if (CalendarState.selectedDate === key) {
      cell.classList.add("selected");
    }

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = dayNumber;
    cell.appendChild(number);

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "day-events";

    const dayEvents = CalendarState.events[key] || [];

    dayEvents.slice(0, 4).forEach(event => {
      const eventButton = document.createElement("button");
      eventButton.className = "calendar-event";
      eventButton.style.borderLeftColor = event.color;
      eventButton.textContent = event.titulo;
      eventButton.title = event.titulo;
      eventButton.addEventListener("click", (eventClick) => {
        eventClick.stopPropagation();
        selectDate(key);
      });
      eventsContainer.appendChild(eventButton);
    });

    if (dayEvents.length > 4) {
      const more = document.createElement("div");
      more.style.fontSize = "10px";
      more.style.color = "var(--muted)";
      more.textContent = `+${dayEvents.length - 4} más`;
      eventsContainer.appendChild(more);
    }

    cell.appendChild(eventsContainer);

    cell.addEventListener("click", () => selectDate(key));

    calendarGrid.appendChild(cell);
  }
}

// ============================================
// SELECCIONAR DÍA
// ============================================
function selectDate(key) {
  CalendarState.selectedDate = key;
  const selected = parseDateKey(key);

  // Si el usuario selecciona un día de otro mes, el calendario cambia automáticamente.
  if (selected.getMonth() !== CalendarState.currentDate.getMonth() ||
      selected.getFullYear() !== CalendarState.currentDate.getFullYear()) {
    CalendarState.currentDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
    CalendarState.currentMonthQuery = `${selected.getFullYear()}-${selected.getMonth()}`;
  }

  renderCalendar();
  renderSelectedDay();
}

// ============================================
// RECUERDOS DEL DÍA
// ============================================
function renderSelectedDay() {
  if (!CalendarState.selectedDate) {
    selectedDayTitle.textContent = "Selecciona un día";
    selectedDayEvents.innerHTML = `<div class="empty">Selecciona un día para ver sus recuerdos.</div>`;
    return;
  }

  selectedDayTitle.textContent = formatLongDate(CalendarState.selectedDate);

  const events = CalendarState.events[CalendarState.selectedDate] || [];

  if (!events.length) {
    selectedDayEvents.innerHTML = `<div class="empty">No hay recuerdos para este día.</div>`;
    return;
  }

  selectedDayEvents.innerHTML = "";

  events.forEach(event => {
    const item = document.createElement("div");
    item.className = "day-event-item";
    item.style.position = "relative";

    let extraContent = "";

    // Mostrar fotos si existen
    if (event.fotos && event.fotos.length > 0) {
      extraContent += `
        <div class="memory-photos">
          ${event.fotos.map(foto => `
            <div class="memory-photo">
              <img src="${escapeHTML(foto)}" alt="Foto del recuerdo">
            </div>
          `).join('')}
        </div>
      `;
    }

    // Mostrar canción si existe
    if (event.cancion) {
      const song = event.cancion;
      extraContent += `
        <div class="memory-song">
          <div class="memory-song-cover">🎵</div>
          <div class="memory-song-info">
            <div class="memory-song-title">Canción de ${song.platform ? song.platform.charAt(0).toUpperCase() + song.platform.slice(1) : 'Música'}</div>
            <div class="memory-song-artist">${song.url ? new URL(song.url).hostname : 'N/A'}</div>
          </div>
          <button type="button" class="memory-song-play" onclick="window.open('${escapeHTML(song.url)}', '_blank')">▶</button>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="event-color" style="background:${escapeHTML(event.color)}"></div>
      <div class="day-event-content">
        <div class="day-event-title">${escapeHTML(event.titulo)}</div>
        ${event.descripcion ? `<div class="day-event-description">${escapeHTML(event.descripcion)}</div>` : ""}
        ${extraContent}
        <div class="memory-actions">
          <button class="share-button" data-platform="instagram" data-id="${escapeHTML(event.id)}">📷 Instagram</button>
          <button class="share-button" data-platform="facebook" data-id="${escapeHTML(event.id)}">📘 Facebook</button>
          <button class="share-button" data-platform="whatsapp" data-id="${escapeHTML(event.id)}">💬 WhatsApp</button>
          <button class="share-button" data-platform="copy" data-id="${escapeHTML(event.id)}">📋 Copiar</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
        <button class="delete-event" data-id="${escapeHTML(event.id)}">Eliminar</button>
      </div>
    `;

    item.querySelector(".delete-event").addEventListener("click", () => deleteEvent(event.id));

    // Agregar listeners a los botones de compartir
    item.querySelectorAll(".share-button").forEach(button => {
      button.addEventListener("click", (e) => {
        const platform = button.dataset.platform;
        handleShare(event, platform);
      });
    });

    selectedDayEvents.appendChild(item);
  });
}

// ============================================
// CARGAR EVENTOS DESDE FIRESTORE
// ============================================
async function loadCalendarEvents() {
  if (!AppState.coupleId) {
    console.log('⚠ No hay coupleId, no se pueden cargar eventos');
    return;
  }

  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth();

  // Crear identificador único para esta consulta
  const queryId = `${year}-${month}`;

  try {
    const db = getDB();
    const startDate = new Date(year, month, 1);
    // Usar el primer día del siguiente mes para incluir todos los eventos del mes actual
    const endDate = new Date(year, month + 1, 1);

    const eventsSnapshot = await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .where('fecha', '>=', startDate)
      .where('fecha', '<', endDate)
      .get();

    // Verificar que esta consulta sigue siendo relevante
    if (CalendarState.currentMonthQuery !== queryId) {
      console.log('⚠ Consulta obsoleta ignorada:', queryId);
      return;
    }

    CalendarState.events = {};

    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.fecha.toDate();
      const dateStr = dateKey(date);

      if (!CalendarState.events[dateStr]) {
        CalendarState.events[dateStr] = [];
      }

      CalendarState.events[dateStr].push({
        id: doc.id,
        titulo: data.titulo,
        descripcion: data.descripcion,
        color: data.color || '#8b6254',
        fecha: date,
        fotos: data.fotos || [],
        cancion: data.cancion || null
      });
    });

    console.log(`✓ ${eventsSnapshot.size} eventos cargados para ${year}-${month + 1}`);
    renderCalendar();
    if (CalendarState.selectedDate) {
      renderSelectedDay();
    }

  } catch (error) {
    console.error('✗ Error al cargar recuerdos:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al cargar recuerdos del calendario', 'error');
    }
  }
}

// ============================================
// MODAL PARA AGREGAR RECUERDO
// ============================================
function openEventModal(date = null) {
  eventForm.reset();
  eventColor.value = "#8b6254";
  document.querySelectorAll(".color-option").forEach(option => option.classList.remove("selected"));
  document.querySelector('.color-option[data-color="#8b6254"]').classList.add("selected");

  // Limpiar estado temporal
  CalendarState.selectedPhotos = [];
  CalendarState.selectedSong = null;
  photoPreviewGallery.innerHTML = "";
  songPreview.style.display = "none";
  songUrl.value = "";

  if (date) {
    eventDate.value = date;
  } else if (CalendarState.selectedDate) {
    eventDate.value = CalendarState.selectedDate;
  } else {
    eventDate.value = dateKey(new Date());
  }

  eventModal.classList.add("open");
  setTimeout(() => eventTitle.focus(), 50);
}

function closeEventModal() {
  eventModal.classList.remove("open");
  // Limpiar estado temporal al cerrar
  CalendarState.selectedPhotos = [];
  CalendarState.selectedSong = null;
}

// ============================================
// MANEJO DE FOTOS
// ============================================
function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData = {
          file: file,
          dataUrl: e.target.result,
          name: file.name
        };
        CalendarState.selectedPhotos.push(photoData);
        renderPhotoPreview();
      };
      reader.readAsDataURL(file);
    }
  });
  // Reset input para permitir seleccionar la misma foto
  event.target.value = '';
}

function renderPhotoPreview() {
  photoPreviewGallery.innerHTML = "";
  CalendarState.selectedPhotos.forEach((photo, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "memory-preview-item";
    previewItem.innerHTML = `
      <img src="${photo.dataUrl}" alt="${photo.name}">
      <button type="button" class="memory-preview-remove" data-index="${index}">×</button>
    `;
    previewItem.querySelector(".memory-preview-remove").addEventListener("click", (e) => {
      e.preventDefault();
      CalendarState.selectedPhotos.splice(index, 1);
      renderPhotoPreview();
    });
    photoPreviewGallery.appendChild(previewItem);
  });
}

// ============================================
// MANEJO DE CANCIONES
// ============================================
function handleAddSong() {
  const url = songUrl.value.trim();
  if (!url) return;

  // Intentar identificar la plataforma y extraer información básica
  let platform = "other";
  let songInfo = { url: url, platform: platform };

  if (url.includes("spotify.com")) {
    platform = "spotify";
    // Extraer información básica de Spotify si es posible
    const match = url.match(/track\/([^?]+)/);
    if (match) {
      songInfo.id = match[1];
    }
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
    // Extraer ID de YouTube
    if (url.includes("youtu.be")) {
      const match = url.match(/youtu\.be\/([^?]+)/);
      if (match) songInfo.id = match[1];
    } else {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) songInfo.id = match[1];
    }
  }

  songInfo.platform = platform;
  CalendarState.selectedSong = songInfo;

  // Mostrar vista previa
  songPreview.style.display = "block";
  songPreview.innerHTML = `
    <div class="memory-song">
      <div class="memory-song-cover">🎵</div>
      <div class="memory-song-info">
        <div class="memory-song-title">Canción de ${platform.charAt(0).toUpperCase() + platform.slice(1)}</div>
        <div class="memory-song-artist">ID: ${songInfo.id || 'N/A'}</div>
      </div>
      <button type="button" class="memory-song-play" onclick="window.open('${url}', '_blank')">▶</button>
      <button type="button" class="memory-preview-remove" style="position:static;margin-left:8px;">×</button>
    </div>
  `;

  songPreview.querySelector(".memory-preview-remove").addEventListener("click", () => {
    CalendarState.selectedSong = null;
    songPreview.style.display = "none";
    songUrl.value = "";
  });
}

// ============================================
// GUARDAR EVENTO
// ============================================
async function saveEvent(event) {
  event.preventDefault();

  // Validaciones
  if (!AppState.coupleId) {
    console.error('✗ No hay coupleId');
    if (typeof showNotification === 'function') {
      showNotification('Error: no hay pareja conectada', 'error');
    }
    return;
  }

  if (!AppState.currentUser || !AppState.currentUser.uid) {
    console.error('✗ No hay usuario autenticado');
    if (typeof showNotification === 'function') {
      showNotification('Error: usuario no autenticado', 'error');
    }
    return;
  }

  const title = eventTitle.value.trim();
  const date = eventDate.value;
  const description = eventDescription.value.trim();
  const color = eventColor.value;

  if (!title) {
    if (typeof showNotification === 'function') {
      showNotification('El título es obligatorio', 'error');
    }
    return;
  }

  if (!date) {
    if (typeof showNotification === 'function') {
      showNotification('La fecha es obligatoria', 'error');
    }
    return;
  }

  try {
    const db = getDB();
    // Parsear la fecha localmente sin timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);

    // Preparar datos multimedia
    // NOTA: Las fotos se guardan temporalmente como base64 hasta que Firebase Storage esté configurado
    // Esto es una solución temporal que permite la funcionalidad sin inventar APIs inexistentes
    const fotosData = CalendarState.selectedPhotos.map(photo => photo.dataUrl);

    const eventData = {
      titulo: title,
      descripcion: description,
      fecha: eventDate,
      color: color || '#8b6254',
      creadoPor: AppState.currentUser.uid,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Agregar fotos si existen
    if (fotosData.length > 0) {
      eventData.fotos = fotosData;
    }

    // Agregar canción si existe
    if (CalendarState.selectedSong) {
      eventData.cancion = CalendarState.selectedSong;
    }

    await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .add(eventData);

    console.log('✓ Recuerdo guardado');
    if (typeof showNotification === 'function') {
      showNotification('Recuerdo guardado correctamente', 'success');
    }

    closeEventModal();

    CalendarState.selectedDate = date;
    const selected = parseDateKey(date);
    CalendarState.currentDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
    CalendarState.currentMonthQuery = `${selected.getFullYear()}-${selected.getMonth()}`;

    await loadCalendarEvents();

  } catch (error) {
    console.error('✗ Error al guardar recuerdo:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al guardar recuerdo', 'error');
    }
  }
}

// ============================================
// ELIMINAR EVENTO
// ============================================
async function deleteEvent(id) {
  // Validaciones
  if (!AppState.coupleId) {
    console.error('✗ No hay coupleId');
    if (typeof showNotification === 'function') {
      showNotification('Error: no hay pareja conectada', 'error');
    }
    return;
  }

  const event = Object.values(CalendarState.events).flat().find(item => item.id === id);
  if (!event) {
    console.error('✗ Recuerdo no encontrado:', id);
    return;
  }

  const confirmed = window.confirm(`¿Eliminar "${event.titulo}"?`);
  if (!confirmed) return;

  try {
    const db = getDB();
    await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .doc(id)
      .delete();

    console.log('✓ Recuerdo eliminado');
    if (typeof showNotification === 'function') {
      showNotification('Recuerdo eliminado', 'success');
    }

    await loadCalendarEvents();

  } catch (error) {
    console.error('✗ Error al eliminar recuerdo:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al eliminar recuerdo', 'error');
    }
  }
}

// ============================================
// COMPARTIR RECUERDOS
// ============================================

function handleShare(event, platform) {
  const shareData = generateShareContent(event);

  switch (platform) {
    case 'instagram':
      // Instagram no permite compartir directamente desde web sin API oficial
      if (navigator.share) {
        navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.url
        }).catch(err => console.log('Error al compartir:', err));
      } else {
        copyToClipboard(shareData.text);
        if (typeof showNotification === 'function') {
          showNotification('Contenido copiado para Instagram', 'success');
        }
      }
      break;

    case 'facebook':
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&quote=${encodeURIComponent(shareData.text)}`;
      window.open(fbUrl, '_blank', 'width=600,height=400');
      break;

    case 'whatsapp':
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`;
      window.open(waUrl, '_blank');
      break;

    case 'copy':
      copyToClipboard(shareData.text + ' ' + shareData.url);
      if (typeof showNotification === 'function') {
        showNotification('Contenido copiado al portapapeles', 'success');
      }
      break;
  }
}

function generateShareContent(event) {
  const dateStr = formatLongDate(dateKey(event.fecha));
  let text = `💕 Recuerdo especial del ${dateStr}\n\n`;
  text += `"${event.titulo}"\n`;

  if (event.descripcion) {
    text += `\n${event.descripcion}\n`;
  }

  if (event.cancion) {
    text += `\n🎵 Canción: ${event.cancion.url}\n`;
  }

  text += `\n— Compartido desde LoveSpace`;

  return {
    title: event.titulo,
    text: text,
    url: window.location.href // URL actual de la app
  };
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Error al copiar:', err);
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Error al copiar:', err);
  }
  document.body.removeChild(textArea);
}

// ============================================
// GENERAR TARJETA DE COMPARTIR (PREPARACIÓN)
// ============================================
function generateShareCard(memory) {
  // Esta función está preparada para futura implementación
  // Podría generar una imagen/canvas visual del recuerdo para compartir
  // Por ahora devuelve los datos estructurados para uso futuro

  return {
    date: formatLongDate(dateKey(memory.fecha)),
    title: memory.titulo,
    description: memory.descripcion,
    photos: memory.fotos || [],
    song: memory.cancion || null,
    color: memory.color,
    brand: 'LoveSpace'
  };
}

// ============================================
// EXPORTAR FUNCIONES
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeCalendar,
    renderCalendar,
    loadCalendarEvents,
    openEventModal,
    closeEventModal,
    saveEvent,
    deleteEvent
  };
}

console.log('✓ calendar.js cargado correctamente');
