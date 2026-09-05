// ============================================
// CALENDARIO LOVESPACE - SISTEMA COMPLETO
// ============================================

const CalendarState = {
  currentDate: new Date(),
  selectedDate: null,
  events: {},
  isInitialized: false
};

// ============================================
// INICIALIZACIÓN
// ============================================
function initializeCalendar() {
  if (CalendarState.isInitialized) {
    console.log('⚠ Calendario ya inicializado');
    return;
  }
  
  console.log('📅 Inicializando calendario...');
  
  // Configurar listeners
  setupCalendarListeners();
  
  // Renderizar calendario
  renderCalendar();
  
  // Cargar eventos del mes actual
  loadCalendarEvents();
  
  CalendarState.isInitialized = true;
  console.log('✓ Calendario inicializado');
}

// ============================================
// LISTENERS
// ============================================
function setupCalendarListeners() {
  const prevMonthBtn = document.getElementById('calendarPrevMonth');
  const nextMonthBtn = document.getElementById('calendarNextMonth');
  const addEventBtn = document.getElementById('calendarAddEvent');
  const todayBtn = document.getElementById('calendarToday');
  const eventForm = document.getElementById('calendarEventForm');
  
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      CalendarState.currentDate.setMonth(CalendarState.currentDate.getMonth() - 1);
      renderCalendar();
      loadCalendarEvents();
    });
  }
  
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      CalendarState.currentDate.setMonth(CalendarState.currentDate.getMonth() + 1);
      renderCalendar();
      loadCalendarEvents();
    });
  }
  
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      CalendarState.currentDate = new Date();
      renderCalendar();
      loadCalendarEvents();
    });
  }
  
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      openEventModal();
    });
  }
  
  if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEvent();
    });
  }
}

// ============================================
// RENDERIZADO DEL CALENDARIO
// ============================================
function renderCalendar() {
  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth();
  
  // Actualizar título del mes
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthTitle = document.getElementById('calendarMonthTitle');
  if (monthTitle) {
    monthTitle.textContent = `${monthNames[month]} ${year}`;
  }
  
  // Calcular días del mes
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  
  // Renderizar grid
  const calendarGrid = document.getElementById('calendarGrid');
  if (!calendarGrid) return;
  
  calendarGrid.innerHTML = '';
  
  // Días vacíos antes del primer día
  for (let i = 0; i < startingDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-cell calendar-cell-empty';
    calendarGrid.appendChild(emptyCell);
  }
  
  // Días del mes
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Marcar hoy
    const isToday = today.getDate() === day && 
                   today.getMonth() === month && 
                   today.getFullYear() === year;
    
    if (isToday) {
      cell.classList.add('calendar-cell-today');
    }
    
    // Marcar seleccionado
    if (CalendarState.selectedDate === dateStr) {
      cell.classList.add('calendar-cell-selected');
    }
    
    // Marcar días con eventos
    if (CalendarState.events[dateStr] && CalendarState.events[dateStr].length > 0) {
      cell.classList.add('calendar-cell-has-events');
      
      // Agregar indicador de eventos
      const eventIndicator = document.createElement('div');
      eventIndicator.className = 'calendar-event-indicator';
      cell.appendChild(eventIndicator);
    }
    
    // Número del día
    const dayNumber = document.createElement('span');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);
    
    // Click en el día
    cell.addEventListener('click', () => {
      selectDate(dateStr);
    });
    
    calendarGrid.appendChild(cell);
  }
}

// ============================================
// SELECCIÓN DE FECHA
// ============================================
function selectDate(dateStr) {
  CalendarState.selectedDate = dateStr;
  renderCalendar();
  showDayEvents(dateStr);
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
  
  try {
    const db = getDB();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    const eventsSnapshot = await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .where('fecha', '>=', startDate)
      .where('fecha', '<=', endDate)
      .get();
    
    CalendarState.events = {};
    
    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.fecha.toDate();
      const dateStr = date.toISOString().split('T')[0];
      
      if (!CalendarState.events[dateStr]) {
        CalendarState.events[dateStr] = [];
      }
      
      CalendarState.events[dateStr].push({
        id: doc.id,
        titulo: data.titulo,
        descripcion: data.descripcion,
        color: data.color || '#ff6b6b',
        fecha: date
      });
    });
    
    console.log(`✓ ${eventsSnapshot.size} eventos cargados para ${year}-${month + 1}`);
    renderCalendar();
    
  } catch (error) {
    console.error('✗ Error al cargar eventos:', error);
    showNotification('Error al cargar eventos del calendario', 'error');
  }
}

// ============================================
// MOSTRAR EVENTOS DEL DÍA
// ============================================
function showDayEvents(dateStr) {
  const eventsPanel = document.getElementById('calendarEventsPanel');
  const eventsList = document.getElementById('calendarEventsList');
  const eventsTitle = document.getElementById('calendarEventsTitle');
  
  if (!eventsPanel || !eventsList || !eventsTitle) return;
  
  const date = new Date(dateStr);
  eventsTitle.textContent = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  const events = CalendarState.events[dateStr] || [];
  
  if (events.length > 0) {
    eventsList.innerHTML = events.map(event => `
      <div class="calendar-event-item">
        <div class="calendar-event-color" style="background: ${event.color}"></div>
        <div class="calendar-event-content">
          <h4 class="calendar-event-title">${event.titulo}</h4>
          <p class="calendar-event-description">${event.descripcion || ''}</p>
        </div>
        <button class="calendar-event-delete" onclick="deleteEvent('${event.id}', '${dateStr}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `).join('');
  } else {
    eventsList.innerHTML = `
      <div class="calendar-empty-state">
        <span class="calendar-empty-icon">📅</span>
        <p>No hay eventos este día</p>
        <button class="btn btn-primary btn-small" onclick="openEventModal('${dateStr}')">
          Añadir evento
        </button>
      </div>
    `;
  }
  
  eventsPanel.classList.remove('hidden');
}

// ============================================
// MODAL PARA AÑADIR EVENTO
// ============================================
function openEventModal(dateStr = null) {
  const modal = document.getElementById('calendarEventModal');
  const form = document.getElementById('calendarEventForm');
  const dateInput = document.getElementById('eventDate');
  
  if (!modal || !form || !dateInput) return;
  
  // Resetear formulario
  form.reset();
  
  // Establecer fecha
  if (dateStr) {
    dateInput.value = dateStr;
  } else if (CalendarState.selectedDate) {
    dateInput.value = CalendarState.selectedDate;
  } else {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  modal.classList.remove('hidden');
}

function closeEventModal() {
  const modal = document.getElementById('calendarEventModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ============================================
// GUARDAR EVENTO
// ============================================
async function saveEvent() {
  const form = document.getElementById('calendarEventForm');
  const titulo = document.getElementById('eventTitle').value;
  const descripcion = document.getElementById('eventDescription').value;
  const fecha = document.getElementById('eventDate').value;
  const color = document.getElementById('eventColor').value;
  
  if (!titulo || !fecha) {
    showNotification('Por favor completa el título y la fecha', 'error');
    return;
  }
  
  try {
    const db = getDB();
    const eventDate = new Date(fecha + 'T00:00:00');
    
    await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .add({
        titulo,
        descripcion,
        fecha: eventDate,
        color,
        creadoPor: AppState.currentUser.uid,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    console.log('✓ Evento guardado');
    showNotification('Evento guardado correctamente', 'success');
    
    closeEventModal();
    
    // Recargar eventos
    const eventMonth = eventDate.getMonth();
    const eventYear = eventDate.getFullYear();
    
    if (eventMonth === CalendarState.currentDate.getMonth() && 
        eventYear === CalendarState.currentDate.getFullYear()) {
      await loadCalendarEvents();
    } else {
      CalendarState.currentDate = eventDate;
      renderCalendar();
      await loadCalendarEvents();
    }
    
    // Si el día está seleccionado, actualizar la vista
    if (CalendarState.selectedDate === fecha) {
      showDayEvents(fecha);
    }
    
  } catch (error) {
    console.error('✗ Error al guardar evento:', error);
    showNotification('Error al guardar evento', 'error');
  }
}

// ============================================
// ELIMINAR EVENTO
// ============================================
async function deleteEvent(eventId, dateStr) {
  if (!confirm('¿Estás seguro de eliminar este evento?')) return;
  
  try {
    const db = getDB();
    await db.collection('couples')
      .doc(AppState.coupleId)
      .collection('calendario')
      .doc(eventId)
      .delete();
    
    console.log('✓ Evento eliminado');
    showNotification('Evento eliminado', 'success');
    
    // Recargar eventos
    await loadCalendarEvents();
    
    // Actualizar vista del día
    if (CalendarState.selectedDate === dateStr) {
      showDayEvents(dateStr);
    }
    
  } catch (error) {
    console.error('✗ Error al eliminar evento:', error);
    showNotification('Error al eliminar evento', 'error');
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
