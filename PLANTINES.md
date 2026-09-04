# 🌿 DOCUMENTACIÓN TÉCNICA Y OPERATIVA - HUERTA HOGAREÑA (/plantines)

> [!IMPORTANT]
> **UBICACIÓN DEL REPOSITORIO LOCAL:**  
> El código fuente del proyecto de plantines **NO forma parte de este repositorio (`Granja`)**.  
> Se encuentra en su propio repositorio independiente ubicado localmente en:  
> 📁 **`/var/home/dilelu/repos/HuertaHogare-a`** (GitHub: `https://github.com/dilelu94/HuertaHogare-a`).

---

## 📌 1. RESUMEN DEL PROYECTO

* **Nombre del Emprendimiento:** Huerta Hogareña
* **Propósito:** Venta barrial directa de plantines de huerta (Tomates Reliquia, Mini Kumato Cherry, Ajíes Variados y Morrón Rojo) mediante cartel en la calle con código QR.
* **URL en vivo:** `https://granjaluque.duckdns.org/plantines/`
* **URL de carteles imprimibles:** `https://granjaluque.duckdns.org/plantines/carteles.html`
* **WhatsApp de contacto:** `+5491127504590` (Formato local: `11 2750-4590`).
* **Tono de comunicación:** Informal, cercano, vecino, casero y en singular. **No usar lenguaje corporativo ni plurales ("nosotros", "envianos")**.

---

## 📂 2. UBICACIÓN EXACTA DE CÓDIGO Y REPOSITORIOS

### 🟢 Proyecto Huerta Hogareña (Plantines):
* 📁 **Carpeta Local:** `/var/home/dilelu/repos/HuertaHogare-a` *(¡Acá está todo el código de /plantines!)*
* 🐙 **Repositorio GitHub:** `https://github.com/dilelu94/HuertaHogare-a` (rama `main`)
* ☁️ **Servidor OCI (Ubuntu):** `/home/ubuntu/huerta-hogarea`
* ⚙️ **Proceso PM2:** `huerta-app` (Puerto local `8085`).

### 🔵 Proyecto Granja Luque (Sistema Principal):
* 📁 **Carpeta Local:** `/var/home/dilelu/repos/Granja`
* 🐙 **Repositorio GitHub:** `https://github.com/dilelu94/granja-luque` (rama `master`)
* ☁️ **Servidor OCI (Ubuntu):** `/home/ubuntu/granja-luque`
* ⚙️ **Proceso PM2:** `granja-app` (Puerto local `8080`).

---

## 🌐 3. INFRAESTRUCTURA Y DESPLIEGUE (SERVER OCI)

* **Proveedor Cloud:** Oracle Cloud Infrastructure (OCI).
* **IP del Servidor:** `129.80.59.99`
* **Usuario SSH:** `ubuntu`
* **Llave SSH:** `~/.ssh/granja`
* **Servidor Web / Reverse Proxy:** Nginx (`/etc/nginx/sites-available/granja`).

### Configuración de Nginx para `/plantines/`:
```nginx
server {
    server_name granjaluque.duckdns.org;

    # El bloque /plantines/ DEBE ir antes de location /
    location /plantines/ {
        proxy_pass http://localhost:8085/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        add_header Service-Worker-Allowed '/plantines/' always;
        add_header Clear-Site-Data '"cache"' always;
    }

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🛠️ 4. RESOLUCIÓN DE PROBLEMAS TÉCNICOS CRÍTICOS

### 🛑 Problema de Redirección / Service Worker Scope en Chrome:
* **Síntoma:** Al entrar a `granjaluque.duckdns.org/plantines/` desde Chrome, el navegador redirigía a la home de Granja Luque o mostraba la pantalla rota/sin estilos, mientras que en Firefox o Incógnito funcionaba bien.
* **Causa Raíz:** Granja Luque es una PWA (React/Vite/Workbox) que registra un Service Worker (`/sw.js`) con scope `'/'`. El Service Worker en Chrome interceptaba las navegaciones de `granjaluque.duckdns.org/plantines/` antes de salir a internet y ejecutaba el fallback SPA `index.html` de Granja Luque.
* **Solución Implementada:**
  1. En `granja-luque/frontend/vite.config.js`: Se agregó `navigateFallbackDenylist: [/^\/plantines/]` a la configuración de Workbox.
  2. En `granja-luque/frontend/dist/sw.js`: Se configuró `NavigationRoute` con `{denylist: [/\/plantines/]}`.
  3. En `granja-luque/frontend/dist/registerSW.js` e `dist/index.html`: Se agregó un script de detección inmediata: si la URL contiene `/plantines/`, desregistra los Service Workers del navegador y recarga la página de forma limpia.
  4. En `HuertaHogare-a/index.html` y `carteles.html`: Se incluyó un script en `<head>` que desregistra Service Workers de scope raíz.

---

## 💰 5. PRECIOS Y ESTRATEGIA BARRIAL ($ ARS)

* **1 Plantín individual:** **$2.500 ARS**
* **Combo 3 Plantines (Mix):** **$7.500 ARS**
* **Combo 5 Plantines (Kit Huertita):** **$11.000 ARS**

### Variedades en Catálogo:
1. 🍅 **Tomate Reliquia:** Variedades antiguas de sabor dulce e intenso. Sabor a tomate de verdad.
2. 🍅 **Mini Kumato (Cherry):** Estilo Cherry oscurito, súper dulzón. Ideal para comer directo de la planta o en ensaladas.
3. 🌶️ **Ajíes Variados:** Variedad de ajíes picantes y dulces de diversos colores.
4. 🫑 **Morrón Rojo:** Morrón rojo dulce de huerta, de excelente rendimiento.

---

## 🖨️ 6. CARTELES IMPRIMIBLES (`carteles.html`)

El archivo `carteles.html` genera **4 Hojas A4** diseñadas para impresión directa (`Ctrl + P` / botón de impresión):

* **Hoja 1 (A4):** Cartel de Precios de Distancia (Genérico con letras gigantes para la calle).
* **Hoja 2 (A4):** Cartel con Código QR + WhatsApp (Diseño minimalista de ahorro de tinta).
* **Hojas 3 y 4 (A4):** Carteles Identificadores de Planta individuales.
  * **Medida exacta de tarjeta:** **15,5 cm x 8,0 cm** (pensadas para deslizar dentro de bolsas Ziplock pequeñas de **16 cm x 8,5 cm**).
  * **Sin precio:** Solo indican el nombre de la variedad, icono/grafico vectorial (Morrón Rojo incluye SVG de morrón rojo) y descripción.

---

## 🧪 7. PRUEBAS AUTOMÁTICAS Y COMANDOS

### Ejecutar Tests Locales:
```bash
cd /var/home/dilelu/repos/HuertaHogare-a
npm test
```

### Despliegue Manual a Servidor OCI:
```bash
cd /var/home/dilelu/repos/HuertaHogare-a
scp -i ~/.ssh/granja index.html carteles.html server.js tests/server.test.js ubuntu@129.80.59.99:/home/ubuntu/huerta-hogarea/
ssh -i ~/.ssh/granja ubuntu@129.80.59.99 "pm2 restart huerta-app"
```
