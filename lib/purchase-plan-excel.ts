import type { PurchasePlanItem } from "@/app/products";

// Filas del Excel de pedido a proveedor, con las mismas columnas (y en el mismo orden)
// que la planilla "ExportdelPedido.xlsx" que se importa en Compras:
// A=Imagen, B=#Pedida, C=Cod., D=P.U. (sin IVA), E=Imp. (IVA unitario), F=Total, G=Descripción.
// Así el mismo archivo se puede volver a importar cuando llega la mercadería.
export const PLAN_EXCEL_HEADERS = ["Imagen", "#Pedida", "Cod.", "P.U.", "Imp.", "Total", "Descripción", "Tipo"];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildPurchasePlanRows(items: PurchasePlanItem[], origin = "") {
  const rows: Record<string, string | number>[] = items.map((i) => {
    const pu = round2(i.costoSinIva || 0);
    const imp = round2(pu * 0.21);
    const image = i.image && i.image.startsWith("/") ? `${origin}${i.image}` : i.image || "";
    return {
      Imagen: image,
      "#Pedida": i.quantity,
      "Cod.": i.productSku,
      "P.U.": pu,
      "Imp.": imp,
      Total: round2((pu + imp) * i.quantity),
      Descripción: i.productTitle,
      Tipo: i.tipo || "",
    };
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const total = rows.reduce((s, r) => s + Number(r.Total), 0);
  // Fila de totales sin código: el importador la ignora
  rows.push({
    Imagen: "",
    "#Pedida": totalUnits,
    "Cod.": "",
    "P.U.": "",
    "Imp.": "",
    Total: round2(total),
    Descripción: "TOTAL",
    Tipo: "",
  });
  return rows;
}
