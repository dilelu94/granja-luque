import React, { useState, useEffect } from 'react';

export default function SettingsPage({ token, role }) {
  // --- Configuraciones Generales ---
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

  // --- Datos para cálculo de costos ---
  const [batches, setBatches] = useState([]);
  const [feed, setFeed] = useState({});

  // --- Cambio de Contraseña ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // --- Gestión de Usuarios (super_admin) ---
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = crear
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'admin' });
  const [userFormError, setUserFormError] = useState('');
  const [userFormLoading, setUserFormLoading] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resSettings, resBatches, resFeed] = await Promise.all([
          fetch('/api/settings', { headers }),
          fetch('/api/inventory/quail-batches', { headers }),
          fetch('/api/inventory/feed', { headers })
        ]);

        const dataSettings = await resSettings.json();
        const dataBatches = await resBatches.json();
        const dataFeed = await resFeed.json();

        setSettings(prev => ({ ...prev, ...dataSettings }));
        setBatches(dataBatches);
        setFeed(dataFeed);
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al obtener configuraciones e inventario.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Cargar usuarios si es super_admin
  const fetchUsers = () => {
    if (role !== 'super_admin') return;
    setUsersLoading(true);
    fetch('/api/users', { headers })
      .then(res => {
        if (!res.ok) throw new Error('No se pudieron obtener los usuarios.');
        return res.json();
      })
      .then(data => {
        setUsers(data);
        setUsersLoading(false);
      })
      .catch(err => {
        setUsersError(err.message);
        setUsersLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, [role, token]);

  // Guardar configuraciones
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

  // Cambiar contraseña
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage('');
    setPwError('');

    if (newPassword !== confirmPassword) {
      setPwError('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña.');

      setPwMessage('Contraseña modificada exitosamente. 🔑');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  // Abrir modal creación
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUserForm({ username: '', password: '', role: 'admin' });
    setUserFormError('');
    setShowUserModal(true);
  };

  // Abrir modal edición
  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setUserForm({ username: u.username, password: '', role: u.role });
    setUserFormError('');
    setShowUserModal(true);
  };

  // Guardar usuario
  const handleUserFormSubmit = async (e) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormLoading(true);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const bodyData = { ...userForm };
      if (editingUser && !bodyData.password) {
        delete bodyData.password; // no sobreescribir clave si está vacía
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al procesar usuario.');

      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      setUserFormError(err.message);
    } finally {
      setUserFormLoading(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario administrador?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario.');
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando configuraciones...</p>;

  return (
    <div style={{ maxWidth: '800px', paddingBottom: '3rem' }}>
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

      {/* --- FORMULARIO CONFIGURACIONES DE NEGOCIO --- */}
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
            <div className="form-group" style={{ flex: '1', minWidth: '350px' }}>
              <label>Costo de Producción de un Huevo suelto ($)</label>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                {(() => {
                  const activeAdultBatches = batches.filter(b => b.type === 'adult' && b.status === 'active');
                  const totalFemales = activeAdultBatches.reduce((acc, b) => acc + (Number(b.femalesQuantity) || 0), 0);
                  const totalAdults = activeAdultBatches.reduce((acc, b) => acc + (Number(b.currentQuantity) || 0), 0);
                  
                  const dailyFeedConsumptionPerAdult = Number(settings.feed_consumption_adult) || 0.025;
                  const ponedoraCostPerKg = feed.ponedora?.costPerKg || 0;
                  
                  const totalDailyFeedCost = totalAdults * dailyFeedConsumptionPerAdult * ponedoraCostPerKg;
                  const expectedDailyEggs = totalFemales * 0.8;
                  const calculatedEggCost = expectedDailyEggs > 0 ? (totalDailyFeedCost / expectedDailyEggs) : 0;

                  return (
                    <>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-green)', marginBottom: '0.5rem' }}>
                        ${calculatedEggCost.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Desglose del cálculo:</strong>
                        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                          <li><strong>Alimento Ponedora:</strong> ${ponedoraCostPerKg.toFixed(2)} por kg</li>
                          <li><strong>Aves Adultas:</strong> {totalAdults} aves consumiendo {(totalAdults * dailyFeedConsumptionPerAdult).toFixed(3)} kg al día (${totalDailyFeedCost.toFixed(2)}/día)</li>
                          <li><strong>Postura Estimada:</strong> {expectedDailyEggs.toFixed(0)} huevos por día (80% de {totalFemales} hembras)</li>
                          <li><strong>Cálculo:</strong> ${totalDailyFeedCost.toFixed(2)} / {expectedDailyEggs.toFixed(0)} huevos = ${calculatedEggCost.toFixed(2)} c/u</li>
                        </ul>
                      </div>
                    </>
                  );
                })()}
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem' }}>
                Este valor se calcula automáticamente y se utiliza para estimar márgenes de ganancia.
              </small>
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
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
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

        <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', marginBottom: '2rem' }} title="Confirmar y guardar los datos ingresados">
          💾 Guardar Configuraciones de Granja
        </button>
      </form>

      {/* --- SECCIÓN: CAMBIO DE CONTRASEÑA --- */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>Seguridad de la Cuenta 🔑</h3>

        {pwMessage && (
          <div className="glass-card" style={{ borderColor: 'var(--accent-green)', background: 'var(--accent-green-glow)', color: '#a7f3d0', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            {pwMessage}
          </div>
        )}
        {pwError && (
          <div className="glass-card" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-glow)', color: '#f87171', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            {pwError}
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label htmlFor="current_pw">Contraseña Actual</label>
            <input 
              type="password" 
              id="current_pw"
              className="form-control"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="new_pw">Nueva Contraseña</label>
              <input 
                type="password" 
                id="new_pw"
                className="form-control"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="confirm_pw">Confirmar Nueva Contraseña</label>
              <input 
                type="password" 
                id="confirm_pw"
                className="form-control"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-gold" style={{ width: '100%', marginTop: '0.5rem' }} disabled={pwLoading} title="Hacer clic para ejecutar acción">
            {pwLoading ? 'Modificando...' : '🔑 Actualizar Contraseña'}
          </button>
        </form>
      </div>

      {/* --- SECCIÓN: GESTIÓN DE USUARIOS (SÓLO SUPER_ADMIN) --- */}
      {role === 'super_admin' && (
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', margin: '0' }}>
              Gestión de Usuarios Administradores 👥
            </h3>
            <button className="btn btn-primary" onClick={handleOpenCreateModal} title="Hacer clic para agregar administrador">
              👤 Agregar Administrador
            </button>
          </div>

          {usersError && (
            <div className="glass-card" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-glow)', color: '#f87171', padding: '1rem', marginBottom: '1rem' }}>
              {usersError}
            </div>
          )}

          {usersLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Cargando lista de usuarios...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Usuario</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rol</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>{u.username}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span 
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: u.role === 'super_admin' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: u.role === 'super_admin' ? 'var(--accent-green)' : '#60a5fa',
                            border: u.role === 'super_admin' ? '1px solid var(--accent-green)' : '1px solid #3b82f6'
                          }}
                        >
                          {u.role === 'super_admin' ? 'Super Administrador' : 'Administrador'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => handleOpenEditModal(u)}
                           title="Abrir formulario para editar este registro">
                            Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteUser(u.id)}
                           title="Eliminar permanentemente este registro del sistema">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL PARA CREAR / EDITAR USUARIO --- */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1.5rem', color: 'var(--accent-green)' }}>
              {editingUser ? 'Editar Administrador' : 'Nuevo Administrador'} 👤
            </h3>

            {userFormError && (
              <div className="glass-card" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-glow)', color: '#f87171', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                {userFormError}
              </div>
            )}

            <form onSubmit={handleUserFormSubmit}>
              <div className="form-group">
                <label htmlFor="modal_username">Nombre de Usuario</label>
                <input 
                  type="text"
                  id="modal_username"
                  className="form-control"
                  required
                  value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="ej: diegoluque"
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal_password">
                  {editingUser ? 'Nueva Contraseña (dejar en blanco para mantener actual)' : 'Contraseña'}
                </label>
                <input 
                  type="password"
                  id="modal_password"
                  className="form-control"
                  required={!editingUser}
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label htmlFor="modal_role">Rol del Usuario</label>
                <select 
                  id="modal_role"
                  className="form-control"
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="admin">Administrador (Normal)</option>
                  <option value="super_admin">Super Administrador (Acceso total)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: '1' }} 
                  onClick={() => setShowUserModal(false)}
                 title="Cancelar la acción actual sin guardar los cambios">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: '1' }}
                  disabled={userFormLoading}
                 title="Hacer clic para ejecutar acción">
                  {userFormLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
