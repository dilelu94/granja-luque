import React, { useState, useEffect } from 'react';

export default function Inventory({ token }) {
  const [activeTab, setActiveTab] = useState('birds'); // 'birds' | 'feed' | 'products'
  const [batches, setBatches] = useState([]);
  const [feed, setFeed] = useState({ initiator: { stock: 0 }, ponedora: { stock: 0 } });
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ egg_base_cost: '15.0' });
  
  // Modals / Forms States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Form inputs
  const [batchForm, setBatchForm] = useState({ name: '', type: 'chick', initialQuantity: '', birthDate: '', notes: '' });
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [mortalityCount, setMortalityCount] = useState('');
  
  const [eggForm, setEggForm] = useState({ date: new Date().toISOString().split('T')[0], quantityCollected: '', quantityBroken: '', notes: '' });
  const [packForm, setPackForm] = useState({ productId: '', packagesCount: '', eggsPerPackage: '30' });
  const [feedForm, setFeedForm] = useState({ type: 'ponedora', action: 'buy', quantity: '', price: '', shippingCost: '' });
  
  // Producto Form (Crear / Editar)
  const [productForm, setProductForm] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    stock: '',
    category: 'eggs',
    imageUrl: '',
    status: 'active',
    containerCost: '',
    labelCost: '',
    eggCount: ''
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchData = async () => {
    try {
      // 1. Lotes
      const resBatches = await fetch('/api/inventory/quail-batches', { headers });
      const dataBatches = await resBatches.json();
      setBatches(dataBatches);

      // 2. Alimentos
      const resFeed = await fetch('/api/inventory/feed', { headers });
      const dataFeed = await resFeed.json();
      setFeed(dataFeed);

      // 3. Productos
      const resProducts = await fetch('/api/inventory/products/admin', { headers });
      const dataProducts = await resProducts.json();
      setProducts(dataProducts);

      // 4. Config (para costo base del huevo)
      const resSettings = await fetch('/api/settings', { headers });
      const dataSettings = await resSettings.json();
      setSettings(dataSettings);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
      setError('Error al sincronizar datos del inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

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

  // 1. Guardar nuevo lote de codornices
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/quail-batches', {
        method: 'POST',
        headers,
        body: JSON.stringify(batchForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Lote de codornices registrado e hitos agendados en el calendario.');
      setShowBatchModal(false);
      setBatchForm({ name: '', type: 'chick', initialQuantity: '', birthDate: '', notes: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // 2. Guardar bajas / mortalidad
  const handleRecordMortality = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/inventory/quail-batches/${selectedBatchId}/mortality`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ count: mortalityCount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Bajas registradas con éxito para el lote.`);
      setShowMortalityModal(false);
      setMortalityCount('');
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // 3. Registrar huevos recogidos
  const handleRecordEggs = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/eggs/collect', {
        method: 'POST',
        headers,
        body: JSON.stringify(eggForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Recolección diaria de huevos guardada.');
      setShowEggModal(false);
      setEggForm({ date: new Date().toISOString().split('T')[0], quantityCollected: '', quantityBroken: '', notes: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // 4. Empaquetar huevos en productos para la venta
  const handlePackEggs = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/eggs/pack', {
        method: 'POST',
        headers,
        body: JSON.stringify(packForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Huevos empaquetados e incrementado el stock del producto.');
      setShowPackModal(false);
      setPackForm({ productId: '', packagesCount: '', eggsPerPackage: '30' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // 5. Cargar / Ajustar alimento (incluyendo precio y flete)
  const handleUpdateFeed = async (e) => {
    e.preventDefault();
    const endpoint = feedForm.action === 'buy' ? '/api/inventory/feed/buy' : '/api/inventory/feed/consume';
    
    const payload = {
      type: feedForm.type,
      quantity: Number(feedForm.quantity),
      price: feedForm.action === 'buy' ? Number(feedForm.price || 0) : 0,
      shippingCost: feedForm.action === 'buy' ? Number(feedForm.shippingCost || 0) : 0
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Movimiento de alimento registrado con éxito.');
      setShowFeedModal(false);
      setFeedForm({ type: 'ponedora', action: 'buy', quantity: '', price: '', shippingCost: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // 6. Crear o Editar Producto
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const isEdit = productForm.id !== null;
    const endpoint = isEdit ? `/api/inventory/products/${productForm.id}` : '/api/inventory/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          containerCost: Number(productForm.containerCost || 0),
          labelCost: Number(productForm.labelCost || 0),
          eggCount: Number(productForm.eggCount || 0)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(isEdit ? 'Producto actualizado con éxito.' : 'Producto creado con éxito.');
      setShowProductModal(false);
      resetProductForm();
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleEditProductClick = (prod) => {
    setProductForm({
      id: prod.id,
      name: prod.name,
      description: prod.description || '',
      price: prod.price,
      stock: prod.stock,
      category: prod.category,
      imageUrl: prod.image_url || '',
      status: prod.status || 'active',
      containerCost: prod.container_cost !== undefined ? prod.container_cost : 0,
      labelCost: prod.label_cost !== undefined ? prod.label_cost : 0,
      eggCount: prod.egg_count !== undefined ? prod.egg_count : 0
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message);
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const resetProductForm = () => {
    setProductForm({
      id: null,
      name: '',
      description: '',
      price: '',
      stock: '',
      category: 'eggs',
      imageUrl: '',
      status: 'active',
      containerCost: '',
      labelCost: '',
      eggCount: ''
    });
  };

  const eggUnitCost = Number(settings.egg_base_cost || 15.0);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando datos de inventario...</p>;

  return (
    <div>
      {/* Botones de acción del encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>Inventario de Granja 📋</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowEggModal(true)}>🥚 Recolectar Huevos</button>
          <button className="btn btn-secondary" onClick={() => setShowPackModal(true)}>📦 Empaquetar</button>
          <button className="btn btn-gold" onClick={() => setShowBatchModal(true)}>🐤 Nuevo Lote Aves</button>
          <button className="btn btn-secondary" onClick={() => setShowFeedModal(true)}>🌾 Cargar Alimento</button>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '1rem' }}>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'birds' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'birds' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('birds')}
        >
          🐤 Lotes de Aves
        </button>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'feed' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('feed')}
        >
          🌾 Alimento y Fletes
        </button>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'products' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'products' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('products')}
        >
          🏷️ Productos en Venta
        </button>
      </div>

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

      {/* =======================================================
          TAB: AVES
         ======================================================= */}
      {activeTab === 'birds' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Control de Aves (Lotes)
          </h3>
          {batches.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay lotes registrados.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Tipo / Edad</th>
                    <th>Cantidad Inicial</th>
                    <th>Cantidad Actual</th>
                    <th>Fecha de Ingreso</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => {
                    const parts = batch.birthDate.split('-');
                    const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    const today = new Date();
                    birth.setHours(0,0,0,0); today.setHours(0,0,0,0);
                    const days = Math.floor(Math.abs(today - birth) / (1000 * 60 * 60 * 24));
                    const weeks = Math.floor(days / 7);

                    return (
                      <tr key={batch.id} style={{ opacity: batch.status !== 'active' ? 0.6 : 1 }}>
                        <td style={{ fontWeight: '600' }}>
                          {batch.name}
                          {batch.notes && <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>{batch.notes}</div>}
                        </td>
                        <td>
                          <span className={`badge ${batch.type === 'chick' ? 'badge-approved' : 'badge-pending'}`}>
                            {batch.type === 'chick' ? 'Polluelo' : 'Adulta'}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            ({weeks} sem, {days} d)
                          </span>
                        </td>
                        <td>{batch.initialQuantity}</td>
                        <td style={{ fontWeight: 'bold' }}>{batch.currentQuantity}</td>
                        <td>{batch.birthDate}</td>
                        <td>
                          <span className={`badge ${batch.status === 'active' ? 'badge-paid' : 'badge-cancelled'}`}>
                            {batch.status === 'active' ? 'Activo' : batch.status === 'sold' ? 'Vendido' : 'Retirado'}
                          </span>
                        </td>
                        <td>
                          {batch.status === 'active' && (
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setShowMortalityModal(true);
                              }}
                            >
                              💀 Registrar Bajas
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =======================================================
          TAB: ALIMENTO
         ======================================================= */}
      {activeTab === 'feed' && (
        <div>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div className="glass-card" style={{ flex: '1', minWidth: '280px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ fontSize: '3rem' }}>🌾</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Alimento Ponedoras</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{feed.ponedora.stock} kg</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Consumo: {feed.ponedora.dailyConsumption || 0} kg/día
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ flex: '1', minWidth: '280px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ fontSize: '3rem' }}>🧪</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Alimento Iniciador</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{feed.initiator.stock} kg</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Consumo: {feed.initiator.dailyConsumption || 0} kg/día
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)' }}>Últimas compras registradas</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              (Los fletes y costos registrados se guardan en el libro de gastos).
            </p>
            {/* Si agregamos una tabla para ver las compras, sería perfecto. Mostraremos un mensaje por ahora */}
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
              💡 Puedes cargar fletes y precios en el botón **Cargar Alimento** de arriba.
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          TAB: PRODUCTOS EN VENTA (DESGLOSE Y MARGENES)
         ======================================================= */}
      {activeTab === 'products' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Gestión Financiera de Productos</h3>
            <button 
              className="btn btn-primary" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              onClick={() => {
                resetProductForm();
                setShowProductModal(true);
              }}
            >
              🏷️ Crear Producto
            </button>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1rem',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem'
          }}>
            📋 **Cálculo de Margen**: Basado en un **Costo Unitario de Huevo de Codorniz de $ {eggUnitCost} ARS** (configurable en Ajustes).
            El costo de materia prima se calcula automáticamente: `Cantidad de Huevos * Costo Unitario`.
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio Venta</th>
                  <th>Desglose Costo</th>
                  <th>Costo Total</th>
                  <th>Margen Neto</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map(prod => {
                  const labelCost = prod.label_cost || 0;
                  const containerCost = prod.container_cost || 0;
                  const eggCount = prod.egg_count || 0;
                  const rawCost = eggCount * eggUnitCost;
                  const totalCost = containerCost + labelCost + rawCost;
                  const margin = prod.price - totalCost;
                  const marginPercent = Math.round((margin / prod.price) * 100);

                  return (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: '600' }}>{prod.name}</td>
                      <td>
                        <span className="badge badge-pending">{prod.category}</span>
                      </td>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>${prod.price}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        📦 Envase plástico: ${containerCost}
                        <br />🏷️ Etiqueta: ${labelCost}
                        {eggCount > 0 && <><br />🥚 Huevos ({eggCount}): ${rawCost} (${eggUnitCost} c/u)</>}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>${totalCost}</td>
                      <td style={{ color: margin >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold' }}>
                        ${margin} ({marginPercent}%)
                      </td>
                      <td style={{ fontWeight: '600', color: prod.stock > 0 ? 'var(--text-primary)' : 'var(--accent-red)' }}>
                        {prod.stock} uds
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEditProductClick(prod)}
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteProduct(prod.id)}
                          >
                            🗑️ Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: CREAR/EDITAR PRODUCTO
         ======================================================= */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>
              {productForm.id ? 'Editar Producto' : 'Crear Nuevo Producto'}
            </h3>
            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label>Nombre del Producto</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Maple de 12 Huevos de Codorniz" 
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Envase plástico protector, listos para consumo..." 
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Precio de Venta ($)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="700" 
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Stock Inicial</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="10" 
                    required
                    value={productForm.stock}
                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Categoría</label>
                  <select 
                    className="form-control"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    <option value="eggs">Huevos Frescos</option>
                    <option value="processed">Procesados / Escabeche</option>
                    <option value="birds">Codornices Vivas</option>
                    <option value="manure">Abono / Guano</option>
                    <option value="other">Otros</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Estado</label>
                  <select 
                    className="form-control"
                    value={productForm.status}
                    onChange={e => setProductForm({ ...productForm, status: e.target.value })}
                  >
                    <option value="active">Activo (Visible en tienda)</option>
                    <option value="inactive">Inactivo (Oculto)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>URL de Imagen (Opcional)</label>
                <input 
                  type="url" 
                  className="form-control" 
                  placeholder="https://imagenes.com/mi-maple.jpg" 
                  value={productForm.imageUrl}
                  onChange={e => setProductForm({ ...productForm, imageUrl: e.target.value })}
                />
              </div>

              {/* SECCIÓN DESGLOSE COSTOS DE PRODUCCIÓN */}
              <div style={{
                border: '1px solid var(--border-color)',
                padding: '1.25rem 1rem 0.5rem 1rem',
                borderRadius: 'var(--border-radius-sm)',
                background: 'rgba(0,0,0,0.15)',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '1rem' }}>
                  Desglose de Costos de Fabricación (Margen)
                </h4>
                
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="form-group" style={{ flex: '1' }}>
                    <label>Costo Envase Plástico</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      placeholder="80" 
                      value={productForm.containerCost}
                      onChange={e => setProductForm({ ...productForm, containerCost: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1' }}>
                    <label>Costo Etiqueta</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-control" 
                      placeholder="30" 
                      value={productForm.labelCost}
                      onChange={e => setProductForm({ ...productForm, labelCost: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1' }}>
                    <label>Cantidad Huevos</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="12" 
                      value={productForm.eggCount}
                      onChange={e => setProductForm({ ...productForm, eggCount: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Guardar Producto</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowProductModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: NUEVO LOTE
         ======================================================= */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Nuevo Lote de Aves</h3>
            <form onSubmit={handleCreateBatch}>
              <div className="form-group">
                <label>Nombre del Lote</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Lote Eclosión Mayo 2026" 
                  required
                  value={batchForm.name}
                  onChange={e => setBatchForm({ ...batchForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select 
                  className="form-control"
                  value={batchForm.type}
                  onChange={e => setBatchForm({ ...batchForm, type: e.target.value })}
                >
                  <option value="chick">Polluelo (Menor a 5 semanas, come Iniciador)</option>
                  <option value="adult">Adulta (Postura, come Ponedora)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cantidad de Aves</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="100" 
                  required
                  value={batchForm.initialQuantity}
                  onChange={e => setBatchForm({ ...batchForm, initialQuantity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Fecha de Nacimiento / Ingreso</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  value={batchForm.birthDate}
                  onChange={e => setBatchForm({ ...batchForm, birthDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Notas Adicionales</label>
                <textarea 
                  className="form-control" 
                  placeholder="Procedencia, lote de incubadora..."
                  value={batchForm.notes}
                  onChange={e => setBatchForm({ ...batchForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Registrar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowBatchModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: REGISTRAR MORTALIDAD
         ======================================================= */}
      {showMortalityModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Registrar Bajas (Mortalidad)</h3>
            <form onSubmit={handleRecordMortality}>
              <div className="form-group">
                <label>Cantidad de Aves Muertas</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="1" 
                  required
                  value={mortalityCount}
                  onChange={e => setMortalityCount(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Esto descontará la cantidad del lote activo y guardará el registro en sus notas.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-danger" style={{ flex: '1' }}>Guardar Bajas</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowMortalityModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: REGISTRAR HUEVOS
         ======================================================= */}
      {showEggModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Recolección Diaria de Huevos</h3>
            <form onSubmit={handleRecordEggs}>
              <div className="form-group">
                <label>Fecha de Recolección</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required
                  value={eggForm.date}
                  onChange={e => setEggForm({ ...eggForm, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Huevos Sanos Recolectados</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="80" 
                  required
                  value={eggForm.quantityCollected}
                  onChange={e => setEggForm({ ...eggForm, quantityCollected: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Huevos Rotos / Descartados</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="3" 
                  value={eggForm.quantityBroken}
                  onChange={e => setEggForm({ ...eggForm, quantityBroken: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Humedad alta, postura normal..."
                  value={eggForm.notes}
                  onChange={e => setEggForm({ ...eggForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowEggModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: EMPAQUETAR
         ======================================================= */}
      {showPackModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Empaquetar Huevos para Venta</h3>
            <form onSubmit={handlePackEggs}>
              <div className="form-group">
                <label>Selecciona el Producto</label>
                <select 
                  className="form-control" 
                  required
                  value={packForm.productId}
                  onChange={e => setPackForm({ ...packForm, productId: e.target.value })}
                >
                  <option value="">-- Elige un producto --</option>
                  {products.filter(p => p.category === 'eggs' || p.category === 'processed').map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock actual: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Cantidad de Cajas / Maples a crear</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="5" 
                  required
                  value={packForm.packagesCount}
                  onChange={e => setPackForm({ ...packForm, packagesCount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Equivalente de huevos por empaque</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="30" 
                  required
                  value={packForm.eggsPerPackage}
                  onChange={e => setPackForm({ ...packForm, eggsPerPackage: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Empaquetar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowPackModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: ALIMENTO
         ======================================================= */}
      {showFeedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Registrar Movimiento de Alimento</h3>
            <form onSubmit={handleUpdateFeed}>
              <div className="form-group">
                <label>Tipo de Alimento</label>
                <select 
                  className="form-control"
                  value={feedForm.type}
                  onChange={e => setFeedForm({ ...feedForm, type: e.target.value })}
                >
                  <option value="ponedora">Ponedoras (Codornices adultas)</option>
                  <option value="iniciador">Iniciador (Polluelos de codorniz)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Operación</label>
                <select 
                  className="form-control"
                  value={feedForm.action}
                  onChange={e => setFeedForm({ ...feedForm, action: e.target.value })}
                >
                  <option value="buy">Comprar bolsa (+ kg)</option>
                  <option value="consume">Consumo manual / Pérdida (- kg)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cantidad (en kg)</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="form-control" 
                  placeholder="25" 
                  required
                  value={feedForm.quantity}
                  onChange={e => setFeedForm({ ...feedForm, quantity: e.target.value })}
                />
              </div>

              {feedForm.action === 'buy' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginBottom: '0.75rem' }}>Detalles de Gastos (Flete)</h4>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="form-group" style={{ flex: '1' }}>
                      <label>Precio Pagado ($)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="24000" 
                        value={feedForm.price}
                        onChange={e => setFeedForm({ ...feedForm, price: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: '1' }}>
                      <label>Flete / Envío ($)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="5000" 
                        value={feedForm.shippingCost}
                        onChange={e => setFeedForm({ ...feedForm, shippingCost: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }}>Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowFeedModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
