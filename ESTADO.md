# Estado actual — Pecados Serranos

> Foto del sistema **hoy**. Se actualiza después de cada cambio.
> ⚠️ Repo público: sin contraseñas, tokens ni datos personales.

**Última actualización:** 2026-11-02
**Versión en producción:** commit `f55eea6` (importación de Excel con la planilla de costos). En producción coincide con GitHub (`master`).

## Funciona en producción

- **Tienda:**
  - Catálogo con filtros y buscador, lupa en las fotos y aviso +18.
  - "Me interesa" para productos sin stock.
  - Carrito con datos obligatorios, código de revendedora y método de pago (Mercado Pago o efectivo en mano).
  - Código de pedido en cada compra.
- **Admin (`/admin`), pestañas:**
  - **Catálogo.**
  - **Flujo de stock:** fórmulas VShop, edición en línea y Excel.
  - **Flujo de caja:** inversión, venta proyectada, facturación, balance de sumas y saldos, movimientos, registros manuales, Excel e impresión.
  - **Stock.**
  - **Interesados / Pedido a proveedor:** con Excel en formato del proveedor.
  - **Compras / Proveedores.**
  - **Ventas:**
    - Compras pendientes de cobro, con confirmar, revisar y rechazar.
    - Buscador por código de pedido.
    - Rendida / a cobrarle.
    - Exportación CSV.
  - **Revendedores:**
    - Resumen de comisiones con filtro de fechas.
    - Una solapa por revendedora, con su ficha a todo el ancho.
    - Ventas agrupadas por compra.
    - Comisiones adeudadas, pagadas y descontadas, con registro de pago y fecha.
    - Lotes filtrados por la revendedora activa.
  - **Respaldos:**
    - WhatsApp de la tienda.
    - Mercado Pago (Access Token verificado, activar/pausar).
    - Backup completo `.psbak` con descarga y restauración con advertencias.
- **Asociado (`/asociado`):**
  - Mis ventas: filtros por período, "Pago a tienda", editar/anular y "Mis comisiones".
  - Mi mercadería: lo que tiene en mano y cuánto le paga a la tienda por unidad.
  - Registrar venta.
- **Mercado Pago:** Checkout Pro configurado con la cuenta del dueño. Los avisos (webhook) se configuran solos en cada pago.

## Datos en producción (al crear el punto de restauración, 2026-10-27 00:10)

| Dato | Cantidad |
|---|---|
| Productos activos | 57 |
| Unidades en stock | 86 |
| Ventas concretadas | 0 |
| Compras pendientes de cobro | 0 |
| Pedidos anulados (pruebas viejas) | 16 |
| Revendedoras activas | 1 |
| Lotes entregados | 1 |
| Compras a proveedores | 2 |
| Interesados | 1 |
| Fotos | 57 |
| Registros manuales de caja | 3 |

## Punto de restauración vigente ("restaurá")

- **Archivo:** `/root/backups-manuales/pecados_OPERATIVO_20261027_0010.sql.gz` (8,8 MB), con los datos de la tabla de arriba.
- **Qué incluye:** solo lo operativo: productos, fotos, ventas, revendedoras, lotes, compras, interesados, pedido a proveedor y registros manuales de caja.
- **Qué no incluye:** la configuración del sitio (WhatsApp y Mercado Pago), que queda como esté.
- **Antes de restaurar:** si se cargaron datos reales después de este punto, se avisa al dueño y se confirma.
- **Puntos anteriores (se conservan):**
  - `pecados_OPERATIVO_20261025_0026.sql.gz`: 39 productos.
  - `pecados_ANTES_PRUEBAS_20261023_1732.sql.gz`: completo.
  - Estados de pruebas: `pecados_ESTADO_PRUEBAS_*`.

## Pendientes y avisos

- [ ] **Datos posteriores al punto de restauración:** el punto vigente es del 27/10. Después se importó "Marzin.xlsb" (4 productos nuevos y la compra) y se repararon nombres. Hoy hay 59 productos activos y 86 unidades. Si se restaura, eso se pierde: conviene crear un punto nuevo.
- [ ] **CON IVA de la planilla:** en algunos artículos el CON IVA de "Marzin.xlsb" no es exactamente SIN IVA × 1,21 (ej. FR510: $6.699,87 contra $6.582,40). En la compra se registra el de la planilla; en Flujo de stock se calcula con el 21%.

- [ ] **Precio a revisar:** el producto SS-SA-1342 tiene Precio Público FT 112,2 (¿112.200?).
- [ ] **IVA:** los artículos "SS-" vienen con IVA 10,5% en las facturas del proveedor; la app usa 21%.
- [ ] **Diferencia de compras:** hay $10.491,97 de diferencia entre "TOTAL PAGADO" de VShop y el total de las facturas.
- [ ] **Comisión sin definir:** el lote entregado a la revendedora no tiene comisión por unidad definida.
- [ ] **Seguridad recomendada:**
  - Cambiar la contraseña root del servidor.
  - Usar claves SSH + fail2ban.
  - Volver el repo de GitHub a **privado** (hoy es público), con una deploy key para el servidor.
- [ ] **Pago real con Mercado Pago:** hacer una compra chica de prueba para verificar todo el circuito.
