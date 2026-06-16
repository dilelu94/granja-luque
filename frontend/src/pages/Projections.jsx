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
  const [projectionMode, setProjectionMode] = useState('eggs'); // 'eggs' o 'birds'
  const [targetEggs, setTargetEggs] = useState(100);
  const [growthMethod, setGrowthMethod] = useState('buy_adults'); // 'buy_adults', 'incubate_own', 'incubate_bought'
  const [pricePerDozen, setPricePerDozen] = useState(4500);
  const [costAdultQuail, setCostAdultQuail] = useState(1200);
  const [costFertileEgg, setCostFertileEgg] = useState(15000);
  const [currentCages, setCurrentCages] = useState(0);
  const [includeCurrentBirds, setIncludeCurrentBirds] = useState(true);
  
  const [currentFemales, setCurrentFemales] = useState(0);
  const [currentMales, setCurrentMales] = useState(0);

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
  const [hoveredIdx, setHoveredIdx] = useState(null);

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
        
        // Inicializar hembras y machos actuales
        setCurrentFemales(data.activeAdultFemales || 0);
        setCurrentMales(data.activeAdultMales || 0);

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

  // 2. Aves adultas necesarias y huevos proyectados
  const quailsNeeded = projectionMode === 'eggs' ? Math.ceil(targetEggs / 0.8) : currentFemales;
  const projectedDailyEggs = projectionMode === 'birds' ? Math.floor(currentFemales * 0.8) : targetEggs;

  // 3. Brecha de aves (aves a agregar)
  const effectiveCurrentFemales = includeCurrentBirds ? currentFemales : 0;
  const quailGap = Math.max(0, quailsNeeded - effectiveCurrentFemales);

  const effectiveCurrentMales = includeCurrentBirds || projectionMode === 'birds' ? currentMales : 0;
  const totalAdultBirdsToFeed = quailsNeeded + effectiveCurrentMales;

  // 4. Módulos de jaula necesarios
  const totalCagesNeeded = Math.ceil(totalAdultBirdsToFeed / 50);
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
    // Para incubación propia, consideramos que solo el 50% de los nacidos serán hembras ponedoras
    const femaleRatio = 0.5;
    fertileEggsNeeded = Math.ceil(quailGap / (hatchDecimal * femaleRatio));
    const chicksHatched = Math.ceil(fertileEggsNeeded * hatchDecimal);

    incubatorBatches = Math.ceil(fertileEggsNeeded / incubatorCapacity);
    incubatorDays = incubatorBatches * 16;

    if (growthMethod === 'incubate_bought') {
      // costFertileEgg representa el precio de una caja de 50 huevos
      birdCost = fertileEggsNeeded * (costFertileEgg / 50);
    } // else 'incubate_own' -> $0 costo de huevo

    // Costo de alimento Iniciador durante 45 días de crianza para TODOS los polluelos nacidos (machos + hembras)
    // Consumo diario estimado polluelo: 15g (0.015kg)
    // Durante las primeras 3 semanas (21 días) desperdician 20% de alimento, y las siguientes semanas (24 días) comen nominal.
    const rearingFeedKgPerChick = (0.015 * 1.20 * 21) + (0.015 * 24);
    rearingFeedKg = chicksHatched * rearingFeedKgPerChick;
    rearingFeedCost = rearingFeedKg * baseData.feedCostIniciadorPerKg;
  }

  // Costo total de inversión inicial
  const cageInvestment = newCagesNeeded * totalCageCost;
  const initialInvestment = cageInvestment + birdCost + rearingFeedCost;

  // 6. Proyección Operativa Mensual (Gastos y Utilidad)
  const monthlyEggs = projectedDailyEggs * 30;
  const pricePerEgg = pricePerDozen / 12;
  const projectedMonthlyRevenue = monthlyEggs * pricePerEgg;

  // Alimento ponedoras mensual
  // Consumo por defecto: 25g (0.025kg)
  const dailyFeedConsumptionAdult = Number(baseData.settings.feed_consumption_adult || 0.025);
  const monthlyFeedConsumptionKg = totalAdultBirdsToFeed * dailyFeedConsumptionAdult * 30;
  const monthlyFeedCost = monthlyFeedConsumptionKg * baseData.feedCostPonedoraPerKg;

  // Costo luz mensual: 48 kWh al mes por jaula módulo
  // Consumo = (Wattage * Hours * 30) / 1000
  const kwhPerCageMonth = (cageBulbWattage * cageLightHours * 30) / 1000;
  const monthlyElectricityCost = totalCagesNeeded * kwhPerCageMonth * electricityKwhCost;

  // Costo de envases: $300 por bandeja de 12 unidades
  const packagingCostPerEgg = 300 / 12;
  const monthlyPackagingCost = monthlyEggs * packagingCostPerEgg;

  // Costo operativo total mensual
  const totalMonthlyOperatingCost = monthlyFeedCost + monthlyElectricityCost + monthlyPackagingCost;

  // Utilidad Neta Mensual
  const netMonthlyProfit = projectedMonthlyRevenue - totalMonthlyOperatingCost;

  // El ROI se calculará más abajo usando la línea de tiempo.

  // --- GENERACIÓN DE DATOS DE LA LÍNEA DE TIEMPO Y CURVA DE ROI ---
  const generateTimelineData = () => {
    const data = [];
    const months = 12;
    const femaleRatio = 0.5;
    
    // Configuración de los lotes de incubación
    const rearingFeedKgPerChick = (0.015 * 1.20 * 21) + (0.015 * 24);
    const rearingFeedCostPerChick = rearingFeedKgPerChick * baseData.feedCostIniciadorPerKg;
    const batchList = [];
    
    if (growthMethod !== 'buy_adults') {
      let eggsAssigned = 0;
      for (let b = 1; b <= incubatorBatches; b++) {
        const eggsInBatch = b === incubatorBatches ? (fertileEggsNeeded - eggsAssigned) : incubatorCapacity;
        eggsAssigned += eggsInBatch;
        
        const chicksInBatch = Math.round(eggsInBatch * hatchDecimal);
        const femalesInBatch = Math.round(chicksInBatch * femaleRatio);
        const startDay = (b - 1) * 16;
        const hatchDay = startDay + 16;
        const adultDay = hatchDay + 45;
        
        batchList.push({
          id: b,
          eggsInBatch,
          chicksInBatch,
          femalesInBatch,
          startDay,
          hatchDay,
          adultDay,
          eggCost: growthMethod === 'incubate_bought' ? eggsInBatch * (costFertileEgg / 50) : 0,
          feedCost: chicksInBatch * rearingFeedCostPerChick
        });
      }
    }

    let cumulativeCost = 0;
    let cumulativeRevenue = 0;
    
    // Inversión Inicial en Mes 0
    cumulativeCost += cageInvestment;
    
    if (growthMethod === 'buy_adults') {
      cumulativeCost += quailGap * costAdultQuail;
    }

    // Punto del Mes 0
    data.push({
      month: 0,
      label: 'Mes 0',
      revenue: 0,
      cost: Math.round(cumulativeCost),
      activeQuails: baseData.activeAdultQuails
    });

    for (let m = 1; m <= months; m++) {
      const monthStartDay = (m - 1) * 30;
      const monthEndDay = m * 30;
      
      let monthRevenue = 0;
      let monthCost = 0;
      
      // 1. Calcular aves activas y huevos puestos en este mes
      let activeQuailsThisMonth = baseData.activeAdultQuails;
      
      if (growthMethod === 'buy_adults') {
        activeQuailsThisMonth += quailGap;
        const eggsProduced = activeQuailsThisMonth * 0.8 * 30;
        monthRevenue += eggsProduced * pricePerEgg;
        
        monthCost += activeQuailsThisMonth * dailyFeedConsumptionAdult * 30 * baseData.feedCostPonedoraPerKg;
        monthCost += Math.ceil(activeQuailsThisMonth / 50) * kwhPerCageMonth * electricityKwhCost;
        monthCost += eggsProduced * packagingCostPerEgg;
      } else {
        let eggsProduced = 0;
        let adultFeedCost = 0;
        let activeQuailsCountEnd = baseData.activeAdultQuails;
        
        eggsProduced += baseData.activeAdultQuails * 0.8 * 30;
        adultFeedCost += baseData.activeAdultQuails * dailyFeedConsumptionAdult * 30 * baseData.feedCostPonedoraPerKg;
        
        batchList.forEach(batch => {
          const startMonth = Math.floor(batch.startDay / 30) + 1;
          if (startMonth === m) {
            monthCost += batch.eggCost + batch.feedCost;
          }
          
          const overlapDays = Math.max(0, Math.min(monthEndDay, batch.hatchDay) - Math.max(monthStartDay, batch.startDay));
          if (overlapDays > 0) {
            monthCost += (16 * 24 * overlapDays / 1000) * electricityKwhCost;
          }
          
          if (batch.adultDay < monthEndDay) {
            const activeDays = monthEndDay - Math.max(monthStartDay, batch.adultDay);
            const batchEggs = batch.femalesInBatch * 0.8 * activeDays;
            eggsProduced += batchEggs;
            adultFeedCost += batch.femalesInBatch * dailyFeedConsumptionAdult * activeDays * baseData.feedCostPonedoraPerKg;
            
            if (monthEndDay >= batch.adultDay) {
              activeQuailsCountEnd += batch.femalesInBatch;
            }
          }
        });
        
        monthRevenue += eggsProduced * pricePerEgg;
        monthCost += adultFeedCost;
        monthCost += eggsProduced * packagingCostPerEgg;
        
        const activeCages = Math.ceil(activeQuailsCountEnd / 50);
        monthCost += activeCages * kwhPerCageMonth * electricityKwhCost;
        activeQuailsThisMonth = activeQuailsCountEnd;
      }
      
      cumulativeRevenue += monthRevenue;
      cumulativeCost += monthCost;
      
      data.push({
        month: m,
        label: `Mes ${m}`,
        revenue: Math.round(cumulativeRevenue),
        cost: Math.round(cumulativeCost),
        activeQuails: activeQuailsThisMonth
      });
    }
    
    return data;
  };

  const timelineData = generateTimelineData();
  
  let roiMonths = null;
  const breakEvenMonthIdx = timelineData.findIndex(d => d.cumulativeProfit >= 0 && d.month > 0);
  if (breakEvenMonthIdx > 0) {
    const prevMonth = timelineData[breakEvenMonthIdx - 1];
    const currentMonth = timelineData[breakEvenMonthIdx];
    if (currentMonth.profit > 0 && prevMonth.cumulativeProfit < 0) {
      const fraction = Math.abs(prevMonth.cumulativeProfit) / currentMonth.profit;
      roiMonths = (prevMonth.month + fraction).toFixed(2);
    } else {
      roiMonths = currentMonth.month.toFixed(2);
    }
  }

  const maxValue = Math.max(...timelineData.map(d => Math.max(d.cost, d.revenue)), 1000) * 1.15;
  const gridLevels = 5;

  const xScale = (idx) => 80 + idx * (680 / 12);
  const yScale = (value) => 310 - (value / maxValue) * 270;

  const formatMoneyCompact = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  // Construir SVG Paths
  let costLinePath = '';
  let costAreaPath = '';
  let revLinePath = '';
  let revAreaPath = '';

  timelineData.forEach((d, idx) => {
    const x = xScale(idx);
    const yCost = yScale(d.cost);
    const yRev = yScale(d.revenue);

    if (idx === 0) {
      costLinePath = `M ${x} ${yCost}`;
      costAreaPath = `M ${x} 310 L ${x} ${yCost}`;
      
      revLinePath = `M ${x} ${yRev}`;
      revAreaPath = `M ${x} 310 L ${x} ${yRev}`;
    } else {
      costLinePath += ` L ${x} ${yCost}`;
      costAreaPath += ` L ${x} ${yCost}`;

      revLinePath += ` L ${x} ${yRev}`;
      revAreaPath += ` L ${x} ${yRev}`;
    }
  });

  costAreaPath += ` L ${xScale(12)} 310 Z`;
  revAreaPath += ` L ${xScale(12)} 310 Z`;

  // Calcular intersección (Punto de Equilibrio exacto)
  let crossingMonth = -1;
  let crossingX = 0;
  let crossingY = 0;
  for (let i = 0; i < timelineData.length - 1; i++) {
    const curr = timelineData[i];
    const next = timelineData[i+1];
    if (curr.revenue < curr.cost && next.revenue >= next.cost) {
      const x1 = xScale(i);
      const x2 = xScale(i + 1);
      const y1_rev = yScale(curr.revenue);
      const y2_rev = yScale(next.revenue);
      const y1_cost = yScale(curr.cost);
      const y2_cost = yScale(next.cost);
      
      const denom = (y2_rev - y1_rev) - (y2_cost - y1_cost);
      const t = denom !== 0 ? (y1_cost - y1_rev) / denom : 0.5;
      
      crossingMonth = i + t;
      crossingX = x1 + t * (x2 - x1);
      crossingY = y1_rev + t * (y2_rev - y1_rev);
      break;
    }
  }

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
            <label htmlFor="projection_mode" style={{ fontSize: '0.85rem' }}>Modo de Proyección 🎯</label>
            <select
              id="projection_mode"
              className="form-control"
              value={projectionMode}
              onChange={e => setProjectionMode(e.target.value)}
              style={{ padding: '0.5rem 0.75rem' }}
            >
              <option value="eggs">Por Meta de Huevos</option>
              <option value="birds">Por Cantidad de Aves</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: '0' }}>
            {projectionMode === 'eggs' ? (
              <>
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
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="current_females" style={{ fontSize: '0.85rem' }}>Hembras 🦅</label>
                  <input 
                    type="number" 
                    id="current_females"
                    className="form-control"
                    value={currentFemales}
                    onChange={e => setCurrentFemales(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ padding: '0.5rem 0.75rem' }}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Huevos: ~{projectedDailyEggs}/día.</small>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="current_males" style={{ fontSize: '0.85rem' }}>Machos 🦅</label>
                  <input 
                    type="number" 
                    id="current_males"
                    className="form-control"
                    value={currentMales}
                    onChange={e => setCurrentMales(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ padding: '0.5rem 0.75rem' }}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Aumenta costo alimento.</small>
                </div>
              </div>
            )}
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
            <small style={{ color: 'var(--text-muted)' }}>Equivale a ${pricePerEgg.toFixed(2)} c/u.</small>
          </div>

          {projectionMode === 'eggs' && (
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
          )}

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

          {projectionMode === 'eggs' && (
          <div className="form-group" style={{ margin: '0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={includeCurrentBirds}
                onChange={e => setIncludeCurrentBirds(e.target.checked)}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              Descontar aves que ya poseo
            </label>
            {includeCurrentBirds ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hembras</label>
                  <input type="number" className="form-control" style={{ padding: '0.25rem' }} value={currentFemales} onChange={e => setCurrentFemales(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Machos</label>
                  <input type="number" className="form-control" style={{ padding: '0.25rem' }} value={currentMales} onChange={e => setCurrentMales(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
            ) : (
              <small style={{ color: 'var(--text-muted)' }}>Se ignorarán las aves actuales.</small>
            )}
          </div>
          )}

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
                      <label style={{ fontSize: '0.8rem' }}>Costo Huevos Fértiles Comprados (x50) ($)</label>
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
      {projectionMode === 'eggs' && (growthMethod !== 'buy_adults' && incubatorBatches > 5) && (
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
      {projectionMode === 'eggs' && (
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
              <span style={{ color: includeCurrentBirds ? 'white' : 'var(--text-muted)', textDecoration: includeCurrentBirds ? 'none' : 'line-through', textAlign: 'right' }}>
                {currentFemales + currentMales} 
                <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', textDecoration: 'none' }}>({currentFemales} H, {currentMales} M)</div>
                {!includeCurrentBirds && <div style={{ fontSize: '0.8em' }}>(Ignoradas)</div>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontWeight: 'bold' }}>
              <span style={{ color: 'white' }}>Brecha a Cubrir:</span>
              <span style={{ color: 'var(--accent-blue)' }}>{quailGap}</span>
            </div>
            {growthMethod !== 'buy_adults' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Con tu tasa de eclosión ({hatchRate}%) y un ratio del 50% de hembras, necesitas incubar un estimado de {fertileEggsNeeded} huevos ({incubatorBatches} tandas de 17 días).
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
                 {rearingFeedKg.toFixed(2)} kg de alimento Iniciador para los 45 días previos a la postura.
              </div>
            )}
          </div>
        </div>

      </div>
      )}

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
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Equivalente a {monthlyEggs / 12} Docenas</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>${(pricePerEgg * 12).toFixed(2)} por Docena</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gastos de Alimento Ponedoras ({monthlyFeedConsumptionKg.toFixed(2)} kg):</span>
                <span style={{ color: '#f87171' }}>- ${Math.round(monthlyFeedCost).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Envases Plásticos (Bandejas de 12):</span>
                <span style={{ color: '#f87171' }}>- ${Math.round(monthlyPackagingCost).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Energía Eléctrica Focos ({(totalCagesNeeded * kwhPerCageMonth).toFixed(2)} kWh):</span>
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
          {projectionMode === 'eggs' && (
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
                      ⚠️ Ten en cuenta que con el método de incubación, el ingreso comenzará a percibirse gradualmente después de que los lotes completen sus 45 días de crianza.
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
          )}

        </div>

        {/* --- GRÁFICO DE LÍNEA DE TIEMPO INTERACTIVO --- */}
        {projectionMode === 'eggs' && (
        <>
        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '2rem 0' }} />
        
        <div>
          <h4 style={{ color: 'white', marginBottom: '1rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📈 Curva de Recuperación y Crecimiento (Proyección a 12 Meses)
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Visualiza cómo crece la cantidad de codornices ponedoras a medida que finaliza la incubación de cada tanda y cómo se cruzan las líneas de inversión y ganancias acumuladas (punto de equilibrio).
          </p>

          <div style={{ position: 'relative', width: '100%', background: 'rgba(11, 15, 25, 0.4)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
            {/* Tooltip flotante */}
            {hoveredIdx !== null && timelineData[hoveredIdx] && (
              <div style={{
                position: 'absolute',
                top: '10px',
                left: hoveredIdx < 6 ? `${xScale(hoveredIdx) + 20}px` : `${xScale(hoveredIdx) - 230}px`,
                background: 'rgba(19, 26, 46, 0.95)',
                border: '1px solid var(--border-color-hover)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                zIndex: 10,
                pointerEvents: 'none',
                boxShadow: 'var(--glass-shadow)',
                fontSize: '0.85rem',
                minWidth: '220px',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ fontWeight: 'bold', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                  {timelineData[hoveredIdx].label}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Aves Ponedoras:</span>
                  <span style={{ fontWeight: '600' }}>{timelineData[hoveredIdx].activeQuails} hembras</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ingresos Acum.:</span>
                  <span style={{ fontWeight: '600', color: 'var(--accent-green)' }}>${timelineData[hoveredIdx].revenue.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costos Acum.:</span>
                  <span style={{ fontWeight: '600', color: 'var(--accent-gold)' }}>${timelineData[hoveredIdx].cost.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.25rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                  <span style={{ color: 'white' }}>Resultado Neto:</span>
                  <span style={{ color: (timelineData[hoveredIdx].revenue - timelineData[hoveredIdx].cost) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    ${(timelineData[hoveredIdx].revenue - timelineData[hoveredIdx].cost).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* SVG gráfico */}
            <svg viewBox="0 0 800 350" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                {/* Gradientes para las curvas */}
                <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="grad-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity="0.0" />
                </linearGradient>
                {/* Sombra para el punto de cruce */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Líneas de cuadrícula horizontal */}
              {Array.from({ length: gridLevels }).map((_, idx) => {
                const val = (maxValue / (gridLevels - 1)) * idx;
                const y = yScale(val);
                return (
                  <g key={idx}>
                    <line x1="80" y1={y} x2="760" y2={y} stroke="var(--border-color)" strokeDasharray="3 3" />
                    <text x="70" y={y + 4} textAnchor="end" fill="var(--text-muted)" style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                      {formatMoneyCompact(val)}
                    </text>
                  </g>
                );
              })}

              {/* Etiquetas del eje X (meses) */}
              {timelineData.map((d, idx) => {
                const x = xScale(idx);
                return (
                  <g key={idx}>
                    <line x1={x} y1="310" x2={x} y2="315" stroke="var(--border-color)" />
                    <text x={x} y="330" textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '11px' }}>
                      M{d.month}
                    </text>
                  </g>
                );
              })}

              {/* Ejes principales */}
              <line x1="80" y1="310" x2="760" y2="310" stroke="var(--border-color)" strokeWidth="1.5" />
              <line x1="80" y1="40" x2="80" y2="310" stroke="var(--border-color)" strokeWidth="1.5" />

              {/* Área y Línea de Inversiones Acumuladas */}
              <path d={costAreaPath} fill="url(#grad-cost)" />
              <path d={costLinePath} fill="none" stroke="var(--accent-gold)" strokeWidth="3" strokeLinecap="round" />

              {/* Área y Línea de Ganancias Acumuladas */}
              <path d={revAreaPath} fill="url(#grad-revenue)" />
              <path d={revLinePath} fill="none" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" />

              {/* Línea vertical de hover */}
              {hoveredIdx !== null && (
                <line 
                  x1={xScale(hoveredIdx)} 
                  y1="40" 
                  x2={xScale(hoveredIdx)} 
                  y2="310" 
                  stroke="rgba(255, 255, 255, 0.2)" 
                  strokeDasharray="4 4" 
                  strokeWidth="1.5" 
                />
              )}

              {/* Punto de intersección (Equilibrio / ROI) */}
              {crossingMonth !== -1 && (
                <g filter="url(#glow)">
                  <circle cx={crossingX} cy={crossingY} r="8" fill="var(--accent-green)" />
                  <circle cx={crossingX} cy={crossingY} r="4" fill="white" />
                  {/* Etiqueta de Punto de Equilibrio */}
                  <rect 
                    x={crossingX - 60} 
                    y={crossingY - 30} 
                    width="120" 
                    height="20" 
                    rx="4" 
                    fill="var(--bg-secondary)" 
                    stroke="var(--accent-green)" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={crossingX} 
                    y={crossingY - 16} 
                    textAnchor="middle" 
                    fill="var(--accent-green)" 
                    style={{ fontSize: '9px', fontWeight: 'bold' }}
                  >
                    RETORNO (ROI)
                  </text>
                </g>
              )}

              {/* Puntos destacados en hover */}
              {hoveredIdx !== null && timelineData[hoveredIdx] && (
                <g>
                  <circle cx={xScale(hoveredIdx)} cy={yScale(timelineData[hoveredIdx].cost)} r="6" fill="var(--accent-gold)" stroke="white" strokeWidth="1.5" />
                  <circle cx={xScale(hoveredIdx)} cy={yScale(timelineData[hoveredIdx].revenue)} r="6" fill="var(--accent-green)" stroke="white" strokeWidth="1.5" />
                </g>
              )}

              {/* Rectángulos transparentes para captura de hover */}
              {timelineData.map((d, idx) => {
                const x = xScale(idx);
                const step = 680 / 12;
                return (
                  <rect
                    key={idx}
                    x={x - step / 2}
                    y="40"
                    width={step}
                    height="270"
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>

            {/* Leyenda del gráfico */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--accent-gold)', borderRadius: '2px' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Inversión Acumulada (Costos)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--accent-green)', borderRadius: '2px' }}></div>
                <span style={{ color: 'var(--text-secondary)' }}>Ingresos Acumulados (Ganancias)</span>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
