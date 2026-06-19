import React, { useState, useEffect } from 'react';

export default function Shop({ onAdminLoginClick }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  
  // Ajustes de envío y contacto
  const [adminPhone, setAdminPhone] = useState('5491122334455');
  const [defaultShippingCost, setDefaultShippingCost] = useState(1500);

  // Formulario de compra
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  
  // Métodos de envío
  const [deliveryMethod, setDeliveryMethod] = useState('pickup'); // 'pickup' | 'shipping'
  const [shippingZone, setShippingZone] = useState('');
  const [shippingCost, setShippingCost] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  // Cargar productos y teléfono del administrador
  useEffect(() => {
    fetch('/api/inventory/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Error al cargar productos:', err));

    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => {
        if (data.admin_whatsapp) {
          setAdminPhone(data.admin_whatsapp);
        }
        if (data.shipping_default_cost) {
          setDefaultShippingCost(Number(data.shipping_default_cost));
        }
      })
      .catch(err => console.error('Error al cargar config pública:', err));
  }, []);

  // Calcular costo de envío dinámico según la localidad
  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setShippingCost(0);
      return;
    }

    const zone = shippingZone.trim().toLowerCase();
    const freeZones = ['el talar', 'la paloma', 'general pacheco', 'pacheco', 'talar'];

    if (freeZones.some(fz => zone.includes(fz))) {
      setShippingCost(0);
    } else {
      setShippingCost(defaultShippingCost);
    }
  }, [deliveryMethod, shippingZone, defaultShippingCost]);

  const addToCart = (product) => {
    setError('');
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        setError(`No hay más stock disponible de ${product.name}`);
        return;
      }
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      if (product.stock <= 0) {
        setError(`El producto ${product.name} no tiene stock.`);
        return;
      }
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId, amount) => {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    const newQty = item.quantity + amount;
    if (newQty <= 0) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      const prod = products.find(p => p.id === productId);
      if (prod && newQty > prod.stock) {
        setError(`No hay más stock disponible de ${prod.name}`);
        return;
      }
      setCart(cart.map(item => 
        item.id === productId ? { ...item, quantity: newQty } : item
      ));
    }
  };

  const productsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotal = productsTotal + (deliveryMethod === 'shipping' ? shippingCost : 0);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !customerAddress) {
      setError('Por favor, completa todos los campos del formulario.');
      return;
    }
    if (deliveryMethod === 'shipping' && !shippingZone) {
      setError('Por favor, ingresa tu localidad para el envío.');
      return;
    }
    if (cart.length === 0) {
      setError('El carrito está vacío.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      customerName,
      customerPhone,
      customerAddress,
      shippingZone: deliveryMethod === 'shipping' ? shippingZone : 'Retiro en granja',
      shippingCost: deliveryMethod === 'shipping' ? shippingCost : 0,
      items: cart.map(item => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price_at_sale: item.price
      }))
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el pedido.');
      }

      setSuccessOrder({
        id: data.id,
        total: data.totalPrice,
        customerName,
        deliveryMethod,
        shippingZone: deliveryMethod === 'shipping' ? shippingZone : '',
        shippingCost: deliveryMethod === 'shipping' ? shippingCost : 0,
        items: [...cart]
      });

      // Limpiar carrito
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setShippingZone('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (order) => {
    const itemsText = order.items.map(item => `* ${item.quantity}x ${item.name} ($${item.price * item.quantity})`).join('\n');
    const shippingText = order.deliveryMethod === 'shipping'
      ? `\n*Envío a Domicilio:* ${order.shippingZone} (Costo: ${order.shippingCost === 0 ? '¡GRATIS! 🎁' : `$${order.shippingCost}`})`
      : `\n*Método:* Retiro en Granja ($0)`;

    const text = `Hola! Realicé una solicitud de pedido en Granja Luque.
*Pedido ID:* #${order.id}
*Cliente:* ${order.customerName}${shippingText}
*Detalle:*
${itemsText}
*Total:* $${order.total}

Quedo a la espera de su aprobación para proceder con el pago. ¡Muchas gracias!`;

    return `https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`;
  };

  const isFreeShipping = deliveryMethod === 'shipping' && shippingCost === 0 && shippingZone.trim() !== '';

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Header público */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 0',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ color: 'var(--accent-green)', fontSize: '2.2rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Granja Luque <img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em' }} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Codornices selectas y productos de granja de alta calidad
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onAdminLoginClick} title="Hacer clic para panel administrador">
          Panel Administrador 🔒
        </button>
      </header>

      {successOrder ? (
        // Pantalla de Pedido Exitoso
        <div className="glass-card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: 'var(--accent-green)', marginBottom: '1rem' }}>¡Pedido Solicitado con Éxito!</h2>
          <p style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            Tu pedido **#{successOrder.id}** ha sido registrado con estado **Pendiente de Aprobación**.
          </p>
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '1.5rem',
            borderRadius: 'var(--border-radius-sm)',
            textAlign: 'left',
            marginBottom: '2rem',
            border: '1px solid var(--border-color)'
          }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Resumen del Pedido:</h4>
            {successOrder.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', margin: '0.25rem 0' }}>
                <span>{item.quantity}x {item.name}</span>
                <span>${item.price * item.quantity}</span>
              </div>
            ))}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              <span>Entrega: {successOrder.deliveryMethod === 'shipping' ? `Envío a ${successOrder.shippingZone}` : 'Retiro en granja'}</span>
              <span>{successOrder.shippingCost === 0 ? 'Gratis' : `$${successOrder.shippingCost}`}</span>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '0.75rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}>
              <span>Total a pagar tras aprobación:</span>
              <span style={{ color: 'var(--accent-gold)' }}>${successOrder.total}</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            ⚠️ **Importante**: Para que preparemos tu pedido y te enviemos el link de pago de Mercado Pago, debes enviarnos la confirmación por WhatsApp pulsando el siguiente botón:
          </p>
          <a href={getWhatsAppLink(successOrder)} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '1.1rem', width: '100%' }}>
            💬 Enviar Solicitud por WhatsApp
          </a>
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={() => setSuccessOrder(null)}
           title="Hacer clic para hacer otra compra">
            Hacer otra compra
          </button>
        </div>
      ) : (
        // Contenido de la tienda
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap-reverse' }}>
          
          {/* Listado de Productos */}
          <div style={{ flex: '2', minWidth: '320px' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Nuestros Productos 📦
            </h2>

            {error && (
              <div className="glass-card" style={{ borderColor: 'var(--accent-red)', background: 'var(--accent-red-glow)', color: '#f87171', padding: '1rem', marginBottom: '1.5rem' }}>
                {error}
              </div>
            )}

            {products.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Cargando catálogo...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {products.map(prod => (
                  <div key={prod.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.25rem' }}>
                    {prod.image_url && (
                      <img 
                        src={prod.image_url} 
                        alt={prod.name} 
                        style={{
                          width: '100%',
                          height: '160px',
                          objectFit: 'cover',
                          borderRadius: 'var(--border-radius-sm)',
                          marginBottom: '1rem',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    )}
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>{prod.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexGrow: '1', marginBottom: '1rem' }}>{prod.description}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                        ${prod.price}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: prod.stock > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {prod.stock > 0 ? `Stock: ${prod.stock}` : 'Sin stock'}
                      </span>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ marginTop: '1rem', width: '100%' }}
                      disabled={prod.stock <= 0}
                      onClick={() => addToCart(prod)}
                     title="Hacer clic para añadir al carrito">
                      🛒 Añadir al carrito
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Compras */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Carrito 🛒</span>
                <span className="badge badge-pending" style={{ fontSize: '0.85rem' }}>{cart.reduce((s,i) => s + i.quantity, 0)} items</span>
              </h3>

              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: '0.5rem' }}><img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '3rem', height: '3rem', verticalAlign: 'middle' }} /></div>
                  <p>Tu carrito está vacío.</p>
                  <p style={{ fontSize: '0.8rem' }}>Selecciona productos de la tienda.</p>
                </div>
              ) : (
                <div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.25rem' }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ maxWidth: '60%' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>${item.price} c/u</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button className="btn" style={{ padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.05)', color: 'white' }} onClick={() => updateCartQuantity(item.id, -1)} title="Hacer clic para -">-</button>
                          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button className="btn" style={{ padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.05)', color: 'white' }} onClick={() => updateCartQuantity(item.id, 1)} title="Hacer clic para +">+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Forma de Entrega */}
                  <div style={{ marginBottom: '1.25rem', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Método de Entrega:</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        type="button"
                        className={`btn ${deliveryMethod === 'pickup' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: '1', padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={() => setDeliveryMethod('pickup')}
                       title="Hacer clic para retiro en granja">
                        🏪 Retiro en Granja
                      </button>
                      <button 
                        type="button"
                        className={`btn ${deliveryMethod === 'shipping' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: '1', padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={() => setDeliveryMethod('shipping')}
                       title="Hacer clic para envío a casa">
                        🚚 Envío a Casa
                      </button>
                    </div>
                  </div>

                  {deliveryMethod === 'shipping' && (
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="shippingZone">Localidad para el envío</label>
                      <input 
                        type="text" 
                        id="shippingZone"
                        className="form-control"
                        placeholder="Ej: El Talar / Tigre / San Fernando"
                        required
                        value={shippingZone}
                        onChange={(e) => setShippingZone(e.target.value)}
                      />
                      {isFreeShipping ? (
                        <div style={{ color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                          ¡Envío sin cargo a El Talar / La Paloma / Pacheco! 🎉
                        </div>
                      ) : shippingZone.trim() !== '' ? (
                        <div style={{ color: 'var(--accent-gold)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          Costo de Envío: ${shippingCost}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <span>Subtotal Productos:</span>
                      <span>${productsTotal}</span>
                    </div>
                    {deliveryMethod === 'shipping' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>Flete ({shippingZone || 'Domicilio'}):</span>
                        <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost}`}</span>
                      </div>
                    )}
                    <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '0.25rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      <span>Total final:</span>
                      <span style={{ color: 'var(--accent-gold)' }}>${cartTotal}</span>
                    </div>
                  </div>

                  {/* Formulario de compra */}
                  <form onSubmit={handleSubmitOrder}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Datos de Entrega</h4>
                    
                    <div className="form-group">
                      <label htmlFor="name">Nombre y Apellido</label>
                      <input 
                        type="text" 
                        id="name" 
                        className="form-control" 
                        placeholder="Juan Pérez" 
                        required 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">WhatsApp (con código de país, ej: 5491122334455)</label>
                      <input 
                        type="tel" 
                        id="phone" 
                        className="form-control" 
                        placeholder="5491133334444" 
                        required 
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="address">Dirección de Entrega o Retiro</label>
                      <input 
                        type="text" 
                        id="address" 
                        className="form-control" 
                        placeholder="Av. Rivadavia 1234, CABA" 
                        required 
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: '100%', fontSize: '1rem', marginTop: '0.5rem' }}
                      disabled={loading}
                     title="Hacer clic para ejecutar acción">
                      {loading ? 'Procesando...' : 'Confirmar Pedido'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
