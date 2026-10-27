# Changelog — Pecados Serranos

> Historial de cambios, el más nuevo arriba. Se agrega una entrada con cada cambio publicado.
> Formato: fecha · commit · qué cambió (para el dueño de la tienda, sin tecnicismos de más).

## 2026-10-27
- `4e3fb25` **Productos:** al editar un artículo y cambiarle el código ya no se duplica. Se actualiza el mismo artículo y su foto pasa al código nuevo.
  - Si el código nuevo ya lo usa otro producto activo, el panel avisa y no guarda.
  - Se puede reutilizar el código de un producto dado de baja.
  - En producción, los duplicados que se habían generado ya estaban dados de baja; no hubo que limpiar nada.

## 2026-10-26
- Documentación permanente del proyecto: `CONTEXTO.md`, `ESTADO.md`, `CHANGELOG.md` y `CLAUDE.md` en la raíz del repositorio.

## 2026-10-25
- **Datos de producción:** se restauró la parte operativa al punto de restauración de las 00:26 (fin de las pruebas). Se borraron los 2 registros manuales de caja de prueba. Antes se guardó una copia del estado con las pruebas.
- `877acbf` **Flujo de caja:** registros manuales (Debe/Haber, categoría, descripción, monto) que suman al balance de sumas y saldos. Se pueden borrar desde los movimientos.
- `f430b3e` **Revendedores:**
  - Ventas agrupadas por compra.
  - El resumen de comisiones se movió desde Flujo de caja.
  - Pago de comisiones con fecha, a cargo del admin.
  - La asociada ve "Mis comisiones" (adeudadas, cobradas y descontadas al rendir).
- `44c93b4` **Revendedores:** el alta se hace en un solo paso y la valida el servidor. Ya no se duplican si un dato está mal. No permite nombres, códigos ni usuarios repetidos.
- `8300faf` **Revendedores:** una solapa por revendedora con su ficha a todo el ancho. Los lotes se filtran por la revendedora activa.
- `404782c` **Flujo de caja:** montos con 2 decimales, la venta aparece antes de su comisión y las notas de las compras quedan como detalle desplegable.
- `0f68ec7` **Flujo de caja:** balance de sumas y saldos y planilla de movimientos con búsqueda, Excel e impresión.

## 2026-10-24
- `f172242` **Admin:** la pestaña "Flujo de caja" pasa a llamarse "Flujo de stock". Nueva pestaña "Flujo de caja" con inversión, venta proyectada, facturación y comisiones.
- `90c5697` **WhatsApp:** los links con mensaje usan api.whatsapp.com, porque wa.me rompía los emojis.
- `ce3f28a` **Pedidos y accesos:**
  - Código de pedido único (2 letras + 4 números) en cada compra.
  - Se sacaron de la tienda los botones Admin y Asociado: ahora se entra por /admin y /asociado.
  - Se quitó el cartel "Tienda Oficial".
- `8aea794` **Mercado Pago:** reintentar el pago ya no acumula órdenes, y el admin solo ve los pagos reales en curso.
- `759e638` **Deploy:** Caddy se reinicia cuando cambia su configuración.
- `e8aaae0` **Carrito y respaldos:**
  - Método de pago (Mercado Pago o efectivo en mano).
  - El stock solo se descuenta al cobrar.
  - Compras pendientes de cobro en el admin.
  - Backup completo comprimido y restauración desde Ajustes.
- `e20a2dc` **Carrito:** nombre y dirección obligatorios. "Finalizar compra" con Mercado Pago (Checkout Pro), configurable desde el admin.
- `845d09d` **Asociado y admin:**
  - Asociado: "Pago a tienda" con filtros por período, y puede editar o anular sus ventas.
  - Admin: ventas rendidas y anulación real con devolución de stock.
- `4bf8e65` **Revendedoras:**
  - Artículos vendidos (en mano, del depósito o con su código).
  - Se puede definir la comisión pendiente.
  - Muestra el monto a pagar a la tienda.

## 2026-10-23
- **Datos de producción:** backup completo antes de las pruebas y restauración posterior (punto `pecados_ANTES_PRUEBAS_20261023_1732`).

## 2026-10-22
- `ba148ac`, `b838477`, `0f8693c`, `d8179a3` **Aviso +18:** animado, con el texto del dueño. En escritorio va en dos columnas y en el celular es compacto, sin scroll.
- `1bc9cb7` **Precios y servidor:** multiplicador de ganancia libre. La imagen de Docker es más liviana y se limpia sola (disco del servidor del 80% al 39%).
- `ed99430`, `8340283` **Comisiones:** monto fijo por artículo, definido al entregar la mercadería.
- `0a3e663` **Lotes:** botón "Devolver" en los lotes de mercadería.
- `e1739a3` **Asociado:** ve la mercadería que se le entregó y puede venderla.
- `685eca8` **Asociado:** perfil para revendedoras y código de revendedora en el carrito.

## 2026-10-21
- `a1a883c` **Precios y fotos:** en efectivo se cobra el Precio Público FT; lupa en las fotos.
- `a0a71be`, `7c6e53b` **Venta manual:** modal rediseñado y Tarjeta de Crédito como medio de pago.
- `5f60f66` **Compras:** las importadas se registran con el costo de la factura.
- `04e8084`, `fcef07b` **Diseño:** carrito y panel responsive; se quitó el logo del encabezado.
- `c07a765`, `7aac9ee` **Fotos y búsqueda:**
  - Fotos de productos guardadas en la base.
  - Columnas centradas.
  - Búsqueda por cualquier valor.
- `8b63cb0` **Flujo de caja (hoy "Flujo de stock"):** fórmulas de la planilla VShop.
- `d4a2273`, `4aece98`, `db68fe3` **Carrito e interesados:**
  - Aviso al agregar al carrito.
  - "Me interesa" con confirmación.
  - Pedido a proveedor con Excel.
- `8b5decd` **HTTPS:** con Caddy y certificado automático.
- `3c9195d` **Seguridad:** endurecimiento general y arreglo del borrado de productos.
- `5df109f` **Inicio:** versión inicial publicada con docker compose.
