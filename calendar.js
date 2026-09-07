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
  console.log('📅 Inicializando calendario...');
  
  // Resetear estado para permitir re-inicialización
  CalendarState.isInitialized = false;
  
  // Configurar listeners
  setupCalendarListeners();
  
  // Esperar a que el DOM esté listo
  setTimeout(() => {
    renderCalendarGrid();
    
    // Cargar eventos del mes actual
    loadCalendarEvents();
    
    CalendarState.isInitialized = true;
    console.log('✓ Calendario inicializado');
  }, 100);
}

// ============================================
// LISTENERS
// ============================================
function setupCalendarListeners() {
  console.log('📅 Configurando listeners del calendario...');

  const prevMonthBtn = document.getElementById('previousMonth');
  const nextMonthBtn = document.getElementById('nextMonth');
  const addEventBtn = document.getElementById('addEventButton');
  const todayBtn = document.getElementById('todayButton');
  const addSelectedDayEventBtn = document.getElementById('addSelectedDayEvent');
  const eventForm = document.getElementById('eventForm');

  console.log(`  - prevMonthBtn: ${prevMonthBtn ? '✓' : '✗'}`);
  console.log(`  - nextMonthBtn: ${nextMonthBtn ? '✓' : '✗'}`);
  console.log(`  - addEventBtn: ${addEventBtn ? '✓' : '✗'}`);
  console.log(`  - todayBtn: ${todayBtn ? '✓' : '✗'}`);
  console.log(`  - addSelectedDayEventBtn: ${addSelectedDayEventBtn ? '✓' : '✗'}`);
  console.log(`  - eventForm: ${eventForm ? '✓' : '✗'}`);

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      console.log('📅 Botón mes anterior clickeado');
      CalendarState.currentDate.setMonth(CalendarState.currentDate.getMonth() - 1);
      renderCalendarGrid();
      loadCalendarEvents();
    });
  } else {
    console.error('✗ previousMonth no encontrado');
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      console.log('📅 Botón mes siguiente clickeado');
      CalendarState.currentDate.setMonth(CalendarState.currentDate.getMonth() + 1);
      renderCalendarGrid();
      loadCalendarEvents();
    });
  } else {
    console.error('✗ nextMonth no encontrado');
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      console.log('📅 Botón hoy clickeado');
      CalendarState.currentDate = new Date();
      CalendarState.selectedDate = dateKey(new Date());
      renderCalendarGrid();
      renderSelectedDay();
      loadCalendarEvents();
    });
  } else {
    console.error('✗ todayButton no encontrado');
  }

  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      console.log('📅 Botón añadir evento clickeado');
      calendarOpenEventModal();
    });
  } else {
    console.error('✗ addEventButton no encontrado');
  }

  if (addSelectedDayEventBtn) {
    addSelectedDayEventBtn.addEventListener('click', () => {
      console.log('📅 Botón añadir evento día seleccionado clickeado');
      if (CalendarState.selectedDate) {
        calendarOpenEventModal(CalendarState.selectedDate);
      } else {
        calendarOpenEventModal();
      }
    });
  } else {
    console.error('✗ addSelectedDayEvent no encontrado');
  }

  if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      calendarSaveEvent();
    });
  }

  // Cerrar modal
  const closeModal = document.getElementById('closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', calendarCloseEventModal);
  }

  const cancelModal = document.getElementById('cancelModal');
  if (cancelModal) {
    cancelModal.addEventListener('click', calendarCloseEventModal);
  }

  // Selección de color
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(item => item.classList.remove('selected'));
      option.classList.add('selected');
      document.getElementById('eventColor').value = option.dataset.color;
    });
  });

  console.log('✓ Listeners del calendario configurados');
}

// ============================================
// RENDERIZADO DEL CALENDARIO
// ============================================
function renderCalendarGrid() {
  console.log('📅 Renderizando calendario...');
  
  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth();
  
  console.log(`  - Año: ${year}, Mes: ${month}`);
  
  // Actualizar título del mes
  const monthTitle = document.getElementById('monthTitle');
  if (monthTitle) {
    monthTitle.textContent = new Date(year, month, 1).toLocaleDateString('es-MX', {
      month: 'long',
      year: 'numeric'
    });
    console.log(`  - Título actualizado`);
  } else {
    console.error(' monthTitle no encontrado');
  }
  
  // Calcular días del mes
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  console.log(`  - Primer día del mes: ${firstDay.toDateString()} (día de semana: ${startingDay})`);
  console.log(`  - Día inicial: ${startingDay}, Total días: ${totalDays}`);
  
  // Convertir para que lunes sea el primer día
  const mondayIndex = startingDay === 0 ? 6 : startingDay - 1;
  
  // Renderizar grid
  const calendarGrid = document.getElementById('calendarGrid');
  if (!calendarGrid) {
    console.error(' calendarGrid no encontrado');
    return;
  }
  
  console.log('  - Limpiando grid...');
  calendarGrid.innerHTML = '';
  
  // Días del mes anterior
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  for (let i = 0; i < mondayIndex; i++) {
    const dayNumber = daysInPreviousMonth - mondayIndex + i + 1;
    const cell = document.createElement('div');
    cell.className = 'calendar-day other-month';
    cell.innerHTML = `<div class="day-number">${dayNumber}</div>`;
    calendarGrid.appendChild(cell);
  }
  
  // Días del mes
  const today = new Date();
  console.log(`  - Agregando ${totalDays} días del mes`);
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Marcar hoy
    const isToday = today.getDate() === day &&
                   today.getMonth() === month &&
                   today.getFullYear() === year;
    
    if (isToday) {
      cell.classList.add('today');
    }
    
    // Marcar seleccionado
    if (CalendarState.selectedDate === dateStr) {
      cell.style.background = 'var(--surface-soft)';
    }
    
    // Número del día
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);
    
    // Eventos del día
    const dayEvents = CalendarState.events[dateStr] || [];
    if (dayEvents.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';
      
      dayEvents.slice(0, 4).forEach(event => {
        const eventButton = document.createElement('button');
        eventButton.className = 'calendar-event';
        eventButton.style.borderLeftColor = event.color;
        eventButton.textContent = event.titulo;
        eventButton.title = event.titulo;
        eventButton.addEventListener('click', (e) => {
          e.stopPropagation();
          calendarSelectDate(dateStr);
        });
        eventsContainer.appendChild(eventButton);
      });
      
      if (dayEvents.length > 4) {
        const more = document.createElement('div');
        more.style.fontSize = '10px';
        more.style.color = 'var(--muted)';
        more.textContent = `+${dayEvents.length - 4} más`;
        eventsContainer.appendChild(more);
      }
      
      cell.appendChild(eventsContainer);
    }
    
    // Click en el día
    cell.addEventListener('click', () => {
      calendarSelectDate(dateStr);
    });
    
    calendarGrid.appendChild(cell);
  }
  
  // Días del mes siguiente para completar 42 celdas (6 semanas)
  const totalCells = mondayIndex + totalDays;
  const remainingCells = 42 - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day other-month';
    cell.innerHTML = `<div class="day-number">${i}</div>`;
    calendarGrid.appendChild(cell);
  }
  
  console.log(' Calendario renderizado');
}

// ============================================
// UTILIDADES DE FECHA
// ============================================
function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

// ============================================
// SELECCIÓN DE FECHA
// ============================================
function calendarSelectDate(dateStr) {
  CalendarState.selectedDate = dateStr;
  renderCalendarGrid();
  renderSelectedDay();
}

// ============================================
// RENDERIZAR DÍA SELECCIONADO
// ============================================
function renderSelectedDay() {
  const selectedDayTitle = document.getElementById('selectedDayTitle');
  const selectedDayEvents = document.getElementById('selectedDayEvents');
  
  if (!selectedDayTitle || !selectedDayEvents) return;
  
  if (!CalendarState.selectedDate) {
    selectedDayTitle.textContent = 'Selecciona un día';
    selectedDayEvents.innerHTML = '<div class="empty">Selecciona un día para ver sus recuerdos.</div>';
    return;
  }
  
  const date = new Date(CalendarState.selectedDate);
  selectedDayTitle.textContent = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const events = CalendarState.events[CalendarState.selectedDate] || [];
  
  if (events.length === 0) {
    selectedDayEvents.innerHTML = '<div class="empty">No hay recuerdos para este día.</div>';
    return;
  }
  
  selectedDayEvents.innerHTML = events.map(event => `
    <div class="day-event-item">
      <div class="event-color" style="background:${event.color}"></div>
      <div class="day-event-content">
        <div class="day-event-title">${event.titulo}</div>
        ${event.descripcion ? `<div class="day-event-description">${event.descripcion}</div>` : ''}
      </div>
      <button class="delete-event" onclick="calendarDeleteEvent('${event.id}', '${CalendarState.selectedDate}')">Eliminar</button>
    </div>
  `).join('');
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
    renderCalendarGrid();
    if (CalendarState.selectedDate) {
      renderSelectedDay();
    }
    
  } catch (error) {
    console.error('✗ Error al cargar eventos:', error);
    showNotification('Error al cargar eventos del calendario', 'error');
  }
}

// ============================================
// MODAL PARA AGREGAR RECUERDO
// ============================================
function calendarOpenEventModal(dateStr = null) {
  const modal = document.getElementById('eventModal');
  const form = document.getElementById('eventForm');
  const dateInput = document.getElementById('eventDate');
  const colorInput = document.getElementById('eventColor');
  
  if (!modal || !form || !dateInput) return;
  
  // Resetear formulario
  form.reset();
  
  // Resetear color
  if (colorInput) colorInput.value = '#8b6254';
  document.querySelectorAll('.color-option').forEach(option => option.classList.remove('selected'));
  const defaultColor = document.querySelector('.color-option[data-color="#8b6254"]');
  if (defaultColor) defaultColor.classList.add('selected');
  
  // Establecer fecha
  if (dateStr) {
    dateInput.value = dateStr;
  } else if (CalendarState.selectedDate) {
    dateInput.value = CalendarState.selectedDate;
  } else {
    dateInput.value = dateKey(new Date());
  }
  
  modal.classList.add('open');
}

function calendarCloseEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

// ============================================
// GUARDAR EVENTO
// ============================================
async function calendarSaveEvent() {
  const form = document.getElementById('eventForm');
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
    
    calendarCloseEventModal();
    
    // Recargar eventos
    const eventMonth = eventDate.getMonth();
    const eventYear = eventDate.getFullYear();

    if (eventMonth === CalendarState.currentDate.getMonth() &&
        eventYear === CalendarState.currentDate.getFullYear()) {
      await loadCalendarEvents();
    } else {
      CalendarState.currentDate = eventDate;
      renderCalendarGrid();
      await loadCalendarEvents();
    }
    
    // Actualizar día seleccionado
    CalendarState.selectedDate = fecha;
    renderSelectedDay();
    
  } catch (error) {
    console.error('✗ Error al guardar evento:', error);
    showNotification('Error al guardar evento', 'error');
  }
}

// ============================================
// ELIMINAR EVENTO
// ============================================
async function calendarDeleteEvent(eventId, dateStr) {
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
    if (CalendarState.selectedDate === fecha) {
      calendarShowDayEvents(fecha);
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
