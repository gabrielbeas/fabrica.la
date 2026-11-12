// Contrato de arrendamiento en PDF (11/11/2026).
// El TEXTO del contrato (la plantilla) NO está en el repo: vive en Firestore, colección `contratos_plantillas` (solo admin),
// porque contiene datos de las partes. Aquí solo está el motor: convierte los datos del borrador en variables
// ({{x}} y banderas) y pinta los bloques de la plantilla.
//
// Bloques de la plantilla: { k: 'titulo'|'centro'|'h'|'p'|'li'|'fila'|'firmas'|'salto', t, e, si: [banderas], no: [banderas] }
//   - `**negritas**` dentro de t; `{{variable}}` se sustituye; si/no = el bloque solo sale si todas las banderas de `si` son
//     verdaderas y ninguna de `no`.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const BLANCO = '__________';

// ---------- Números con letra ----------
const UN = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function bajoMil(n) {
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(CEN[c]);
    if (r) {
        if (r < 30) partes.push(UN[r]);
        else { const d = Math.floor(r / 10), u = r % 10; partes.push(u ? `${DEC[d]} y ${UN[u]}` : DEC[d]); }
    }
    return partes.join(' ');
}
/** Entero a letra (hasta 999,999,999). `apocope`: «uno» pasa a «un» cuando va antes de un sustantivo (un peso, veintiún mil). */
export function letras(n, apocope = true) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'cero';
    const mill = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000, p = [];
    if (mill) p.push(mill === 1 ? 'un millón' : `${bajoMil(mill)} millones`);
    if (mil) p.push(mil === 1 ? 'mil' : `${bajoMil(mil)} mil`);
    if (resto) p.push(bajoMil(resto));
    let s = p.join(' ').replace(/ uno mil/g, ' un mil').replace(/^uno mil/, 'un mil').replace(/veintiuno mil/g, 'veintiún mil').replace(/ y uno mil/g, ' y un mil');
    if (apocope) s = s.replace(/veintiuno$/, 'veintiún').replace(/ y uno$/, ' y un').replace(/^uno$/, 'un').replace(/ uno$/, ' un');
    return s;
}
const fmt = n => (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** $24,675.00 M.N. (veinticuatro mil seiscientos setenta y cinco pesos 00/100 M.N.) */
export function dineroLegal(x) {
    const n = r2(Number(x) || 0), pesos = Math.floor(n), cent = Math.round((n - pesos) * 100);
    return `$${fmt(n)} M.N. (${letras(pesos)} pesos ${String(cent).padStart(2, '0')}/100 M.N.)`;
}
const sumaDia = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const sumaMeses = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const ult = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, ult)); return t.toISOString().slice(0, 10); };
const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f || '');
/** 1º (primero) de octubre de 2026 (dos mil veintiséis) */
export function fechaLegal(iso) {
    if (!esFecha(iso)) return BLANCO;
    const [y, m, d] = iso.split('-').map(Number);
    return `${d === 1 ? '1º (primero)' : `${d} (${letras(d, false)})`} de ${MESES[m - 1]} de ${y} (${letras(y)})`;
}
/** 1º de octubre de 2026 */
export function fechaCorta(iso) {
    if (!esFecha(iso)) return BLANCO;
    const [y, m, d] = iso.split('-').map(Number);
    return `${d === 1 ? '1º' : d} de ${MESES[m - 1]} de ${y}`;
}
const veces = (n, uno, otros) => `${n} (${letras(n)}) ${n === 1 ? uno : otros}`;

/** Variables y banderas de la plantilla a partir de los datos del borrador (`g`) y del contrato que se reemplaza (`c`). */
export function variablesContrato(g, c = {}) {
    const lineas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
    const num = k => Number(String(g[k] ?? '').replace(/[^0-9.\-]/g, '')) || 0;
    const v = k => String(g[k] ?? '').trim() || BLANCO;
    const renovacion = g.tipoContrato === 'renovacion';
    const anios = num('anios') || 1, inicio = g.inicio, mantPct = num('mantenimientoPct'), gracia = num('mesesGracia');
    const fin = esFecha(inicio) ? sumaDia(sumaMeses(inicio, anios * 12), -1) : '';
    const inicioRenta = esFecha(inicio) ? sumaMeses(inicio, gracia) : '';
    const renta = num('renta'), mesesDep = num('mesesDeposito'), deposito = r2(renta * mesesDep), anterior = num('depositoAnterior');
    const locales = (c.locales || []).map(String), m2 = Number(c.m2) || 0;
    const localNum = locales.length ? locales.join(' y ') : BLANCO;
    const localLetra = locales.length === 1 && /^\d+$/.test(locales[0]) ? letras(+locales[0]) : '';
    const m2Letra = Number.isInteger(m2) ? letras(m2) : letras(Math.floor(m2)) + ' punto ' + String(m2).split('.')[1].split('').map(d => UN[+d]).join(' ');
    const acta = renovacion ? g.posesionDesde : inicio;
    const mantSeparado = mantPct > 0;
    const may = s => v(s).toUpperCase();
    const vars = {
        arrendatarioMay: may('razonSocial'), representante: v('representante'), representanteMay: may('representante'),
        nombreComercial: v('nombreComercial'), giroMay: may('giro'), rfc: v('rfc'), curp: v('curp'), direccion: lineas(g.direccion).join(', ') || BLANCO,
        constitucion: v('constitucion'), poderRepresentante: v('poderRepresentante'),
        osNombre: v('osNombre'), osNombreMay: may('osNombre'), osCurp: v('osCurp'), osRfc: v('osRfc'), osDomicilio: v('osDomicilio'), osInmueble: v('osInmueble'), osEscritura: v('osEscritura'),
        correoNotificacion: lineas(g.correosNotificacion)[0] || BLANCO,
        localNum, localNumLetra: localLetra || BLANCO, localNumLetraMay: (localLetra || BLANCO).toUpperCase(),
        m2Texto: m2 ? `${m2.toLocaleString('es-MX')} m² (${m2Letra} metros cuadrados)` : BLANCO,
        entradaLocal: v('entradaLocal'),
        inicioLegal: fechaLegal(inicio), inicioCorto: fechaCorta(inicio), finLegal: fechaLegal(fin), finCorto: fechaCorta(fin),
        inicioRentaLegal: fechaLegal(inicioRenta), inicioRentaCorto: fechaCorta(inicioRenta),
        posesionLegal: fechaLegal(g.posesionDesde), posesionCorto: fechaCorta(g.posesionDesde),
        anteriorFinLegal: fechaLegal(c.fin),
        actaLegal: fechaLegal(acta), actaMay: fechaCorta(acta).toUpperCase(),
        firmaLegal: esFecha(g.firma) ? fechaLegal(g.firma) : '___ de ____________ de ________',
        plazoTexto: `${anios} (${letras(anios).toUpperCase()}) año${anios === 1 ? '' : 's'}`,
        rentaLegal: renta ? dineroLegal(renta) : BLANCO, rentaAnualLegal: renta ? dineroLegal(renta * 12) : BLANCO,
        mesesDepTexto: mesesDep ? veces(mesesDep, 'mes', 'meses') : BLANCO,
        depositoLegal: deposito ? dineroLegal(deposito) : BLANCO, depositoAnteriorLegal: anterior ? dineroLegal(anterior) : BLANCO,
        depositoDiferenciaLegal: deposito ? dineroLegal(Math.max(0, r2(deposito - anterior))) : BLANCO,
        mantenimientoPctTexto: mantPct ? `${mantPct}% (${letras(mantPct)} por ciento)` : BLANCO,
        graciaTexto: gracia ? veces(gracia, 'mes', 'meses') : '',
        ycuota: mantSeparado ? ' y la cuota de mantenimiento' : '', cuotaLista: mantSeparado ? ', la cuota de mantenimiento' : '',
        seCausan: mantSeparado ? 'se causan' : 'se causa'
    };
    const flags = { renovacion, mantSeparado, incAnual: anios > 1, conGracia: gracia > 0, moral: g.tipoPersona === 'moral', fisica: g.tipoPersona === 'fisica' };
    return { vars, flags };
}

const sustituye = (t, vars) => String(t || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : BLANCO));
const inline = (t, vars) => sustituye(t, vars).split('**').map((x, i) => (i % 2 ? `<b>${esc(x)}</b>` : esc(x))).join('');
const aplica = (b, flags) => (b.si || []).every(f => flags[f]) && !(b.no || []).some(f => flags[f]);

/** HTML del contrato (para #hoja). */
export function htmlContrato(plantilla, g, c, logoUrl) {
    const { vars, flags } = variablesContrato(g, c);
    const partes = [];
    const bloques = (plantilla.bloques || []).filter(b => aplica(b, flags));
    let ultimaEtiqueta = '';
    for (const b of bloques) {
        if (b.k === 'titulo') partes.push(`<h2 class="ct-titulo">${inline(b.t, vars)}</h2>`);
        else if (b.k === 'centro') partes.push(`<p class="ct-centro">${inline(b.t, vars)}</p>`);
        else if (b.k === 'h') partes.push(`<h3 class="ct-h">${inline(b.t, vars)}</h3>`);
        else if (b.k === 'li') partes.push(`<p class="ct-li">${inline(b.t, vars)}</p>`);
        else if (b.k === 'fila') { partes.push(`<div class="ct-fila"><div class="ct-et">${b.cont && b.e === ultimaEtiqueta ? '' : esc(b.e)}</div><div>${inline(b.t, vars)}</div></div>`); ultimaEtiqueta = b.e; }
        else if (b.k === 'salto') partes.push('<div class="ct-salto"></div>');
        else if (b.k === 'firmas') {
            partes.push(`<div class="ct-firmas">${b.filas.map(fila => fila.c.map(f => f
                ? `<div class="ct-firma"><b>${inline(f.rol, vars)}</b><div class="ct-linea"></div><div>${inline(f.nombre, vars)}</div>${f.rep ? `<div>${inline(f.rep, vars)}</div>` : ''}${f.persona ? `<div>${inline(f.persona, vars)}</div>` : ''}</div>`
                : '<div></div>').join('')).join('')}</div>`);
        } else partes.push(`<p class="ct-p">${inline(b.t, vars)}</p>`);
    }
    return `${logoUrl ? `<div class="ct-enc"><img src="${esc(logoUrl)}" alt="La Fábrica de Chocolate"></div>` : ''}${partes.join('')}`;
}

/** Estilos de impresión del contrato (se agregan a la página que imprime). */
export const ESTILOS_CONTRATO = `
@media print {
  @page { size: letter portrait; margin: 20mm 18mm; }
  #hoja.contrato { display: block !important; min-height: 0 !important; color: #1b2430; font: 10.5pt/1.4 Roboto, Arial, sans-serif; text-align: left; }
  #hoja.contrato .ct-enc { text-align: center; margin-bottom: 10px; } #hoja.contrato .ct-enc img { height: 44px; }
  #hoja.contrato .ct-titulo { text-align: center; font-size: 14pt; font-weight: 900; margin: 14px 0 8px; }
  #hoja.contrato .ct-centro { text-align: center; margin: 6px 0; }
  #hoja.contrato .ct-h { font-size: 10.5pt; font-weight: 700; margin: 14px 0 4px; break-after: avoid; }
  #hoja.contrato .ct-p, #hoja.contrato .ct-li { text-align: justify; margin: 0 0 7px; font-size: 10.5pt; }
  #hoja.contrato .ct-li { margin-left: 18px; }
  #hoja.contrato .ct-fila { display: grid; grid-template-columns: 38% 62%; gap: 8px; padding: 5px 0; border-bottom: 1px solid #d5dbe3; break-inside: avoid; }
  #hoja.contrato .ct-et { font-weight: 700; }
  #hoja.contrato .ct-firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 34px 40px; margin: 26px 0; text-align: center; break-inside: avoid; }
  #hoja.contrato .ct-firma { break-inside: avoid; } #hoja.contrato .ct-linea { border-top: 1px solid #1b2430; margin: 34px 0 4px; }
  #hoja.contrato .ct-salto { break-after: page; }
}`;
