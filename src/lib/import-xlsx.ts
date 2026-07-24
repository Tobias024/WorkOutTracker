export type SheetRows = (string | number | null)[][];

function cellText(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.result === "string" || typeof o.result === "number")
      return o.result as string | number;
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
  }
  return String(v);
}

/**
 * Lee un .xlsx en el navegador y devuelve, por hoja, sus filas como celdas
 * posicionales (columna 1..N). Espeja el import dinámico + guard UMD de
 * `downloadWorkbook` en export-xlsx.ts.
 */
export async function readWorkbook(
  file: File,
): Promise<Record<string, SheetRows>> {
  const mod = (await import("exceljs")) as unknown as {
    Workbook?: new () => import("exceljs").Workbook;
    default?: { Workbook?: new () => import("exceljs").Workbook };
  };
  const Workbook = mod.Workbook ?? mod.default?.Workbook;
  if (!Workbook) throw new Error("No se pudo cargar exceljs (Workbook ausente)");
  const wb = new Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const out: Record<string, SheetRows> = {};
  wb.eachSheet((ws) => {
    const cols = ws.columnCount;
    const rows: SheetRows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: (string | number | null)[] = [];
      for (let c = 1; c <= cols; c++) cells.push(cellText(row.getCell(c).value));
      rows.push(cells);
    });
    out[ws.name] = rows;
  });
  return out;
}
