import React, { useState, useEffect } from 'react';

export default function CageDetail({ token, onBack, cageId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [mortalityForms, setMortalityForms] = useState({});

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchCageData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/cages/${cageId}`, { headers });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData(result);
      
      // Init forms
      const forms = {};
      result.batches.forEach(b => {
        forms[b.id] = { count: '', notes: '' };
      });
      setMortalityForms(forms);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCageData();
  }, [cageId, token]);

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

  const handleRecordMortality = async (e, batchId) => {
    e.preventDefault();
    const form = mortalityForms[batchId];
    if (!form.count || Number(form.count) <= 0) return;

    try {
      const res = await fetch(`/api/inventory/quail-batches/${batchId}/mortality`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          count: form.count,
          reason: 'Baja Registrada (QR)',
          notes: form.notes
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      showNotification(`✅ Baja registrada en ${result.batch.name}`);
      fetchCageData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  if (loading && !data) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando jaula...</div>;
  }

  if (error && !data) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-red)' }}>{error}</div>;
  }

  if (!data) return null;

  const { cage, batches } = data;

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'var(--font-main)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
          Jaula {cage.name}
        </h2>
        <button 
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
         title="Volver a la pantalla anterior">
          Volver
        </button>
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

      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Ocupación:</span>
          <span style={{ fontWeight: 'bold', color: cage.currentOccupancy > cage.capacity ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {cage.currentOccupancy} / {cage.capacity}
          </span>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${Math.min(100, (cage.currentOccupancy / cage.capacity) * 100)}%`, 
            height: '100%', 
            background: cage.currentOccupancy > cage.capacity ? 'var(--accent-red)' : 'var(--accent-blue)' 
          }} />
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Lotes en esta jaula</h3>

      {batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)' }}>
          No hay aves registradas en esta jaula.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {batches.map(batch => {
            const ageDays = Math.floor((new Date() - new Date(batch.birthDate)) / (1000 * 60 * 60 * 24));
            const ageWeeks = Math.floor(ageDays / 7);

            return (
              <div key={batch.id} className="glass-card" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>{batch.name}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {batch.type === 'chick' ? (
                          <>
                            <img src="/HatchlingQuail.png" alt="🐣" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                            Pichón
                          </>
                        ) : 'Codorniz Adulta'}
                      </span>
                      {batch.type !== 'chick' && batch.femalesQuantity > 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <img src="/FemaleQuail.png" alt="♀️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                          {batch.femalesQuantity} H
                        </span>
                      )}
                      {batch.type !== 'chick' && batch.malesQuantity > 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <img src="/MaleQuail.png" alt="♂️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                          {batch.malesQuantity} M
                        </span>
                      )}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        {ageWeeks} sem ({ageDays}d)
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                    {batch.currentQuantity}
                  </div>
                </div>

                <form onSubmit={(e) => handleRecordMortality(e, batch.id)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="N° Bajas" 
                      min="1"
                      max={batch.currentQuantity}
                      required
                      value={mortalityForms[batch.id]?.count || ''}
                      onChange={e => setMortalityForms({...mortalityForms, [batch.id]: { ...mortalityForms[batch.id], count: e.target.value }})}
                      style={{ padding: '0.75rem' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-danger" style={{ padding: '0.75rem 1rem' }} title="Registrar los datos completados">
                    Registrar Baja
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
