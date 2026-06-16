import React, { useState, useEffect } from 'react';

const getLocalTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes(' '))) {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const dayPart = parts[2].split(' ')[0].split('T')[0];
    return `${dayPart}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const addDays = (dateTimeStr, days) => {
  const parts = dateTimeStr.replace('T', ' ').split(' ');
  const dateParts = parts[0].split('-');
  const timeParts = parts[1] ? parts[1].split(':') : ['00', '00'];
  
  const d = new Date(
    Number(dateParts[0]),
    Number(dateParts[1]) - 1,
    Number(dateParts[2]),
    Number(timeParts[0]),
    Number(timeParts[1])
  );
  d.setDate(d.getDate() + days);
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return {
    dateOnly: `${yyyy}-${mm}-${dd}`,
    dateTime: `${yyyy}-${mm}-${dd} ${hh}:${min}`
  };
};

export default function CalendarView({ token }) {
  const [events, setEvents] = useState([]);
  const [incubations, setIncubations] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals
  const [showIncubatorModal, setShowIncubatorModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null); // { date: 'YYYY-MM-DD', list: [...] }

  // Forms inputs
  const [incubatorForm, setIncubatorForm] = useState({
    id: null,
    eggsCount: '',
    startDate: getLocalTodayDate() + 'T00:10',
    notes: '',
    status: 'active'
  });
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

  const fetchIncubations = async () => {
    try {
      const res = await fetch('/api/calendar/incubations', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIncubations(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchIncubations();
  }, [token]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Guardar/Actualizar incubación
  const handleSaveIncubation = async (e) => {
    e.preventDefault();
    const isEdit = incubatorForm.id !== null;
    const endpoint = isEdit ? `/api/calendar/incubations/${incubatorForm.id}` : '/api/calendar/incubations';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          eggsCount: Number(incubatorForm.eggsCount),
          startDate: incubatorForm.startDate.replace('T', ' '),
          status: incubatorForm.status,
          notes: incubatorForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowIncubatorModal(false);
      setIncubatorForm({ id: null, eggsCount: '', startDate: new Date().toISOString().substring(0, 10) + 'T00:10', notes: '', status: 'active' });
      fetchEvents();
      fetchIncubations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditIncubationClick = (inc) => {
    setIncubatorForm({
      id: inc.id,
      eggsCount: inc.eggsCount,
      startDate: inc.startDate.replace(' ', 'T'),
      notes: inc.notes || '',
      status: inc.status
    });
    setShowIncubatorModal(true);
  };

  const handleDeleteIncubation = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tanda de incubación? Se borrarán todos sus eventos asociados.')) return;
    try {
      const res = await fetch(`/api/calendar/incubations/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      fetchEvents();
      fetchIncubations();
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

  // Filtrar eventos por celda (maneja YYYY-MM-DD y YYYY-MM-DD HH:MM)
  const getEventsForDate = (dateStr) => {
    if (!dateStr) return [];
    return events.filter(e => e.eventDate && e.eventDate.substring(0, 10) === dateStr);
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

          <button 
            className="btn btn-primary" 
            onClick={() => {
              setEventForm({ title: '', description: '', eventDate: getLocalTodayDate(), type: 'manual' });
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
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
                    transition: 'var(--transition-smooth)',
                    minWidth: '0px',
                    overflow: 'hidden'
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', width: '100%', overflow: 'hidden' }}>
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
                            style={{
                              fontSize: '0.75rem',
                              color: getEventColor(event.type),
                              background: 'rgba(255, 255, 255, 0.02)',
                              padding: '0.1rem 0.25rem',
                              borderRadius: '3px',
                              borderLeft: `2px solid ${getEventColor(event.type)}`,
                              width: '100%',
                              boxSizing: 'border-box',
                              // Si hay un solo evento, permitir que use hasta 2 líneas. Si hay más, limitar a 1 línea.
                              ...(dayEvents.length === 1 ? {
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                              } : {
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              })
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
          SECCIÓN: GESTIÓN DE INCUBADORA
         ======================================================= */}
      <div className="glass-card" style={{ marginTop: '2.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🐣 Control de Incubadoras Activas e Historial
          </h3>
          <button 
            className="btn btn-gold" 
            onClick={() => {
              setIncubatorForm({
                id: null,
                eggsCount: '',
                startDate: getLocalTodayDate() + 'T00:10',
                notes: '',
                status: 'active'
              });
              setShowIncubatorModal(true);
            }}
          >
            🐣 Nueva Incubación
          </button>
        </div>

        {incubations.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No hay registros de incubación cargados.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cantidad</th>
                  <th>Fecha Inicio</th>
                  <th>Ovoscopia (Día 7)</th>
                  <th>Detener Volteo (Día 15)</th>
                  <th>Eclosión (Día 16-18)</th>
                  <th>Estado</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {incubations.map(inc => {
                  const ovoscopiaTime = `${addDays(inc.startDate, 7).dateOnly} 20:00`;
                  const volteoTime = addDays(inc.startDate, 15).dateTime;
                  const eclosionTime = addDays(inc.startDate, 16).dateTime;

                  const statusBadgeClass = inc.status === 'active' 
                    ? 'badge-pending' 
                    : inc.status === 'completed'
                      ? 'badge-paid' 
                      : 'badge-cancelled';

                  const statusText = inc.status === 'active' 
                    ? 'Activa' 
                    : inc.status === 'completed' 
                      ? 'Completada' 
                      : 'Cancelada';

                  return (
                    <tr key={inc.id}>
                      <td style={{ fontWeight: 'bold' }}>{inc.eggsCount} huevos</td>
                      <td>{formatDateTime(inc.startDate)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDateTime(ovoscopiaTime)}</td>
                      <td style={{ color: 'var(--accent-gold)' }}>{formatDateTime(volteoTime)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: '500' }}>{formatDateTime(eclosionTime)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td 
                        style={{ 
                          fontSize: '0.85rem', 
                          color: 'var(--text-secondary)', 
                          maxWidth: '180px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }} 
                        title={inc.notes}
                      >
                        {inc.notes || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                            onClick={() => handleEditIncubationClick(inc)}
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                            onClick={() => handleDeleteIncubation(inc.id)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                    {event.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', whiteSpace: 'pre-line' }}>{event.description}</p>}
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
            <h3 style={{ marginBottom: '1.5rem' }}>
              {incubatorForm.id ? '✏️ Editar Lote de Incubadora' : '🐣 Iniciar Lote de Incubadora'}
            </h3>
            <form onSubmit={handleSaveIncubation}>
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
                <label>Fecha y Hora de Inicio de Incubación</label>
                <input 
                  type="datetime-local" 
                  className="form-control" 
                  required
                  value={incubatorForm.startDate}
                  onChange={e => setIncubatorForm({ ...incubatorForm, startDate: e.target.value })}
                />
              </div>

              {incubatorForm.id && (
                <div className="form-group">
                  <label>Estado de la Incubación</label>
                  <select 
                    className="form-control"
                    value={incubatorForm.status}
                    onChange={e => setIncubatorForm({ ...incubatorForm, status: e.target.value })}
                  >
                    <option value="active">Activa (Genera alertas en calendario)</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Notas / Observaciones</label>
                <textarea 
                  className="form-control" 
                  placeholder="Detalles sobre el lote, temperatura, humedad..."
                  value={incubatorForm.notes}
                  onChange={e => setIncubatorForm({ ...incubatorForm, notes: e.target.value })}
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
                ℹ️ **Alertas automáticas** (para tandas activas):
                <br />1. **Ovoscopia** en el **Día 7 a las 20:00**.
                <br />2. **Detener volteo** en el **Día 15** a la hora de inicio.
                <br />3. **Eclosión estimada** en el **Día 16 a 18** a la hora de inicio.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-gold" style={{ flex: '1' }}>
                  {incubatorForm.id ? 'Guardar Cambios' : 'Registrar e Iniciar'}
                </button>
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
