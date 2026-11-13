// Recibo del depósito en garantía cubierto en su totalidad (12/11/2026): PDF vía impresión y correo.
// Un recibo por todo el depósito, con el desglose de los pagos que cuentan, folio consecutivo RD-AAAA-NNN y firma de Administración.
// El folio sale de un contador en config_cobro/contador_recibos y cada recibo queda en recibos_deposito/{folio} (solo admin, regla general).
// Si el depósito no ha cambiado desde el último recibo, se reimprime con el mismo folio.
import { db, getCurrentUser } from './auth.js?v=20261111-1';
import { doc, collection, query, where, getDocs, runTransaction, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { imprimirHojas, LOGO_URL } from './facturacion.js?v=20261112-1';
import { cuentaDeposito } from './depositos.js?v=20261112-1';
import { dineroLegal } from './contrato-pdf.js?v=20261111-1';
import { correosDeContrato, abrirCorreo, CORREO_REMITENTE, urlGmail } from './correos-contrato.js?v=20261014-6';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dinero = n => typeof n === 'number' ? (n <= -0.005 ? '-$' : '$') + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fechaTxt = f => { if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return f || '-'; const [y, m, d] = f.split('-'); return `${+d} de ${MESES[+m - 1]} de ${y}`; };
const isoDe = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const cents = n => Math.round((Number(n) || 0) * 100);

// ¿Se puede emitir? Solo con el depósito requerido y cubierto
function revisar(c) {
  const r = cuentaDeposito(c);
  if (!(r.requerido > 0.005)) { alert('Este contrato no tiene depósito requerido.'); return null; }
  if (r.saldo > 0.005) { alert(`El depósito todavía no está completo.\n\nDepósito requerido: ${dinero(r.requerido)}\nDepósito pagado: ${dinero(r.pagado)}\nPor pagar: ${dinero(r.saldo)}`); return null; }
  if (!r.cuentan.length) { alert('No hay pagos que cuenten en este depósito.'); return null; }
  return r;
}

// Recibo ya emitido para este contrato con el mismo total pagado (si lo hay, se reutiliza su folio)
async function reciboVigente(c, r) {
  const sn = await getDocs(query(collection(db, 'recibos_deposito'), where('contratoId', '==', c.id)));
  return sn.docs.map(d => ({ folio: d.id, ...d.data() })).filter(x => cents(x.pagado) === cents(r.pagado) && cents(x.requerido) === cents(r.requerido))
    .sort((a, b) => (b.folio || '').localeCompare(a.folio || ''))[0] || null;
}

// Folio nuevo en una transacción (contador por año) y registro del recibo
async function emitir(c, r) {
  const anio = new Date().getFullYear(), user = getCurrentUser();
  const refCont = doc(db, 'config_cobro', 'contador_recibos');
  return runTransaction(db, async tx => {
    const sn = await tx.get(refCont);
    const n = ((sn.exists() ? sn.data()[anio] : 0) || 0) + 1;
    const folio = `RD-${anio}-${String(n).padStart(3, '0')}`;
    const registro = {
      contratoId: c.id, locales: c.locales || [], razonSocial: c.razonSocial || '', fecha: isoDe(new Date()),
      requerido: r.requerido, pagado: r.pagado,
      pagos: r.cuentan.map(p => ({ fecha: p.fecha || '', monto: Number(p.monto) || 0, banco: p.banco || '', pago: p.pago || '' })),
      emitidoPor: user.email, emitidoEn: serverTimestamp()
    };
    tx.set(refCont, { [anio]: n }, { merge: true });
    tx.set(doc(db, 'recibos_deposito', folio), registro);
    return { folio, ...registro, fecha: registro.fecha };
  });
}

// HTML del recibo (lo usan la impresión y el PDF que se descarga para el correo)
export function htmlRecibo(c, r, rec) {
    const locales = (c.locales || []).join(', ');
    const dir = (Array.isArray(c.direccion) ? c.direccion : [c.direccion]).filter(Boolean).map(x => esc(String(x).replace(/\bCP:/, 'CP'))).join(', ');
    const pagos = rec.pagos || [];
    const baseTxt = r.baseClave === 'sin' ? 'sin mantenimiento' : 'con mantenimiento';
    const meses = Number(c.mesesDeposito) || 1;
    const html = `<div class="rq">
      <style>
        .rq { font-family: Arial, Helvetica, sans-serif; color: #1b2430; font-size: 12.5px; line-height: 1.55; }
        .rq .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1b2430; padding-bottom: 10px; margin-bottom: 20px; }
        .rq .cab img { height: 40px; display: block; }
        .rq .cab .der { text-align: right; font-size: 11px; color: #5b6572; }
        .rq .folio { font-size: 15px; font-weight: 700; color: #1b2430; }
        .rq h1 { text-align: center; font-size: 16px; letter-spacing: .05em; margin: 0; }
        .rq .sub { text-align: center; color: #5b6572; margin: 0 0 18px; }
        .rq .dest { margin-bottom: 14px; } .rq .gris { color: #5b6572; }
        .rq p { margin: 0 0 12px; text-align: justify; }
        .rq table { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
        .rq th { background: #1b2430; color: #fff; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 12px; }
        .rq th.n, .rq td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rq td { padding: 6px 10px; border-bottom: 1px solid #d5dbe1; }
        .rq tr.tot td { background: #eef1f4; font-weight: 700; font-size: 13.5px; border-bottom: none; }
        .rq .ok { border: 1px solid #2e7d32; color: #2e7d32; padding: 8px 12px; text-align: center; font-weight: 700; margin: 0 0 14px; }
        .rq .nota { font-size: 11px; color: #5b6572; font-style: italic; margin: 0 0 14px; }
        .rq .firma { width: 260px; margin: 64px auto 0; border-top: 1px solid #1b2430; padding-top: 4px; font-size: 11.5px; text-align: center; }
      </style>
      <div class="cab"><img src="${LOGO_URL}" alt="La Fábrica de Chocolate">
        <div class="der"><span class="folio">Folio ${esc(rec.folio)}</span><br>Guadalajara, Jalisco, a ${esc(fechaTxt(rec.fecha))}<br>Referencia: Local ${esc(locales)} · Depósito en garantía</div></div>
      <h1>RECIBO DE DEPÓSITO EN GARANTÍA</h1>
      <div class="sub">Depósito cubierto en su totalidad</div>
      <div class="dest"><strong>${esc(c.razonSocial)}</strong><br>
        ${c.representante ? `Atención: ${esc(c.representante)}, representante<br>` : ''}
        <span class="gris">Local ${esc(locales)}${dir ? ` · ${dir}` : ''}</span></div>
      <p>LAFABDECHOC S DE RL DE CV, arrendador del local ${esc(locales)} conforme al contrato de arrendamiento ${c.inicio ? `con inicio el ${esc(fechaTxt(c.inicio))}` : 'vigente'}, recibió de ${esc(c.razonSocial)} la cantidad total de <strong>${esc(dineroLegal(rec.pagado))}</strong>, en ${pagos.length} pago${pagos.length === 1 ? '' : 's'}, por concepto de depósito en garantía pactado en dicho contrato, equivalente a ${meses === 1 ? 'un mes' : `${meses} meses`} de renta vigente ${baseTxt}.</p>
      <table>
        <thead><tr><th>Fecha del pago</th><th>Banco</th><th>Quién pagó</th><th class="n">Importe</th></tr></thead>
        <tbody>
          ${pagos.map(p => `<tr><td>${esc(fechaTxt(p.fecha))}</td><td>${esc(p.banco || '')}</td><td>${esc(p.pago || '')}</td><td class="n">${dinero(p.monto)}</td></tr>`).join('')}
          <tr class="tot"><td colspan="3">Total recibido</td><td class="n">${dinero(rec.pagado)}</td></tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr><td>Depósito en garantía requerido</td><td class="n">${dinero(rec.requerido)}</td></tr>
          <tr><td>Depósito recibido</td><td class="n">${dinero(rec.pagado)}</td></tr>
          <tr class="tot"><td>Saldo por pagar</td><td class="n">${dinero(0)}</td></tr>
        </tbody>
      </table>
      <div class="ok">El depósito en garantía queda cubierto en su totalidad.</div>
      <p class="nota">Este depósito no se factura por tratarse de un depósito en garantía. Se conserva en los términos del contrato de arrendamiento.</p>
      <div class="firma">Administración<br><span class="gris">LAFABDECHOC S DE RL DE CV</span></div>
    </div>`;
    return html;
}

// ---------- PDF ----------
export async function reciboDeposito(c, btn = null) {
  const r = revisar(c); if (!r) return;
  const locales = (c.locales || []).join(', ');
  if (btn) btn.disabled = true;
  try {
    let rec = await reciboVigente(c, r), repetido = false;
    if (rec) {
      if (!confirm(`Ya se emitió el recibo ${rec.folio} (${fechaTxt(rec.fecha)}) para este depósito, sin cambios desde entonces.\n\n¿Volver a imprimirlo con el mismo folio?`)) return;
      repetido = true;
    } else {
      if (!confirm(`Recibo de depósito en garantía\n\n${c.razonSocial} · local ${locales}\nDepósito requerido: ${dinero(r.requerido)}\nDepósito pagado: ${dinero(r.pagado)} (${r.cuentan.length} pago${r.cuentan.length === 1 ? '' : 's'})\n\nSe asignará un folio nuevo. ¿Generar el PDF?`)) return;
      rec = await emitir(c, r);
    }
    const pagos = rec.pagos || [];
    const html = htmlRecibo(c, r, rec);
    imprimirHojas(html, `Recibo de depósito ${rec.folio} · Local ${locales}`, { vertical: true });
    const user = getCurrentUser();
    await addDoc(collection(db, 'contratos', c.id, 'historial'), {
      antes: { reciboDeposito: null },
      despues: { reciboDeposito: `${rec.folio}${repetido ? ' (reimpreso)' : ''}: ${dinero(rec.pagado)} en ${pagos.length} pago${pagos.length === 1 ? '' : 's'}` },
      por: user.email, en: serverTimestamp()
    });
  } catch (err) {
    console.error(err);
    alert('No se pudo generar el recibo: ' + err.message);
  } finally { if (btn) btn.disabled = false; }
}

// PDF como archivo (html2pdf.js desde cdnjs, se carga solo al usarlo): el recibo se descarga para adjuntarlo al correo
function cargarHtml2pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((ok, mal) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    sc.onload = () => window.html2pdf ? ok(window.html2pdf) : mal(new Error('No se cargó el generador de PDF.'));
    sc.onerror = () => mal(new Error('No se pudo cargar el generador de PDF (revisa la conexión).'));
    document.head.appendChild(sc);
  });
}
async function descargarPdfRecibo(c, r, rec) {
  const lib = await cargarHtml2pdf();
  const cont = document.createElement('div');
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:180mm;background:#fff';
  cont.innerHTML = htmlRecibo(c, r, rec);
  document.body.appendChild(cont);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const imgs = [...cont.querySelectorAll('img')];
    await Promise.all(imgs.map(i => i.complete ? null : new Promise(ok => { i.onload = i.onerror = ok; })));
    const nombre = `Recibo ${rec.folio} Local ${(c.locales || []).join('-')}.pdf`;
    await lib().set({ margin: [16, 18], filename: nombre, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' } }).from(cont.firstElementChild).save();
    return nombre;
  } finally { cont.remove(); }
}

// ---------- Correo ----------
// Abre la redacción de Gmail de admin@fabrica.la con las direcciones del Directorio. El PDF se genera aparte (con el mismo folio) y se adjunta a mano.
export async function emailReciboDeposito(c) {
  const r = revisar(c); if (!r) return;
  let rec;
  try { rec = await reciboVigente(c, r); } catch (err) { alert('No se pudo consultar el recibo: ' + err.message); return; }
  if (!rec) { alert('Primero genera el recibo con «Recibo de depósito (PDF)»: así tiene su folio y lo puedes adjuntar al correo.'); return; }
  const correos = correosDeContrato(c);
  const locales = (c.locales || []).join(', ');
  const asunto = `Recibo de depósito en garantía ${rec.folio} · Local ${locales}`;
  const cuerpo = `Estimados ${c.razonSocial}:

Les hacemos llegar el recibo ${rec.folio} del depósito en garantía del local ${locales}, por ${dinero(rec.pagado)} (${(rec.pagos || []).length} pago${(rec.pagos || []).length === 1 ? '' : 's'}). Con estos pagos el depósito queda cubierto en su totalidad.

Este depósito es una garantía, por lo que no genera factura.

Quedamos atentos a cualquier duda.

Saludos,
Administración
LAFABDECHOC S DE RL DE CV`;
  const fondo = document.createElement('div');
  fondo.className = 'lf-modal-fondo';
  fondo.innerHTML = `<div class="lf-modal" role="dialog" aria-label="Recibo por correo" style="max-width:720px">
    <h3>Recibo de depósito por correo</h3>
    <p style="margin:0;font-size:13px;color:var(--tinta-suave)">${esc(c.razonSocial)} · local ${esc(locales)} · ${esc(rec.folio)} · ${dinero(rec.pagado)}</p>
    <div class="lf-form">
      <div class="lf-campo lf-ancho"><label>Para (direcciones del Directorio)</label>
        ${correos.length ? correos.map(x => `<label style="display:flex;gap:8px;align-items:center;justify-content:flex-start;text-align:left;text-transform:none;letter-spacing:0;font-weight:400;font-size:14px;margin:3px 0;cursor:pointer"><input type="checkbox" class="rc-correo" value="${esc(x.correo)}" checked style="width:16px;height:16px;flex:none;margin:0"> <span>${esc(x.correo)}</span> <span style="color:var(--tinta-suave);font-size:12px">${esc(x.tipo)}</span></label>`).join('') : '<div style="color:var(--peligro);font-size:13px">Este contrato no tiene correos en el Directorio. Agrégalos en Contratos o en Facturación.</div>'}
      </div>
      <div class="lf-campo lf-ancho"><label for="rc-asunto">Asunto</label><input id="rc-asunto" value="${esc(asunto)}"></div>
      <div class="lf-campo lf-ancho"><label for="rc-cuerpo">Mensaje</label><textarea id="rc-cuerpo" rows="10">${esc(cuerpo)}</textarea></div>
    </div>
    <p style="margin:0;font-size:12px;color:var(--tinta-suave)">El correo se abre en Gmail, desde ${CORREO_REMITENTE} (esa cuenta debe estar abierta en este navegador). Al abrir Gmail se descarga el PDF del recibo (mismo folio): adjúntalo al correo antes de enviar.</p>
    <div class="lf-modal-pie"><span id="rc-msg" style="margin-right:auto;font-size:13px;color:var(--peligro)"></span>
      <button class="lf-btn" data-cerrar>Cancelar</button><button class="lf-btn" id="rc-copiar">Copiar mensaje</button><button class="lf-btn lf-btn-primario" id="rc-abrir">Abrir en Gmail (${CORREO_REMITENTE})</button></div>
  </div>`;
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', teclas); };
  const teclas = e => { if (e.key === 'Escape') cerrar(); };
  fondo.addEventListener('click', e => { if (e.target === fondo || e.target.hasAttribute('data-cerrar')) cerrar(); });
  document.addEventListener('keydown', teclas);
  document.body.appendChild(fondo);
  const $ = id => document.getElementById(id), msg = $('rc-msg');
  $('rc-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('rc-cuerpo').value); msg.style.color = 'var(--exito)'; msg.textContent = 'Mensaje copiado.'; }
    catch { msg.style.color = 'var(--peligro)'; msg.textContent = 'No se pudo copiar; selecciona el texto a mano.'; }
  });
  $('rc-abrir').addEventListener('click', async () => {
    const para = [...fondo.querySelectorAll('.rc-correo:checked')].map(x => x.value);
    if (!para.length) { msg.style.color = 'var(--peligro)'; msg.textContent = 'Marca al menos una dirección.'; return; }
    const datos = { para, asunto: $('rc-asunto').value, cuerpo: $('rc-cuerpo').value };
    if (urlGmail(datos).length > 7000) { msg.style.color = 'var(--peligro)'; msg.textContent = 'El mensaje es muy largo para abrirlo directo; usa «Copiar mensaje».'; return; }
    abrirCorreo(datos);   // primero, para que el navegador no bloquee la pestaña nueva
    let pdf = '';
    try { pdf = await descargarPdfRecibo(c, r, rec); }
    catch (err) { console.error(err); alert('Gmail se abrió, pero no se pudo descargar el PDF: ' + err.message + '\n\nUsa «Recibo de depósito (PDF)» para generarlo.'); }
    try {
      const user = getCurrentUser();
      await addDoc(collection(db, 'contratos', c.id, 'historial'), {
        antes: { reciboDepositoCorreo: null },
        despues: { reciboDepositoCorreo: `${isoDe(new Date()).split('-').reverse().join('/')}: ${rec.folio} preparado desde ${CORREO_REMITENTE} para ${para.join(', ')}` },
        por: user.email, en: serverTimestamp()
      });
    } catch (err) { console.warn('No se anotó en el historial', err); }
    cerrar();
  });
}
