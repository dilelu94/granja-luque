import React, { useState, useEffect } from 'react';
import Shop from './pages/Shop';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import CalendarView from './pages/CalendarView';
import SettingsPage from './pages/SettingsPage';
import Projections from './pages/Projections';
import RecolectarHuevosApp from './pages/RecolectarHuevos';
import CageDetail from './pages/CageDetail';
import QRScanner from './pages/QRScanner';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || 'admin');
  const [view, setView] = useState(() => {
    // Manejar acceso directo por URL
    if (window.location.pathname === '/recolectar-huevos') {
      return 'recolectar-huevos';
    }
    if (window.location.pathname.startsWith('/jaula/')) {
      return 'jaula-detail';
    }
    if (window.location.pathname === '/escanear') {
      return 'escanear';
    }
    const savedView = localStorage.getItem('currentView');
    const hasToken = !!localStorage.getItem('token');
    if (!hasToken) {
      return 'shop';
    }
    return savedView || 'dashboard';
  });

  useEffect(() => {
    // Si la vista es la especial, actualizamos la URL para que quede bonita, y no la guardamos como default
    if (view === 'recolectar-huevos') {
      window.history.pushState({}, '', '/recolectar-huevos');
      return;
    } else if (view === 'jaula-detail') {
      // Mantenemos la URL que ya tiene el ID
      return;
    } else if (view === 'escanear') {
      window.history.pushState({}, '', '/escanear');
      return;
    } else {
      window.history.pushState({}, '', '/');
    }
    localStorage.setItem('currentView', view);
  }, [view]);

  // Si hay un cambio en el token, verificar validez al arrancar
  useEffect(() => {
    if (token) {
      fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) {
            return res.json();
          } else {
            handleLogout();
          }
        })
        .then(data => {
          if (data && data.role) {
            localStorage.setItem('role', data.role);
            setRole(data.role);
          }
        })
        .catch(() => {
          // Si da error de conexión, no borramos para poder seguir trabajando offline temporalmente
        });
    }
  }, [token]);

  const handleLoginSuccess = (newToken, newUsername, newRole) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('role', newRole || 'admin');
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole || 'admin');
    
    if (view === 'recolectar-huevos' || view === 'jaula-detail') {
      setView(view);
    } else {
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('currentView');
    setToken(null);
    setUsername('');
    setRole('admin');
    setView('shop');
  };

  // Navegar de vuelta a la tienda
  const handleCancelLogin = () => {
    setView('shop');
  };

  // Renderizador condicional de páginas
  const renderPage = () => {
    switch (view) {
      case 'shop':
        return <Shop onAdminLoginClick={() => setView(token ? 'dashboard' : 'login')} />;
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'dashboard':
        return token ? <Dashboard token={token} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'inventory':
        return token ? <Inventory token={token} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'orders':
        return token ? <Orders token={token} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'calendar':
        return token ? <CalendarView token={token} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'settings':
        return token ? <SettingsPage token={token} role={role} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'projections':
        return token ? <Projections token={token} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'recolectar-huevos':
        return token ? <RecolectarHuevosApp token={token} onBack={() => setView('dashboard')} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      case 'jaula-detail': {
        const id = window.location.pathname.split('/').pop();
        return token ? <CageDetail token={token} cageId={id} onBack={() => { window.history.pushState({}, '', '/'); setView('inventory'); }} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      }
      case 'escanear':
        return token ? <QRScanner onBack={() => { window.history.pushState({}, '', '/'); setView('dashboard'); }} /> : <Login onLoginSuccess={handleLoginSuccess} onCancel={handleCancelLogin} />;
      default:

        return <Shop onAdminLoginClick={() => setView('login')} />;
    }
  };

  // Modo público: renderizar la tienda directamente sin barra lateral
  if (view === 'shop' || view === 'login' || view === 'recolectar-huevos' || view === 'jaula-detail' || view === 'escanear') {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 2rem' }}>
        {renderPage()}
      </div>
    );
  }

  // Modo administrador: renderizar barra de navegación y panel
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-green)', fontSize: '1.4rem', fontFamily: 'var(--font-heading)' }}>
            Granja Admin 🚜
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Conectado como {username}</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: '1' }}>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('dashboard')}
          >
            📊 Dashboard
          </button>
          
          <button 
            className={`btn ${view === 'orders' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('orders')}
          >
            🛒 Pedidos Venta
          </button>

          <button 
            className={`btn ${view === 'inventory' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('inventory')}
          >
            📋 Inventario Granja
          </button>

          <button 
            className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('calendar')}
          >
            📅 Calendario
          </button>

          <button 
            className={`btn ${view === 'projections' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('projections')}
          >
            📈 Proyecciones
          </button>

          <button 
            className={`btn ${view === 'settings' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', width: '100%' }}
            onClick={() => setView('settings')}
          >
            ⚙️ Configuración
          </button>

        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', borderColor: 'transparent', background: 'rgba(255,255,255,0.02)' }}
            onClick={() => setView('shop')}
          >
            🥚 Ir a la Tienda
          </button>
          <button 
            className="btn btn-danger" 
            style={{ width: '100%' }}
            onClick={handleLogout}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
