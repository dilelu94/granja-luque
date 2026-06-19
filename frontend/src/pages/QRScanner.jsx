import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function QRScanner({ onBack }) {
  const [error, setError] = useState('');

  const handleScan = (result) => {
    if (result && result.length > 0) {
      const url = result[0].rawValue;
      if (url.includes('/jaula/')) {
        const id = url.split('/jaula/')[1];
        // Redirect to the cage
        window.history.pushState({}, '', `/jaula/${id}`);
        // To force an update in App.jsx which uses window.location, we can dispatch an event
        // or just reload, but since it's a SPA it's better to reload to ensure view updates correctly
        window.location.reload();
      } else {
        setError('El código QR escaneado no pertenece a una jaula válida.');
        setTimeout(() => setError(''), 4000);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Escáner de Jaulas</h2>
        <button className="btn btn-secondary" onClick={onBack}>Cerrar</button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#ef4444', color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
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
    </div>
  );
}
