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

## ⚙️ Configuración del Servidor

El servidor Oracle Cloud AMD ya cuenta con Node.js 22 y PM2 instalados, y la base de datos se inicializará automáticamente.

Para arrancar el proyecto localmente en desarrollo:
```bash
npm install
npm run dev
```

Las pruebas unitarias pueden ejecutarse con:
```bash
npm test
```
