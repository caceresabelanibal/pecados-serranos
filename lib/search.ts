// Búsqueda por "cualquier valor" de una fila: textos y números (con o sin formato).
// Ej: "19175", "19.175", "$23.201,75", "x1.7", "vibradores" o varias palabras a la vez.

function numberForms(n: number): string[] {
  if (!Number.isFinite(n)) return [];
  const rounded = Math.round(n * 100) / 100;
  return [
    String(rounded),
    String(rounded).replace(".", ","),
    rounded.toLocaleString("es-AR", { maximumFractionDigits: 2 }),
    rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    `x${rounded}`,
  ];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\$/g, "")
    .trim();

export function buildSearchText(values: (string | number | null | undefined)[]): string {
  const parts: string[] = [];
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number") parts.push(...numberForms(v));
    else parts.push(v);
  }
  return normalize(parts.join(" | "));
}

// Todas las palabras de la búsqueda deben aparecer en algún valor de la fila
export function matchesSearch(searchText: string, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return terms.every((t) => searchText.includes(t));
}
