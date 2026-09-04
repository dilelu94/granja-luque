import React, { useState, useEffect } from 'react';

export default function Shop({ onAdminLoginClick }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const phoneRaw = '5491127504590';
  const phoneFormatted = '11 2750-4590';

  useEffect(() => {
    fetch('/api/inventory/products')
      .then(res => res.json())
      .then(data => {
        // Filtrar solo productos activos y múltiplos de 12
        const filtered = data.filter(p => p.status === 'active' && p.egg_count > 0 && p.egg_count % 12 === 0);
        setProducts(filtered.length > 0 ? filtered : data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error al cargar productos:', err);
        setLoading(false);
      });
  }, []);

  const getWhatsAppProductLink = (product) => {
    const text = `Hola Granja Luque! 👋 Quisiera encargar:\n\n🥚 *${product.name}*\n💰 *Precio:* $${product.price}\n📦 *Cantidad:* ${product.egg_count} huevos frescos\n\n¿Me podrías confirmar disponibilidad y acordar la entrega? ¡Muchas gracias!`;
    return `https://wa.me/${phoneRaw}?text=${encodeURIComponent(text)}`;
  };

  const getWhatsAppGeneralLink = (extraMsg = '') => {
    const text = extraMsg || `Hola Granja Luque! 👋 Quisiera consultar por la compra de huevos de codorniz y coordinar entrega.`;
    return `https://wa.me/${phoneRaw}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div style={{ paddingBottom: '5rem', position: 'relative' }}>
      
      {/* --- BOTÓN FLOTANTE DE WHATSAPP --- */}
      <a
        href={getWhatsAppGeneralLink()}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          backgroundColor: '#25D366',
          color: '#ffffff',
          borderRadius: '50px',
          padding: '0.85rem 1.4rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          boxShadow: '0 10px 25px rgba(37, 211, 102, 0.4)',
          zIndex: 9999,
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '1rem',
          transition: 'all 0.3s ease',
          animation: 'pulseGlow 2s infinite'
        }}
        title="Consultar por WhatsApp (11 2750-4590)"
      >
        <span style={{ fontSize: '1.4rem' }}>💬</span>
        <span>WhatsApp: {phoneFormatted}</span>
      </a>

      {/* --- ANIMACIÓN CSS FLOTANTE --- */}
      <style>{`
        @keyframes pulseGlow {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.6); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(37, 211, 102, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }
        .product-card:hover {
          transform: translateY(-6px) !important;
          border-color: var(--accent-gold) !important;
          box-shadow: 0 12px 30px rgba(245, 158, 11, 0.15) !important;
        }
        .btn-wsp:hover {
          background-color: #1eb857 !important;
          transform: scale(1.02) !important;
        }
      `}</style>

      {/* --- HEADER PÚBLICO --- */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 0',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ color: 'var(--accent-green)', fontSize: '2.2rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Granja Luque <img src="/QuailEggEmoji.png" alt="🥚" style={{ width: '1.2em', height: '1.2em' }} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
            Codornices selectas y huevos frescos de producción propia
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={onAdminLoginClick} 
          title="Hacer clic para ingresar al panel administrador"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          Acceso Administrador 🔒
        </button>
      </header>

      {/* --- BANNER HERO PRINCIPAL --- */}
      <div 
        className="glass-card" 
        style={{
          padding: '2.5rem 2rem',
          marginBottom: '3rem',
          borderRadius: 'var(--border-radius-lg)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(245, 158, 11, 0.08) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.2)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'inline-block', backgroundColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', padding: '0.35rem 1rem', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          🥚 Huevos Seleccionados Diariamente
        </div>

        <h2 style={{ fontSize: '2.4rem', fontFamily: 'var(--font-heading)', marginBottom: '1rem', color: 'white', lineHeight: '1.2' }}>
          Frescura y Calidad Directo de Nuestra Granja
        </h2>

        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '750px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
          Producimos y seleccionamos diariamente huevos de codorniz de máxima calidad. Presentaciones exclusivamente en múltiplos de 12 para garantizar frescura y óptima conservación.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', padding: '0.6rem 1.2rem', borderRadius: '50px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            🌿 100% Naturales
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', padding: '0.6rem 1.2rem', borderRadius: '50px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            📦 Envasados en Múltiplos de 12
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', padding: '0.6rem 1.2rem', borderRadius: '50px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            🚚 Envíos a Domicilio y Retiros
          </div>
        </div>

        <div>
          <a
            href={getWhatsAppGeneralLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-wsp"
            style={{
              backgroundColor: '#25D366',
              color: '#ffffff',
              fontSize: '1.15rem',
              padding: '0.9rem 2.2rem',
              borderRadius: '50px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 8px 25px rgba(37, 211, 102, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>💬</span>
            <span>Hacé tu Pedido por WhatsApp ({phoneFormatted})</span>
          </a>
        </div>
      </div>

      {/* --- CATÁLOGO DE PRODUCTOS (SOLO MÚLTIPLOS DE 12) --- */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: 'white', marginBottom: '0.5rem' }}>
            Nuestras Presentaciones y Precios 🏷️
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Tocá en el botón de cualquier producto para pedirlo directamente por WhatsApp
          </p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando catálogo...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {products.map((prod, idx) => {
              const perEggPrice = (prod.price / prod.egg_count).toFixed(0);
              const dozenCount = prod.egg_count / 12;

              let badgeText = '⭐ Excelente Elección';
              let badgeColor = 'var(--accent-blue)';
              let badgeBg = 'var(--accent-blue-glow)';

              if (prod.egg_count === 12) {
                badgeText = '🔥 El Más Vendido (1 Docena)';
                badgeColor = 'var(--accent-gold)';
                badgeBg = 'var(--accent-gold-glow)';
              } else if (prod.egg_count === 24) {
                badgeText = '⚡ Doble Docena (24 Huevos)';
                badgeColor = 'var(--accent-green)';
                badgeBg = 'var(--accent-green-glow)';
              } else if (prod.egg_count === 36) {
                badgeText = '📦 Pack Familiar (3 Docenas)';
                badgeColor = '#a855f7';
                badgeBg = 'rgba(168, 85, 247, 0.15)';
              }

              return (
                <div 
                  key={prod.id || idx} 
                  className="glass-card product-card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    height: '100%', 
                    padding: '1.75rem',
                    position: 'relative',
                    borderRadius: 'var(--border-radius-md)'
                  }}
                >
                  {/* Badge superior */}
                  <div style={{
                    display: 'inline-block',
                    alignSelf: 'flex-start',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '50px',
                    marginBottom: '1rem',
                    border: `1px solid ${badgeColor}`
                  }}>
                    {badgeText}
                  </div>

                  {prod.image_url && (
                    <img 
                      src={prod.image_url} 
                      alt={prod.name} 
                      style={{
                        width: '100%',
                        height: '180px',
                        objectFit: 'cover',
                        borderRadius: 'var(--border-radius-sm)',
                        marginBottom: '1.25rem',
                        border: '1px solid var(--border-color)'
                      }}
                    />
                  )}

                  <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'white' }}>
                    {prod.name}
                  </h3>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flexGrow: '1', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    {prod.description}
                  </p>

                  <div style={{ 
                    background: 'rgba(0,0,0,0.35)', 
                    padding: '1rem 1.25rem', 
                    borderRadius: 'var(--border-radius-sm)', 
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>
                        ${prod.price.toLocaleString('es-AR')}
                      </span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Equivale a ${perEggPrice} por huevo
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>
                        {dozenCount} {dozenCount === 1 ? 'Docena' : 'Docenas'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                        {prod.egg_count} unidades
                      </div>
                    </div>
                  </div>

                  <a 
                    href={getWhatsAppProductLink(prod)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-wsp"
                    style={{ 
                      backgroundColor: '#25D366', 
                      color: '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      padding: '0.85rem 1rem',
                      width: '100%',
                      textAlign: 'center',
                      borderRadius: 'var(--border-radius-sm)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(37, 211, 102, 0.2)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span>💬</span> Pedir por WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- SECCIÓN DE BENEFICIOS --- */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '2.5rem 2rem', 
          marginBottom: '3.5rem',
          borderRadius: 'var(--border-radius-lg)',
          borderColor: 'rgba(255, 255, 255, 0.08)'
        }}
      >
        <h3 style={{ textAlign: 'center', fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', marginBottom: '2rem' }}>
          ¿Por qué elegir los Huevos de Codorniz de Granja Luque? 🌟
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💪</div>
            <h4 style={{ fontSize: '1.1rem', color: 'white', marginBottom: '0.5rem' }}>Máximo Valor Nutritivo</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Concentran altos niveles de proteínas de excelente calidad, hierro, fósforo, vitamina A, B12 y antioxidantes naturales.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍃</div>
            <h4 style={{ fontSize: '1.1rem', color: 'white', marginBottom: '0.5rem' }}>Fácil Digestión</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Son altamente tolerados, ideales para la alimentación de niños, deportistas y personas que buscan cuidar su digestión diaria.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🥗</div>
            <h4 style={{ fontSize: '1.1rem', color: 'white', marginBottom: '0.5rem' }}>Versatilidad en Cocina</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Ideales para picadas, ensaladas gourmet, aperitivos, desayunos nutritivos o viandas saludables.
            </p>
          </div>

        </div>
      </div>

      {/* --- SECCIÓN DE ENVÍOS Y ZONAS --- */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '2rem', 
          marginBottom: '2rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '2rem', 
          flexWrap: 'wrap',
          borderRadius: 'var(--border-radius-md)',
          background: 'rgba(15, 23, 42, 0.7)'
        }}
      >
        <div style={{ fontSize: '3.5rem', flexShrink: 0 }}>📍</div>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h3 style={{ fontSize: '1.4rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
            Zonas de Entrega y Puntos de Retiro
          </h3>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Hacemos entregas a domicilio en <strong>El Talar, La Paloma, General Pacheco, Tigre y San Fernando</strong>. 
            También podés retirar sin costo directamente por nuestra granja coordinando por WhatsApp.
          </p>
        </div>
        <div>
          <a 
            href={getWhatsAppGeneralLink('Hola! Quisiera consultar si hacen envíos a mi dirección en la zona.')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.95rem', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}
          >
            Consultar por mi zona 🚚
          </a>
        </div>
      </div>

      {/* --- FOOTER DE LA TIENDA --- */}
      <footer style={{ textAlign: 'center', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <p>Granja Luque © {new Date().getFullYear()} — Producción y venta de huevos de codorniz de alta calidad.</p>
        <p style={{ marginTop: '0.4rem' }}>Contacto directo WhatsApp: <strong>{phoneFormatted}</strong></p>
      </footer>

    </div>
  );
}
