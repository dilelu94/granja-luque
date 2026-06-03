import test from 'node:test';
import assert from 'node:assert';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { QuailBatch } from '../models/QuailBatch.js';
import { FeedStock } from '../models/FeedStock.js';
import { EggCollection } from '../models/EggCollection.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { Settings } from '../models/Settings.js';
import { User } from '../models/User.js';
import { Incubation } from '../models/Incubation.js';
import { Cage } from '../models/Cage.js';
import { getDatabaseConnection } from '../db/connection.js';
import bcryptjs from 'bcryptjs';

const toLocalYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test.describe('Pruebas Unitarias de Modelos de Negocio (POO)', () => {
  
  test.beforeEach(async () => {
    await setupTestDb();
  });

  test.afterEach(async () => {
    await teardownTestDb();
  });

  // --- PRUEBAS QUAILBATCH ---
  test.describe('Modelo QuailBatch (Lotes de Codornices)', () => {
    test('Debe calcular correctamente la edad en días y semanas', () => {
      const birthDate = new Date();
      birthDate.setDate(birthDate.getDate() - 14); // Hace 14 días
      const dateStr = toLocalYYYYMMDD(birthDate);

      const batch = new QuailBatch({
        name: 'Lote Test 1',
        type: 'chick',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: dateStr
      });

      assert.strictEqual(batch.getAgeInDays(), 14);
      assert.strictEqual(batch.getAgeInWeeks(), 2);
    });

    test('Debe sugerir alimento Iniciador para aves menores de 45 días y Ponedora para mayores', () => {
      const birthChick = new Date();
      birthChick.setDate(birthChick.getDate() - 20); // 20 días
      const chickBatch = new QuailBatch({
        name: 'Polluelos',
        type: 'chick',
        initial_quantity: 50,
        current_quantity: 50,
        birth_date: toLocalYYYYMMDD(birthChick)
      });

      const birthAdult = new Date();
      birthAdult.setDate(birthAdult.getDate() - 50); // 50 días (mayor a 45 días)
      const adultBatch = new QuailBatch({
        name: 'Adultas',
        type: 'adult',
        initial_quantity: 50,
        current_quantity: 50,
        birth_date: toLocalYYYYMMDD(birthAdult)
      });

      assert.strictEqual(chickBatch.getFeedType(), 'iniciador');
      assert.strictEqual(adultBatch.getFeedType(), 'ponedora');
    });

    test('Debe calcular el consumo diario de polluelos con 20% de desperdicio antes de 21 días', () => {
      const birth = new Date();
      birth.setDate(birth.getDate() - 10); // 10 días (tiene desperdicio)
      const batch = new QuailBatch({
        name: 'Polluelos Bebés',
        type: 'chick',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: toLocalYYYYMMDD(birth)
      });

      const settings = {
        feed_consumption_adult: '0.025',
        feed_consumption_chick: '0.015'
      };

      // 100 * 0.015 * 1.20 = 1.8 kg/día
      const breakdown = batch.getDailyFeedConsumptionBreakdown(settings);
      assert.strictEqual(breakdown.initiator, 1.8);
      assert.strictEqual(breakdown.ponedora, 0.0);
    });

    test('Debe calcular el consumo gradual durante el periodo de transición (días 39 a 45)', () => {
      const settings = {
        feed_consumption_adult: '0.025',
        feed_consumption_chick: '0.015'
      };

      // Caso: Día 40 (transición Día 1-2: 75% iniciador, 25% postura)
      const birth40 = new Date();
      birth40.setDate(birth40.getDate() - 40);
      const batch40 = new QuailBatch({
        name: 'Transición 40d',
        type: 'chick',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: toLocalYYYYMMDD(birth40)
      });
      // Tasa combinada = 0.75 * 0.015 + 0.25 * 0.025 = 0.01125 + 0.00625 = 0.0175 kg/ave
      // Total lote = 100 * 0.0175 = 1.75 kg
      // Iniciador = 1.75 * 0.75 = 1.3125 kg
      // Ponedora = 1.75 * 0.25 = 0.4375
      const breakdown40 = batch40.getDailyFeedConsumptionBreakdown(settings);
      assert.strictEqual(breakdown40.initiator, 1.3125);
      assert.strictEqual(breakdown40.ponedora, 0.4375);
    });

    test('Debe calcular el consumo diario de alimento según la configuración', () => {
      const batch = new QuailBatch({
        name: 'Lote Test',
        type: 'adult',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: '2026-01-01' // Claramente adultos
      });

      const settings = {
        feed_consumption_adult: '0.025', // 25g
        feed_consumption_chick: '0.015'  // 15g
      };

      // 100 codornices * 0.025kg = 2.5kg
      assert.strictEqual(batch.getDailyFeedConsumption(settings), 2.5);
    });

    test('Debe restar cantidad en caso de mortalidad', async () => {
      const batch = new QuailBatch({
        name: 'Lote Test',
        type: 'adult',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: '2026-01-01'
      });
      await batch.save();

      await batch.recordMortality(5);

      assert.strictEqual(batch.currentQuantity, 95);
      assert.ok(batch.notes.includes('Baja registrada: 5 aves'));
    });

    test('Debe restar cantidad y registrar motivo personalizado en caso de faena', async () => {
      const batch = new QuailBatch({
        name: 'Lote Test Faena',
        type: 'adult',
        initial_quantity: 50,
        current_quantity: 50,
        birth_date: '2026-01-01'
      });
      await batch.save();

      await batch.recordReduction(10, 'Faena / Consumo', 'para el domingo');

      assert.strictEqual(batch.currentQuantity, 40);
      assert.ok(batch.notes.includes('Motivo: Faena / Consumo'));
      assert.ok(batch.notes.includes('para el domingo'));
    });
  });

  // --- PRUEBAS FEEDSTOCK ---
  test.describe('Modelo FeedStock (Stock de Alimentos)', () => {
    test('Debe estimar correctamente los días de alimento restante', async () => {
      const settings = {
        feed_consumption_adult: '0.025',
        feed_consumption_chick: '0.015'
      };

      // Crear un lote activo
      const batch = new QuailBatch({
        name: 'Lote Productivo',
        type: 'adult',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: '2026-01-01' // Adultos
      });
      await batch.save(); // Consumo esperado: 100 * 0.025 = 2.5 kg/día

      // Actualizar stock de alimento ponedora a 10kg
      const feed = await FeedStock.getByType('ponedora');
      feed.quantity = 10.0;
      await feed.save();

      const estimates = await FeedStock.calculateEstimates(settings);
      
      // 10kg / 2.5kg/día = 4 días
      assert.strictEqual(estimates.ponedora.stock, 10.0);
      assert.strictEqual(estimates.ponedora.dailyConsumption, 2.5);
      assert.strictEqual(estimates.ponedora.daysLeft, 4);
    });

    test('Debe registrar compras de alimento en el historial de gastos (feed_purchases)', async () => {
      const db = await getDatabaseConnection();
      const feed = await FeedStock.getByType('ponedora');
      const initialQty = feed.quantity;

      // Comprar 25kg de alimento a $24,000 con flete de $5,000 (mitad de $10k)
      await feed.addStock(25.0, 24000.0, 5000.0);

      assert.strictEqual(feed.quantity, initialQty + 25.0);

      const purchases = await db.all('SELECT * FROM feed_purchases ORDER BY id DESC LIMIT 1');
      assert.strictEqual(purchases.length, 1);
      
      const purchase = purchases[0];
      assert.strictEqual(purchase.feed_type, 'ponedora');
      assert.strictEqual(purchase.quantity_kg, 25.0);
      assert.strictEqual(purchase.price, 24000.0);
      assert.strictEqual(purchase.shipping_cost, 5000.0);
    });

    test('Debe descontar automáticamente el alimento según el tiempo transcurrido', async () => {
      // 1. Crear un lote activo
      const batch = new QuailBatch({
        name: 'Lote Comilón',
        type: 'adult',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: '2026-01-01' // Adultos
      });
      await batch.save(); // consume 100 * 0.025 = 2.5 kg/día

      // 2. Establecer stock de ponedora en 50kg, y simular que se actualizó hace 2 días
      const feed = await FeedStock.getByType('ponedora');
      feed.quantity = 50.0;
      
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      feed.lastUpdated = twoDaysAgo.toISOString();
      await feed.save(); 
      
      // Forzar fecha en base de datos para simular tiempo transcurrido
      const db = await getDatabaseConnection();
      await db.run('UPDATE feed_stock SET quantity = 50.0, last_updated = ? WHERE id = ?', [twoDaysAgo.toISOString(), feed.id]);

      // 3. Ejecutar deducción automática
      const settings = {
        feed_consumption_adult: '0.025',
        feed_consumption_chick: '0.015'
      };
      await FeedStock.deductAutomaticConsumption(settings);

      // 4. Verificar que se restaron 2 días de consumo: 2.5kg * 2 = 5kg => Stock final aprox: 45kg
      const updatedFeed = await FeedStock.getByType('ponedora');
      assert.ok(updatedFeed.quantity <= 45.01 && updatedFeed.quantity >= 44.95);
    });
  });

  // --- PRUEBAS EGGCOLLECTION ---
  test.describe('Modelo EggCollection (Producción de Huevos)', () => {
    test('Debe calcular la tasa de postura comparada con codornices adultas en esa fecha', async () => {
      // Registrar lote nacido hace 40 días (adulta) con 100 codornices
      const birth = new Date();
      birth.setDate(birth.getDate() - 40);
      const batch = new QuailBatch({
        name: 'Ponedoras',
        type: 'adult',
        initial_quantity: 100,
        current_quantity: 100,
        birth_date: toLocalYYYYMMDD(birth)
      });
      await batch.save();

      const todayStr = toLocalYYYYMMDD(new Date());
      const collection = new EggCollection({
        date: todayStr,
        quantity_collected: 85,
        quantity_broken: 2
      });
      await collection.save();

      const stats = await EggCollection.getStats(1);
      const stat = stats[0];

      assert.strictEqual(stat.quantityCollected, 85);
      assert.strictEqual(stat.adultQuailsCount, 100);
      // (85 / 100) * 100 = 85%
      assert.strictEqual(stat.postureRate, 85);
      assert.strictEqual(stat.expectedEggs, 80);
    });
  });

  // --- PRUEBAS PRODUCT (DESGLOSE DE COSTOS) ---
  test.describe('Modelo Product (Desglose de Costos)', () => {
    test('Debe calcular correctamente el costo de empaque plástico, etiqueta y materia prima', () => {
      const product = new Product({
        name: 'Maple de 30 huevos premium',
        price: 1500.0,
        stock: 10,
        category: 'eggs',
        container_cost: 150.0, // Envase plástico
        label_cost: 30.0,      // Etiqueta
        egg_count: 30
      });

      // Costo unitario por huevo = $15
      // Costo materia prima = 30 huevos * $15 = $450
      // Costo total = $150 (envase) + $30 (etiqueta) + $450 (huevos) = $630
      // Ganancia neta = $1500 - $630 = $870
      assert.strictEqual(product.getTotalCost(15.0), 630.0);
      assert.strictEqual(product.getProfitMargin(15.0), 870.0);
    });
  });

  // --- PRUEBAS ORDER ---
  test.describe('Modelo Order (Pedidos y Ventas)', () => {
    test('Debe calcular el total acumulado de items e incrementar stock de productos al cancelar o pagarse', async () => {
      const db = await getDatabaseConnection();
      
      // Obtener producto existente (sembrado por schema) o crear uno
      const products = await db.all('SELECT * FROM products');
      const prod = products[0];
      const initialStock = prod.stock;

      // Crear pedido sin envío
      const order = await Order.createOrder({
        customerName: 'Cliente Prueba',
        customerPhone: '12345678',
        customerAddress: 'Calle Falsa 123',
        shippingZone: '',
        shippingCost: 0.0,
        items: [
          {
            product_id: prod.id,
            name: prod.name,
            quantity: 5,
            price_at_sale: prod.price
          }
        ]
      });

      assert.strictEqual(order.totalPrice, prod.price * 5);
      assert.strictEqual(order.status, 'pending_approval');

      // Pasar a pagado (debe restar stock de 5 unidades)
      const orderInst = await Order.getById(order.id);
      await orderInst.updateStatus('paid');

      const prodAfterPaid = await db.get('SELECT stock FROM products WHERE id = ?', [prod.id]);
      assert.strictEqual(prodAfterPaid.stock, initialStock - 5);

      // Cancelar pedido (debe retornar stock de 5 unidades)
      await orderInst.updateStatus('cancelled');
      const prodAfterCancelled = await db.get('SELECT stock FROM products WHERE id = ?', [prod.id]);
      assert.strictEqual(prodAfterCancelled.stock, initialStock);
    });

    test('Debe incluir costos de envío en el total del pedido', async () => {
      const db = await getDatabaseConnection();
      const products = await db.all('SELECT * FROM products');
      const prod = products[0];

      // Pedido con flete de $1500 a Tigre
      const order = await Order.createOrder({
        customerName: 'Juan Pérez',
        customerPhone: '5491122334455',
        customerAddress: 'Av Cazón 500, Tigre',
        shippingZone: 'Tigre',
        shippingCost: 1500.0,
        items: [
          {
            product_id: prod.id,
            name: prod.name,
            quantity: 2,
            price_at_sale: prod.price
          }
        ]
      });

      // Total = 2 * prod.price + $1500 flete
      assert.strictEqual(order.totalPrice, (prod.price * 2) + 1500.0);
      assert.strictEqual(order.shippingZone, 'Tigre');
      assert.strictEqual(order.shippingCost, 1500.0);
    });
  });

  // --- PRUEBAS CALENDAREVENT ---
  test.describe('Modelo CalendarEvent (Calendario de Granja)', () => {
    test('Debe crear eventos automáticos de volteo y eclosión al iniciar incubadora', async () => {
      const todayStr = toLocalYYYYMMDD(new Date());
      await CalendarEvent.registerIncubatorBatch(120, todayStr);

      const events = await CalendarEvent.getAll();
      
      // Debe haber creado 2 eventos (Detener volteo en día 15, Eclosión en día 17)
      const turnEvent = events.find(e => e.type === 'incubator_turn');
      const hatchEvent = events.find(e => e.type === 'incubator_hatch');

      assert.ok(turnEvent);
      assert.ok(hatchEvent);
      assert.strictEqual(turnEvent.title, 'Detener Volteo (120 huevos)');
      assert.strictEqual(hatchEvent.title, 'Eclosión Estimada (120 huevos)');
    });
  });

  // --- PRUEBAS MODELO USER ---
  test.describe('Modelo User (Roles y Gestión)', () => {
    test('Debe inicializar la base de datos con el usuario admin como super_admin', async () => {
      const admin = await User.findByUsername('admin');
      assert.ok(admin);
      assert.strictEqual(admin.role, 'super_admin');
    });

    test('Debe crear, guardar y encontrar un usuario por username y id', async () => {
      const newUser = new User({
        username: 'diego',
        password: 'hashedpassword',
        role: 'admin'
      });
      await newUser.save();

      const foundByUsername = await User.findByUsername('diego');
      assert.ok(foundByUsername);
      assert.strictEqual(foundByUsername.username, 'diego');
      assert.strictEqual(foundByUsername.role, 'admin');

      const foundById = await User.findById(newUser.id);
      assert.ok(foundById);
      assert.strictEqual(foundById.username, 'diego');
    });

    test('Debe cambiar la contraseña cifrada', async () => {
      const user = new User({
        username: 'juan',
        password: 'oldpassword',
        role: 'admin'
      });
      await user.save();

      await user.changePassword('newsecurepassword');
      
      const updatedUser = await User.findById(user.id);
      assert.ok(updatedUser);
      assert.notStrictEqual(updatedUser.password, 'newsecurepassword'); // Debe estar hasheada
      
      const isMatch = await bcryptjs.compare('newsecurepassword', updatedUser.password);
      assert.ok(isMatch);
    });

    test('Debe eliminar un usuario correctamente', async () => {
      const user = new User({
        username: 'temp',
        password: 'pwd',
        role: 'admin'
      });
      await user.save();

      const created = await User.findById(user.id);
      assert.ok(created);

      await User.delete(user.id);

      const deleted = await User.findById(user.id);
      assert.strictEqual(deleted, null);
    });
  });

  // --- PRUEBAS PROYECCIONES ---
  test.describe('Datos Base de Proyecciones', () => {
    test('Debe inicializar y retornar correctamente las constantes de proyección en settings', async () => {
      const db = await getDatabaseConnection();
      
      const capacity = await db.get("SELECT value FROM settings WHERE key = 'incubator_capacity'");
      assert.strictEqual(capacity.value, '24');

      const hatchRate = await db.get("SELECT value FROM settings WHERE key = 'hatch_rate'");
      assert.strictEqual(hatchRate.value, '0.70');

      const kwhCost = await db.get("SELECT value FROM settings WHERE key = 'electricity_kwh_cost'");
      assert.strictEqual(kwhCost.value, '60.0');
    });
  });

  // --- PRUEBAS INCUBATION ---
  test.describe('Modelo Incubation (Gestión de Incubación y Eventos)', () => {
    test('Debe registrar una incubación y agendar eventos en las fechas y horas correctas', async () => {
      const db = await getDatabaseConnection();
      
      const incubation = new Incubation({
        eggsCount: 150,
        startDate: '2026-05-30 00:10',
        notes: 'Incubación de prueba'
      });
      await incubation.save();

      assert.ok(incubation.id);

      // Verificar que se crearon 3 eventos
      const events = await db.all('SELECT * FROM calendar_events WHERE reference_id = ? ORDER BY event_date ASC', [incubation.id]);
      assert.strictEqual(events.length, 3);

      // Evento 1: Ovoscopia (Día 7 a las 20:00)
      const ovoscopia = events.find(e => e.title.includes('Ovoscopia'));
      assert.ok(ovoscopia);
      assert.strictEqual(ovoscopia.event_date, '2026-06-06 20:00');

      // Evento 2: Detener Volteo (Día 15 a la hora exacta de inicio: 00:10)
      const volteo = events.find(e => e.title.includes('Volteo'));
      assert.ok(volteo);
      assert.strictEqual(volteo.event_date, '2026-06-14 00:10');

      // Evento 3: Eclosión (Día 16 a la hora exacta: 00:10)
      const hatch = events.find(e => e.title.includes('Eclosión'));
      assert.ok(hatch);
      assert.strictEqual(hatch.event_date, '2026-06-15 00:10');

      // Eliminar y verificar limpieza de eventos
      await incubation.delete();
      const eventsAfterDelete = await db.all('SELECT * FROM calendar_events WHERE reference_id = ?', [incubation.id]);
      assert.strictEqual(eventsAfterDelete.length, 0);
    });

    test('Debe crear un lote de aves automático con cantidad 0 al marcar la incubación como completada', async () => {
      const db = await getDatabaseConnection();
      const incubation = new Incubation({
        eggsCount: 150,
        startDate: '2026-05-30 00:10',
        status: 'active',
        notes: 'Incubación de prueba para lote'
      });
      await incubation.save();

      assert.ok(incubation.id);

      // Cambiar status a completed
      incubation.status = 'completed';
      await incubation.save();

      // Buscar lote automático creado
      const { QuailBatch } = await import('../models/QuailBatch.js');
      const batches = await QuailBatch.getAll();
      const newBatch = batches.find(b => b.name.includes('(Pendiente)') && b.notes.includes(`#${incubation.id}`));

      assert.ok(newBatch);
      assert.strictEqual(newBatch.initialQuantity, 0);
      assert.strictEqual(newBatch.currentQuantity, 0);
      assert.strictEqual(newBatch.type, 'chick');
      assert.strictEqual(newBatch.status, 'active');
    });
  });

  // --- PRUEBAS MODELO CAGE Y VINCULACIÓN CON LOTES ---
  test.describe('Modelo Cage (Gestión de Jaulas y Vinculación)', () => {
    test('Debe crear una jaula, asociar un lote, y actualizar eventos al cambiar el nombre', async () => {
      const db = await getDatabaseConnection();

      // 1. Crear jaula
      const cage = new Cage({
        name: 'Jaula Test 1',
        capacity: 40,
        notes: 'Ubicación sur'
      });
      await cage.save();
      assert.ok(cage.id);

      // 2. Crear un lote de aves y asignarlo a la jaula
      const batch = new QuailBatch({
        name: 'Lote Test Jaula',
        type: 'chick',
        initialQuantity: 30,
        currentQuantity: 30,
        birthDate: '2026-05-01',
        status: 'active',
        cageId: cage.id
      });
      await batch.save();
      assert.ok(batch.id);
      assert.strictEqual(batch.cageId, cage.id);

      // 3. Verificar que se crearon eventos automáticos con el nombre de la jaula
      const events = await db.all('SELECT * FROM calendar_events WHERE reference_id = ?', [batch.id]);
      assert.strictEqual(events.length, 3);
      
      const transitionEvent = events.find(e => e.title.includes('Inicio Transición'));
      assert.ok(transitionEvent);
      assert.ok(transitionEvent.title.includes('Jaula: Jaula Test 1'));
      assert.ok(transitionEvent.description.includes('Jaula: Jaula Test 1'));

      // 4. Renombrar la jaula y verificar que los eventos del calendario se actualizaron
      cage.name = 'Jaula Test Modificada';
      await cage.save();

      const updatedEvents = await db.all('SELECT * FROM calendar_events WHERE reference_id = ?', [batch.id]);
      const updatedTransitionEvent = updatedEvents.find(e => e.title.includes('Inicio Transición'));
      assert.ok(updatedTransitionEvent);
      assert.ok(updatedTransitionEvent.title.includes('Jaula: Jaula Test Modificada'));
      assert.ok(updatedTransitionEvent.description.includes('Jaula: Jaula Test Modificada'));

      // 5. Eliminar la jaula y verificar que el lote ahora tiene cage_id = null
      await cage.delete();
      const updatedBatch = await QuailBatch.getById(batch.id);
      assert.strictEqual(updatedBatch.cageId, null);
      
      // Limpiar lote
      await db.run('DELETE FROM quail_batches WHERE id = ?', [batch.id]);
      await db.run('DELETE FROM calendar_events WHERE reference_id = ?', [batch.id]);
    });
  });
});

