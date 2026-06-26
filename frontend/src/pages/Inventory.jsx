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
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);
  const [cageViewMode, setCageViewMode] = useState('list'); // 'grid' | 'list' | 'table'
  
  // Modals / Forms States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showCageModal, setShowCageModal] = useState(false);
  const [showEditCageModal, setShowEditCageModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRCage, setSelectedQRCage] = useState(null);
  const [hoveredChart1, setHoveredChart1] = useState(null);
  const [hoveredChart2, setHoveredChart2] = useState(null);
  const [hoveredChart3, setHoveredChart3] = useState(null);
  
  const [containerForm, setContainerForm] = useState({ id: null, name: '', containerStock: 0, containerCost: 0, originalProd: null });

  // Form inputs
  const [batchForm, setBatchForm] = useState({ name: '', type: 'chick', initialQuantity: '', birthDate: '', notes: '', cageId: '' });
  const [editBatchForm, setEditBatchForm] = useState({ id: '', name: '', type: 'chick', initialQuantity: '', currentQuantity: '', femalesQuantity: '', malesQuantity: '', birthDate: '', status: 'active', notes: '', cageId: '' });
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [mortalityForm, setMortalityForm] = useState({ count: '', reason: 'Muerte / Enfermedad', notes: '' });
  
  const [eggData, setEggData] = useState({ history: [], totals: { collected: 0, broken: 0 }, cageCollections: [] });
  const [eggForm, setEggForm] = useState({ date: todayStr, quantityCollected: '', quantityBroken: '', notes: '', cageId: '' });
  const [eggTimeFilter, setEggTimeFilter] = useState('all'); // 'all' | 'week' | 'month' | 'year' | 'custom'
  const [eggStartDate, setEggStartDate] = useState('');
  const [eggEndDate, setEggEndDate] = useState('');
  const [eggCageFilter, setEggCageFilter] = useState('all'); // 'all' | cageId

  const [consumeQuantity, setConsumeQuantity] = useState('');
  const [packForm, setPackForm] = useState({ productId: '', packagesCount: '', eggsPerPackage: '' });
  const [feedForm, setFeedForm] = useState({ type: 'ponedora', action: 'buy', quantity: '', price: '', shippingCost: '', purchaseDate: new Date().toISOString().split('T')[0] });
  const [feedPurchases, setFeedPurchases] = useState([]);

  const [cageForm, setCageForm] = useState({ name: '', capacity: '50', notes: '' });
  const [editCageForm, setEditCageForm] = useState({ id: '', name: '', capacity: '', notes: '', status: 'active' });
  
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
      setProducts(dataProducts);

      // 4. Config (para costo base del huevo)
      const resSettings = await fetch('/api/settings', { headers });
      const dataSettings = await resSettings.json();
      setSettings(dataSettings);

      // 5. Egg production data
      const resEggs = await fetch('/api/inventory/eggs?limit=1000', { headers });

      const dataEggs = await resEggs.json();
      setEggData(dataEggs);
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

      showNotification(data.message || 'Recolección diaria de huevos guardada.');
      setShowEggModal(false);
      setEggForm({ date: todayStr, quantityCollected: '', quantityBroken: '', notes: '', cageId: '' });
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

  const handleConsumeEggs = async (e) => {
    e.preventDefault();
    if (!consumeQuantity || isNaN(consumeQuantity) || Number(consumeQuantity) <= 0) {
      showNotification('Ingresa una cantidad válida a descontar.', true);
      return;
    }
    try {
      const res = await fetch('/api/inventory/eggs/consume', {
        method: 'POST',
        headers,
        body: JSON.stringify({ quantity: Number(consumeQuantity) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showNotification(data.message || 'Huevos descontados con éxito.');
      setShowConsumeModal(false);
      setConsumeQuantity('');
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
      notes: cage.notes || '',
      status: cage.status || 'active'
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
          notes: editCageForm.notes,
          status: editCageForm.status || 'active'
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

  const handleQuickCreateCageClick = (type, height, col) => {
    const computedName = `${type}${height}${col}`;
    const defaultCapacity = type === 'A' ? 25 : 50;
    setCageForm({
      name: computedName,
      capacity: String(defaultCapacity),
      notes: ''
    });
    setShowCageModal(true);
  };

  const getNextSuggestedCageName = (cagesList) => {
    if (!cagesList || cagesList.length === 0) return 'AA100';
    const names = cagesList.map(c => c.name || '').filter(Boolean);
    const heightsOrder = ['A', 'B', 'C', 'D', 'E'];
    
    const columns = cagesList.map(c => {
      const colStr = (c.name || '').slice(2);
      return parseInt(colStr, 10) || 100;
    });
    const minCol = Math.min(...columns, 100);
    const maxCol = Math.max(...columns, 100);
    
    for (let col = minCol; col <= maxCol + 1; col++) {
      const colStr = String(col).padStart(3, '0');
      for (const h of heightsOrder) {
        const candidate = `A${h}${colStr}`;
        if (!names.includes(candidate)) {
          return candidate;
        }
      }
    }
    return 'AA100';
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

  const hasExistingCollection = eggData.cageCollections?.some(
    col => col.date === eggForm.date && Number(col.cageId) === Number(eggForm.cageId)
  );

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando datos de inventario...</p>;

  return (
    <div>
      {/* Botones de acción del encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>Inventario de Granja 📋</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowEggModal(true)} title="Hacer clic para recolectar huevos"><img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '0.4rem' }} /> Recolectar Huevos</button>
          <button className="btn btn-secondary" onClick={() => setShowPackModal(true)} title="Descontar huevos sueltos y envases para armar el producto de venta">📦 Empaquetar</button>
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
          <img src="/FemaleQuail.png" alt="🐤" style={{ width: '1.2em', height: '1.2em', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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
            borderBottom: activeTab === 'eggProduction' ? '2px solid var(--accent-green)' : 'none',
            borderRadius: '0', background: 'none', color: activeTab === 'eggProduction' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
          onClick={() => setActiveTab('eggProduction')}
         title="Hacer clic para ver el control y gráficos de producción de huevos">
          <img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle' }} />
          Producción de Huevos
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
        <div className="glass-card animate-slide-in" style={{ 
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          borderColor: 'var(--accent-green)',
          background: 'var(--bg-secondary)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: '#a7f3d0',
          padding: '1rem 1.5rem',
          maxWidth: '380px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: '5px solid var(--accent-green)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <div>{message}</div>
        </div>
      )}
      {error && (
        <div className="glass-card animate-slide-in" style={{ 
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          borderColor: 'var(--accent-red)',
          background: 'var(--bg-secondary)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: '#f87171',
          padding: '1rem 1.5rem',
          maxWidth: '380px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: '5px solid var(--accent-red)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>{error}</div>
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
                    <th style={{ textAlign: 'center' }}>Jaula</th>
                    <th style={{ textAlign: 'center' }}>Cantidad Actual</th>
                    <th style={{ textAlign: 'center' }}>Tipo / Edad</th>
                    <th style={{ textAlign: 'center' }}>Cantidad Inicial</th>
                    <th style={{ textAlign: 'center' }}>Fecha de Ingreso</th>
                    <th>Lote</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
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
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {batch.cageName ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
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
                                  QR
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', textAlign: 'center' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>{batch.currentQuantity}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                ({weeks} sem, {days} d)
                              </span>
                            </div>
                            <div>
                              <span className={`badge ${batch.type === 'chick' ? 'badge-approved' : 'badge-pending'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                {batch.type === 'chick' ? (
                                  <>
                                    <img src="/HatchlingQuail.png" alt="🐣" style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    Polluelo
                                  </>
                                ) : 'Codorniz Adulta'}
                              </span>
                            </div>
                            {batch.type !== 'chick' && (batch.femalesQuantity > 0 || batch.malesQuantity > 0) && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', justifyContent: 'center' }}>
                                {batch.femalesQuantity > 0 ? (
                                  <>
                                    <img src="/FemaleQuail.png" alt="♀️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    <span>{batch.femalesQuantity} H</span>
                                    {batch.malesQuantity > 0 && (
                                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                                        ({batch.malesQuantity} M)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <img src="/MaleQuail.png" alt="♂️" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    <span>{batch.malesQuantity} M</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{batch.initialQuantity}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{formatDate(batch.birthDate)}</td>
                        <td style={{ fontWeight: '600', minWidth: '180px', verticalAlign: 'middle' }}>
                          {batch.name}
                          <CollapsibleNotes notes={batch.notes} />
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span className={`badge ${batch.status === 'active' ? 'badge-paid' : 'badge-cancelled'}`} style={{ display: 'inline-flex', justifyContent: 'center' }}>
                            {batch.status === 'active' ? 'Activo' : batch.status === 'sold' ? 'Vendido' : 'Retirado'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
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

      {activeTab === 'cages' && (() => {
        // Parse codes
        const parsedCages = cages.map(c => {
          const name = c.name || '';
          const type = name[0] || 'A';
          const height = name[1] || 'A';
          const col = name.slice(2) || '000';
          return { ...c, type, height, col };
        });

        const activeParsedCages = parsedCages.filter(c => c.status !== 'inactive');
        const activeTypesOrder = ['A', 'C', 'B'];
        const activeTypes = cages.length === 0
          ? activeTypesOrder
          : [...new Set(activeParsedCages.map(c => c.type))].sort((a, b) => activeTypesOrder.indexOf(a) - activeTypesOrder.indexOf(b));
        const typeDetails = {
          A: { title: 'Módulos Estándar (Tipo A)', desc: 'Módulos normales de producción (Capacidad: 25 aves por jaula)' },
          B: { title: 'Módulos Temporales / Experimentales (Tipo B)', desc: 'Jaulas experimentales o de uso temporal' },
          C: { title: 'Cunas Criadoras de Pichones (Tipo C)', desc: 'Cajas de crianza especiales para pichones' }
        };

        return (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>
                Gestión de Jaulas 🪵
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <button 
                    className={`btn ${cageViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--border-radius-sm)' }}
                    onClick={() => setCageViewMode('grid')}
                  >
                    🕸️ Cuadrícula
                  </button>
                  <button 
                    className={`btn ${cageViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--border-radius-sm)' }}
                    onClick={() => setCageViewMode('list')}
                  >
                    🥞 Pilas
                  </button>
                  <button 
                    className={`btn ${cageViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--border-radius-sm)' }}
                    onClick={() => setCageViewMode('table')}
                  >
                    📋 Tabla
                  </button>
                </div>
                <button className="btn btn-primary" onClick={() => {
                  const suggested = getNextSuggestedCageName(cages);
                  const defaultCap = suggested.startsWith('A') ? 25 : 50;
                  setCageForm({ name: suggested, capacity: String(defaultCap), notes: '' });
                  setShowCageModal(true);
                }} title="Abrir formulario para crear una nueva jaula">
                  🪵 Agregar Jaula
                </button>
              </div>
            </div>
            
            <div>
              {/* 1. VISTA DE CUADRÍCULA (GRID VIEW) */}
              {cageViewMode === 'grid' && activeTypes.map(type => {
                const typeInfo = typeDetails[type] || { title: `Módulos de Tipo ${type}`, desc: `Jaulas de tipo ${type}` };
                const typeCages = activeParsedCages.filter(c => c.type === type);
                
                // Si está vacío, pre-poblar columnas por defecto para servir de guía (100 a 104)
                let cols = [...new Set(typeCages.map(c => c.col))].sort();
                if (cols.length === 0) {
                  cols = ['100', '101', '102', '103', '104'];
                } else {
                  const lastCol = cols[cols.length - 1];
                  const lastColNum = parseInt(lastCol, 10);
                  if (!isNaN(lastColNum)) {
                    const nextColNum = lastColNum + 1;
                    const nextColStr = String(nextColNum).padStart(lastCol.length, '0');
                    if (!cols.includes(nextColStr)) {
                      cols.push(nextColStr);
                    }
                  }
                }
                
                const standardHeights = type === 'A' ? ['E', 'D', 'C', 'B', 'A'] : ['A'];
                const activeHeights = [...new Set(typeCages.map(c => c.height))];
                const extraHeights = activeHeights.filter(h => !standardHeights.includes(h)).sort().reverse();
                const heightsToRender = [...extraHeights, ...standardHeights];

                const firstActiveIdx = heightsToRender.findIndex(h => typeCages.some(c => c.height === h));
                const referenceIdx = firstActiveIdx === -1 ? heightsToRender.length - 1 : firstActiveIdx;

                return (
                  <div key={type} style={{ marginBottom: '2.5rem', background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: 'var(--border-radius-md)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent-gold)', paddingLeft: '0.75rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                        {typeInfo.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{typeInfo.desc}</p>
                    </div>

                    <div className="table-container" style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: 'var(--border-radius-sm)' }}>
                      <table style={{ borderCollapse: 'separate', borderSpacing: '0.75rem', width: 'auto' }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: '80px', background: 'transparent', border: 'none' }}></th>
                            {cols.map(col => (
                              <th key={col} style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-primary)', padding: '0.5rem', minWidth: '220px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                                📍 Columna {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heightsToRender.map((height, idx) => {
                            const isLevelEmpty = !typeCages.some(c => c.height === height);
                            const isCompressed = idx < referenceIdx && isLevelEmpty;
                            return (
                              <tr key={height}>
                                <td style={{ 
                                  fontWeight: isCompressed ? 'normal' : 'bold', 
                                  verticalAlign: 'middle', 
                                  color: isCompressed ? 'rgba(255, 255, 255, 0.25)' : 'var(--text-secondary)', 
                                  fontSize: isCompressed ? '0.75rem' : '0.85rem',
                                  textAlign: 'right',
                                  paddingRight: '0.75rem',
                                  borderRight: '2px solid rgba(255,255,255,0.05)',
                                  background: 'transparent',
                                  borderBottom: 'none'
                                }}>
                                  {isCompressed ? (
                                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 'normal' }}>Nivel {height}</span>
                                  ) : (
                                    type === 'A' ? `Nivel ${height}` : 'Único'
                                  )}
                                </td>
                                {cols.map(col => {
                                  const cage = typeCages.find(c => c.height === height && c.col === col);
                                  if (cage) {
                                    const occupancyPercent = cage.capacity > 0 ? Math.round((cage.current_occupancy / cage.capacity) * 100) : 0;
                                    const cageBatches = batches.filter(b => b.cageId === cage.id && b.status === 'active');
                                    return (
                                      <td key={cage.id} style={{ verticalAlign: 'top', padding: 0, border: 'none' }}>
                                        <div className="glass-card" style={{
                                          padding: '0.85rem',
                                          border: occupancyPercent > 100 ? '1px solid rgba(239, 68, 68, 0.4)' : occupancyPercent === 0 ? '1px dashed rgba(255, 255, 255, 0.15)' : '1px solid rgba(16, 185, 129, 0.3)',
                                          background: occupancyPercent > 100 ? 'rgba(239, 68, 68, 0.04)' : occupancyPercent === 0 ? 'rgba(255, 255, 255, 0.01)' : 'rgba(16, 185, 129, 0.02)',
                                          borderRadius: 'var(--border-radius-sm)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between',
                                          minHeight: '180px',
                                          boxShadow: 'none'
                                        }}>
                                          <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                              <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{cage.name}</strong>
                                              <span style={{ 
                                                fontSize: '0.7rem', 
                                                padding: '0.1rem 0.3rem', 
                                                borderRadius: '4px', 
                                                background: occupancyPercent > 100 ? 'rgba(239, 68, 68, 0.2)' : occupancyPercent === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.2)',
                                                color: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent === 0 ? 'var(--text-secondary)' : 'var(--accent-green)',
                                                fontWeight: 'bold'
                                              }}>
                                                {occupancyPercent > 100 ? 'Lleno+' : occupancyPercent === 0 ? 'Vacío' : 'OK'}
                                              </span>
                                            </div>

                                            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                              <strong style={{ color: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent === 0 ? 'var(--text-secondary)' : 'var(--accent-green)' }}>
                                                {cage.current_occupancy}
                                              </strong>
                                              <span style={{ color: 'var(--text-muted)' }}> / {cage.capacity} aves ({occupancyPercent}%)</span>
                                              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.25rem', overflow: 'hidden' }}>
                                                <div style={{
                                                  width: `${Math.min(100, occupancyPercent)}%`,
                                                  height: '100%',
                                                  background: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent === 0 ? 'rgba(255,255,255,0.1)' : 'var(--accent-green)'
                                                }} />
                                              </div>
                                            </div>

                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                              {cageBatches.length === 0 ? (
                                                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Vacía</span>
                                              ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                  {cageBatches.map(b => (
                                                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '0.15rem 0.3rem', borderRadius: '4px' }}>
                                                      <span style={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '110px' }} title={b.name}>{b.name}</span>
                                                      <span>{b.currentQuantity} u</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                            {cage.notes && (
                                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.25rem' }} title={cage.notes}>
                                                📝 {cage.notes}
                                              </div>
                                            )}
                                          </div>

                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem', marginTop: '0.5rem' }}>
                                            <button 
                                              className="btn btn-primary" 
                                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                              onClick={() => {
                                                setSelectedQRCage(cage);
                                                setShowQRModal(true);
                                              }}
                                              title="Imprimir Código QR de la jaula"
                                            >
                                              🖨️ QR
                                            </button>
                                            <button 
                                              className="btn btn-secondary" 
                                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                              onClick={() => handleEditCageClick(cage)}
                                              title="Editar Jaula"
                                            >
                                              ✏️
                                            </button>
                                            <button 
                                              className="btn btn-secondary" 
                                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--accent-red)', background: 'transparent' }}
                                              onClick={() => handleDeleteCage(cage.id)}
                                              title="Eliminar Jaula"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  } else {
                                    if (isCompressed) {
                                      return (
                                        <td key={`${height}-${col}`} style={{ verticalAlign: 'top', padding: 0, border: 'none' }}>
                                          <div style={{
                                            border: '1px dashed rgba(255, 255, 255, 0.05)',
                                            borderRadius: 'var(--border-radius-sm)',
                                            height: '50px',
                                            display: 'flex',
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'rgba(255, 255, 255, 0.002)',
                                            color: 'var(--text-muted)',
                                            padding: '0 0.75rem'
                                          }}>
                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)' }}>{type}{height}{col}</span>
                                            <button 
                                              className="btn btn-secondary" 
                                              style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem', opacity: 0.4, border: '1px solid rgba(255,255,255,0.1)' }}
                                              onClick={() => handleQuickCreateCageClick(type, height, col)}
                                              title={`Instalar jaula ${type}${height}${col}`}
                                            >
                                              ➕
                                            </button>
                                          </div>
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={`${height}-${col}`} style={{ verticalAlign: 'top', padding: 0, border: 'none' }}>
                                        <div style={{
                                          border: '1px dashed rgba(255, 255, 255, 0.08)',
                                          borderRadius: 'var(--border-radius-sm)',
                                          height: '100%',
                                          minHeight: '180px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          background: 'rgba(255, 255, 255, 0.005)',
                                          color: 'var(--text-muted)',
                                          padding: '0.85rem'
                                        }}>
                                          <span style={{ fontSize: '0.75rem', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>Vacío ({type}{height}{col})</span>
                                          <button 
                                            className="btn btn-secondary" 
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', opacity: 0.5, border: '1px solid rgba(255,255,255,0.1)' }}
                                            onClick={() => handleQuickCreateCageClick(type, height, col)}
                                            title={`Instalar jaula ${type}${height}${col}`}
                                          >
                                            ➕ Instalar
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  }
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* 2. VISTA DE PILAS POR COLUMNA (COLUMN VIEW) */}
              {cageViewMode === 'list' && activeTypes.map(type => {
                const typeInfo = typeDetails[type] || { title: `Módulos de Tipo ${type}`, desc: `Jaulas de tipo ${type}` };
                const typeCages = activeParsedCages.filter(c => c.type === type);
                const cols = [...new Set(typeCages.map(c => c.col))].sort();
                const standardHeights = type === 'A' ? ['E', 'D', 'C', 'B', 'A'] : ['A'];
                const activeHeights = [...new Set(typeCages.map(c => c.height))];
                const extraHeights = activeHeights.filter(h => !standardHeights.includes(h)).sort().reverse();
                const heightsToRender = [...extraHeights, ...standardHeights];

                return (
                  <div key={type} style={{ marginBottom: '2.5rem', background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: 'var(--border-radius-md)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent-gold)', paddingLeft: '0.75rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                        {typeInfo.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{typeInfo.desc}</p>
                    </div>

                    {cols.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '0.5rem' }}>
                        No hay jaulas registradas para este tipo.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        {cols.map(col => {
                          const colCages = typeCages.filter(c => c.col === col).sort((a, b) => {
                            return heightsToRender.indexOf(a.height) - heightsToRender.indexOf(b.height);
                          });

                          return (
                            <div key={col} className="glass-card" style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                              <h5 style={{ margin: '0 0 1rem 0', paddingBottom: '0.35rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '1rem' }}>
                                📍 Columna {col}
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {colCages.map(cage => {
                                  const occupancyPercent = cage.capacity > 0 ? Math.round((cage.current_occupancy / cage.capacity) * 100) : 0;
                                  const cageBatches = batches.filter(b => b.cageId === cage.id && b.status === 'active');
                                  return (
                                    <div key={cage.id} style={{
                                      padding: '0.75rem',
                                      border: occupancyPercent > 100 ? '1px solid rgba(239, 68, 68, 0.3)' : occupancyPercent === 0 ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px solid rgba(16, 185, 129, 0.2)',
                                      background: occupancyPercent > 100 ? 'rgba(239, 68, 68, 0.02)' : occupancyPercent === 0 ? 'rgba(255, 255, 255, 0.005)' : 'rgba(16, 185, 129, 0.01)',
                                      borderRadius: '4px'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cage.name}{type === 'A' ? ` (Nivel ${cage.height})` : ''}</strong>
                                        <span style={{ fontSize: '0.75rem', color: occupancyPercent > 100 ? 'var(--accent-red)' : occupancyPercent === 0 ? 'var(--text-muted)' : 'var(--accent-green)', fontWeight: 'bold' }}>
                                          {cage.current_occupancy}/{cage.capacity} u
                                        </span>
                                      </div>
                                      
                                      {/* Small progress bar */}
                                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                        <div style={{
                                          width: `${Math.min(100, occupancyPercent)}%`,
                                          height: '100%',
                                          background: occupancyPercent > 100 ? 'var(--accent-red)' : 'var(--accent-green)'
                                        }} />
                                      </div>

                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        {cageBatches.length === 0 ? (
                                          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Vacía</span>
                                        ) : (
                                          cageBatches.map(b => `${b.name} (${b.currentQuantity} u)`).join(', ')
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.2rem', marginTop: '0.5rem' }}>
                                        <button 
                                          className="btn btn-primary" 
                                          style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
                                          onClick={() => {
                                            setSelectedQRCage(cage);
                                            setShowQRModal(true);
                                          }}
                                        >
                                          🖨️ QR
                                        </button>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
                                          onClick={() => handleEditCageClick(cage)}
                                        >
                                          ✏️
                                        </button>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem', color: 'var(--accent-red)', background: 'transparent', borderColor: 'transparent' }}
                                          onClick={() => handleDeleteCage(cage.id)}
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 3. VISTA DE TABLA DETALLADA (TABLE VIEW) */}
              {cageViewMode === 'table' && (
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
                      {cages.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                            No hay jaulas registradas en el sistema.
                          </td>
                        </tr>
                      ) : (
                        cages.map(cage => {
                          const occupancyPercent = cage.capacity > 0 ? Math.round((cage.current_occupancy / cage.capacity) * 100) : 0;
                          const cageBatches = batches.filter(b => b.cageId === cage.id && b.status === 'active');
                          
                          return (
                            <tr key={cage.id}>
                              <td style={{ fontWeight: 'bold' }}>
                                {cage.name}
                                {cage.status === 'inactive' && (
                                  <span className="badge" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.35rem', background: 'rgba(239, 68, 68, 0.15)', color: 'rgba(239, 68, 68, 0.95)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px' }}>
                                    Inactiva
                                  </span>
                                )}
                              </td>
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
                                    title="Hacer clic para ver qr"
                                  >
                                    🖨️ Ver QR
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                    onClick={() => handleEditCageClick(cage)}
                                    title="Abrir formulario para editar este registro"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                                    onClick={() => handleDeleteCage(cage.id)}
                                    title="Eliminar permanentemente este registro"
                                  >
                                    🗑️ Borrar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* =======================================================
          TAB: PRODUCCIÓN DE HUEVOS
         ======================================================= */}
      {activeTab === 'eggProduction' && (() => {
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length !== 3) return dateStr;
          return `${parts[2]}/${parts[1]}`;
        };

        const formatFullDate = (dateStr) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length !== 3) return dateStr;
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        const unfilteredHistory = eggData.history || [];
        const cageCollections = eggData.cageCollections || [];

        // 1. First, apply the cage filter if it's not 'all'
        let baseHistory = unfilteredHistory;
        if (eggCageFilter !== 'all') {
          const selectedCageId = Number(eggCageFilter);
          baseHistory = unfilteredHistory.map(dayRecord => {
            const cageCol = cageCollections.find(
              cc => cc.date === dayRecord.date && cc.cageId === selectedCageId
            );
            const collected = cageCol ? cageCol.quantityCollected : 0;
            const broken = cageCol ? cageCol.quantityBroken : 0;
            const notes = cageCol ? cageCol.notes : '';

            // Calculate posture rate for this cage on this date
            const adultCount = (() => {
              const targetDate = new Date(dayRecord.date + 'T12:00:00');
              return batches.reduce((sum, batch) => {
                if (batch.cageId !== selectedCageId) return sum;
                if (batch.status !== 'active') return sum;
                const birth = new Date(batch.birthDate + 'T12:00:00');
                const ageInDays = (targetDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24);
                if (ageInDays >= 35 && ageInDays >= 0) {
                  return sum + (batch.femalesQuantity || 0);
                }
                return sum;
              }, 0);
            })();

            const postureRate = adultCount > 0 
              ? Math.round((collected / adultCount) * 1000) / 10 
              : 0;

            return {
              ...dayRecord,
              quantityCollected: collected,
              quantityBroken: broken,
              notes,
              adultQuailsCount: adultCount,
              postureRate
            };
          });
        }

        // 2. Next, apply the time filter
        let history = baseHistory;
        if (eggTimeFilter !== 'all') {
          const now = new Date();
          let limitDate = null;
          
          if (eggTimeFilter === 'week') {
            limitDate = new Date();
            limitDate.setDate(now.getDate() - 7);
          } else if (eggTimeFilter === 'month') {
            limitDate = new Date();
            limitDate.setDate(now.getDate() - 30);
          } else if (eggTimeFilter === 'year') {
            limitDate = new Date();
            limitDate.setDate(now.getDate() - 365);
          }
          
          if (limitDate) {
            const limitDateStr = limitDate.toISOString().split('T')[0];
            history = baseHistory.filter(h => h.date >= limitDateStr);
          } else if (eggTimeFilter === 'custom') {
            history = baseHistory.filter(h => {
              let match = true;
              if (eggStartDate) {
                match = match && h.date >= eggStartDate;
              }
              if (eggEndDate) {
                match = match && h.date <= eggEndDate;
              }
              return match;
            });
          }
        }

        const totalCollected = history.reduce((sum, h) => sum + h.quantityCollected, 0);
        const totalBroken = history.reduce((sum, h) => sum + h.quantityBroken, 0);

        
        const rates = history.filter(h => h.adultQuailsCount > 0);
        const avgPosture = rates.length 
          ? (rates.reduce((sum, h) => sum + h.postureRate, 0) / rates.length).toFixed(1) 
          : '0.0';

        const temps = history.filter(h => h.tempAvg !== null);
        const avgTemp = temps.length 
          ? (temps.reduce((sum, h) => sum + h.tempAvg, 0) / temps.length).toFixed(1) 
          : null;

        const hums = history.filter(h => h.humidity !== null);
        const avgHum = hums.length 
          ? (hums.reduce((sum, h) => sum + h.humidity, 0) / hums.length).toFixed(0) 
          : null;

        const getISOWeekDetails = (dateStr) => {
          const d = new Date(dateStr + 'T12:00:00');
          const day = d.getDay();
          const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(new Date(d).setDate(diffToMonday));
          const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
          
          const target = new Date(monday.valueOf());
          const dayNr = (monday.getDay() + 6) % 7;
          target.setDate(target.getDate() - dayNr + 3);
          const firstThursday = target.valueOf();
          target.setMonth(0, 1);
          if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
          }
          const weekNo = 1 + Math.ceil((firstThursday - target) / 604800000);

          const pad = (num) => String(num).padStart(2, '0');
          const weekKey = `${monday.getFullYear()}-W${pad(weekNo)}`;
          const label = `Semana ${weekNo} (${pad(monday.getDate())}/${pad(monday.getMonth() + 1)} al ${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)})`;
          
          return { weekKey, label };
        };

        const weeklyGroups = {};
        history.forEach(record => {
          const { weekKey, label } = getISOWeekDetails(record.date);
          if (!weeklyGroups[weekKey]) {
            weeklyGroups[weekKey] = {
              label,
              collected: 0,
              broken: 0,
              postureSum: 0,
              postureCount: 0,
              tempSum: 0,
              tempCount: 0,
              humSum: 0,
              humCount: 0
            };
          }
          const g = weeklyGroups[weekKey];
          g.collected += record.quantityCollected;
          g.broken += record.quantityBroken;
          if (record.adultQuailsCount > 0) {
            g.postureSum += record.postureRate;
            g.postureCount += 1;
          }
          if (record.tempAvg !== null) {
            g.tempSum += record.tempAvg;
            g.tempCount += 1;
          }
          if (record.humidity !== null) {
            g.humSum += record.humidity;
            g.humCount += 1;
          }
        });

        const weeklySummary = Object.keys(weeklyGroups).map(weekKey => {
          const g = weeklyGroups[weekKey];
          return {
            weekKey,
            label: g.label,
            collected: g.collected,
            broken: g.broken,
            postureRate: g.postureCount > 0 ? Math.round((g.postureSum / g.postureCount) * 10) / 10 : 0,
            avgTemp: g.tempCount > 0 ? Math.round((g.tempSum / g.tempCount) * 10) / 10 : null,
            avgHum: g.humCount > 0 ? Math.round((g.humSum / g.humCount) * 10) / 10 : null
          };
        }).sort((a, b) => b.weekKey.localeCompare(a.weekKey));

        const cageBreakdownByDate = {};
        (eggData.cageCollections || []).forEach(cc => {
          if (eggCageFilter !== 'all' && cc.cageId !== Number(eggCageFilter)) {
            return;
          }
          if (!cageBreakdownByDate[cc.date]) {
            cageBreakdownByDate[cc.date] = [];
          }
          cageBreakdownByDate[cc.date].push(cc);
        });


        const dailyPoints = history.map((h, i) => {
          const x = 60 + (i / Math.max(1, history.length - 1)) * 680;
          const y = 200 - (h.postureRate / 100) * 180;
          return { x, y, data: h };
        });

        const weeklyPoints = [...weeklySummary].reverse().map((w, i) => {
          const x = 60 + (i / Math.max(1, weeklySummary.length - 1)) * 680;
          const y = 200 - (w.postureRate / 100) * 180;
          return { x, y, data: w };
        });

        const barHistory = history.slice(-14);
        const maxEggs = Math.max(...barHistory.map(h => h.quantityCollected + h.quantityBroken), 10);
        const barWidth = 35;
        const barGap = 15;
        const barOffset = (800 - (barHistory.length * (barWidth + barGap))) / 2;

        const climatePoints = history.map((h, i) => {
          const x = 60 + (i / Math.max(1, history.length - 1)) * 680;
          const yTemp = h.tempAvg !== null ? 200 - (h.tempAvg / 45) * 180 : null;
          const yHum = h.humidity !== null ? 200 - (h.humidity / 100) * 180 : null;
          const yPosture = 200 - (h.postureRate / 100) * 180;
          return { x, yTemp, yHum, yPosture, data: h };
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
            
            {/* Filtros de Historial y Jaulas */}
            <div className="glass-card" style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.5rem'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
                {/* Filtro de Tiempo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Rango de Tiempo</label>
                  <select 
                    value={eggTimeFilter} 
                    onChange={(e) => setEggTimeFilter(e.target.value)}
                    className="form-control"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                  >
                    <option value="all">Todo el Historial</option>
                    <option value="week">Última Semana</option>
                    <option value="month">Último Mes</option>
                    <option value="year">Último Año</option>
                    <option value="custom">Rango de Fechas</option>
                  </select>
                </div>

                {/* Filtros de Fecha Personalizados */}
                {eggTimeFilter === 'custom' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '130px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Desde</label>
                      <input 
                        type="date" 
                        value={eggStartDate} 
                        onChange={(e) => setEggStartDate(e.target.value)}
                        className="form-control"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '130px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Hasta</label>
                      <input 
                        type="date" 
                        value={eggEndDate} 
                        onChange={(e) => setEggEndDate(e.target.value)}
                        className="form-control"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
                      />
                    </div>
                  </>
                )}

                {/* Filtro de Jaula */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Jaula</label>
                  <select 
                    value={eggCageFilter} 
                    onChange={(e) => setEggCageFilter(e.target.value)}
                    className="form-control"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                  >
                    <option value="all">Todas las Jaulas (Por Defecto)</option>
                    {cages.filter(c => !c.name.toUpperCase().startsWith('C')).map(c => (
                      <option key={c.id} value={c.id}>Jaula {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Botón para Limpiar Filtros */}
                {(eggTimeFilter !== 'all' || eggCageFilter !== 'all' || eggStartDate || eggEndDate) && (
                  <button 
                    onClick={() => {
                      setEggTimeFilter('all');
                      setEggCageFilter('all');
                      setEggStartDate('');
                      setEggEndDate('');
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginLeft: 'auto', alignSelf: 'flex-end', height: '36px' }}
                  >
                    🧹 Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>

              <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem' }}>🥚</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Huevos Sueltos Disponibles</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{settings.loose_eggs_stock || 0} u</div>
                    <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setShowConsumeModal(true)} title="Descontar huevos consumidos o cedidos">➖ Descontar</button>
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-green)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem' }}><img src="/QuailEggEmoji.png" alt="Huevo" style={{ width: '1em', height: '1em', verticalAlign: 'middle' }} /></div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Huevos Recolectados (Total)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>{totalCollected} u</div>
                </div>
              </div>

              <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-red)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem' }}>💔</div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Huevos Rotos (Total)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-red)' }}>{totalBroken} u</div>
                </div>
              </div>

              <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem' }}>📈</div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tasa de Postura Promedio</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{avgPosture}%</div>
                </div>
              </div>

              <div className="glass-card" style={{ borderLeft: '5px solid var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem' }}>🌡️</div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Clima Promedio (El Talar)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {avgTemp ? `🌡️ ${avgTemp} °C` : 'Temp: N/D'}<br />
                    {avgHum ? `💧 ${avgHum}% Hum` : 'Hum: N/D'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
              
              <div className="glass-card" style={{ position: 'relative', padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📈 Tasa de Postura Diaria y Semanal</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Eje Y: 0% - 100%</span>
                </h4>
                {history.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Sin datos suficientes</p>
                ) : (
                  <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                    <svg width="100%" height="220" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
                      <defs>
                        <linearGradient id="postureGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {[0, 25, 50, 75, 100].map(val => {
                        const y = 200 - (val / 100) * 180;
                        return (
                          <g key={val}>
                            <line x1="60" y1={y} x2="740" y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                            <text x="50" y={y + 4} fill="var(--text-secondary)" fontSize="10" textAnchor="end">{val}%</text>
                          </g>
                        );
                      })}
                      
                      {dailyPoints.length > 0 && (
                        <>
                          <path d={dailyPoints.length ? `${dailyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} L ${dailyPoints[dailyPoints.length-1].x} 200 L ${dailyPoints[0].x} 200 Z` : ''} fill="url(#postureGrad)" />
                          <path d={dailyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="var(--accent-green)" strokeWidth="2.5" />
                        </>
                      )}

                      {weeklyPoints.length > 0 && (
                        <path d={weeklyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="var(--accent-gold)" strokeWidth="2" strokeDasharray="5,3" />
                      )}

                      {dailyPoints.filter((_, idx) => idx % Math.max(1, Math.floor(dailyPoints.length / 5)) === 0).map(p => (
                        <g key={p.data.date}>
                          <line x1={p.x} y1="200" x2={p.x} y2="204" stroke="rgba(255,255,255,0.15)" />
                          <text x={p.x} y="215" fill="var(--text-secondary)" fontSize="9" textAnchor="middle">{formatDate(p.data.date)}</text>
                        </g>
                      ))}

                      {dailyPoints.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          fill="var(--accent-green)"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                          style={{ cursor: 'pointer', opacity: hoveredChart1 === idx ? 1 : 0 }}
                          onMouseEnter={() => setHoveredChart1(idx)}
                          onMouseLeave={() => setHoveredChart1(null)}
                        />
                      ))}
                      {dailyPoints.map((p, idx) => {
                        const stepWidth = 700 / Math.max(1, dailyPoints.length - 1);
                        return (
                          <rect
                            key={`rect-${idx}`}
                            x={p.x - stepWidth/2}
                            y="20"
                            width={stepWidth}
                            height="180"
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredChart1(idx)}
                            onMouseLeave={() => setHoveredChart1(null)}
                          />
                        );
                      })}
                    </svg>

                    {hoveredChart1 !== null && dailyPoints[hoveredChart1] && (
                      <div style={{
                        position: 'absolute',
                        left: `${(dailyPoints[hoveredChart1].x / 800) * 100}%`,
                        top: `${(dailyPoints[hoveredChart1].y / 220) * 100}%`,
                        transform: 'translate(-50%, -115%)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        pointerEvents: 'none',
                        zIndex: 10,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        whiteSpace: 'nowrap'
                      }}>
                        <strong>Día: {formatFullDate(dailyPoints[hoveredChart1].data.date)}</strong><br />
                        Postura: <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{dailyPoints[hoveredChart1].data.postureRate}%</span><br />
                        Recolectados: {dailyPoints[hoveredChart1].data.quantityCollected} u<br />
                        Hembras Activas: {dailyPoints[hoveredChart1].data.adultQuailsCount}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '3px', background: 'var(--accent-green)', display: 'inline-block' }}></span> Diaria
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '3px', background: 'var(--accent-gold)', borderStyle: 'dashed', borderWidth: '1px', display: 'inline-block' }}></span> Promedio Semanal
                  </span>
                </div>
              </div>

              <div className="glass-card" style={{ position: 'relative', padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📊 Huevos Recolectados vs Rotos (Últimos 14 días)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Eje Y: Huevos Totales</span>
                </h4>
                {barHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Sin datos suficientes</p>
                ) : (
                  <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                    <svg width="100%" height="220" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
                      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const val = Math.round(pct * maxEggs);
                        const y = 200 - pct * 180;
                        return (
                          <g key={pct}>
                            <line x1="60" y1={y} x2="740" y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                            <text x="50" y={y + 4} fill="var(--text-secondary)" fontSize="10" textAnchor="end">{val}</text>
                          </g>
                        );
                      })}

                      {barHistory.map((h, idx) => {
                        const x = barOffset + idx * (barWidth + barGap);
                        const hColl = (h.quantityCollected / maxEggs) * 180;
                        const hBrok = (h.quantityBroken / maxEggs) * 180;
                        
                        const yColl = 200 - hColl;
                        const yBrok = yColl - hBrok;
                        
                        return (
                          <g key={h.date}>
                            <rect
                              x={x}
                              y={yColl}
                              width={barWidth}
                              height={hColl}
                              fill="var(--accent-green)"
                              rx="3"
                              style={{ transition: 'opacity 0.2s', opacity: hoveredChart2 === idx || hoveredChart2 === null ? 1 : 0.6 }}
                            />
                            {h.quantityBroken > 0 && (
                              <rect
                                x={x}
                                y={yBrok}
                                width={barWidth}
                                height={hBrok}
                                fill="var(--accent-red)"
                                rx="3"
                                style={{ transition: 'opacity 0.2s', opacity: hoveredChart2 === idx || hoveredChart2 === null ? 1 : 0.6 }}
                              />
                            )}
                            
                            <text x={x + barWidth/2} y="215" fill="var(--text-secondary)" fontSize="9" textAnchor="middle">{formatDate(h.date)}</text>
                            
                            <rect
                              x={x - barGap/2}
                              y="20"
                              width={barWidth + barGap}
                              height="180"
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredChart2(idx)}
                              onMouseLeave={() => setHoveredChart2(null)}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {hoveredChart2 !== null && barHistory[hoveredChart2] && (
                      <div style={{
                        position: 'absolute',
                        left: `${((barOffset + hoveredChart2 * (barWidth + barGap) + barWidth/2) / 800) * 100}%`,
                        top: `${((200 - ((barHistory[hoveredChart2].quantityCollected + barHistory[hoveredChart2].quantityBroken) / maxEggs) * 180) / 220) * 100}%`,
                        transform: 'translate(-50%, -115%)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        pointerEvents: 'none',
                        zIndex: 10,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        whiteSpace: 'nowrap'
                      }}>
                        <strong>{formatFullDate(barHistory[hoveredChart2].date)}</strong><br />
                        Sanos: <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{barHistory[hoveredChart2].quantityCollected} u</span><br />
                        Rotos: <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{barHistory[hoveredChart2].quantityBroken} u</span><br />
                        Total: {barHistory[hoveredChart2].quantityCollected + barHistory[hoveredChart2].quantityBroken} u
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '12px', background: 'var(--accent-green)', borderRadius: '2px', display: 'inline-block' }}></span> Sanos
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '12px', background: 'var(--accent-red)', borderRadius: '2px', display: 'inline-block' }}></span> Rotos / Descartados
                  </span>
                </div>
              </div>

              <div className="glass-card" style={{ position: 'relative', padding: '1.25rem', gridColumn: 'span 2' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🌡️ Correlación: Temperatura, Humedad y Postura</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ejes: Izq (Postura: 0-100%) | Der (Clima)</span>
                </h4>
                {history.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Sin datos suficientes</p>
                ) : (
                  <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                    <svg width="100%" height="220" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
                      {[0, 25, 50, 75, 100].map(pct => {
                        const y = 200 - (pct / 100) * 180;
                        const tempVal = Math.round((pct / 100) * 45);
                        return (
                          <g key={pct}>
                            <line x1="60" y1={y} x2="740" y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                            <text x="50" y={y + 4} fill="var(--accent-green)" fontSize="10" textAnchor="end">{pct}%</text>
                            <text x="750" y={y + 4} fill="var(--accent-blue)" fontSize="10" textAnchor="start">{pct}% / {tempVal}°C</text>
                          </g>
                        );
                      })}

                      {climatePoints.filter(p => p.yHum !== null).length > 0 && (
                        <>
                          <path
                            d={(() => {
                              const valid = climatePoints.filter(p => p.yHum !== null);
                              return valid.length ? `${valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yHum}`).join(' ')} L ${valid[valid.length-1].x} 200 L ${valid[0].x} 200 Z` : '';
                            })()}
                            fill="rgba(59, 130, 246, 0.05)"
                          />
                          <path
                            d={climatePoints.filter(p => p.yHum !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yHum}`).join(' ')}
                            fill="none"
                            stroke="rgba(59, 130, 246, 0.5)"
                            strokeWidth="1.5"
                          />
                        </>
                      )}

                      {climatePoints.filter(p => p.yTemp !== null).length > 0 && (
                        <path
                          d={climatePoints.filter(p => p.yTemp !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTemp}`).join(' ')}
                          fill="none"
                          stroke="var(--accent-gold)"
                          strokeWidth="2"
                        />
                      )}

                      {climatePoints.length > 0 && (
                        <path
                          d={climatePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPosture}`).join(' ')}
                          fill="none"
                          stroke="var(--accent-green)"
                          strokeWidth="2.5"
                        />
                      )}

                      {climatePoints.filter((_, idx) => idx % Math.max(1, Math.floor(climatePoints.length / 5)) === 0).map(p => (
                        <text key={p.data.date} x={p.x} y="215" fill="var(--text-secondary)" fontSize="9" textAnchor="middle">{formatDate(p.data.date)}</text>
                      ))}

                      {climatePoints.map((p, idx) => (
                        <g key={`dots-${idx}`}>
                          {hoveredChart3 === idx && (
                            <>
                              <circle cx={p.x} cy={p.yPosture} r="5" fill="var(--accent-green)" stroke="#1e293b" />
                              {p.yTemp !== null && <circle cx={p.x} cy={p.yTemp} r="4" fill="var(--accent-gold)" stroke="#1e293b" />}
                              {p.yHum !== null && <circle cx={p.x} cy={p.yHum} r="4" fill="#3b82f6" stroke="#1e293b" />}
                            </>
                          )}
                        </g>
                      ))}

                      {climatePoints.map((p, idx) => {
                        const stepWidth = 700 / Math.max(1, climatePoints.length - 1);
                        return (
                          <rect
                            key={`cl-rect-${idx}`}
                            x={p.x - stepWidth/2}
                            y="20"
                            width={stepWidth}
                            height="180"
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredChart3(idx)}
                            onMouseLeave={() => setHoveredChart3(null)}
                          />
                        );
                      })}
                    </svg>

                    {hoveredChart3 !== null && climatePoints[hoveredChart3] && (
                      <div style={{
                        position: 'absolute',
                        left: `${(climatePoints[hoveredChart3].x / 800) * 100}%`,
                        top: '40%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        pointerEvents: 'none',
                        zIndex: 10,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        whiteSpace: 'nowrap'
                      }}>
                        <strong>{formatFullDate(climatePoints[hoveredChart3].data.date)}</strong><br />
                        Tasa Postura: <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{climatePoints[hoveredChart3].data.postureRate}%</span><br />
                        Temperatura: <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{climatePoints[hoveredChart3].data.tempAvg !== null ? `${climatePoints[hoveredChart3].data.tempAvg.toFixed(1)} °C` : 'N/D'}</span><br />
                        Humedad: <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{climatePoints[hoveredChart3].data.humidity !== null ? `${Math.round(climatePoints[hoveredChart3].data.humidity)}%` : 'N/D'}</span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '3px', background: 'var(--accent-green)', display: 'inline-block' }}></span> Tasa de Postura (%)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '3px', background: 'var(--accent-gold)', display: 'inline-block' }}></span> Temperatura (°C)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '12px', height: '3px', background: 'rgba(59, 130, 246, 0.7)', display: 'inline-block' }}></span> Humedad (%)
                  </span>
                </div>
              </div>

            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Resumen Semanal de Postura
              </h3>
              {weeklySummary.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay datos suficientes para agrupar semanalmente.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Semana</th>
                        <th style={{ textAlign: 'center' }}>Total Huevos Recolectados</th>
                        <th style={{ textAlign: 'center' }}>Total Huevos Rotos</th>
                        <th style={{ textAlign: 'center' }}>Tasa de Postura Promedio</th>
                        <th style={{ textAlign: 'center' }}>Temp. Promedio</th>
                        <th style={{ textAlign: 'center' }}>Humedad Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklySummary.map(row => (
                        <tr key={row.weekKey}>
                          <td style={{ fontWeight: '600' }}>{row.label}</td>
                          <td style={{ textAlign: 'center', color: 'var(--accent-green)', fontWeight: '600' }}>{row.collected} u</td>
                          <td style={{ textAlign: 'center', color: 'var(--accent-red)' }}>{row.broken} u</td>
                          <td style={{ textAlign: 'center', color: 'var(--accent-gold)', fontWeight: '600' }}>{row.postureRate}%</td>
                          <td style={{ textAlign: 'center' }}>{row.avgTemp !== null ? `🌡️ ${row.avgTemp} °C` : 'N/D'}</td>
                          <td style={{ textAlign: 'center' }}>{row.avgHum !== null ? `💧 ${row.avgHum}%` : 'N/D'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Historial de Recolección Diaria
              </h3>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No hay registros en el historial.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Desglose por Jaula</th>
                        <th style={{ textAlign: 'center' }}>Huevos Sanos</th>
                        <th style={{ textAlign: 'center' }}>Huevos Rotos</th>
                        <th style={{ textAlign: 'center' }}>Clima Promedio</th>
                        <th style={{ textAlign: 'center' }}>Tasa de Postura</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map(row => {
                        const breakdown = cageBreakdownByDate[row.date] || [];
                        const breakdownStr = breakdown.map(cc => `${cc.cageName} (${cc.quantityCollected} u)`).join(' | ');

                        return (
                          <tr key={row.id}>
                            <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{formatFullDate(row.date)}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {breakdownStr || <span style={{ color: 'var(--text-secondary)' }}>Sin desglose</span>}
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--accent-green)', fontWeight: '600' }}>{row.quantityCollected} u</td>
                            <td style={{ textAlign: 'center', color: 'var(--accent-red)' }}>{row.quantityBroken} u</td>
                            <td style={{ textAlign: 'center', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {row.tempAvg !== null ? `🌡️ ${row.tempAvg.toFixed(1)}°C` : ''}
                              {row.humidity !== null ? ` | 💧 ${Math.round(row.humidity)}%` : ''}
                              {row.daylightDuration !== null ? ` | ☀️ ${row.daylightDuration}h` : ''}
                              {row.cloudCover !== null ? ` | ☁️ ${Math.round(row.cloudCover)}%` : ''}
                              {row.tempAvg === null && row.humidity === null && row.daylightDuration === null ? 'N/D' : ''}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>
                              {row.postureRate > 0 ? `${row.postureRate}%` : '0%'}
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>Gestión Financiera de Productos</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={showInactiveProducts} 
                  onChange={e => setShowInactiveProducts(e.target.checked)} 
                />
                Mostrar productos inactivos
              </label>
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
                {products
                  .filter(prod => prod.status === 'active' || showInactiveProducts)
                  .map(prod => {
                    const labelCost = prod.label_cost || 0;
                    const containerCost = prod.container_cost || 0;
                    const eggCount = prod.egg_count || 0;
                    const rawCost = eggCount * eggUnitCost;
                    const totalCost = containerCost + labelCost + rawCost;
                    const margin = prod.price - totalCost;
                    const marginPercent = prod.price > 0 ? Math.round((margin / prod.price) * 100) : 0;
                    const isInactive = prod.status === 'inactive';

                    return (
                      <tr key={prod.id} style={{ opacity: isInactive ? 0.6 : 1, background: isInactive ? 'rgba(255, 255, 255, 0.01)' : 'none' }}>
                        <td style={{ fontWeight: '600' }}>
                          {prod.name}
                          {isInactive && <span className="badge badge-cancelled" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}>Inactivo</span>}
                        </td>
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
                {products
                  .filter(prod => prod.status === 'active' || (prod.container_stock || 0) > 0)
                  .map(prod => (
                  <tr key={`env-${prod.id}`}>
                    <td style={{ fontWeight: '600' }}>
                      {prod.name}
                      {prod.status === 'inactive' && <span className="badge badge-cancelled" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>Inactivo</span>}
                    </td>
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
                <label>Jaula 🪵 *</label>
                <select
                  className="form-control"
                  required
                  value={eggForm.cageId}
                  onChange={e => setEggForm({ ...eggForm, cageId: e.target.value })}
                >
                  <option value="">-- Seleccionar Jaula --</option>
                  {cages.filter(c => c.status !== 'inactive' && !c.name.toUpperCase().startsWith('C')).map(cage => (
                    <option key={cage.id} value={cage.id}>
                      {cage.name} (Capac: {cage.capacity})
                    </option>
                  ))}
                </select>
              </div>

              {hasExistingCollection && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  padding: '0.75rem',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '0.85rem',
                  marginTop: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}>
                  <span>⚠️</span>
                  <span><strong>Aviso de acumulación:</strong> Ya existe un registro para esta jaula en esta fecha. La nueva cantidad se sumará a la anterior de forma automática.</span>
                </div>
              )}

              <div className="form-group">
                <label>Huevos Sanos Recolectados</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="80" 
                  required
                  min="0"
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
                  min="0"
                  value={eggForm.quantityBroken}
                  onChange={e => setEggForm({ ...eggForm, quantityBroken: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Postura normal, incidencias, notas de la recolección..."
                  value={eggForm.notes}
                  onChange={e => setEggForm({ ...eggForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y guardar los datos ingresados">Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => { setShowEggModal(false); setEggDateMode('hoy'); setEggForm({ date: todayStr, quantityCollected: '', quantityBroken: '', notes: '', cageId: '' }); }} title="Cancelar la acción actual sin guardar los cambios">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =======================================================
          MODAL: DESCONTAR HUEVOS (CONSUMO/CESIÓN)
         ======================================================= */}
      {showConsumeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Descontar Huevos Sueltos</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Registra huevos consumidos, regalados o de merma que se restarán del stock de sueltos actual.</p>
            <form onSubmit={handleConsumeEggs}>
              <div className="form-group">
                <label>Cantidad a descontar</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej: 10" 
                  required
                  min="1"
                  value={consumeQuantity}
                  onChange={e => setConsumeQuantity(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1' }} title="Confirmar y descontar">Confirmar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: '1' }} onClick={() => { setShowConsumeModal(false); setConsumeQuantity(''); }} title="Cancelar">Cancelar</button>
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
        const allEggProducts = products.filter(p => p.status === 'active' && (p.category === 'eggs' || p.category === 'processed') && p.egg_count > 0);
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
                  placeholder="Ej: AA100" 
                  required
                  maxLength={5}
                  pattern="[A-Za-z]{2}[0-9]{3}"
                  title="Debe tener exactamente 2 letras y 3 números (ej. AA100)"
                  value={cageForm.name}
                  onChange={e => setCageForm({ ...cageForm, name: e.target.value })}
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.4rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  💡 <strong>Formato: [Tipo][Nivel][Columna]</strong> (ej: <code>AA100</code>)<br />
                  • Primera letra: <code>A</code> (Módulo normal 25 aves), <code>B</code> (Experimental), <code>C</code> (Criadora).<br />
                  • Segunda letra: Nivel (<code>E</code> a <code>A</code> para tipo A; siempre usar <code>A</code> para tipo B y C).<br />
                  • Tres números: Columna de 3 dígitos (ej: <code>100</code>, <code>101</code>...).
                </small>
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

              {(editCageForm.name.toUpperCase().startsWith('B') || editCageForm.name.toUpperCase().startsWith('C')) && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input 
                      type="checkbox" 
                      checked={editCageForm.status === 'inactive'}
                      onChange={e => setEditCageForm({ ...editCageForm, status: e.target.checked ? 'inactive' : 'active' })}
                    />
                    <span>Desactivar jaula (no mostrar en la vista general)</span>
                  </label>
                </div>
              )}

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
