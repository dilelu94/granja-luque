import React, { useState, useEffect } from 'react';

export default function SettingsPage({ token }) {
  const [settings, setSettings] = useState({
    admin_whatsapp: '',
    whatsapp_bot_url: '',
    feed_consumption_adult: '0.025',
    feed_consumption_chick: '0.015',
    egg_base_cost: '15.0',
    shipping_default_cost: '1500.0',
    MERCADO_PAGO_ACCESS_TOKEN: '',
    MERCADO_PAGO_WEBHOOK_URL: ''
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then(res => res.json())
      .then(data => {
        setSettings(prev => ({
          ...prev,
          ...data
        }));
        setLoading(false);
      })
      .catch(err => {
        console.error('Error al cargar configuraciones:', err);
        setError('Error al obtener configuraciones de la API.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setMessage('Configuraciones guardadas con éxito.');
      setSettings(data.settings);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando configuraciones...</p>;

  return (
    <div style={{ maxWidth: '700px' }}>
      <h2 style={{ marginBottom: '2rem', fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>
        Configuración del Sistema ⚙️
      </h2>

      {message && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-green)', background: 'var(--accent-green-glow)', color: '#a7f3d0', padding: '1rem', marginBottom: '1.5rem' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-glow)', color: '#f87171', padding: '1rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        {/* Sección: General */}
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-green)' }}>General & WhatsApp</h3>
          
          <div className="form-group">
            <label htmlFor="admin_whatsapp">Número de WhatsApp del Administrador (con código de país sin + o 0, ej: 5491122334455)</label>
            <input 
              type="text" 
              id="admin_whatsapp"
              className="form-control"
              placeholder="5491122334455"
              required
              value={settings.admin_whatsapp}
              onChange={e => setSettings({ ...settings, admin_whatsapp: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
              Este es el teléfono al cual se dirigirán los mensajes wa.me que envían los clientes al realizar una compra.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="whatsapp_bot_url">URL de Webhook del Bot de WhatsApp (Opcional)</label>
            <input 
              type="url" 
              id="whatsapp_bot_url"
              className="form-control"
              placeholder="https://tu-bot-de-whatsapp.com/webhook"
              value={settings.whatsapp_bot_url || ''}
              onChange={e => setSettings({ ...settings, whatsapp_bot_url: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
              Si tu bot de WhatsApp tiene un webhook HTTP, el servidor le enviará notificaciones en tiempo real al crearse, aprobarse o pagarse pedidos.
            </small>
          </div>
        </div>

        {/* Sección: Finanzas y Envíos */}
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-green)' }}>Finanzas y Envíos</h3>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="egg_base_cost">Costo de Producción de un Huevo suelto ($)</label>
              <input 
                type="number" 
                step="0.1"
                id="egg_base_cost"
                className="form-control"
                placeholder="15.0"
                required
                value={settings.egg_base_cost || ''}
                onChange={e => setSettings({ ...settings, egg_base_cost: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Usado para estimar márgenes de ganancia en maples.</small>
            </div>

            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="shipping_default_cost">Costo de Envío a Domicilio Estándar ($)</label>
              <input 
                type="number" 
                step="0.1"
                id="shipping_default_cost"
                className="form-control"
                placeholder="1500.0"
                required
                value={settings.shipping_default_cost || ''}
                onChange={e => setSettings({ ...settings, shipping_default_cost: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tarifa fija para envíos fuera de las zonas gratuitas.</small>
            </div>
          </div>
        </div>

        {/* Sección: Consumos */}
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>Consumo de Alimento (Estimaciones)</h3>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="feed_consumption_adult">Codorniz Adulta (kg/día)</label>
              <input 
                type="number" 
                step="0.001"
                id="feed_consumption_adult"
                className="form-control"
                placeholder="0.025"
                required
                value={settings.feed_consumption_adult}
                onChange={e => setSettings({ ...settings, feed_consumption_adult: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Por defecto: 0.025 kg (25 gramos)</small>
            </div>

            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="feed_consumption_chick">Codorniz Polluelo (kg/día)</label>
              <input 
                type="number" 
                step="0.001"
                id="feed_consumption_chick"
                className="form-control"
                placeholder="0.015"
                required
                value={settings.feed_consumption_chick}
                onChange={e => setSettings({ ...settings, feed_consumption_chick: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Por defecto: 0.015 kg (15 gramos)</small>
            </div>
          </div>
        </div>

        {/* Sección: Mercado Pago */}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-blue)' }}>Integración Mercado Pago</h3>
          
          <div className="form-group">
            <label htmlFor="mp_token">Access Token de Mercado Pago (Producción o Sandbox)</label>
            <input 
              type="password" 
              id="mp_token"
              className="form-control"
              placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxx"
              value={settings.MERCADO_PAGO_ACCESS_TOKEN || ''}
              onChange={e => setSettings({ ...settings, MERCADO_PAGO_ACCESS_TOKEN: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
              Ingresa el token provisto por Mercado Pago Developers. Si usas credenciales de prueba Sandbox, los cobros no serán reales.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="mp_webhook">URL de Webhook de Mercado Pago</label>
            <input 
              type="text" 
              id="mp_webhook"
              className="form-control"
              placeholder="https://tu-granja-servidor.com/api/orders/webhooks/mercadopago"
              value={settings.MERCADO_PAGO_WEBHOOK_URL || ''}
              onChange={e => setSettings({ ...settings, MERCADO_PAGO_WEBHOOK_URL: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
              Configura esta URL en el panel de Mercado Pago Developers para recibir notificaciones instantáneas de pago.
            </small>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem' }}>
          💾 Guardar Cambios
        </button>
      </form>
    </div>
  );
}
