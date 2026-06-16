# Granja Luque 🥚🚜 - Sistema de Control y Ventas

Este es un sistema full-stack de gestión para granja de codornices, diseñado para correr en un servidor Oracle AMD Always Free.

## 🌟 Características

1. **Tienda de Ventas (Público)**: Carrito de compras responsivo que envía la solicitud por WhatsApp al administrador.
2. **Dashboard de Métricas**: Control de stock de aves, días estimados de alimento y tasa de postura diaria (esperada 80 huevos cada 100 aves).
3. **Control Financiero**: Desglose de costos de empaquetado (caja de plástico, etiqueta, huevos) y cálculo automático de ganancia neta.
4. **Zonas de Envío Gratis**: Flete gratis automático para compras con envío a **El Talar**, **La Paloma** y **General Pacheco**.
5. **Calendario de Granja**: Agendamiento inteligente y automático de volteo (Día 15) y eclosión (Día 17) para incubadoras.
6. **Integración de Mercado Pago**: Generación de enlaces de pago por Mercado Pago para pedidos aprobados por WhatsApp.
7. **Notificación al Bot de WhatsApp**: Envía webhooks instantáneos a tu bot de WhatsApp cuando se crea, aprueba o paga un pedido.
8. **Cálculos Financieros Dinámicos**: Costo base del huevo en tiempo real calculado en base a las aves vivas (machos/hembras) y el consumo diario de alimento según su edad.
9. **Empaquetado Inteligente**: Sugerencia de cuántos envases se pueden empaquetar según el stock de envases vacíos (maples, cajas) y la cantidad de huevos recolectados.

## ⚙️ Configuración del Servidor

El servidor Oracle Cloud AMD ya cuenta con Node.js 22 y PM2 instalados, y la base de datos se inicializará automáticamente.

Para arrancar el proyecto localmente en desarrollo:
```bash
# Iniciar frontend y backend
npm install
npm run dev
```

### 🧪 Pruebas Unitarias
El proyecto utiliza **Vitest** y **React Testing Library** para asegurar el correcto funcionamiento de la lógica de negocio (como el cálculo del alimento, costos dinámicos, días de incubación y ROI).

Las pruebas unitarias pueden ejecutarse en cada directorio de forma independiente:
```bash
cd backend && npm test
cd ../frontend && npm test
```
Además, se han implementado flujos de integración continua en **GitHub Actions** para correr estos tests automáticamente al hacer un push a `master`.
