import React, { useState } from 'react';

export default function RecolectarHuevos({ token, onBack }) {
  const getLocalDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = getLocalDateString(today);
  const yesterdayStr = getLocalDateString(yesterday);

  const [dateMode, setDateMode] = useState('hoy'); // 'hoy' | 'ayer' | 'manual'
  const [activeDate, setActiveDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    quantityCollected: '',
    quantityBroken: '',
    notes: ''
  });

  const handleDateModeCycle = () => {
    if (dateMode === 'hoy') {
      setDateMode('ayer');
      setActiveDate(yesterdayStr);
    } else if (dateMode === 'ayer') {
      setDateMode('manual');
      // keep activeDate as whatever it is, or reset to today
    } else {
      setDateMode('hoy');
      setActiveDate(todayStr);
    }
  };

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setMessage('');
    } else {
      setMessage(msg);
      setError('');
    }
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 4000);
  };

  const handleRecordEggs = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/eggs/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: activeDate,
          quantityCollected: form.quantityCollected,
          quantityBroken: form.quantityBroken || '0',
          notes: form.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      showNotification('✅ Recolección guardada exitosamente.');
      setForm({ quantityCollected: '', quantityBroken: '', notes: '' });
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', fontFamily: 'var(--font-main)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em' }} /> Recolectar
        </h2>
        <button 
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
         title="Volver a la pantalla anterior">
          Volver
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={handleDateModeCycle}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: 'var(--border-radius-sm)',
            border: '2px solid var(--accent-green)',
            background: 'var(--accent-green-glow)',
            color: 'var(--text-primary)',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem'
          }}
         title="Hacer clic para () : 
               datemode === 'ayer' ? yesterday.tolocaledatestring('es-ar', ) : 'seleccionar'})">
          📅 {dateMode === 'hoy' ? 'Hoy' : dateMode === 'ayer' ? 'Ayer' : 'Fecha Manual'} 🔄
          <span style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.8, marginLeft: '0.5rem' }}>
            ({dateMode === 'hoy' ? today.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 
               dateMode === 'ayer' ? yesterday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 'Seleccionar'})
          </span>
        </button>

        {dateMode === 'manual' && (
          <input 
            type="date"
            className="form-control"
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            style={{ marginTop: '0.5rem' }}
            max={todayStr}
          />
        )}
      </div>

      {message && (
        <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #34d399', color: '#34d399', textAlign: 'center', fontWeight: 'bold' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', background: 'rgba(248, 113, 113, 0.1)', border: '1px solid #f87171', color: '#f87171', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRecordEggs} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
            <img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em' }} /> Huevos Sanos
          </label>
          <input 
            type="number" 
            className="form-control" 
            placeholder="Ej: 120" 
            required
            min="0"
            style={{ fontSize: '1.5rem', padding: '1rem', textAlign: 'center' }}
            value={form.quantityCollected}
            onChange={e => setForm({ ...form, quantityCollected: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'block', color: 'var(--text-primary)' }}>
            💔 Huevos Rotos (Opcional)
          </label>
          <input 
            type="number" 
            className="form-control" 
            placeholder="0"
            min="0"
            style={{ fontSize: '1.5rem', padding: '1rem', textAlign: 'center' }}
            value={form.quantityBroken}
            onChange={e => setForm({ ...form, quantityBroken: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'block', color: 'var(--text-primary)' }}>
            📝 Notas (Opcional)
          </label>
          <textarea 
            className="form-control" 
            placeholder="Observaciones..."
            style={{ fontSize: '1.1rem', padding: '1rem', minHeight: '80px' }}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ 
            marginTop: '0.5rem', 
            padding: '1.2rem', 
            fontSize: '1.2rem', 
            fontWeight: 'bold',
            width: '100%',
            opacity: loading ? 0.7 : 1
          }}
         title="Hacer clic para ejecutar acción">
          {loading ? 'Guardando...' : '💾 Guardar Recolección'}
        </button>
      </form>
    </div>
  );
}
