// Facturación mensual a locatarios: cálculo y utilidades compartidas
import { db } from './auth.js?v=20261005-5';
import {
  collection, getDocs, getDoc, doc, query, where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const IVA = 0.16;
export const BASURA_DEFAULT = { subtotal: 158.28, iva: 25.32, total: 183.60 };
// Valores por defecto de facturacion_config/general; se cambian en Configuración
export const MORATORIOS_DEFAULT = 0.05;   // sobre la renta sin IVA
export const DIA_LIMITE_DEFAULT = 10;     // pagos después de este día son tarde

export const ESTADOS = {
  pendiente:   { txt: 'Pendiente',       clase: 'e-pendiente' },
  en_proceso:  { txt: 'En proceso',      clase: 'e-proceso' },
  pagado:      { txt: 'Pagado a tiempo', clase: 'e-pagado' },
  pago_tarde:  { txt: 'Pagado tarde',    clase: 'e-tarde' }
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mesTxt = m => { if (!m) return '-'; const [y, mm] = m.split('-'); return `${MESES[+mm - 1]} ${y}`; };
export const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const mesMas = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const dinero = n => typeof n === 'number' ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export const facturaId = (contratoId, mes) => `${contratoId}_${mes}`;

// Concepto a partir de un subtotal (IVA 16%)
export function conceptoDesdeSubtotal(concepto, subtotal, extra = {}) {
  const s = r2(subtotal || 0);
  return { concepto, subtotal: s, iva: r2(s * IVA), total: r2(s * (1 + IVA)), ...extra };
}
// Concepto a partir de un total que ya incluye IVA (el agua se cobra así)
export function conceptoDesdeTotal(concepto, total, extra = {}) {
  const t = r2(total || 0);
  const s = r2(t / (1 + IVA));
  return { concepto, subtotal: s, iva: r2(t - s), total: t, ...extra };
}

export function totales(conceptos) {
  const sum = k => r2(conceptos.reduce((a, c) => a + (Number(c[k]) || 0), 0));
  return { subtotal: sum('subtotal'), iva: sum('iva'), total: sum('total') };
}

export async function cargarConfigGeneral() {
  const s = await getDoc(doc(db, 'facturacion_config', 'general'));
  return { basura: BASURA_DEFAULT, moratoriosPct: MORATORIOS_DEFAULT, diaLimitePago: DIA_LIMITE_DEFAULT, ...(s.exists() ? s.data() : {}) };
}

export async function cargarLecturas() {
  const s = await getDocs(collection(db, 'agua_lecturas'));
  return s.docs.map(d => d.data());
}

export async function cargarFacturasMes(mes) {
  const s = await getDocs(query(collection(db, 'facturas'), where('mes', '==', mes)));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function cargarFacturasContrato(contratoId) {
  const s = await getDocs(query(collection(db, 'facturas'), where('contratoId', '==', contratoId)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.mes.localeCompare(a.mes));
}

// Última lectura con importe de un tubo hasta el último día de un mes (incluye las tomadas en ese mes)
// El agua que se factura en un mes es la del MES ANTERIOR (ej. factura de octubre → lectura de septiembre).
// Se toma la última lectura capturada antes del día 1 del mes de la factura.
function ultimaLecturaHasta(lecturas, tubo, mes) {
  const limite = `${mes}-01`;
  return lecturas
    .filter(l => l.tubo === tubo && l.fecha < limite && typeof l.importe === 'number')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
}
const idLectura = l => `${l.tubo}_${l.fecha}`;

export async function cargarTodasLasFacturas() {
  const s = await getDocs(collection(db, 'facturas'));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Lecturas de agua que este contrato ya pagó en OTRAS facturas (para no cobrarlas dos veces).
 * - Facturas del panel: guardan los ids de las lecturas que usaron.
 * - Facturas importadas del Sheet: usaban la última lectura ANTERIOR a su mes.
 * Solo se revisan facturas del mismo contrato (el tubo 21 se comparte entre dos contratos).
 */
export function lecturasFacturadas(facturas, contrato, lecturas, excluirId = null) {
  const usadas = new Set();
  const tubos = ((contrato || {}).facturacion || {}).tubos || [];
  facturas.forEach(f => {
    if (f.id === excluirId || f.contratoId !== contrato.id) return;
    const agua = (f.conceptos || []).find(c => c.tipo === 'agua' || /AGUA/.test(c.concepto));
    if (!agua || !(Number(agua.total) > 0)) return;
    if (Array.isArray(agua.lecturaIds)) { agua.lecturaIds.forEach(id => usadas.add(id)); return; }
    if (f.origen === 'sheets') {
      // Se identifica la lectura cuyo importe coincide con el agua cobrada en el Sheet
      tubos.forEach(({ tubo, proporcion = 1 }) => {
        const l = lecturas
          .filter(x => x.tubo === tubo && x.fecha < `${f.mes}-01` && typeof x.importe === 'number' && Math.abs(x.importe * proporcion - agua.total) <= 0.05)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        if (l) usadas.add(idLectura(l));
      });
    }
  });
  return usadas;
}

/** Concepto de agua de un contrato para un mes, con las lecturas capturadas en el panel */
export function conceptoAgua(contrato, mes, lecturas, facturadas = new Set()) {
  const tubos = ((contrato || {}).facturacion || {}).tubos || [];
  if (!tubos.length) return { concepto: null, avisos: [] };
  const avisos = [];
  let total = 0; const fechas = []; const ids = []; let periodo = null;
  tubos.forEach(({ tubo, proporcion = 1 }) => {
    const l = ultimaLecturaHasta(lecturas, tubo, mes);
    if (!l) { avisos.push(`Sin lecturas de agua del tubo ${tubo} antes de ${mesTxt(mes)}.`); return; }
    if (facturadas.has(idLectura(l))) {
      avisos.push(`Tubo ${tubo}: no hay lectura nueva; la última (${l.fecha}) ya se cobró. Captura la lectura en Lecturas de Agua y recalcula.`);
      return;
    }
    if (l.fecha.slice(0, 7) !== mesMas(mes, -1)) avisos.push(`Tubo ${tubo}: no hay lectura de ${mesTxt(mesMas(mes, -1))}; se usó la del ${l.fecha}.`);
    if (typeof l.consumo === 'number' && l.consumo < 0) avisos.push(`Tubo ${tubo}: la lectura del ${l.fecha} tiene consumo negativo (${l.consumo} m³).`);
    total += l.importe * proporcion;
    ids.push(idLectura(l));
    if (!periodo || l.fecha.slice(0, 7) > periodo) periodo = l.fecha.slice(0, 7);
    fechas.push(`tubo ${tubo}: lectura del ${l.fecha}${typeof l.consumo === 'number' ? `, ${l.consumo} m³` : ''}${proporcion !== 1 ? ` (${Math.round(proporcion * 100)}%)` : ''}`);
  });
  return {
    concepto: conceptoDesdeTotal('SUMINISTRO DE AGUA', total, { tipo: 'agua', periodo: periodo || mes, lecturas: fechas.join(' · '), lecturaIds: ids }),
    avisos
  };
}

/** Reemplaza el agua de una factura existente con las lecturas actuales (conserva lo demás) */
export function actualizarAguaEnFactura(factura, contrato, lecturas, facturadas) {
  const { concepto, avisos } = conceptoAgua(contrato, factura.mes, lecturas, facturadas);
  const conceptos = (factura.conceptos || [])
    .filter(c => !(c.tipo === 'agua' || /AGUA/.test(c.concepto)))
    // La recolección de basura corresponde al mismo mes de la factura
    .map(c => (c.tipo === 'basura' || /BASURA/.test(c.concepto)) ? { ...c, periodo: factura.mes } : c);
  if (concepto) conceptos.push(concepto);
  const otrosAvisos = (factura.avisos || []).filter(a => !/^Tubo |^Sin lecturas de agua/.test(a));
  return { conceptos, ...totales(conceptos), avisos: [...otrosAvisos, ...avisos] };
}

/**
 * Genera (prellena) la factura de un contrato para un mes.
 * Renta: del contrato. Agua: de las lecturas. Basura: monto fijo. Moratorios: 0.
 */
export function generarFactura(contrato, mes, lecturas, general, facturadas = new Set()) {
  const cfg = contrato.facturacion || {};
  const conceptos = [];
  const avisos = [];
  if (contratoVencidoEn(contrato, mes)) avisos.push(`El contrato venció el ${contrato.fin}: revisa si ya se renovó.`);

  // Renta: si el contrato tiene "con IVA", se respeta tal cual (como en el Sheet)
  const renta = Number(contrato.total) || 0;
  const rentaIva = typeof contrato.totalIva === 'number' ? contrato.totalIva : r2(renta * (1 + IVA));
  conceptos.push({ concepto: cfg.conceptoRenta || 'RENTA', subtotal: r2(renta), iva: r2(rentaIva - renta), total: r2(rentaIva), tipo: 'renta' });
  conceptos.push({ concepto: 'EXTRAORDINARIO', subtotal: 0, iva: 0, total: 0, tipo: 'extraordinario', descripcion: '' });
  conceptos.push({ concepto: 'INTERESES MORATORIOS', subtotal: 0, iva: 0, total: 0, tipo: 'moratorios' });

  if (cfg.basura) {
    const b = general.basura || BASURA_DEFAULT;
    conceptos.push({ concepto: 'RECOLECCIÓN DE BASURA', subtotal: b.subtotal, iva: b.iva, total: b.total, tipo: 'basura', periodo: mes });
  }

  const agua = conceptoAgua(contrato, mes, lecturas, facturadas);
  if (agua.concepto) conceptos.push(agua.concepto);
  avisos.push(...agua.avisos);

  return {
    contratoId: contrato.id,
    mes,
    razonSocial: cfg.razonSocialFactura || contrato.razonSocial,
    locales: contrato.locales || [],
    rfc: contrato.rfc || null,
    correos: cfg.correos || [],
    metodoPago: cfg.metodoPago || 'PUE',
    moratoriosPct: 0,
    conceptos,
    ...totales(conceptos),
    estadoPago: 'pendiente',
    fechaPago: null,
    notas: '',
    avisos,
    origen: 'panel'
  };
}

// Contratos que se facturan: todos los que tienen datos de facturación
// (un contrato vencido se sigue facturando mientras el locatario ocupe el local; se avisa)
export function contratosFacturables(contratos) {
  return contratos.filter(c => c.facturacion && c.facturacion.activo !== false);
}
export const contratoVencidoEn = (c, mes) => !!(c.fin && c.fin < `${mes}-01`);

// ================= HOJA PARA CONTADORES (PDF) =================
// Página 1: resumen del mes (una fila por factura).
// Después: una ficha por factura, solo con los conceptos que llevan monto.
const fechaDMY = f => (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) ? f.split('-').reverse().join('/') : (f || '');
const mesCap = m => { const t = mesTxt(m); return t === '-' ? '' : t.charAt(0).toUpperCase() + t.slice(1); };
const tipoDe = (c, i) => c.tipo || (i === 0 ? 'renta'
  : /EXTRAORDINARIO/.test(c.concepto) ? 'extraordinario'
  : /MORATORIO/.test(c.concepto) ? 'moratorios'
  : /BASURA/.test(c.concepto) ? 'basura'
  : /AGUA/.test(c.concepto) ? 'agua' : 'otro');

/** Deja cada concepto a centavos exactos para que renglones, resumen y totales siempre cuadren.
 *  Agua: el monto capturado es el TOTAL con IVA → subtotal = total ÷ 1.16.
 *  Lo demás: el monto base es el SUBTOTAL → IVA = subtotal × 16 % (o 0 si el concepto no lleva IVA). */
export function normalizarConceptos(conceptos = []) {
  return conceptos.map((c, i) => {
    const tipo = tipoDe(c, i);
    if (tipo === 'agua') {
      const t = r2(Number(c.total) || 0), sub = r2(t / (1 + IVA));
      return { ...c, subtotal: sub, iva: r2(t - sub), total: t };
    }
    const sub = r2(Number(c.subtotal) || 0);
    const sinIva = Number(c.iva) === 0 && Math.abs((Number(c.total) || 0) - sub) < 0.005 && sub !== 0;
    const iva = sinIva ? 0 : r2(sub * IVA);
    return { ...c, subtotal: sub, iva, total: r2(sub + iva) };
  });
}
/** Totales de una factura: siempre la suma de sus conceptos normalizados (mismo número en pantalla, resumen y detalle) */
export function totalesFactura(f) {
  return totales(normalizarConceptos(f.conceptos || []));
}
// Fin del periodo de renta vigente = día anterior al próximo incremento
function finPeriodoRenta(contrato = {}) {
  if (!contrato.incremento) return contrato.fin || '';
  const d = new Date(contrato.incremento + 'T12:00:00'); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
const correosDe = f => ['facturas@fabrica.la', ...(f.correos || []).filter(c => c.toLowerCase() !== 'facturas@fabrica.la')];
const localesDe = (f, c = {}) => (f.locales && f.locales.length ? f.locales : c.locales || []).join(', ');

export const ESTILO_HOJA = `
  .hc { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10.5px; line-height: 1.4; }
  .hc h1 { font-size: 17px; margin: 0; line-height: 1.2; }
  .hc .enc { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 12px; }
  .hc .enc .der { text-align: right; font-size: 9.5px; color: #555; }
  .hc h2 { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; margin: 14px 0 6px; color: #555; }
  .hc table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .hc th, .hc td { font-size: 10.5px; line-height: 1.4; }
  .hc th { background: #111; color: #fff; font-weight: 600; text-align: left; padding: 5px 7px; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
  .hc td { padding: 5px 7px; border-bottom: 1px solid #e2e2e2; vertical-align: top; }
  .hc tr:nth-child(even) td { background: #f7f7f7; }
  .hc table.fija { table-layout: fixed; }
  .hc .n, .hc th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .hc .mon { display: flex; justify-content: space-between; gap: 4px; font-variant-numeric: tabular-nums; }
  .hc .mon strong { display: contents; }
  .hc .guion { color: #999; }
  .hc td { overflow: hidden; text-overflow: ellipsis; }
  .hc td.loc { white-space: nowrap; color: #333; }
  .hc .tot td { background: #ececec !important; font-weight: 700; border-top: 2px solid #111; border-bottom: 2px solid #111; font-size: 11px; }
  .hc .falta { color: #c00; font-weight: 700; }
  .hc .peq, .hc td.peq { color: #666; font-size: 9.5px; }
  .hc .ficha { page-break-inside: avoid; break-inside: avoid; border: 2px solid #333; border-radius: 5px; margin: 0 0 14px; overflow: hidden; }
  .hc .ficha-cab { display: grid; grid-template-columns: 2.4fr 1.1fr 1.1fr 0.8fr; border-bottom: 1px solid #bbb; }
  /* En las fichas, las líneas de TOTAL A FACTURAR son más ligeras que en el resumen */
  .hc .ficha .tot td { border-top: 1px solid #888; border-bottom: 1px solid #888; background: #f4f4f4 !important; }
  /* Páginas de fichas: se reparten a lo alto de la hoja carta horizontal */
  .hc .pag-fichas { display: flex; flex-direction: column; justify-content: space-between; }
  .hc .pag-fichas.ultima { justify-content: flex-start; gap: 9mm; }
  .hc .pag-fichas .ficha { margin: 0; }
  .hc .pag-fichas:not(.fin) { break-after: page; page-break-after: always; }
  .hc .ficha-cab div { padding: 6px 9px; border-right: 1px solid #e2e2e2; }
  .hc .ficha-cab div:last-child { border-right: none; }
  .hc .k { display: block; font-size: 7.5px; color: #777; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
  .hc .v { font-size: 12px; font-weight: 700; }
  .hc .ficha table th { background: #f0f0f0; color: #333; }
  .hc .ficha table td { background: #fff !important; }
  .hc .ficha-pie { display: grid; grid-template-columns: 1.4fr 1fr; border-top: 1px solid #bbb; font-size: 10px; }
  .hc .ficha-pie div { padding: 6px 9px; }
  .hc .salto { page-break-before: always; break-before: page; }
  .hc .redact { color: #111 !important; letter-spacing: -1px; white-space: nowrap; overflow: hidden; display: inline-block; max-width: 100%; vertical-align: bottom; }
`;

export function encabezadoHoja(mes, subtitulo = '') {
  return `<div class="enc"><div><h1>Facturación ${mesCap(mes)}</h1>
    <div class="peq">Emisor: LAFABDECHOC S DE RL DE CV · Solicitud de emisión de CFDI</div></div>
    <div class="der">${esc(subtitulo)}<br>Generado el ${fechaDMY(hoyISO())}</div></div>`;
}


// Celda tachada (redacted): factura apagada en la lista; no muestra el monto
// Se usan bloques "█" (no el texto real): aunque la impresión quite los fondos, nada se puede leer
const tapar = (txt, max = 60) => `<span class="redact">${'█'.repeat(Math.max(4, Math.min(max, String(txt || '').length || 8)))}</span>`;
const tdTachado = () => `<td class="n">${tapar('00,000.00')}</td>`;
const mtdR = (red, ...a) => red ? tdTachado() : mtd(...a);

// Celda de dinero alineada tipo contable: "$" a la izquierda, cifra a la derecha; 0 → "–" si se pide
function mtd(n, fuerte = false, guionSiCero = false) {
  if (guionSiCero && !Number(n)) return '<td class="n"><span class="guion">–</span></td>';
  const v = Number(n) || 0;
  const cifra = Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ini = fuerte ? '<strong>' : '', fin = fuerte ? '</strong>' : '';
  return `<td class="n"><span class="mon">${ini}<span>${v < 0 ? '-$' : '$'}</span><span>${cifra}</span>${fin}</span></td>`;
}

/** Resumen del mes: una fila por factura.
 *  Columnas: Renta · Moratorios · Agua · Basura. "Otros" (extraordinarios u otros conceptos)
 *  solo aparece si alguna factura del resumen los tiene, para que las columnas sigan sumando el subtotal. */
export function resumenHTML(facturas, contratosPorId = {}) {
  const col = (f, tipos) => r2(normalizarConceptos(f.conceptos || []).reduce((s, c, i) => s + (tipos.includes(tipoDe(c, i)) ? c.subtotal : 0), 0));
  const filas = facturas.map((f, i) => {
    const c = contratosPorId[f.contratoId] || {};
    const t = totalesFactura(f);
    return { f, c, t, i: i + 1, renta: col(f, ['renta']), mora: col(f, ['moratorios']), agua: col(f, ['agua']), basura: col(f, ['basura']), otros: col(f, ['extraordinario', 'otro']) };
  });
  // Las facturas apagadas (_redactada) se muestran tachadas y no entran en los totales
  const s = k => r2(filas.filter(x => !x.f._redactada).reduce((a, x) => a + (k in x.t ? x.t[k] : x[k]), 0));
  const conOtros = filas.some(x => x.otros && !x.f._redactada);
  const nAct = filas.filter(x => !x.f._redactada).length;
  const anchos = conOtros
    ? [3, 8, 20, 11, 7.5, 7, 6.5, 6, 6, 8.5, 7.5, 9]
    : [3, 9, 22, 12, 8, 7.5, 7, 6.5, 8.5, 7.5, 9];
  return `
    <h2>Resumen · subtotales sin IVA por concepto</h2>
    <table class="fija">
      <colgroup>${anchos.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
      <thead><tr><th>#</th><th>Locales</th><th>Receptor</th><th>RFC</th>
        <th class="n">Renta</th><th class="n">Moratorios</th><th class="n">Agua</th><th class="n">Basura</th>${conOtros ? '<th class="n">Otros</th>' : ''}
        <th class="n">Subtotal</th><th class="n">IVA 16%</th><th class="n">Total</th></tr></thead>
      <tbody>
        ${filas.map(x => `<tr>
          <td>${x.i}</td><td class="loc">${esc(localesDe(x.f, x.c))}</td><td>${esc(x.f.razonSocial)}</td>
          <td>${x.f.rfc || x.c.rfc ? esc(x.f.rfc || x.c.rfc) : '<span class="falta">FALTA</span>'}</td>
          ${mtdR(x.f._redactada, x.renta)}${mtdR(x.f._redactada, x.mora, false, true)}${mtdR(x.f._redactada, x.agua, false, true)}
          ${mtdR(x.f._redactada, x.basura, false, true)}${conOtros ? mtdR(x.f._redactada, x.otros, false, true) : ''}
          ${mtdR(x.f._redactada, x.t.subtotal)}${mtdR(x.f._redactada, x.t.iva)}${mtdR(x.f._redactada, x.t.total, true)}</tr>`).join('')}
        <tr class="tot"><td colspan="4">TOTAL · ${nAct} factura${nAct === 1 ? '' : 's'}${nAct < filas.length ? ` (${filas.length - nAct} tachada${filas.length - nAct === 1 ? '' : 's'})` : ''}</td>
          ${mtd(s('renta'))}${mtd(s('mora'))}${mtd(s('agua'))}${mtd(s('basura'))}${conOtros ? mtd(s('otros')) : ''}
          ${mtd(s('subtotal'))}${mtd(s('iva'))}${mtd(s('total'))}</tr>
      </tbody>
    </table>`;
}

/** Ficha de una factura: datos del receptor + conceptos con monto */
export function hojaFacturaHTML(f, contrato = {}, numero = '') {
  const t = totalesFactura(f);
  const red = !!f._redactada; // factura apagada: detalle y montos tachados
  const rfc = f.rfc || contrato.rfc;
  const conceptos = normalizarConceptos(f.conceptos || []).map((c, i) => ({ ...c, _tipo: tipoDe(c, i) })).filter(c => Number(c.total) || Number(c.subtotal));
  const detalle = c => {
    if (c._tipo === 'renta') { const fp = finPeriodoRenta(contrato); return `Mensualidad ${mesCap(f.mes)}${fp ? ` · periodo de renta vigente hasta ${fechaDMY(fp)}` : ''}`; }
    if (c._tipo === 'moratorios') return `${Math.round((f.moratoriosPct || 0) * 100)}% sobre la renta`;
    if (c.periodo) return `Periodo: ${mesCap(c.periodo)}`;
    return '';
  };
  return `
    <div class="ficha">
      <div class="ficha-cab">
        <div><span class="k">${numero ? `${numero} · ` : ''}Receptor</span><span class="v">${esc(f.razonSocial)}</span></div>
        <div><span class="k">RFC</span><span class="v">${rfc ? esc(rfc) : '<span class="falta">FALTA RFC</span>'}</span></div>
        <div><span class="k">Locales</span><span class="v">${esc(localesDe(f, contrato))}</span></div>
        <div><span class="k">Método de pago</span><span class="v">${esc(f.metodoPago || 'PUE')}</span></div>
      </div>
      <table class="fija">
        <colgroup><col style="width:24%"><col style="width:40%"><col style="width:12%"><col style="width:12%"><col style="width:12%"></colgroup>
        <thead><tr><th>Concepto</th><th>Detalle</th><th class="n">Subtotal</th><th class="n">IVA 16%</th><th class="n">Total</th></tr></thead>
        <tbody>
          ${conceptos.map(c => `<tr><td><strong>${esc(c.concepto)}</strong>${c.descripcion ? `<br>${red ? tapar(c.descripcion) : `<span class="peq">${esc(c.descripcion)}</span>`}` : ''}</td>
            <td class="peq">${red ? tapar(detalle(c)) : detalle(c)}</td>
            ${mtdR(red, c.subtotal)}${mtdR(red, c.iva)}${mtdR(red, c.total)}</tr>`).join('')}
          <tr class="tot"><td colspan="2">TOTAL A FACTURAR</td>${mtdR(red, t.subtotal)}${mtdR(red, t.iva)}${mtdR(red, t.total)}</tr>
        </tbody>
      </table>
      <div class="ficha-pie">
        <div><span class="k">Enviar CFDI a</span>${correosDe(f).map(esc).join(' · ')}</div>
        <div><span class="k">Notas</span>${f.notas ? (red ? tapar(f.notas) : esc(f.notas).replace(/\n/g, ' · ')) : '–'}</div>
      </div>
    </div>`;
}

/** Documento completo: encabezado + resumen + fichas */
export function documentoContadores(mes, facturas, contratosPorId = {}, { resumen = true } = {}) {
  const activas = facturas.filter(f => !f._redactada);
  const tot = r2(activas.reduce((s, f) => s + (totalesFactura(f).total || 0), 0));
  return `<div class="hc">
    ${encabezadoHoja(mes, `${activas.length} factura(s)${activas.length < facturas.length ? ` + ${facturas.length - activas.length} tachada(s)` : ''} · Total ${dinero(tot)}`)}
    ${facturas.length > 1 && resumen ? resumenHTML(facturas, contratosPorId) + '<h2 class="salto">Detalle por receptor</h2>' : ''}
    <div class="fichas">${facturas.map((f, i) => hojaFacturaHTML(f, contratosPorId[f.contratoId], facturas.length > 1 ? i + 1 : '')).join('')}</div>
  </div>`;
}

/** Acomoda las fichas en páginas (carta horizontal) y las reparte a lo alto para usar casi toda la hoja.
 *  Se mide cada ficha ya dibujada con el ancho imprimible real, y se agrupan las que caben por página. */
function paginarFichas(cont) {
  const cajaFichas = cont.querySelector('.fichas');
  if (!cajaFichas) return;
  const prev = cont.getAttribute('style') || '';
  // Se dibuja fuera de pantalla con el ancho imprimible: carta horizontal 279.4 mm − márgenes 2 × 12 mm
  cont.setAttribute('style', 'display:block !important; position:absolute; left:-10000px; top:0; width:255mm; visibility:hidden;');
  const mm = (() => { const d = document.createElement('div'); d.style.height = '100mm'; cont.appendChild(d); const h = d.getBoundingClientRect().height / 100; d.remove(); return h; })();
  const alto = 188 * mm;                       // 215.9 mm − márgenes 2 × 10 mm − holgura
  const minGap = 6 * mm;
  const fichas = [...cajaFichas.querySelectorAll(':scope > .ficha')];
  // Espacio ya ocupado en la primera página de fichas (título "Detalle por receptor" o encabezado)
  const ref = cont.querySelector('.salto') || cont.querySelector('.hc');
  let usado = cajaFichas.getBoundingClientRect().top - ref.getBoundingClientRect().top;
  const paginas = [[]];
  fichas.forEach(f => {
    const h = f.getBoundingClientRect().height;
    const pag = paginas[paginas.length - 1];
    const necesita = h + (pag.length ? minGap : 0);
    if (pag.length && usado + necesita > alto) { paginas.push([f]); usado = h; }
    else { pag.push(f); usado += necesita; }
  });
  // Altura disponible de cada página (la primera descuenta el título)
  const inicio = cajaFichas.getBoundingClientRect().top - ref.getBoundingClientRect().top;
  const altoDe = f => f.getBoundingClientRect().height;
  const medidas = paginas.map(g => g.reduce((s, f) => s + altoDe(f), 0)); // antes de moverlas
  cajaFichas.innerHTML = '';
  paginas.forEach((grupo, i) => {
    const div = document.createElement('div');
    const ultima = i === paginas.length - 1;
    const disponible = i === 0 ? alto - inicio : alto;
    // Se reparten a lo alto si hay varias y la página queda llena en buena parte; si no, van seguidas
    const repartir = grupo.length > 1 && (!ultima || medidas[i] > disponible * 0.6);
    div.className = 'pag-fichas' + (repartir ? '' : ' ultima') + (ultima ? ' fin' : '');
    if (repartir) div.style.height = `${disponible / mm}mm`;
    grupo.forEach(f => div.appendChild(f));
    cajaFichas.appendChild(div);
  });
  cont.setAttribute('style', prev);
}

/** Abre el diálogo de impresión con las hojas (el usuario elige "Guardar como PDF") */
export function imprimirHojas(html, titulo) {
  let cont = document.getElementById('hojas-impresion');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'hojas-impresion';
    document.body.appendChild(cont);
    const st = document.createElement('style');
    st.textContent = ESTILO_HOJA + `
      #hojas-impresion { display: none; }
      @page { size: letter landscape; margin: 10mm 12mm; }
      @media print {
        body > *:not(#hojas-impresion) { display: none !important; }
        #hojas-impresion { display: block !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`;
    document.head.appendChild(st);
  }
  cont.innerHTML = html;
  paginarFichas(cont);
  const tituloPrevio = document.title;
  document.title = titulo; // nombre sugerido del PDF
  window.print();
  setTimeout(() => { document.title = tituloPrevio; }, 1000);
}

export const ordenLocales =(a, b) => parseInt(a.locales?.[0] || 999) - parseInt(b.locales?.[0] || 999);
