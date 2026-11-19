// Encabezado único de todos los exports (PDF/impresión) del panel (18/11/2026), tomado de la «Hoja de datos»:
// título en Roboto Black 18 px, una o dos líneas grises de 10.5 px debajo, logo a la derecha (logo-export.png, con margen para que no se
// corte) y línea gruesa de tinta debajo. Todo export arma su encabezado con `cabeceraExport` y pega `CSS_CABECERA` en sus estilos.
// `titulo` y `lineas` van ya escapados (HTML); `logo` es la ruta de `css/logo-export.png` relativa a la página que imprime.

export const CSS_CABECERA = `
.lf-cab { display: flex !important; flex-direction: row-reverse; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #1b2430; padding: 0 0 10px !important; margin: 0 0 8px !important; font-family: Roboto, Arial, sans-serif; color: #1b2430; }
.lf-cab img { height: 42px !important; width: auto !important; display: block; flex: none; margin: 0 !important; }
.lf-cab h1 { margin: 0 0 3px !important; padding: 0 !important; font-size: 18px !important; line-height: 1.15 !important; font-weight: 900 !important; text-align: left !important; letter-spacing: 0 !important; text-transform: none !important; color: #1b2430 !important; }
.lf-cab p { margin: 0 !important; padding: 0 !important; color: #5f6670 !important; font-size: 10.5px !important; line-height: 1.35 !important; text-align: left !important; font-weight: 400 !important; }`;

export const cabeceraExport = (titulo, lineas, logo) =>
    `<div class="lf-cab"><img src="${logo}" alt="La Fábrica de Chocolate"><div><h1>${titulo}</h1>${(lineas || []).filter(Boolean).map(l => `<p>${l}</p>`).join('')}</div></div>`;

// Nombre de archivo único de todo export (el que sugiere el navegador al guardar como PDF), 18/11/2026:
//   «Documento · Local N · Nombre · AAAA-MM-DD»   (sin los caracteres que Windows no admite)
// `partes` = lo que va antes de la fecha (se omiten las vacías); `fecha` = la del documento (por defecto, hoy).
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const nombreArchivo = (partes, fecha = hoyISO()) => [...partes, fecha]
    .filter(x => x !== undefined && x !== null && String(x).trim() !== '')
    .map(x => String(x).trim()).join(' · ').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');

// ── Cuerpo único de los exports (18/11/2026), tomado de la «Hoja de datos» ───────────────────────────────
// Todo export pega `cssDoc('<selector de su hoja>')` en sus estilos y usa estas piezas; sus reglas propias van después
// (solo para lo que sea exclusivo de ese documento: cajas, fichas, gráficas…). Colores en hex porque van a impresión.
//   h2 = título de sección (tinta, mayúsculas, línea gris) · th/td = tabla (encabezado gris en mayúsculas con línea de tinta)
//   .n = cifra a la derecha · tr.tot / tfoot = renglón de total · .gris · .nota · .pie · .firmas (dos firmas) · .firma (una)
//   .res = tarjetas de resumen (<div class="res"><div><span>Etiqueta</span><b>$0.00</b><small>detalle</small></div>…</div>)
export const DOC = { tinta: '#1b2430', gris: '#5f6670', tenue: '#9aa1aa', linea: '#e6e9ee', lineaMedia: '#dfe3e8', borde: '#8a929c', fondo: '#f2f4f7', exito: '#2e7d32', peligro: '#b3261e' };
export const MARGEN_VERTICAL = '14mm', MARGEN_HORIZONTAL = '10mm 12mm';   // márgenes de página de todo export (carta)
export const cssDoc = s => `
${s} { font: 10.5px/1.4 Roboto, Arial, sans-serif; color: #1b2430; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${s} h2 { font-size: 11px; line-height: 1.3; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #1b2430; margin: 14px 0 6px; padding: 0 0 3px; border-bottom: 1px solid #dfe3e8; break-after: avoid; page-break-after: avoid; }
${s} table { width: 100%; border-collapse: collapse; }
${s} thead { display: table-header-group; }
${s} th { text-align: left; vertical-align: bottom; font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #5f6670; background: none; border-bottom: 1px solid #1b2430; padding: 4px 6px; }
${s} td { padding: 4px 6px; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
${s} tr { break-inside: avoid; page-break-inside: avoid; }
${s} .n, ${s} th.n, ${s} td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
${s} tr.tot td, ${s} tfoot td { font-weight: 700; background: #f2f4f7; border-top: 1px solid #1b2430; border-bottom: 1px solid #1b2430; }
${s} .gris { color: #5f6670; }
${s} .nota { font-size: 9.5px; color: #5f6670; margin: 6px 0; }
${s} .pie { margin-top: 14px; font-size: 9px; color: #5f6670; }
${s} .firmas { display: flex; gap: 40px; margin-top: 64px; text-align: center; font-size: 10px; break-inside: avoid; }
${s} .firmas > div { flex: 1; border-top: 1px solid #1b2430; padding-top: 4px; }
${s} .res { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 6px 0 10px; }
${s} .res > div { border: 1px solid #dfe3e8; border-radius: 6px; padding: 6px 8px; }
${s} .res span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #5f6670; }
${s} .res b { display: block; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
${s} .res small { display: block; font-size: 8.5px; color: #5f6670; }
${s} .firma { width: 50%; margin: 64px auto 0; border-top: 1px solid #1b2430; padding-top: 4px; text-align: center; font-size: 10px; break-inside: avoid; }`;
