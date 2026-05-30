import React, { useState, useEffect } from 'react';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function CalendarView({ token }) {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals
  const [showIncubatorModal, setShowIncubatorModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null); // { date: 'YYYY-MM-DD', list: [...] }

  // Forms inputs
  const [incubatorForm, setIncubatorForm] = useState({ eggsCount: '', startDate: new Date().toISOString().split('T')[0] });
  const [eventForm, setEventForm] = useState({ title: '', description: '', eventDate: '', type: 'manual' });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/calendar/events', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvents(data);
    } catch (err) {
      console.error(err);
      setError('Error al obtener eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Crear eventos de la incubadora
  const handleCreateIncubator = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/calendar/incubator', {
        method: 'POST',
        headers,
        body: JSON.stringify(incubatorForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowIncubatorModal(false);
      setIncubatorForm({ eggsCount: '', startDate: new Date().toISOString().split('T')[0] });
      fetchEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // Crear evento manual
  const handleCreateManualEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(eventForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowEventModal(false);
      setEventForm({ title: '', description: '', eventDate: '', type: 'manual' });
      fetchEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // Eliminar evento
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este evento?')) return;
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // Cerrar detalle
      setSelectedDayEvents(null);
      fetchEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // Generar cuadrícula de días del calendario mensual
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayIndex = (y, m) => {
    const day = new Date(y, m, 1).getDay(); // 0: Sunday, 1: Monday, ...
    return day === 0 ? 6 : day - 1; // Ajustado para iniciar el lunes (0: Lunes, 6: Domingo)
  };

  const daysCount = getDaysInMonth(year, month);
  const offset = getFirstDayIndex(year, month);
  const calendarCells = [];

  // Rellenar días del mes anterior (vacíos)
  for (let i = 0; i < offset; i++) {
    calendarCells.push({ day: null, dateStr: null });
  }

  // Rellenar días del mes actual
  for (let d = 1; d <= daysCount; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ day: d, dateStr });
  }

  // Rellenar celdas finales para completar semanas
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ day: null, dateStr: null });
  }

  // Filtrar eventos por celda
  const getEventsForDate = (dateStr) => {
    if (!dateStr) return [];
    return events.filter(e => e.eventDate === dateStr);
  };

  const getEventEmoji = (type) => {
    switch (type) {
      case 'incubator_turn': return '🔄';
      case 'incubator_hatch': return '🥚';
      case 'feed_transition': return '🌾';
      case 'egg_posture': return '🌟';
      case 'vaccine': return '💉';
      default: return '📅';
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'incubator_turn': return 'var(--accent-gold)';
      case 'incubator_hatch': return 'var(--accent-green)';
      case 'feed_transition': return 'var(--accent-blue)';
      case 'egg_posture': return '#c084fc';
      case 'vaccine': return 'var(--accent-red)';
      default: return 'var(--text-secondary)';
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>Calendario de la Granja 📅</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-gold" onClick={() => setShowIncubatorModal(true)}>🐣 Iniciar Incubadora</button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setEventForm({ title: '', description: '', eventDate: new Date().toISOString().split('T')[0], type: 'manual' });
              setShowEventModal(true);
            }}
          >
            ➕ Añadir Evento
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Cargando calendario...</p>
      ) : (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {/* Navegación del mes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>
              {monthNames[month]} {year}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handlePrevMonth}>◀ Anterior</button>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setCurrentDate(new Date())}>Hoy</button>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handleNextMonth}>Siguiente ▶</button>
            </div>
          </div>

          {/* Cuadrícula del Calendario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
            {/* Cabecera Lunes - Domingo */}
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} style={{ color: 'var(--text-secondary)', fontWeight: 'bold', padding: '0.5rem 0', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}

            {/* Celdas de días */}
            {calendarCells.map((cell, idx) => {
              const dayEvents = getEventsForDate(cell.dateStr);
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div 
                  key={idx} 
                  style={{
                    minHeight: '100px',
                    background: isToday ? 'rgba(16, 185, 129, 0.05)' : cell.day ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                    border: '1px solid',
                    borderColor: isToday ? 'var(--accent-green)' : cell.day ? 'var(--border-color)' : 'transparent',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '0.5rem',
                    textAlign: 'left',
                    cursor: cell.day ? 'pointer' : 'default',
                    transition: 'var(--transition-smooth)'
                  }}
                  className={cell.day ? 'glass-card' : ''}
                  onClick={() => {
                    if (cell.day) {
                      setSelectedDayEvents({ date: cell.dateStr, list: dayEvents });
                    }
                  }}
                >
                  {cell.day && (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.25rem', color: isToday ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                        {cell.day}
                      </div>
                      
                      {/* Lista resumida de eventos en el día */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
                            style={{
                              fontSize: '0.75rem',
                              color: getEventColor(event.type),
                              background: 'rgba(255, 255, 255, 0.02)',
                              padding: '0.1rem 0.25rem',
                              borderRadius: '3px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              borderLeft: `2px solid ${getEventColor(event.type)}`
                            }}
                            title={event.title}
                          >
                            {getEventEmoji(event.type)} {event.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: DETALLES DE EVENTOS DEL DÍA
         ======================================================= */}
      {selectedDayEvents && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Eventos para el {formatDate(selectedDayEvents.date)}
            </h3>

            {selectedDayEvents.list.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: '1.5rem 0' }}>No hay eventos agendados para este día.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedDayEvents.list.map(event => (
                  <div 
                    key={event.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '1rem',
                      borderRadius: 'var(--border-radius-sm)',
                      borderLeft: `4px solid ${getEventColor(event.type)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <h4 style={{ color: getEventColor(event.type), display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getEventEmoji(event.type)} {event.title}
                      </h4>
                      <button 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '0.9rem' }} 
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        🗑️
                      </button>
                    </div>
                    {event.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{event.description}</p>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: '1' }}
                onClick={() => {
                  setEventForm({ title: '', description: '', eventDate: selectedDayEvents.date, type: 'manual' });
                  setSelectedDayEvents(null);
                  setShowEventModal(true);
                }}
              >
                ➕ Añadir Evento
              </button>
              <button className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setSelectedDayEvents(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: INICIAR INCUBADORA (AUTOMATIZADO)
         ======================================================= */}
      {showIncubatorModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>🐣 Iniciar Lote de Incubadora</h3>
            <form onSubmit={handleCreateIncubator}>
              <div className="form-group">
                <label>Cantidad de Huevos Cargados</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="120" 
                  required
                  value={incubatorForm.eggsCount}
                  onChange={e => setIncubatorForm({ ...incubatorForm, eggsCount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Fecha de Inicio de Incubación</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  value={incubatorForm.startDate}
                  onChange={e => setIncubatorForm({ ...incubatorForm, startDate: e.target.value })}
                />
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#fbbf24',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '0.8rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(245,158,11,0.2)'
              }}>
                ℹ️ **Automático**: El sistema agendará automáticamente:
                <br />1. **Detener volteo** en el **Día 15**.
                <br />2. **Fecha de eclosión estimada** en el **Día 17**.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-gold" style={{ flex: '1' }}>Registrar e Iniciar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowIncubatorModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: NUEVO EVENTO MANUAL
         ======================================================= */}
      {showEventModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Agregar Evento al Calendario</h3>
            <form onSubmit={handleCreateManualEvent}>
              <div className="form-group">
                <label>Título del Evento</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Vacunación Lote A" 
                  required
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Fecha del Evento</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  value={eventForm.eventDate}
                  onChange={e => setEventForm({ ...eventForm, eventDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tipo de Hito</label>
                <select 
                  className="form-control"
                  value={eventForm.type}
                  onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
                >
                  <option value="manual">📅 Evento General / Manual</option>
                  <option value="vaccine">💉 Vacunación / Vitaminas</option>
                  <option value="feed_transition">🌾 Cambio de Alimento</option>
                </select>
              </div>

              <div className="form-group">
                <label>Descripción / Instrucciones</label>
                <textarea 
                  className="form-control" 
                  placeholder="Instrucciones adicionales para la tarea..."
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Crear Evento</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowEventModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
