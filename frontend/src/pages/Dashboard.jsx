import React, { useState, useEffect } from 'react';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes(' '))) {
    const d = new Date(dateStr);
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

export default function Dashboard({ token }) {
  const [stats, setStats] = useState({
    quails: { chick: 0, adult: 0, total: 0 },
    feed: {
      initiator: { stock: 0, dailyConsumption: 0, daysLeft: null },
      ponedora: { stock: 0, dailyConsumption: 0, daysLeft: null }
    },
    eggs: { history: [], totals: { collected: 0, broken: 0 } },
    orders: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // 1. Cargar Alimento
        const resFeed = await fetch('/api/inventory/feed', { headers });
        const dataFeed = await resFeed.json();

        // 2. Cargar Codornices
        const resBatches = await fetch('/api/inventory/quail-batches', { headers });
        const dataBatches = await resBatches.json();

        // 3. Cargar Huevos
        const resEggs = await fetch('/api/inventory/eggs', { headers });
        const dataEggs = await resEggs.json();

        // 4. Cargar Pedidos
        const resOrders = await fetch('/api/orders', { headers });
        const dataOrders = await resOrders.json();

        // Procesar totales de codornices
        let chicks = 0;
        let adults = 0;
        dataBatches.forEach(batch => {
          if (batch.status === 'active') {
            if (batch.type === 'chick') chicks += batch.currentQuantity;
            else adults += batch.currentQuantity;
          }
        });

        setStats({
          quails: { chick: chicks, adult: adults, total: chicks + adults },
          feed: dataFeed,
          eggs: dataEggs,
          orders: dataOrders
        });
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
        setError('Error al conectar con la API para recopilar métricas.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando métricas de la granja...</p>;
  if (error) return <div className="glass-card" style={{ borderColor: 'var(--accent-red)' }}>{error}</div>;

  // Filtrar alertas críticas de alimento
  const alerts = [];
  if (stats.feed.initiator.daysLeft !== null && stats.feed.initiator.daysLeft < 7) {
    alerts.push({
      type: 'critical',
      message: `El alimento Iniciador se agotará en ${stats.feed.initiator.daysLeft} días. Stock actual: ${Number(stats.feed.initiator.stock).toFixed(2)} kg.`
    });
  }
  if (stats.feed.ponedora.daysLeft !== null && stats.feed.ponedora.daysLeft < 7) {
    alerts.push({
      type: 'critical',
      message: `El alimento Ponedora se agotará en ${stats.feed.ponedora.daysLeft} días. Stock actual: ${Number(stats.feed.ponedora.stock).toFixed(2)} kg.`
    });
  }
 
  // Tasa de postura actual (del último registro)
  const lastEggCollection = stats.eggs.history[stats.eggs.history.length - 1];
  if (lastEggCollection && lastEggCollection.postureRate < 65 && lastEggCollection.adultQuailsCount > 0) {
    alerts.push({
      type: 'warning',
      message: `La tasa de postura del día ${formatDate(lastEggCollection.date)} cayó al ${lastEggCollection.postureRate}% (esperado ~80%). Revisa las aves.`
    });
  }

  // Pedidos pendientes de aprobación
  const pendingOrders = stats.orders.filter(o => o.status === 'pending_approval');

  return (
    <div>
      <h2 style={{ marginBottom: '2rem', fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>
        Resumen Operativo de la Granja 🚜
      </h2>

      {/* Caja de Alertas */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          {alerts.map((alert, idx) => (
            <div 
              key={idx} 
              className="glass-card" 
              style={{
                borderColor: alert.type === 'critical' ? 'var(--accent-red)' : 'var(--accent-gold)',
                background: alert.type === 'critical' ? 'var(--accent-red-glow)' : 'var(--accent-gold-glow)',
                color: alert.type === 'critical' ? '#f87171' : '#fbbf24',
                padding: '1rem 1.5rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{alert.type === 'critical' ? '🚨' : '⚠️'}</span>
              <span style={{ fontWeight: '500' }}>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid de Métricas Principales */}
      <div className="dashboard-grid">
        
        {/* Card Codornices */}
        <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Codornices Activas</span>
            <span style={{ fontSize: '2rem' }}>🐤</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', fontFamily: 'var(--font-heading)' }}>
            {stats.quails.total}
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Adultas: <strong style={{ color: 'white' }}>{stats.quails.adult}</strong></span>
            <span>Chicos: <strong style={{ color: 'white' }}>{stats.quails.chick}</strong></span>
          </div>
        </div>

        {/* Card Alimento Ponedora */}
        <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Alimento Ponedoras</span>
            <span style={{ fontSize: '2rem' }}>🌾</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>
            {Number(stats.feed.ponedora.stock).toFixed(2)} kg
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {stats.feed.ponedora.daysLeft !== null ? (
              <span>Dura aprox. <strong style={{ color: 'white' }}>{stats.feed.ponedora.daysLeft} días</strong> ({Number(stats.feed.ponedora.dailyConsumption).toFixed(2)} kg/día)</span>
            ) : (
              <span>Sin consumo activo (0 adultas)</span>
            )}
          </div>
        </div>

        {/* Card Alimento Iniciador */}
        <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Alimento Iniciador</span>
            <span style={{ fontSize: '2rem' }}>🧪</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', fontFamily: 'var(--font-heading)', color: 'var(--accent-blue)' }}>
            {Number(stats.feed.initiator.stock).toFixed(2)} kg
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {stats.feed.initiator.daysLeft !== null ? (
              <span>Dura aprox. <strong style={{ color: 'white' }}>{stats.feed.initiator.daysLeft} días</strong> ({Number(stats.feed.initiator.dailyConsumption).toFixed(2)} kg/día)</span>
            ) : (
              <span>Sin consumo activo (0 polluelos)</span>
            )}
          </div>
        </div>

        {/* Card Rendimiento Postura */}
        <div className="glass-card" style={{ borderLeft: '5px solid var(--text-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Tasa de Postura Reciente</span>
            <span style={{ fontSize: '2rem' }}>🥚</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', fontFamily: 'var(--font-heading)' }}>
            {lastEggCollection ? `${lastEggCollection.postureRate}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {lastEggCollection ? (
              <span>{lastEggCollection.quantityCollected} huevos de {lastEggCollection.adultQuailsCount} adultas</span>
            ) : (
              <span>Registra huevos hoy en el Inventario</span>
            )}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '2rem' }}>
        
        {/* Gráfico/Tabla de Postura */}
        <div className="glass-card" style={{ flex: '2', minWidth: '320px' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)' }}>Postura de Huevos (Últimos 7 registros)</h3>
          {stats.eggs.history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No hay datos de postura cargados todavía.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hembras Adultas</th>
                    <th>Recolectados</th>
                    <th>Rotos</th>
                    <th>Tasa de Postura</th>
                    <th>Rendimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.eggs.history.slice(-7).map((row, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.adultQuailsCount}</td>
                      <td style={{ fontWeight: '600' }}>{row.quantityCollected}</td>
                      <td style={{ color: 'var(--accent-red)' }}>{row.quantityBroken}</td>
                      <td style={{ color: 'var(--accent-gold)', fontWeight: '600' }}>{row.postureRate}%</td>
                      <td>
                        <span className={`badge ${row.postureRate >= 75 ? 'badge-paid' : row.postureRate >= 65 ? 'badge-pending' : 'badge-cancelled'}`}>
                          {row.postureRate >= 75 ? 'Excelente' : row.postureRate >= 65 ? 'Normal' : 'Bajo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Acciones Rápidas y Resumen de Ventas */}
        <div className="glass-card" style={{ flex: '1', minWidth: '300px' }}>
          <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)' }}>Pedidos Pendientes ({pendingOrders.length})</h3>
          
          {pendingOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💚</div>
              <p>No hay pedidos pendientes de aprobación.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingOrders.map(order => (
                <div 
                  key={order.id} 
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>#{order.id} - {order.customerName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(order.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>${Number(order.totalPrice).toFixed(2)}</div>
                    <span className="badge badge-pending" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Pendiente</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
