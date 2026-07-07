export type SheetCell = string | number | null;
export interface SheetSpec {
  name: string;
  rows: SheetCell[][];
}

/**
 * Genera y descarga un .xlsx con una o más hojas. `exceljs` se importa de forma
 * dinámica: sólo se baja el chunk cuando el usuario exporta, no en la carga
 * inicial de la app.
 */
export async function downloadWorkbook(filename: string, sheets: SheetSpec[]) {
  // exceljs se resuelve al bundle de navegador (campo "browser" → UMD). El
  // interop UMD↔ESM puede dejar `Workbook` en el namespace o bajo `.default`,
  // así que lo buscamos en ambos para no romper en runtime.
  const mod = (await import("exceljs")) as unknown as {
    Workbook?: new () => import("exceljs").Workbook;
    default?: { Workbook?: new () => import("exceljs").Workbook };
  };
  const Workbook = mod.Workbook ?? mod.default?.Workbook;
  if (!Workbook) throw new Error("No se pudo cargar exceljs (Workbook ausente)");
  const wb = new Workbook();
  for (const sheet of sheets) {
    // Excel limita el nombre de hoja a 31 chars y prohíbe : \ / ? * [ ]
    const ws = wb.addWorksheet(sheet.name.slice(0, 31).replace(/[:\\/?*[\]]/g, " "));
    for (const row of sheet.rows) {
      ws.addRow(row.map((c) => (c == null ? "" : c)));
    }
    // Ancho automático aproximado por columna (según el contenido más largo).
    const widths: number[] = [];
    for (const row of sheet.rows) {
      row.forEach((c, i) => {
        const len = c == null ? 0 : String(c).length;
        widths[i] = Math.max(widths[i] ?? 10, Math.min(len + 2, 48));
      });
    }
    ws.columns.forEach((col, i) => {
      col.width = widths[i] ?? 12;
    });
    if (ws.getRow(1)) ws.getRow(1).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
