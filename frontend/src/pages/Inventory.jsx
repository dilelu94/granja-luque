import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

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

const getCageBadgeDataURL = (name) => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // Hacemos el canvas un poco más ancho (160) para soportar códigos de 5 caracteres como AA000
  canvas.width = 160;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  
  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 160, 48);
  
  // Borde oscuro
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 156, 44);
  
  // Texto centrado (ajustamos el tamaño si el texto es largo)
  ctx.fillStyle = '#0f172a';
  const fontSize = name.length > 4 ? '18px' : '22px';
  ctx.font = `bold ${fontSize} monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 80, 24);
  
  return canvas.toDataURL();
};

const CollapsibleNotes = ({ notes }) => {
  const [expanded, setExpanded] = useState(false);
  if (!notes) return null;
  
  const lines = notes.split('\n').filter(line => line.trim() !== '');
  const isLong = notes.length > 80 || lines.length > 1;
  
  if (!isLong) {
    return (
      <div style={{ 
        fontSize: '0.75rem', 
        fontWeight: 'normal', 
        color: 'var(--text-secondary)', 
        marginTop: '0.35rem', 
        whiteSpace: 'pre-wrap',
        lineHeight: '1.3',
        minWidth: '220px',
        maxWidth: '350px'
      }}>
        {notes}
      </div>
    );
  }
  
  let preview = lines[0];
  if (preview.length > 80) {
    preview = preview.slice(0, 80) + '...';
  } else if (lines.length > 1) {
    preview = preview + '...';
  }
  
  return (
    <div style={{ 
      fontSize: '0.75rem', 
      fontWeight: 'normal', 
      color: 'var(--text-secondary)', 
      marginTop: '0.35rem', 
      lineHeight: '1.3',
      minWidth: '220px',
      maxWidth: '350px'
    }}>
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {expanded ? notes : preview}
      </div>
      <span 
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        style={{ 
          color: 'var(--accent-green)', 
          cursor: 'pointer', 
          fontSize: '0.7rem', 
          fontWeight: '600',
          marginTop: '0.2rem',
          display: 'inline-block',
          textDecoration: 'underline'
        }}
      >
        {expanded ? 'Ver menos ⬆' : 'Ver más ⬇'}
      </span>
    </div>
  );
};

export default function Inventory({ token }) {
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

  const [eggDateMode, setEggDateMode] = useState('hoy'); // 'hoy' | 'ayer' | 'manual'
  const [activeTab, setActiveTab] = useState('birds'); // 'birds' | 'feed' | 'products' | 'cages'
  const [batches, setBatches] = useState([]);
  const [feed, setFeed] = useState({ initiator: { stock: 0 }, ponedora: { stock: 0 } });
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ egg_base_cost: '15.0' });
  const [cages, setCages] = useState([]);
  
  // Modals / Forms States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showCageModal, setShowCageModal] = useState(false);
  const [showEditCageModal, setShowEditCageModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRCage, setSelectedQRCage] = useState(null);
  
  const [containerForm, setContainerForm] = useState({ id: null, name: '', containerStock: 0, containerCost: 0, originalProd: null });

  // Form inputs
  const [batchForm, setBatchForm] = useState({ name: '', type: 'chick', initialQuantity: '', birthDate: '', notes: '', cageId: '' });
  const [editBatchForm, setEditBatchForm] = useState({ id: '', name: '', type: 'chick', initialQuantity: '', currentQuantity: '', femalesQuantity: '', malesQuantity: '', birthDate: '', status: 'active', notes: '', cageId: '' });
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [mortalityForm, setMortalityForm] = useState({ count: '', reason: 'Muerte / Enfermedad', notes: '' });
  
  const [eggForm, setEggForm] = useState({ date: todayStr, quantityCollected: '', quantityBroken: '', notes: '' });
  const [packForm, setPackForm] = useState({ productId: '', packagesCount: '', eggsPerPackage: '' });
  const [feedForm, setFeedForm] = useState({ type: 'ponedora', action: 'buy', quantity: '', price: '', shippingCost: '', purchaseDate: new Date().toISOString().split('T')[0] });
  const [feedPurchases, setFeedPurchases] = useState([]);

  const [cageForm, setCageForm] = useState({ name: '', capacity: '50', notes: '' });
  const [editCageForm, setEditCageForm] = useState({ id: '', name: '', capacity: '', notes: '' });
  
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
    eggCount: '',
    containerStock: ''
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

      // 1.5. Jaulas
      const resCages = await fetch('/api/inventory/cages', { headers });
      const dataCages = await resCages.json();
      setCages(dataCages);

      // 2. Alimentos
      const resFeed = await fetch('/api/inventory/feed', { headers });
      const dataFeed = await resFeed.json();
      setFeed(dataFeed);

      // 2.5. Historial de Compras de Alimentos
      const resFeedPurchases = await fetch('/api/inventory/feed/purchases', { headers });
      const dataFeedPurchases = await resFeedPurchases.json();
      setFeedPurchases(dataFeedPurchases);

      // 3. Productos
      const resProducts = await fetch('/api/inventory/products/admin', { headers });
      const dataProducts = await resProducts.json();
      setProducts(dataProducts.filter(p => p.status !== 'inactive'));

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
        body: JSON.stringify({
          ...batchForm,
          cageId: batchForm.cageId ? Number(batchForm.cageId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Lote de codornices registrado e hitos agendados en el calendario.');
      setShowBatchModal(false);
      setBatchForm({ name: '', type: 'chick', initialQuantity: '', birthDate: '', notes: '', cageId: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // Editar lote de codornices
  const handleEditBatchClick = (batch) => {
    setEditBatchForm({
      id: batch.id,
      name: batch.name,
      type: batch.type,
      initialQuantity: batch.initialQuantity,
      currentQuantity: batch.currentQuantity,
      femalesQuantity: batch.femalesQuantity || 0,
      malesQuantity: batch.malesQuantity || 0,
      birthDate: batch.birthDate,
      status: batch.status,
      notes: batch.notes || '',
      cageId: batch.cageId || ''
    });
    setShowEditBatchModal(true);
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/inventory/quail-batches/${editBatchForm.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editBatchForm.name,
          type: editBatchForm.type,
          initialQuantity: Number(editBatchForm.initialQuantity),
          currentQuantity: Number(editBatchForm.currentQuantity),
          femalesQuantity: Number(editBatchForm.femalesQuantity),
          malesQuantity: Number(editBatchForm.malesQuantity),
          birthDate: editBatchForm.birthDate,
          status: editBatchForm.status,
          notes: editBatchForm.notes,
          cageId: editBatchForm.cageId ? Number(editBatchForm.cageId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Lote de aves actualizado con éxito.');
      setShowEditBatchModal(false);
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
        body: JSON.stringify({
          count: Number(mortalityForm.count),
          reason: mortalityForm.reason,
          notes: mortalityForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(`Bajas registradas con éxito para el lote.`);
      setShowMortalityModal(false);
      setMortalityForm({ count: '', reason: 'Muerte / Enfermedad', notes: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDateModeCycle = () => {
    if (eggDateMode === 'hoy') {
      setEggDateMode('ayer');
      setEggForm(prev => ({ ...prev, date: yesterdayStr }));
    } else if (eggDateMode === 'ayer') {
      setEggDateMode('manual');
    } else {
      setEggDateMode('hoy');
      setEggForm(prev => ({ ...prev, date: todayStr }));
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
      setEggForm({ date: todayStr, quantityCollected: '', quantityBroken: '', notes: '' });
      setEggDateMode('hoy');
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
        body: JSON.stringify({
          productId: packForm.productId,
          packagesCount: Number(packForm.packagesCount)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Huevos empaquetados e incrementado el stock del producto.');
      setShowPackModal(false);
      setPackForm({ productId: '', packagesCount: '', eggsPerPackage: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleAdjustLooseEggs = async () => {
    const current = Number(settings.loose_eggs_stock || 0);
    const newVal = prompt(`Cantidad actual: ${current}\n\nIngresa la nueva cantidad total de huevos sueltos (ajuste manual):`, current);
    if (newVal === null || newVal.trim() === '') return;
    const numVal = Number(newVal);
    if (isNaN(numVal) || numVal < 0) {
      showNotification('Cantidad inválida', true);
      return;
    }

    try {
      const res = await fetch('/api/inventory/eggs/loose', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newStock: numVal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Stock de huevos sueltos ajustado con éxito.');
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleProductChangeForPacking = (productId) => {
    const prod = products.find(p => p.id === Number(productId));
    setPackForm({
      ...packForm,
      productId,
      eggsPerPackage: prod ? String(prod.egg_count || 30) : '30'
    });
  };

  // 4.5. CRUD de Jaulas
  const handleCreateCage = async (e) => {
    e.preventDefault();
    const nameTrim = cageForm.name.trim();
    const cageNameRegex = /^[A-Za-z]{2}\d{3}$/;
    if (!cageNameRegex.test(nameTrim)) {
      showNotification('El identificador debe tener exactamente 2 letras y 3 números (ej. AA000).', true);
      return;
    }
    try {
      const res = await fetch('/api/inventory/cages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nameTrim.toUpperCase(),
          capacity: Number(cageForm.capacity),
          notes: cageForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Jaula creada con éxito.');
      setShowCageModal(false);
      setCageForm({ name: '', capacity: '50', notes: '' });
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleEditCageClick = (cage) => {
    setEditCageForm({
      id: cage.id,
      name: cage.name,
      capacity: cage.capacity,
      notes: cage.notes || ''
    });
    setShowEditCageModal(true);
  };

  const handleSaveCage = async (e) => {
    e.preventDefault();
    const nameTrim = editCageForm.name.trim();
    const cageNameRegex = /^[A-Za-z]{2}\d{3}$/;
    if (!cageNameRegex.test(nameTrim)) {
      showNotification('El identificador debe tener exactamente 2 letras y 3 números (ej. AA000).', true);
      return;
    }
    try {
      const res = await fetch(`/api/inventory/cages/${editCageForm.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: nameTrim.toUpperCase(),
          capacity: Number(editCageForm.capacity),
          notes: editCageForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Jaula actualizada con éxito.');
      setShowEditCageModal(false);
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDeleteCage = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta jaula? Los lotes vinculados no se eliminarán pero quedarán sin jaula asignada.')) return;
    try {
      const res = await fetch(`/api/inventory/cages/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Jaula eliminada con éxito.');
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handlePrintQR = () => {
    const canvas = document.querySelector('.modal-content canvas');
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotification('Por favor permite las ventanas emergentes (popups) para imprimir.', true);
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR - Jaula ${selectedQRCage.name}</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-family: monospace;
              text-align: center;
              background: white;
              color: black;
            }
            .container {
              padding: 20px;
              display: inline-block;
            }
            img {
              width: 250px;
              height: 250px;
            }
            .name {
              margin-top: 15px;
              font-size: 24px;
              font-weight: bold;
              border: 2px solid #000;
              padding: 5px 15px;
              display: inline-block;
              border-radius: 5px;
            }
            @media print {
              body {
                height: auto;
              }
              .container {
                border: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="${qrDataUrl}" alt="QR" />
            <br />
            <div class="name">${selectedQRCage.name}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 5. Cargar / Ajustar alimento (incluyendo precio y flete)
  const handleUpdateFeed = async (e) => {
    e.preventDefault();
    const endpoint = feedForm.action === 'buy' ? '/api/inventory/feed/buy' : '/api/inventory/feed/consume';
    
    const payload = {
      type: feedForm.type,
      quantity: Number(feedForm.quantity),
      price: feedForm.action === 'buy' ? Number(feedForm.price || 0) : 0,
      shippingCost: feedForm.action === 'buy' ? Number(feedForm.shippingCost || 0) : 0,
      purchaseDate: feedForm.action === 'buy' ? feedForm.purchaseDate : new Date().toISOString().split('T')[0]
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
      setFeedForm({ type: 'ponedora', action: 'buy', quantity: '', price: '', shippingCost: '', purchaseDate: new Date().toISOString().split('T')[0] });
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
          eggCount: Number(productForm.eggCount || 0),
          containerStock: Number(productForm.containerStock || 0)
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
      eggCount: prod.egg_count !== undefined ? prod.egg_count : 0,
      containerStock: prod.container_stock !== undefined ? prod.container_stock : 0
    });
    setShowProductModal(true);
  };

  const handleEditContainerClick = (prod) => {
    setContainerForm({
      id: prod.id,
      name: prod.name,
      containerStock: prod.container_stock !== undefined ? prod.container_stock : 0,
      containerCost: prod.container_cost !== undefined ? prod.container_cost : 0,
      originalProd: prod
    });
    setShowContainerModal(true);
  };

  const handleSaveContainer = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/inventory/products/${containerForm.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: containerForm.id,
          name: containerForm.originalProd.name,
          description: containerForm.originalProd.description || '',
          price: Number(containerForm.originalProd.price),
          stock: Number(containerForm.originalProd.stock),
          category: containerForm.originalProd.category,
          imageUrl: containerForm.originalProd.image_url || '',
          status: containerForm.originalProd.status || 'active',
          labelCost: Number(containerForm.originalProd.label_cost || 0),
          eggCount: Number(containerForm.originalProd.egg_count || 0),
          containerCost: Number(containerForm.containerCost || 0),
          containerStock: Number(containerForm.containerStock || 0)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification('Stock de envases actualizado con éxito.');
      setShowContainerModal(false);
      fetchData();
    } catch (err) {
      showNotification(err.message, true);
    }
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
      eggCount: '',
      containerStock: ''
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
          <button className="btn btn-primary" onClick={() => setShowEggModal(true)} title="Hacer clic para recolectar huevos"><img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '0.4rem' }} /> Recolectar Huevos</button>
          <button className="btn btn-secondary" onClick={() => setShowPackModal(true)} title="Descontar huevos sueltos y envases para armar el producto de venta">📦 Empaquetar</button>
          <button className="btn btn-secondary" onClick={() => setShowCageModal(true)} title="Hacer clic para 🪵 nueva jaula">🪵 Nueva Jaula</button>
          <button className="btn btn-secondary" onClick={() => setShowFeedModal(true)} title="Hacer clic para cargar alimento">🌾 Cargar Alimento</button>
          <button className="btn btn-gold" onClick={() => setShowBatchModal(true)} title="Hacer clic para nuevo lote aves" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <img src="/HatchlingQuail.png" alt="🐣" style={{ width: '1.2em', height: '1.2em', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            Nuevo Lote Aves
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              window.history.pushState({}, '', '/escanear');
              window.location.reload();
            }}
           title="Abrir el escáner de códigos QR">
            📷 Escanear QR
          </button>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '1rem' }}>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'birds' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'birds' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
          onClick={() => setActiveTab('birds')}
         title="Hacer clic para lotes de aves">
          <img src="/Quails.png" alt="🐤" style={{ width: '1.2em', height: '1.2em', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          Lotes de Aves
        </button>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'cages' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'cages' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('cages')}
         title="Hacer clic para 🪵 jaulas">
          🪵 Jaulas
        </button>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'feed' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('feed')}
         title="Hacer clic para alimento y fletes">
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
         title="Hacer clic para ️ productos (venta)">
          🏷️ Productos (Venta)
        </button>
        <button 
          className="btn" 
          style={{
            borderBottom: activeTab === 'containers' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'containers' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}
          onClick={() => setActiveTab('containers')}
         title="Hacer clic para envases vacíos">
          📦 Envases Vacíos
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
                    <th>Jaula</th>
                    <th>Cantidad Inicial</th>
                    <th>Cantidad Actual</th>
                    <th>Fecha de Ingreso</th>
                    <th>Tipo / Edad</th>
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
                        <td style={{ fontWeight: '600', minWidth: '180px' }}>
                          {batch.name}
                          <CollapsibleNotes notes={batch.notes} />
                        </td>
                        <td>
                          {batch.cageName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: '600', color: 'var(--accent-gold)' }}>
                                {batch.cageName}
                              </span>
                              {cages.some(c => c.id === batch.cageId) && (
                                <button
                                  type="button"
                                  className="btn"
                                  style={{
                                    padding: '0.15rem 0.35rem',
                                    fontSize: '0.75rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px'
                                  }}
                                  onClick={() => {
                                    const cage = cages.find(c => c.id === batch.cageId);
                                    if (cage) {
                                      setSelectedQRCage(cage);
                                      setShowQRModal(true);
                                    }
                                  }}
                                  title={`Ver código QR de la jaula ${batch.cageName}`}
                                >
                                  📷 QR
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                          )}
                        </td>
                        <td>{batch.initialQuantity}</td>
                        <td style={{ fontWeight: 'bold' }}>{batch.currentQuantity}</td>
                        <td>{formatDate(batch.birthDate)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
                              <span className={`badge ${batch.type === 'chick' ? 'badge-approved' : 'badge-pending'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                {batch.type === 'chick' ? (
                                  <>
                                    <img src="/HatchlingQuail.png" alt="🐣" style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    Polluelo
                                  </>
                                ) : 'Codorniz Adulta'}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                ({weeks} sem, {days} d)
                              </span>
                            </div>
                            {batch.type !== 'chick' && (batch.femalesQuantity > 0 || batch.malesQuantity > 0) && (
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                                {batch.femalesQuantity > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    <img src="/FemaleQuail.png" alt="♀️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    {batch.femalesQuantity} H
                                  </span>
                                )}
                                {batch.malesQuantity > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    <img src="/MaleQuail.png" alt="♂️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    {batch.malesQuantity} M
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${batch.status === 'active' ? 'badge-paid' : 'badge-cancelled'}`}>
                            {batch.status === 'active' ? 'Activo' : batch.status === 'sold' ? 'Vendido' : 'Retirado'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {batch.status === 'active' && (
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedBatchId(batch.id);
                                  setShowMortalityModal(true);
                                }}
                               title="Hacer clic para baja">
                                Baja
                              </button>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleEditBatchClick(batch)}
                             title="Abrir formulario para editar este registro">
                              ✏️ Editar
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
      )}

      {/* =======================================================
          TAB: JAULAS
         ======================================================= */}
      {activeTab === 'cages' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>
              Gestión de Jaulas 🪵
            </h3>
            <button className="btn btn-primary" onClick={() => setShowCageModal(true)} title="Abrir formulario para crear una nueva jaula">
              🪵 Agregar Jaula
            </button>
          </div>
          
          {cages.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay jaulas registradas.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Jaula</th>
                    <th>Capacidad</th>
                    <th>Ocupación Actual</th>
                    <th>Lotes de aves alojados</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cages.map(cage => {
                    const occupancyPercent = cage.capacity > 0 ? Math.round((cage.current_occupancy / cage.capacity) * 100) : 0;
                    const cageBatches = batches.filter(b => b.cageId === cage.id && b.status === 'active');
                    
                    return (
                      <tr key={cage.id}>
                        <td style={{ fontWeight: 'bold' }}>{cage.name}</td>
                        <td>{cage.capacity} aves</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              color: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent >= 90 ? 'var(--accent-gold)' : 'var(--accent-green)',
                              fontWeight: '600'
                            }}>
                              {cage.current_occupancy} / {cage.capacity} ({occupancyPercent}%)
                            </span>
                            <div style={{
                              width: '60px', height: '8px', background: '#374151', borderRadius: '4px', overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${Math.min(100, occupancyPercent)}%`,
                                height: '100%',
                                background: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent >= 90 ? 'var(--accent-gold)' : 'var(--accent-green)'
                              }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          {cageBatches.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vacía</span>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                              {cageBatches.map(b => (
                                <li key={b.id}>
                                  <strong>{b.name}</strong> ({b.currentQuantity} {b.type === 'chick' ? 'polluelos' : 'adultas'}, {b.birthDate})
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{cage.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setSelectedQRCage(cage);
                                setShowQRModal(true);
                              }}
                             title="Hacer clic para ️ ver qr">
                              🖨️ Ver QR
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleEditCageClick(cage)}
                             title="Abrir formulario para editar este registro">
                              ✏️ Editar
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                              onClick={() => handleDeleteCage(cage.id)}
                             title="Eliminar permanentemente este registro">
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
          )}
        </div>
      )}

      {/* =======================================================
          TAB: ALIMENTO
         ======================================================= */}
      {activeTab === 'feed' && (
        <div>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div className="glass-card" style={{ flex: '1', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '5px solid var(--accent-green)' }}>
              <div style={{ fontSize: '3rem' }}>⚖️</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Total Stock Alimento</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                  {((feed.ponedora?.stock || 0) + (feed.initiator?.stock || 0)).toFixed(2)} kg
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Ponedoras + Iniciador
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ flex: '1', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '5px solid var(--accent-gold)' }}>
              <div style={{ fontSize: '3rem' }}>🌾</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Alimento Ponedoras</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{(feed.ponedora?.stock || 0).toFixed(2)} kg</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Consumo: {(feed.ponedora?.dailyConsumption || 0).toFixed(2)} kg/día
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ flex: '1', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '5px solid var(--accent-blue)' }}>
              <div style={{ fontSize: '3rem' }}>🧪</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Alimento Iniciador</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{(feed.initiator?.stock || 0).toFixed(2)} kg</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Consumo: {(feed.initiator?.dailyConsumption || 0).toFixed(2)} kg/día
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)' }}>Historial de Compras de Alimento</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Registro de fletes y costos por llegada de alimiento (los costos se guardan en el libro de gastos).
            </p>
            {feedPurchases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                💡 No hay compras registradas. Puedes cargar fletes y precios en el botón **Cargar Alimento** de arriba.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha de Llegada</th>
                      <th>Alimento</th>
                      <th>Cantidad</th>
                      <th>Precio Pagado</th>
                      <th>Flete / Envío</th>
                      <th>Costo Total</th>
                      <th>Costo por Kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedPurchases.map(purchase => {
                      const totalCost = purchase.price + purchase.shipping_cost;
                      const costPerKg = purchase.quantity_kg > 0 ? (totalCost / purchase.quantity_kg).toFixed(2) : '0.00';
                      return (
                        <tr key={purchase.id}>
                          <td style={{ fontWeight: '600' }}>{formatDate(purchase.purchase_date)}</td>
                          <td>
                            <span className={`badge ${purchase.feed_type === 'iniciador' ? 'badge-approved' : 'badge-pending'}`}>
                              {purchase.feed_type === 'iniciador' ? 'Iniciador' : 'Ponedora'}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600' }}>{Number(purchase.quantity_kg).toFixed(2)} kg</td>
                          <td>${Number(purchase.price).toFixed(2)}</td>
                          <td>${Number(purchase.shipping_cost).toFixed(2)}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>${totalCost.toFixed(2)}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>${costPerKg}/kg</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
             title="Registrar y crear el nuevo elemento">
              🏷️ Crear Producto
            </button>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1.25rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div>
              📋 **Cálculo de Margen**: Basado en un **Costo Unitario de Huevo de Codorniz de $ {eggUnitCost} ARS** (configurable en Ajustes).
              El costo de materia prima se calcula automáticamente: `Cantidad de Huevos * Costo Unitario`.
            </div>
            {feed.ponedora && (
              <div style={{
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)'
              }}>
                💡 **Incidencia del Alimento**: Una codorniz adulta come aprox. <strong>{(Number(settings.feed_consumption_adult || 0.025) * 1000)}g</strong> al día. 
                Con el precio actual del alimento Ponedora (<strong>${Number(feed.ponedora.costPerKg || 1160.0).toFixed(2)}/kg</strong>) y una tasa de postura estimada del 80%, 
                el costo de alimento necesario para producir 1 huevo es de aproximadamente <strong>${((Number(settings.feed_consumption_adult || 0.025) * Number(feed.ponedora.costPerKg || 1160.0)) / 0.8).toFixed(2)} ARS</strong>.
              </div>
            )}
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
                  <th>Stock Producto</th>
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
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>${Number(prod.price).toFixed(2)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        📦 Envase plástico: ${Number(containerCost).toFixed(2)}
                        <br />🏷️ Etiqueta: ${Number(labelCost).toFixed(2)}
                        {eggCount > 0 && <><br /><img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '0.2rem' }} /> Huevos ({eggCount}): ${Number(rawCost).toFixed(2)} (${Number(eggUnitCost).toFixed(2)} c/u)</>}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>${totalCost.toFixed(2)}</td>
                      <td style={{ color: margin >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold' }}>
                        ${margin.toFixed(2)} ({marginPercent}%)
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
                           title="Abrir formulario para editar este registro">
                            ✏️ Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDeleteProduct(prod.id)}
                           title="Eliminar permanentemente este registro">
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
          TAB: ENVASES VACÍOS
         ======================================================= */}
      {activeTab === 'containers' && (
        <div className="glass-card">
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div className="glass-card" style={{ flex: '1', minWidth: '240px', display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '5px solid var(--accent-gold)' }}>
              <div style={{ fontSize: '3rem' }}>📦</div>
              <div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Total Envases Vacíos</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                  {products.reduce((acc, p) => acc + (p.container_stock || 0), 0)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Suma de maples, frascos y cajas
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Huevos que se pueden empacar: <strong>{products.reduce((acc, p) => acc + (p.container_stock || 0) * (p.egg_count || 0), 0)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Inventario de Envases</h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto Asociado</th>
                  <th>Categoría</th>
                  <th>Envases Vacíos (Stock)</th>
                  <th>Costo por Envase</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map(prod => (
                  <tr key={`env-${prod.id}`}>
                    <td style={{ fontWeight: '600' }}>{prod.name}</td>
                    <td>
                      <span className="badge badge-pending">{prod.category}</span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: (prod.container_stock > 0) ? 'var(--accent-gold)' : 'var(--text-muted)', fontSize: '1.1rem' }}>
                      {prod.container_stock || 0} uds
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      ${Number(prod.container_cost || 0).toFixed(2)}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => handleEditContainerClick(prod)}
                       title="Hacer clic para modificar stock envases">
                        ➕ Modificar Stock Envases
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: MODIFICAR STOCK DE ENVASES
         ======================================================= */}
      {showContainerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>
              Modificar Envase: {containerForm.name}
            </h3>
            <form onSubmit={handleSaveContainer}>
              <div className="form-group">
                <label>Stock de Envases Vacíos</label>
                <input 
                  type="number" 
                  className="form-control" 
                  required
                  min="0"
                  value={containerForm.containerStock}
                  onChange={e => setContainerForm({ ...containerForm, containerStock: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <small style={{ color: 'var(--text-muted)' }}>Cantidad de maples/frascos/cajas vacías disponibles.</small>
              </div>

              <div className="form-group">
                <label>Costo por Envase ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  required
                  min="0"
                  value={containerForm.containerCost}
                  onChange={e => setContainerForm({ ...containerForm, containerCost: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
                <small style={{ color: 'var(--text-muted)' }}>Costo unitario del envase (se usa para calcular el costo total de fabricación).</small>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Guardar el envase y actualizar su stock o precio de costo">Guardar Envase</button>
                {containerForm.id && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ flex: '0.5' }} 
                    onClick={() => {
                      setShowContainerModal(false);
                      handleDeleteProduct(containerForm.id);
                    }}
                   title="Eliminar permanentemente este registro">
                    Borrar
                  </button>
                )}
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowContainerModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
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
                  <label>Stock Producto Terminado</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="10" 
                    required
                    value={productForm.stock}
                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Stock Envases Vacíos</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="0" 
                    required
                    value={productForm.containerStock}
                    onChange={e => setProductForm({ ...productForm, containerStock: e.target.value })}
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

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Guardar el producto y actualizar sus especificaciones">Guardar Producto</button>
                {productForm.id && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ flex: '0.5' }} 
                    onClick={() => {
                      setShowProductModal(false);
                      handleDeleteProduct(productForm.id);
                    }}
                   title="Eliminar permanentemente este registro">
                    Borrar
                  </button>
                )}
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowProductModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
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
                <label>Jaula de Aves 🪵</label>
                <select 
                  className="form-control"
                  value={batchForm.cageId}
                  onChange={e => setBatchForm({ ...batchForm, cageId: e.target.value })}
                >
                  <option value="">-- Sin jaula (Libre) --</option>
                  {cages.map(cage => (
                    <option key={cage.id} value={cage.id}>
                      {cage.name} (Capac: {cage.capacity}, Ocup: {cage.current_occupancy}/{cage.capacity})
                    </option>
                  ))}
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

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Registrar los datos completados">Registrar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowBatchModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: REGISTRAR MORTALIDAD (BAJAS)
         ======================================================= */}
      {showMortalityModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Registrar Bajas / Descarte</h3>
            <form onSubmit={handleRecordMortality}>
              <div className="form-group">
                <label>Cantidad de Aves</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="1" 
                  required
                  value={mortalityForm.count}
                  onChange={e => setMortalityForm({ ...mortalityForm, count: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Motivo de la Baja</label>
                <select 
                  className="form-control"
                  value={mortalityForm.reason}
                  onChange={e => setMortalityForm({ ...mortalityForm, reason: e.target.value })}
                >
                  <option value="Muerte / Enfermedad">Muerte / Enfermedad</option>
                  <option value="Faena / Consumo">Faena / Consumo (Hecha carne)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observaciones / Detalles</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: una murió hoy / faenada para carne" 
                  value={mortalityForm.notes}
                  onChange={e => setMortalityForm({ ...mortalityForm, notes: e.target.value })}
                />
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Esto descontará la cantidad del lote activo y guardará el registro en sus notas.
              </p>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-danger" style={{ flex: '1' }} title="Registrar bajas (muertes o retiros) en el lote seleccionado">Guardar Bajas</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowMortalityModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
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
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>Fecha de Recolección</label>
                <button
                  type="button"
                  onClick={handleDateModeCycle}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  title="Cambiar fecha de recolección (Hoy / Ayer / Manual)"
                >
                  📅 {eggDateMode === 'hoy' ? 'Hoy' : eggDateMode === 'ayer' ? 'Ayer' : 'Fecha Manual'} 🔄
                  <span style={{ fontSize: '0.85rem', fontWeight: 'normal', opacity: 0.8, marginLeft: '0.5rem' }}>
                    ({eggDateMode === 'hoy' ? today.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 
                       eggDateMode === 'ayer' ? yesterday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 'Seleccionar'})
                  </span>
                </button>

                {eggDateMode === 'manual' && (
                  <input 
                    type="date"
                    className="form-control"
                    required
                    value={eggForm.date}
                    onChange={e => setEggForm({ ...eggForm, date: e.target.value })}
                    style={{ marginTop: '0.25rem' }}
                    max={todayStr}
                  />
                )}
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

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y guardar los datos ingresados">Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => { setShowEggModal(false); setEggDateMode('hoy'); setEggForm(prev => ({ ...prev, date: todayStr })); }} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: EMPAQUETAR
         ======================================================= */}
      {showPackModal && (() => {
        const looseEggs = Number(settings.loose_eggs_stock || 0);
        const allEggProducts = products.filter(p => (p.category === 'eggs' || p.category === 'processed') && p.egg_count > 0);
        const eggProducts = allEggProducts.filter(p => p.container_stock > 0);
        const suggestions = eggProducts.map(p => {
          const maxPacks = Math.min(p.container_stock, Math.floor(looseEggs / p.egg_count));
          return { ...p, maxPacks };
        }).filter(p => p.maxPacks > 0);

        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 style={{ marginBottom: '1.5rem' }}>Empaquetar Huevos para Venta</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Huevos Sueltos Disponibles</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1.75rem', color: 'var(--accent-gold)', lineHeight: '1' }}>{looseEggs}</strong>
                    <span 
                      style={{ cursor: 'pointer', opacity: 0.7, fontSize: '1rem', padding: '0.25rem' }} 
                      onClick={handleAdjustLooseEggs}
                      title="Ajustar Manualmente"
                    >
                      ✏️
                    </span>
                  </div>
                </div>
              </div>

              {suggestions.length > 0 ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>💡 Sugerencias Rápidas:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {suggestions.map(s => (
                      <button 
                        key={s.id} 
                        type="button"
                        className="btn btn-primary" 
                        style={{ fontSize: '0.85rem', padding: '0.5rem 0.8rem' }}
                        onClick={() => {
                          setPackForm({ productId: s.id, packagesCount: s.maxPacks, eggsPerPackage: s.egg_count });
                        }}
                       title="Hacer clic para x">
                        📦 {s.maxPacks}x {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255, 193, 7, 0.1)', color: 'var(--accent-gold)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem' }}>
                  💡 {looseEggs === 0 ? "No tienes huevos sueltos disponibles para empaquetar." : (eggProducts.length === 0 ? "No tienes envases vacíos (maples) cargados en ninguno de tus productos." : "No tienes suficientes huevos sueltos para llenar los envases vacíos que posees.")}
                  {eggProducts.length === 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {allEggProducts.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                          <span>{p.name} (Envases: {p.container_stock || 0})</span>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setShowPackModal(false);
                              handleEditContainerClick(p);
                            }}
                           title="Hacer clic para cargar envases">
                            ➕ Cargar Envases
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handlePackEggs}>
                <div className="form-group">
                  <label>Selecciona el Producto</label>
                  <select 
                    className="form-control" 
                    required
                    value={packForm.productId}
                    onChange={e => handleProductChangeForPacking(e.target.value)}
                  >
                    <option value="">-- Elige un producto --</option>
                    {eggProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock} | Envases vacíos: {p.container_stock || 0})
                      </option>
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
                    max={(() => {
                      if (!packForm.productId) return undefined;
                      const prod = products.find(p => p.id === Number(packForm.productId));
                      if (!prod) return undefined;
                      return Math.min(prod.container_stock || 0, Math.floor(looseEggs / (prod.egg_count || 1)));
                    })()}
                    value={packForm.packagesCount}
                    onChange={e => setPackForm({ ...packForm, packagesCount: e.target.value })}
                  />
                  {packForm.productId && (() => {
                    const prod = products.find(p => p.id === Number(packForm.productId));
                    if (!prod) return null;
                    const maxPossible = Math.min(prod.container_stock || 0, Math.floor(looseEggs / (prod.egg_count || 1)));
                    return <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Puedes crear hasta {maxPossible} paquetes.</small>;
                  })()}
                </div>

                <div className="form-group" style={{ display: 'none' }}>
                  <label>Equivalente de huevos por empaque</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    readOnly
                    value={packForm.eggsPerPackage}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: '1' }} disabled={looseEggs === 0 || eggProducts.length === 0} title="Descontar huevos sueltos y envases para armar el producto de venta">Empaquetar</button>
                  <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowPackModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                  <div className="form-group">
                    <label>Fecha de Compra / Llegada</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      required
                      value={feedForm.purchaseDate}
                      onChange={e => setFeedForm({ ...feedForm, purchaseDate: e.target.value })}
                    />
                  </div>
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

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y guardar los datos ingresados">Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowFeedModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: EDITAR LOTE DE AVES
         ======================================================= */}
      {showEditBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Editar Lote de Aves</h3>
            <form onSubmit={handleSaveBatch}>
              <div className="form-group">
                <label>Nombre del Lote</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  value={editBatchForm.name}
                  onChange={e => setEditBatchForm({ ...editBatchForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select 
                  className="form-control"
                  value={editBatchForm.type}
                  onChange={e => setEditBatchForm({ ...editBatchForm, type: e.target.value })}
                >
                  <option value="chick">Polluelo (Menor a 5 semanas, come Iniciador)</option>
                  <option value="adult">Adulta (Postura, come Ponedora)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Jaula de Aves 🪵</label>
                <select 
                  className="form-control"
                  value={editBatchForm.cageId}
                  onChange={e => setEditBatchForm({ ...editBatchForm, cageId: e.target.value })}
                >
                  <option value="">-- Sin jaula (Libre) --</option>
                  {cages.map(cage => (
                    <option key={cage.id} value={cage.id}>
                      {cage.name} (Capac: {cage.capacity}, Ocup: {cage.current_occupancy}/{cage.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Cantidad Inicial</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={editBatchForm.initialQuantity}
                    onChange={e => setEditBatchForm({ ...editBatchForm, initialQuantity: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Cantidad Actual Total</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={editBatchForm.currentQuantity}
                    onChange={e => setEditBatchForm({ ...editBatchForm, currentQuantity: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Hembras</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={editBatchForm.femalesQuantity}
                    onChange={e => setEditBatchForm({ 
                      ...editBatchForm, 
                      femalesQuantity: e.target.value,
                      currentQuantity: Number(e.target.value) + Number(editBatchForm.malesQuantity)
                    })}
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Machos</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required
                    value={editBatchForm.malesQuantity}
                    onChange={e => setEditBatchForm({ 
                      ...editBatchForm, 
                      malesQuantity: e.target.value,
                      currentQuantity: Number(editBatchForm.femalesQuantity) + Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Fecha de Nacimiento / Ingreso</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required
                    value={editBatchForm.birthDate}
                    onChange={e => setEditBatchForm({ ...editBatchForm, birthDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label>Estado</label>
                  <select 
                    className="form-control"
                    value={editBatchForm.status}
                    onChange={e => setEditBatchForm({ ...editBatchForm, status: e.target.value })}
                  >
                    <option value="active">Activo</option>
                    <option value="sold">Vendido</option>
                    <option value="retired">Retirado</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notas Adicionales</label>
                <textarea 
                  className="form-control" 
                  value={editBatchForm.notes}
                  onChange={e => setEditBatchForm({ ...editBatchForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y aplicar los cambios realizados">Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowEditBatchModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: CREAR JAULA
         ======================================================= */}
      {showCageModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Crear Nueva Jaula</h3>
            <form onSubmit={handleCreateCage}>
              <div className="form-group">
                <label>Nombre / Identificador de la Jaula</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: AA000" 
                  required
                  maxLength={5}
                  pattern="[A-Za-z]{2}[0-9]{3}"
                  title="Debe tener exactamente 2 letras y 3 números (ej. AA000)"
                  value={cageForm.name}
                  onChange={e => setCageForm({ ...cageForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Capacidad Máxima (Aves)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="50" 
                  required
                  value={cageForm.capacity}
                  onChange={e => setCageForm({ ...cageForm, capacity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Notas / Descripción</label>
                <textarea 
                  className="form-control" 
                  placeholder="Material, ubicación, foco de luz..."
                  value={cageForm.notes}
                  onChange={e => setCageForm({ ...cageForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Registrar y crear el nuevo elemento">Crear</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowCageModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: EDITAR JAULA
         ======================================================= */}
      {showEditCageModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>Editar Jaula</h3>
            <form onSubmit={handleSaveCage}>
              <div className="form-group">
                <label>Nombre / Identificador de la Jaula</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  maxLength={5}
                  pattern="[A-Za-z]{2}[0-9]{3}"
                  title="Debe tener exactamente 2 letras y 3 números (ej. AA000)"
                  value={editCageForm.name}
                  onChange={e => setEditCageForm({ ...editCageForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Capacidad Máxima (Aves)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  required
                  value={editCageForm.capacity}
                  onChange={e => setEditCageForm({ ...editCageForm, capacity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Notas / Descripción</label>
                <textarea 
                  className="form-control" 
                  value={editCageForm.notes}
                  onChange={e => setEditCageForm({ ...editCageForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y aplicar los cambios realizados">Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => setShowEditCageModal(false)} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL: VER QR
         ======================================================= */}
      {showQRModal && selectedQRCage && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Código QR - Jaula {selectedQRCage.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Escaneá este código con tu celular para ver y gestionar la jaula directamente.
            </p>
            
            <div style={{ 
              background: 'white', 
              padding: '2rem', 
              borderRadius: '1rem', 
              display: 'inline-block',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
              <QRCodeCanvas 
                value={`${window.location.origin}/jaula/${selectedQRCage.id}`}
                size={256}
                level="H" // Nivel H para máxima tolerancia a errores y poder tapar el centro
                bgColor="#ffffff"
                fgColor="#0f172a"
                imageSettings={{
                  src: getCageBadgeDataURL(selectedQRCage.name),
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 108, // Ajustamos la anchura a 108 para la excavación de textos de 5 dígitos (AA000)
                  excavate: true // Esto limpia los módulos del QR debajo de la imagen para que sea escaneable
                }}
              />
              <br />
              <div style={{
                marginTop: '1.2rem',
                background: '#f1f5f9',
                padding: '0.4rem 1rem',
                borderRadius: '0.5rem',
                border: '2px solid #0f172a',
                fontWeight: '900',
                color: '#0f172a',
                fontSize: '1.4rem',
                fontFamily: 'monospace',
                display: 'inline-block'
              }}>
                {selectedQRCage.name}
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={handlePrintQR}
               title="Imprimir el código QR de esta jaula">
                🖨️ Imprimir
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedQRCage(null);
                }}
               title="Cerrar esta ventana">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
