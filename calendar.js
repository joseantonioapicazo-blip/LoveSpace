// ============================================
// CALENDARIO TWO-COFFE - SISTEMA COMPLETO
// ============================================

const CalendarState = {
  currentDate: new Date(),
  selectedDate: null,
  events: {},
  isInitialized: false,
  listenersSetup: false,
  currentMonthQuery: `${new Date().getFullYear()}-${new Date().getMonth()}` // Para rastrear la consulta actual
};

// ============================================
// ELEMENTOS (cacheados después de la inicialización)
// ============================================
let monthTitle, calendarGrid, selectedDayTitle, selectedDayEvents, eventModal, eventForm, eventTitle, eventDate, eventDescription, eventColor;

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
}

// ============================================
// VALIDAR ELEMENTOS DEL DOM
// ============================================
function validateCalendarElements() {
  return monthTitle && calendarGrid && selectedDayTitle && selectedDayEvents &&
         eventModal && eventForm && eventTitle && eventDate && eventDescription && eventColor;
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
    item.innerHTML = `
      <div class="event-color" style="background:${escapeHTML(event.color)}"></div>
      <div class="day-event-content">
        <div class="day-event-title">${escapeHTML(event.titulo)}</div>
        ${event.descripcion ? `<div class="day-event-description">${escapeHTML(event.descripcion)}</div>` : ""}
      </div>
      <button class="delete-event" data-id="${escapeHTML(event.id)}">Eliminar</button>
    `;
    item.querySelector(".delete-event").addEventListener("click", () => deleteEvent(event.id));
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
        fecha: date
      });
    });

    console.log(`✓ ${eventsSnapshot.size} eventos cargados para ${year}-${month + 1}`);
    renderCalendar();
    if (CalendarState.selectedDate) {
      renderSelectedDay();
    }

  } catch (error) {
    console.error('✗ Error al cargar eventos:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al cargar eventos del calendario', 'error');
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

    await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .add({
        titulo: title,
        descripcion: description,
        fecha: eventDate,
        color: color || '#8b6254',
        creadoPor: AppState.currentUser.uid,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      });

    console.log('✓ Evento guardado');
    if (typeof showNotification === 'function') {
      showNotification('Evento guardado correctamente', 'success');
    }

    closeEventModal();

    CalendarState.selectedDate = date;
    const selected = parseDateKey(date);
    CalendarState.currentDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
    CalendarState.currentMonthQuery = `${selected.getFullYear()}-${selected.getMonth()}`;

    await loadCalendarEvents();

  } catch (error) {
    console.error('✗ Error al guardar evento:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al guardar evento', 'error');
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
    console.error('✗ Evento no encontrado:', id);
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

    console.log('✓ Evento eliminado');
    if (typeof showNotification === 'function') {
      showNotification('Evento eliminado', 'success');
    }

    await loadCalendarEvents();

  } catch (error) {
    console.error('✗ Error al eliminar evento:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error al eliminar evento', 'error');
    }
  }
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
