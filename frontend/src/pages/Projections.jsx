import React, { useState, useEffect } from 'react';

export default function Projections({ token }) {
  const [baseData, setBaseData] = useState({
    activeAdultQuails: 0,
    feedCostPonedoraPerKg: 1360.0,
    feedCostIniciadorPerKg: 1480.0,
    settings: {
      feed_consumption_adult: '0.025',
      feed_consumption_chick: '0.015',
      incubator_capacity: '24',
      hatch_rate: '0.70',
      cage_build_time_days: '7',
      electricity_kwh_cost: '60.0',
      cage_bulb_wattage: '100',
      cage_light_hours: '16',
      cost_fertile_egg: '50.0',
      cost_adult_quail: '1200.0'
    },
    products: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Estados de Entrada del Usuario ---
  const [targetEggs, setTargetEggs] = useState(500);
  const [growthMethod, setGrowthMethod] = useState('buy_adults'); // 'buy_adults', 'incubate_own', 'incubate_bought'
  const [pricePerDozen, setPricePerDozen] = useState(4500);
  const [costAdultQuail, setCostAdultQuail] = useState(1200);
  const [costFertileEgg, setCostFertileEgg] = useState(50);
  const [currentCages, setCurrentCages] = useState(0);

  // --- Desglose Costo Unitario de Jaula ---
  const [cageCosts, setCageCosts] = useState({
    wood: 30000,
    tray: 17000,
    plywood: 33000,
    screws: 960,
    mesh: 5000,
    staples: 1000
  });

  // --- Variables Eléctricas e Infraestructura editables ---
  const [electricityKwhCost, setElectricityKwhCost] = useState(60);
  const [cageBulbWattage, setCageBulbWattage] = useState(100);
  const [cageLightHours, setCageLightHours] = useState(16);
  const [incubatorCapacity, setIncubatorCapacity] = useState(24);
  const [hatchRate, setHatchRate] = useState(70);
  const [buildTimeDays, setBuildTimeDays] = useState(7);

  // --- Estado de Collapsible de Configuración ---
  const [showConfig, setShowConfig] = useState(false);

  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/projections/base-data', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar datos base.');
        return res.json();
      })
      .then(data => {
        setBaseData(data);
        
        // Inicializar jaulas actuales estimadas
        const estimatedCages = Math.ceil(data.activeAdultQuails / 50);
        setCurrentCages(estimatedCages);

        // Inicializar inputs editables con los valores de base de datos
        if (data.settings) {
          setElectricityKwhCost(Number(data.settings.electricity_kwh_cost || 60));
          setCageBulbWattage(Number(data.settings.cage_bulb_wattage || 100));
          setCageLightHours(Number(data.settings.cage_light_hours || 16));
          setIncubatorCapacity(Number(data.settings.incubator_capacity || 24));
          setHatchRate(Number(data.settings.hatch_rate * 100 || 70));
          setBuildTimeDays(Number(data.settings.cage_build_time_days || 7));
          setCostFertileEgg(Number(data.settings.cost_fertile_egg || 50));
          setCostAdultQuail(Number(data.settings.cost_adult_quail || 1200));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando base para proyecciones:', err);
        setError('Error al obtener datos base del servidor.');
        setLoading(false);
      });
  }, [token]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Cargando calculadora de proyecciones...</p>;
  if (error) return <div className="glass-card" style={{ borderColor: 'var(--accent-red)', color: '#f87171' }}>{error}</div>;

  // ========================================================
  // CÁLCULOS DINÁMICOS
  // ========================================================

  // 1. Costo unitario total de fabricar una jaula
  const totalCageCost = Object.values(cageCosts).reduce((a, b) => Number(a) + Number(b), 0);

  // 2. Aves adultas necesarias
  const quailsNeeded = Math.ceil(targetEggs / 0.8);

  // 3. Brecha de aves (aves a agregar)
  const quailGap = Math.max(0, quailsNeeded - baseData.activeAdultQuails);

  // 4. Módulos de jaula necesarios
  const totalCagesNeeded = Math.ceil(quailsNeeded / 50);
  const newCagesNeeded = Math.max(0, totalCagesNeeded - currentCages);
  
  // Tiempo de fabricación en semanas
  const totalBuildWeeks = Math.ceil((newCagesNeeded * buildTimeDays) / 7);

  // 5. Costo de aves / crianza inicial
  let birdCost = 0;
  let rearingFeedKg = 0;
  let rearingFeedCost = 0;
  let fertileEggsNeeded = 0;
  let incubatorBatches = 0;
  let incubatorDays = 0;

  const hatchDecimal = hatchRate / 100;

  if (growthMethod === 'buy_adults') {
    birdCost = quailGap * costAdultQuail;
  } else {
    // Para incubación propia
    fertileEggsNeeded = Math.ceil(quailGap / hatchDecimal);
    incubatorBatches = Math.ceil(fertileEggsNeeded / incubatorCapacity);
    incubatorDays = incubatorBatches * 17;

    if (growthMethod === 'incubate_bought') {
      birdCost = fertileEggsNeeded * costFertileEgg;
    } // else 'incubate_own' -> $0 costo de huevo

    // Costo de alimento Iniciador durante 35 días de crianza
    // Consumo diario estimado polluelo: 15g (0.015kg)
    rearingFeedKg = quailGap * 0.015 * 35;
    rearingFeedCost = rearingFeedKg * baseData.feedCostIniciadorPerKg;
  }

  // Costo total de inversión inicial
  const cageInvestment = newCagesNeeded * totalCageCost;
  const initialInvestment = cageInvestment + birdCost + rearingFeedCost;

  // 6. Proyección Operativa Mensual (Gastos y Utilidad)
  const monthlyEggs = targetEggs * 30;
  const pricePerEgg = pricePerDozen / 12;
  const projectedMonthlyRevenue = monthlyEggs * pricePerEgg;

  // Alimento ponedoras mensual
  // Consumo por defecto: 25g (0.025kg)
  const dailyFeedConsumptionAdult = Number(baseData.settings.feed_consumption_adult || 0.025);
  const monthlyFeedConsumptionKg = quailsNeeded * dailyFeedConsumptionAdult * 30;
  const monthlyFeedCost = monthlyFeedConsumptionKg * baseData.feedCostPonedoraPerKg;

  // Costo luz mensual: 48 kWh al mes por jaula módulo
  // Consumo = (Wattage * Hours * 30) / 1000
  const kwhPerCageMonth = (cageBulbWattage * cageLightHours * 30) / 1000;
  const monthlyElectricityCost = totalCagesNeeded * kwhPerCageMonth * electricityKwhCost;

  // Costo de envases y etiquetas (Prorrateado usando Maple de 30 como referencia)
  // Intentar obtener de la base de datos el producto maple de 30
  const mapleProduct = baseData.products.find(p => p.egg_count === 30) || { container_cost: 150, label_cost: 30 };
  const packagingCostPerEgg = (mapleProduct.container_cost + mapleProduct.label_cost) / 30;
  const monthlyPackagingCost = monthlyEggs * packagingCostPerEgg;

  // Costo operativo total mensual
  const totalMonthlyOperatingCost = monthlyFeedCost + monthlyElectricityCost + monthlyPackagingCost;

  // Utilidad Neta Mensual
  const netMonthlyProfit = projectedMonthlyRevenue - totalMonthlyOperatingCost;

  // ROI (Meses para recuperar inversión)
  const roiMonths = netMonthlyProfit > 0 ? (initialInvestment / netMonthlyProfit).toFixed(1) : null;

  return (
    <div>
      <h2 style={{ marginBottom: '2rem', fontFamily: 'var(--font-heading)', fontSize: '1.8rem' }}>
        Calculadora de Proyecciones de Crianza e Inversión 📈
      </h2>

      {/* --- GRID DE CONTROLES PRINCIPALES --- */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--accent-green)', fontFamily: 'var(--font-heading)' }}>Parámetros del Objetivo</h3>
        
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          
          <div className="form-group" style={{ margin: '0' }}>
            <label htmlFor="target_eggs" style={{ fontSize: '0.85rem' }}>Meta de Huevos Diarios 🥚</label>
            <input 
              type="number" 
              id="target_eggs"
              className="form-control"
              value={targetEggs}
              onChange={e => setTargetEggs(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ padding: '0.5rem 0.75rem' }}
            />
            <small style={{ color: 'var(--text-muted)' }}>Requiere ~{quailsNeeded} codornices adultas.</small>
          </div>

          <div className="form-group" style={{ margin: '0' }}>
            <label htmlFor="price_dozen" style={{ fontSize: '0.85rem' }}>Precio de Venta (Docena) 💰</label>
            <input 
              type="number" 
              id="price_dozen"
              className="form-control"
              value={pricePerDozen}
              onChange={e => setPricePerDozen(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ padding: '0.5rem 0.75rem' }}
            />
            <small style={{ color: 'var(--text-muted)' }}>Equivale a ${pricePerEgg.toFixed(1)} c/u.</small>
          </div>

          <div className="form-group" style={{ margin: '0' }}>
            <label htmlFor="growth_method" style={{ fontSize: '0.85rem' }}>Método de Crecimiento 🐣</label>
            <select
              id="growth_method"
              className="form-control"
              value={growthMethod}
              onChange={e => setGrowthMethod(e.target.value)}
              style={{ padding: '0.5rem 0.75rem' }}
            >
              <option value="buy_adults">Compra de Aves Adultas</option>
              <option value="incubate_own">Incubación (Huevos de la Granja)</option>
              <option value="incubate_bought">Incubación (Comprando Huevos)</option>
            </select>
            <small style={{ color: 'var(--text-muted)' }}>Define la inversión y plazos.</small>
          </div>

          <div className="form-group" style={{ margin: '0' }}>
            <label htmlFor="cages_current" style={{ fontSize: '0.85rem' }}>Jaulas Disponibles en Granja 🪵</label>
            <input 
              type="number" 
              id="cages_current"
              className="form-control"
              value={currentCages}
              onChange={e => setCurrentCages(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ padding: '0.5rem 0.75rem' }}
            />
            <small style={{ color: 'var(--text-muted)' }}>Caben 50 aves por jaula.</small>
          </div>

        </div>
      </div>

      {/* --- CONFIGURACIONES EXTRA Y COSTOS UNITARIOS (COLLAPSIBLE) --- */}
      <div className="glass-card" style={{ marginBottom: '2rem', borderColor: 'rgba(255, 255, 255, 0.05)' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowConfig(!showConfig)}
        >
          <h4 style={{ margin: '0', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛠️ Costos Unitarios de Jaula e Infraestructura {showConfig ? '▲' : '▼'}
          </h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hacer clic para {showConfig ? 'ocultar' : 'editar costos de madera, focos, etc.'}</span>
        </div>

        {showConfig && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              
              {/* Costos de la jaula */}
              <div style={{ flex: '1', minWidth: '280px' }}>
                <h5 style={{ color: 'var(--accent-green)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.25rem' }}>
                  Materiales por Módulo de Jaula (50 Aves)
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Maderas ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.wood}
                      onChange={e => setCageCosts({ ...cageCosts, wood: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Corrugado Plástico ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.tray}
                      onChange={e => setCageCosts({ ...cageCosts, tray: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Terciado Madera ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.plywood}
                      onChange={e => setCageCosts({ ...cageCosts, plywood: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Tornillos (24x) ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.screws}
                      onChange={e => setCageCosts({ ...cageCosts, screws: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Alambrado ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.mesh}
                      onChange={e => setCageCosts({ ...cageCosts, mesh: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Grapas/Varios ($)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageCosts.staples}
                      onChange={e => setCageCosts({ ...cageCosts, staples: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1rem', fontWeight: 'bold', fontSize: '0.9rem', color: 'white', textAlign: 'right' }}>
                  Costo Fabricación Jaula: <span style={{ color: 'var(--accent-green)' }}>${totalCageCost.toLocaleString()}</span>
                </div>
              </div>

              {/* Otros Costos Operativos */}
              <div style={{ flex: '1', minWidth: '280px' }}>
                <h5 style={{ color: 'var(--accent-green)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.25rem' }}>
                  Ajustes Eléctricos e Infraestructura
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Costo Electricidad ($/kWh)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={electricityKwhCost}
                      onChange={e => setElectricityKwhCost(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Potencia Foco Jaula (W)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageBulbWattage}
                      onChange={e => setCageBulbWattage(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Horas Luz Jaula (h/día)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={cageLightHours}
                      onChange={e => setCageLightHours(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Capacidad Incubadora</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={incubatorCapacity}
                      onChange={e => setIncubatorCapacity(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Tasa Eclosión (%)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={hatchRate}
                      onChange={e => setHatchRate(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label style={{ fontSize: '0.8rem' }}>Tiempo de Construcción (días)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={buildTimeDays}
                      onChange={e => setBuildTimeDays(Number(e.target.value) || 0)}
                    />
                  </div>
                  {growthMethod === 'buy_adults' ? (
                    <div className="form-group" style={{ margin: '0', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.8rem' }}>Costo Compra Ave Adulta ($)</label>
                      <input 
                        type="number"
                        className="form-control"
                        value={costAdultQuail}
                        onChange={e => setCostAdultQuail(Number(e.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    <div className="form-group" style={{ margin: '0', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.8rem' }}>Costo Huevo Fértil Comprado ($)</label>
                      <input 
                        type="number"
                        className="form-control"
                        value={costFertileEgg}
                        disabled={growthMethod === 'incubate_own'}
                        onChange={e => setCostFertileEgg(Number(e.target.value) || 0)}
                      />
                      {growthMethod === 'incubate_own' && <small style={{ color: 'var(--accent-green)' }}>Usando huevos fértiles propios ($0)</small>}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* --- ADVERTENCIAS INTELIGENTES DE CAPACIDAD --- */}
      {(growthMethod !== 'buy_adults' && incubatorBatches > 5) && (
        <div 
          className="glass-card" 
          style={{
            borderColor: 'var(--accent-red)',
            background: 'var(--accent-red-glow)',
            color: '#f87171',
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <span style={{ fontSize: '2rem' }}>🚨</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.25rem' }}>Alerta de Capacidad de Incubación</div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
              Para cubrir tu brecha de <strong>{quailGap}</strong> aves mediante tu incubadora de <strong>{incubatorCapacity}</strong> huevos,
              requerirás <strong>{incubatorBatches} tandas</strong> consecutivas de incubación. Esto tomará aproximadamente 
              <strong> {Math.ceil(incubatorDays / 30)} meses ({incubatorDays} días)</strong> sin contar el desarrollo de las aves. Se sugiere:
              <ul style={{ margin: '0.5rem 0 0 1rem', paddingLeft: '0.5rem' }}>
                <li>Comprar parte de la brecha en aves adultas para recortar tiempos.</li>
                <li>Ampliar tu infraestructura adquiriendo una incubadora con mayor capacidad.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- CARDS DE DETALLE E INVERSIÓN INICIAL --- */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        
        {/* Card: Análisis de Aves */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)', fontFamily: 'var(--font-heading)' }}>Brecha de Aves</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Meta Total Aves:</span>
              <span style={{ fontWeight: 'bold' }}>{quailsNeeded}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Aves Adultas Actuales:</span>
              <span>{baseData.activeAdultQuails}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontWeight: 'bold' }}>
              <span style={{ color: 'white' }}>Brecha a Cubrir:</span>
              <span style={{ color: 'var(--accent-blue)' }}>{quailGap}</span>
            </div>
            {growthMethod !== 'buy_adults' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Con tu tasa de eclosión ({hatchRate}%), necesitas incubar un estimado de {fertileEggsNeeded} huevos ({incubatorBatches} tandas de 17 días).
              </div>
            )}
          </div>
        </div>

        {/* Card: Infraestructura Jaulas */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-gold)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>Construcción de Jaulas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Módulos Totales:</span>
              <span style={{ fontWeight: 'bold' }}>{totalCagesNeeded}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Jaulas Actuales:</span>
              <span>{currentCages}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontWeight: 'bold' }}>
              <span style={{ color: 'white' }}>Jaulas a Construir:</span>
              <span style={{ color: 'var(--accent-gold)' }}>{newCagesNeeded}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Fabricar {newCagesNeeded} jaulas te llevará aproximadamente <strong>{totalBuildWeeks} semanas ({newCagesNeeded * buildTimeDays} días)</strong> de trabajo.
            </div>
          </div>
        </div>

        {/* Card: Capital de Inversión */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-green)', fontFamily: 'var(--font-heading)' }}>Presupuesto de Inversión</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Materiales de Jaulas:</span>
              <span>${cageInvestment.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {growthMethod === 'buy_adults' ? 'Adquisición de Aves:' : 'Costo Huevos Fértiles:'}
              </span>
              <span>${birdCost.toLocaleString()}</span>
            </div>
            {growthMethod !== 'buy_adults' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Alimento de Crianza (Iniciador):</span>
                <span style={{ color: 'var(--accent-gold)' }}>${Math.round(rearingFeedCost).toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontWeight: 'bold', fontSize: '1.05rem' }}>
              <span style={{ color: 'white' }}>Inversión Requerida:</span>
              <span style={{ color: 'var(--accent-green)' }}>${Math.round(initialInvestment).toLocaleString()}</span>
            </div>
            {growthMethod !== 'buy_adults' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Incluye {rearingFeedKg.toFixed(1)} kg de alimento Iniciador para los 35 días previos a la postura.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- PROYECCIÓN DE GASTOS Y UTILIDADES MENSUALES --- */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
          Proyección de Flujo de Caja y Utilidades Mensuales 📊
        </h3>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h4 style={{ color: 'var(--accent-green)', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Balance Mensual</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Venta Estimada de Huevos ({monthlyEggs} unidades):</span>
                <span style={{ fontWeight: '600', color: 'white' }}>+ ${projectedMonthlyRevenue.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem', borderLeft: '2px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Equivalente a {monthlyEggs / 30} Maples de 30</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>${(pricePerEgg * 30).toFixed(1)} por Maple</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gastos de Alimento Ponedoras ({monthlyFeedConsumptionKg.toFixed(1)} kg):</span>
                <span style={{ color: '#f87171' }}>- ${Math.round(monthlyFeedCost).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Envases Plásticos y Etiquetas (Maples):</span>
                <span style={{ color: '#f87171' }}>- ${Math.round(monthlyPackagingCost).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Energía Eléctrica Focos ({monthlyElectricityCost.toFixed(1)} kWh):</span>
                <span style={{ color: '#f87171' }}>- ${Math.round(monthlyElectricityCost).toLocaleString()}</span>
              </div>

              {growthMethod !== 'buy_adults' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costo Eléctrico Promedio Incubadora (16W):</span>
                  <span style={{ color: '#f87171' }}>- ${Math.round(16 * 24 * 30 / 1000 * electricityKwhCost).toLocaleString()}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
                <span style={{ color: 'white' }}>Utilidad Neta Estimada / Mes:</span>
                <span style={{ color: netMonthlyProfit > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {netMonthlyProfit > 0 ? '+' : ''} ${Math.round(netMonthlyProfit).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* ROI y Conclusión */}
          <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="glass-card" style={{ background: 'rgba(255,255,255,0.01)', textAlign: 'center', padding: '2rem 1.5rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              
              {netMonthlyProfit > 0 ? (
                <>
                  <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏱️</span>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'white', margin: '0 0 0.5rem 0' }}>Retorno de Inversión (ROI)</h4>
                  
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-green)', fontFamily: 'var(--font-heading)', margin: '0.5rem 0' }}>
                    {roiMonths} {roiMonths === '1.0' ? 'mes' : 'meses'}
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0', maxWidth: '320px', lineHeight: '1.4' }}>
                    Recuperarás la inversión inicial estimada de <strong>${Math.round(initialInvestment).toLocaleString()}</strong> en <strong>{roiMonths}</strong> meses operando al 80% de postura.
                  </p>
                  
                  {growthMethod !== 'buy_adults' && (
                    <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid var(--accent-gold)', borderRadius: '4px', padding: '0.75rem', marginTop: '1.25rem', color: '#fbbf24', fontSize: '0.8rem', lineHeight: '1.4' }}>
                      ⚠️ Ten en cuenta que con el método de incubación, el ingreso comenzará a percibirse gradualmente después de que los lotes completen sus 35 días de crianza.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</span>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-red)', margin: '0 0 0.5rem 0' }}>Margen de Pérdida</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0', maxWidth: '320px', lineHeight: '1.4' }}>
                    Los costos operativos mensuales superan los ingresos proyectados. Verifica tus costos de alimento o aumenta el precio de venta de los huevos.
                  </p>
                </>
              )}
              
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
