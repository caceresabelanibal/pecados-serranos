# Contexto del proyecto — Pecados Serranos

> Documento permanente. Explica **qué es** el sistema, **cómo está armado** y **qué reglas de negocio** sigue.
> Se actualiza cuando cambia algo de fondo (arquitectura, reglas, flujos). El día a día va en `ESTADO.md` y `CHANGELOG.md`.
> ⚠️ El repositorio es **público**: acá nunca van contraseñas, tokens, IP/puertos del servidor ni datos personales.

## 1. Qué es

Tienda online de **Pecados Serranos** (sex shop, Valle de Punilla, Córdoba) con panel de administración y perfil para revendedoras.

- **Sitio:** https://pecadosserranos.com.ar
- **Panel de administración:** https://pecadosserranos.com.ar/admin
- **Perfil de revendedoras ("Asociado"):** https://pecadosserranos.com.ar/asociado

Los accesos no tienen botones en la tienda: se entra escribiendo la URL.

## 2. Stack

- **Front y back:** Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, framer-motion, lucide-react.
- **Base de datos:** PostgreSQL 16 con Prisma 6. El esquema se aplica con `prisma db push` al arrancar el contenedor.
- **Excel:** `xlsx` (SheetJS 0.20.3, CDN). Imágenes con `sharp`.
- **Infra:** docker compose con tres servicios.
  - `db` (Postgres): escucha solo en localhost.
  - `app` (Next): escucha solo en localhost.
  - `caddy`: HTTPS con certificado automático de Let's Encrypt, puertos 80 y 443.
- **Servidor:** VPS Linux (DonWeb). Repo en `/opt/pecados-serranos`. Los accesos y secretos están **fuera del repo**, en el `.env` del servidor.

### Archivos clave

- **`app/page.tsx`:** la página principal (cliente). Tienda pública + panel admin con todas sus pestañas.
- **`app/admin/page.tsx` y `app/asociado/page.tsx`:** misma página, abren el login correspondiente.
- **`app/components/`:**
  - `AgeGate`: aviso +18.
  - `AsociadoPanel`: perfil de la revendedora.
  - `CashFlowTab`: pestaña **Flujo de stock**.
  - `CashSummaryTab`: pestaña **Flujo de caja**.
  - `ResellerSections`: comisiones y ventas en Revendedores.
  - `InterestsTab`, `ImageZoom`, `MercadoPagoSettings`, `BackupSettings`.
- **`app/products.ts`:** tipos y helpers compartidos (`owedToStore`, `commissionStatus`, medios de pago).
- **`lib/`:**
  - `pricing.ts`: fórmulas de VShop.
  - `commission.ts`: comisiones.
  - `sales.ts`: anular, devolver y confirmar stock.
  - `mercadopago.ts`: Checkout Pro.
  - `order-code.ts`: códigos de pedido.
  - `db-backup.ts`: backup firmado.
  - `auth.ts` / `reseller-auth.ts`: sesiones.
  - `search.ts`, `product-images.ts`.
- **`app/api/`:**
  - Públicas: `productos`, `pedidos`, `interes`, `codigo`, `checkout`, `mercadopago/webhook`, `mercadopago/estado`, `imagen`.
  - `asociado/*`: requiere sesión de revendedora.
  - `admin/*`: requiere sesión de admin. Incluye `ventas`, `revendedores`, `comisiones`, `caja`, `backup`, `mercadopago`, `imagenes`, `interesados`, `pedido-proveedor`.
- **`prisma/schema.prisma`:** modelos.
  - `PecadoProduct`, `PecadoProductImage`.
  - `PecadoSale`, `PecadoSaleItem`.
  - `PecadoReseller`, `PecadoConsignment`.
  - `PecadoPurchase`, `PecadoPurchasePlanItem`, `PecadoInterest`.
  - `PecadoCashEntry`, `PecadoSetting`.
- **`scripts/deploy.sh`:** deploy completo (ver §5).

## 3. Reglas de negocio

### Precios (planilla VShop)

- Proveedor con IVA = sin IVA × 1,21.
- Ganancia = con IVA × multiplicador. El multiplicador es libre, mayor que 0 y hasta 100.
- **Precio Público FT** se carga a mano. Es el precio en efectivo, transferencia y Mercado Pago en ventas manuales.
- **Precio Público TC** = FT × 1,10. Es el precio de la tienda online y de la tarjeta.
- Un producto **incompleto** no aparece en la tienda. Le falta alguno de estos datos: código, descripción, costo, multiplicador o FT.

### Compras de la tienda (carrito)

- Nombre completo y dirección son obligatorios.
- **Método de pago:**
  - **Mercado Pago (Checkout Pro):** se crea la orden "pendiente" y se paga en Mercado Pago.
  - **Efectivo en mano:** pedido por WhatsApp; el admin lo confirma cuando recibe el dinero.
- **El stock se descuenta solo cuando la compra está cobrada:**
  - Mercado Pago: cuando el pago se acredita (webhook o consulta).
  - Efectivo: cuando el admin toca "Confirmar cobro".
- **Órdenes de Mercado Pago:**
  - Las que no se pagan vencen a la hora y se anulan.
  - Si se reintenta el pago desde el mismo navegador, la orden anterior sin pagar se anula, así no se acumulan.
  - El admin solo ve como pendientes las que tienen un pago real en curso.
- **Código de pedido:** cada compra tiene uno único de 2 letras + 4 números (sin I ni O).
  - Va en el mensaje de WhatsApp.
  - Se muestra al cliente antes de ir a pagar y al volver.
  - Aparece en el admin y en el perfil de la revendedora.
- **Links de WhatsApp con texto:** se arman con `api.whatsapp.com/send`, porque `wa.me` rompe los emojis.

### Revendedoras

- Cada una puede tener código propio (para el carrito) y usuario y contraseña para /asociado.
- El alta se hace en un solo paso, validado en el servidor, para evitar duplicados.
- **Mercadería en consignación (lotes):** al entregarla se descuenta del depósito. La comisión por unidad la define el admin en cada lote.
- **Comisión:** monto fijo por unidad.
  - En la venta de un lote se usa la del lote.
  - En ventas con código o del depósito, se usa la del último lote de ese artículo; si no hay, la última definida a mano.
  - Si no hay ninguna, queda "a definir".
- **¿Quién paga la comisión?**
  - **Ventas que cobra ella** (las que carga en /asociado o las rendiciones de lotes): ella le paga a la tienda el total menos su comisión ("Pago a tienda") y la comisión queda "descontada al rendir". El admin marca la venta como **rendida** cuando recibe el pago.
  - **Ventas que cobra la tienda** (compras online con su código): la tienda le **adeuda** la comisión. El admin la marca **pagada** con fecha. Ella lo ve en "Mis comisiones".
- **Lo que puede hacer la asociada:**
  - Editar o anular sus ventas mientras no estén rendidas.
  - Ver su mercadería, el "Pago a tienda" con filtros por período y el estado de sus comisiones.

### Flujo de caja (admin)

- **Balance de sumas y saldos:**
  - Debe = entra; Haber = sale.
  - Cuentas fijas: Ventas, Compras a proveedores y Comisiones.
  - Además, una cuenta por cada categoría de **registro manual** (ej: perchas, posnet, aporte de capital).
- **Movimientos:** planilla con saldo acumulado, búsqueda y período.
- Se puede exportar a Excel e imprimir (o guardar como PDF).

## 4. Seguridad

- **Sesiones:**
  - Admin: contraseña con hash scrypt en `.env`, cookie HttpOnly firmada con HMAC.
  - Revendedoras: cookie propia firmada.
  - Rate limiting en logins y pedidos, y verificación de mismo origen (CSRF) en las APIs que modifican datos.
- **Precios y stock:** los calcula siempre el servidor; el navegador solo manda códigos y cantidades.
- **Mercado Pago:**
  - El Access Token se guarda en la base (`PecadoSetting`) y nunca sale completo al navegador.
  - Los avisos del webhook solo disparan una consulta a la API de Mercado Pago; su contenido no se usa como dato confiable.
- **Backups desde el panel (.psbak):** van firmados con HMAC. Solo se restauran backups generados por esta tienda.

## 5. Forma de trabajo (acordada con el dueño)

- **Cada cambio de código** sigue estos pasos:
  1. Commit.
  2. Push a GitHub (`master`).
  3. En el servidor, `scripts/deploy.sh`, que hace:
     - Backup de la base; se conservan los últimos 3 en `/root/backups`.
     - `git pull`.
     - `docker compose up -d --build`.
     - Reinicio de Caddy si cambió el `Caddyfile`.
     - Limpieza de imágenes y caché.
  4. Verificación.
- **Las tareas largas en el servidor** se lanzan con `systemd-run`, porque los procesos en segundo plano mueren al cortarse la sesión SSH.
- **Las pruebas se hacen sobre una copia de la base:** base `pecados_test` + contenedor temporal en el puerto local 3100. Al terminar, se borran.
- **Backups manuales** (`/root/backups-manuales`):
  - Comprimidos (gzip), con permisos 600.
  - Cuando el dueño dice **"restaurá"**, se vuelve al punto de restauración vigente (ver `ESTADO.md`).
- **Después de cada cambio** se actualizan `ESTADO.md` y `CHANGELOG.md` (y este archivo si cambia algo de fondo).
