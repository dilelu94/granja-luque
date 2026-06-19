import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function QRScanner({ token, onBack }) {
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual'
  const [cages, setCages] = useState([]);
  const [selectedCageId, setSelectedCageId] = useState('');

  useEffect(() => {
    if (activeTab === 'manual') {
      fetch('/api/inventory/cages', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCages(data);
          }
        })
        .catch(err => console.error('Error fetching cages:', err));
    }
  }, [activeTab, token]);

  const handleScan = (result) => {
    if (result && result.length > 0) {
      const url = result[0].rawValue;
      if (url.includes('/jaula/')) {
        const id = url.split('/jaula/')[1];
        // Redirect to the cage
        window.history.pushState({}, '', `/jaula/${id}`);
        window.location.reload();
      } else {
        setError('El código QR escaneado no pertenece a una jaula válida.');
        setTimeout(() => setError(''), 4000);
      }
    }
  };

  const handleManualGo = () => {
    if (selectedCageId) {
      window.history.pushState({}, '', `/jaula/${selectedCageId}`);
      window.location.reload();
    } else {
      setError('Por favor selecciona una jaula primero.');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#0f172a', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Seleccionar Jaula</h2>
        <button className="btn btn-secondary" onClick={onBack}>Volver</button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#ef4444', color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', padding: '1rem', gap: '1rem', background: 'rgba(255,255,255,0.05)' }}>
        <button 
          className={`btn ${activeTab === 'scan' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1 }}
          onClick={() => setActiveTab('scan')}
        >
          📷 Escanear QR
        </button>
        <button 
          className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1 }}
          onClick={() => setActiveTab('manual')}
        >
          ⌨️ Seleccionar Manual
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', padding: '1rem' }}>
        {activeTab === 'scan' ? (
          <>
            <div style={{ width: '100%', maxWidth: '500px', flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', borderRadius: '1rem', overflow: 'hidden' }}>
                <Scanner 
                  onScan={handleScan}
                  formats={['qr_code']}
                  components={{
                    audio: false,
                    tracker: true
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
              Apunta la cámara al código QR impreso en la jaula
            </div>
          </>
        ) : (
          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
            <div className="form-group">
              <label style={{ color: 'var(--text-secondary)' }}>Escribe o selecciona una Jaula</label>
              <input 
                type="text"
                className="form-control" 
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
                placeholder="Ej: AA1"
                list="cages-datalist"
                onChange={(e) => {
                  const val = e.target.value;
                  const found = cages.find(c => c.name === val);
                  if (found) {
                    setSelectedCageId(found.id);
                  } else {
                    setSelectedCageId('');
                  }
                }}
              />
              <datalist id="cages-datalist">
                {cages.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={handleManualGo}
            >
              🚀 Ir a la Jaula
            </button>
          </div>
        )}
      </div>
      
      {!window.matchMedia('(display-mode: standalone)').matches && (
        <div style={{ padding: '1rem', background: 'var(--accent-gold-glow)', color: '#fbbf24', textAlign: 'center', fontSize: '0.85rem' }}>
          💡 Tip: Si estás en Chrome, toca los 3 puntitos arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla"</strong> para que funcione como una app nativa.
        </div>
      )}
    </div>
  );
}
