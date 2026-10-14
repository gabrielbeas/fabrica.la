// Requerimiento de cobro del saldo del depósito en garantía (PDF vía impresión).
// Lo usan la carátula y la sección Depósitos. Los datos bancarios salen de config_cobro/cuenta (solo Firestore).
import { db, getCurrentUser } from './auth.js?v=20261014-4';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { imprimirHojas, LOGO_URL } from './facturacion.js?v=20261013-1';
import { cuentaDeposito } from './depositos.js?v=20261014-4';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dinero = n => typeof n === 'number' ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fechaTxt = f => { if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return f || '-'; const [y, m, d] = f.split('-'); return `${+d} de ${MESES[+m - 1]} de ${y}`; };

// Requerimiento de cobro del saldo del depósito: carta vertical con membrete, cuadro de saldos y datos bancarios
const PLAZO_REQUERIMIENTO_DIAS = 7;   // fecha límite sugerida; se puede cambiar al generar
export async function requerimientoDeposito(c, btn = null) {
    const r = cuentaDeposito(c);
    const baseTxt = r.baseClave === 'sin' ? 'sin mantenimiento' : 'con mantenimiento';
    if (r.saldo <= 0.005) { alert(`Este contrato no tiene saldo de depósito por cobrar.

Depósito requerido: ${dinero(r.requerido)}
Depósito pagado: ${dinero(r.pagado)}`); return; }
    const hoy0 = new Date(), def = new Date(hoy0.getTime() + PLAZO_REQUERIMIENTO_DIAS * 86400000);
    const isoDe = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!confirm(`Requerimiento de cobro para ${c.razonSocial} (local ${(c.locales || []).join(', ')})

Depósito requerido (${c.mesesDeposito || 1} mes${(c.mesesDeposito || 1) === 1 ? '' : 'es'} de renta vigente ${baseTxt}): ${dinero(r.requerido)}
Depósito pagado: ${dinero(r.pagado)}
Saldo a cobrar: ${dinero(r.saldo)}

¿Generar el PDF?`)) return;
    const limTxt = prompt('Fecha límite de pago (AAAA-MM-DD)', isoDe(def));
    if (limTxt === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(limTxt.trim()) || isNaN(new Date(limTxt.trim() + 'T12:00:00')) || limTxt.trim() < isoDe(hoy0)) { alert('Escribe una fecha válida que no sea anterior a hoy, con el formato AAAA-MM-DD.'); return; }
    if (btn) btn.disabled = true;
    try {
        const snap = await getDoc(doc(db, 'config_cobro', 'cuenta'));
        if (!snap.exists() || !snap.data().clabe) { alert('Faltan los datos bancarios para cobrar (colección config_cobro, documento cuenta).'); return; }
        const cta = snap.data();
        const hoy = new Date(), lim = new Date(limTxt.trim() + 'T12:00:00');
        const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const larga = d => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
        const locales = (c.locales || []).join(', ');
        const dir = (Array.isArray(c.direccion) ? c.direccion : [c.direccion]).filter(Boolean).map(x => esc(String(x).replace(/\bCP:/, 'CP'))).join(', ');
        const obligados = (c.obligadosSolidarios || []).filter(Boolean).join(', ');
        const ultimoPago = r.pagos.length ? r.pagos[r.pagos.length - 1] : null;
        const pagadoTxt = r.pagos.length === 1 && ultimoPago.fecha
            ? `Depósito pagado · ${fechaTxt(ultimoPago.fecha)}${ultimoPago.banco ? `, ${esc(ultimoPago.banco)}` : ''}`
            : `Depósito pagado (${r.pagos.length} pago${r.pagos.length === 1 ? '' : 's'})`;
        const requeridoTxt = (c.mesesDeposito || 1) === 1 ? `Depósito en garantía requerido (1 mes de renta vigente ${baseTxt})` : `Depósito en garantía requerido (${c.mesesDeposito} meses de renta vigente ${baseTxt})`;
        const html = `<div class="rq">
            <style>
                .rq { font-family: Arial, Helvetica, sans-serif; color: #1b2430; font-size: 12.5px; line-height: 1.55; }
                .rq .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1b2430; padding-bottom: 10px; margin-bottom: 20px; }
                .rq .cab img { height: 40px; display: block; }
                .rq .cab .der { text-align: right; font-size: 11px; color: #5b6572; }
                .rq h1 { text-align: center; font-size: 16px; letter-spacing: .05em; margin: 0; }
                .rq .sub { text-align: center; color: #5b6572; margin: 0 0 18px; }
                .rq .dest { margin-bottom: 14px; } .rq .gris { color: #5b6572; }
                .rq p { margin: 0 0 12px; text-align: justify; }
                .rq table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
                .rq th { background: #1b2430; color: #fff; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 12px; }
                .rq th.n, .rq td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .rq td { padding: 6px 10px; border-bottom: 1px solid #d5dbe1; }
                .rq tr.tot td { background: #eef1f4; font-weight: 700; font-size: 13.5px; border-bottom: none; }
                .rq .nota { font-size: 11px; color: #5b6572; font-style: italic; margin: 0 0 14px; }
                .rq .banco { border: 1px solid #9aa5b1; padding: 8px 12px; margin: 0 0 24px; display: grid; grid-template-columns: 90px 1fr; gap: 2px 8px; font-size: 12px; }
                .rq .banco b { font-weight: 400; color: #5b6572; }
                .rq .firmas { display: flex; gap: 40px; margin-top: 56px; font-size: 11.5px; text-align: center; }
                .rq .firmas div { flex: 1; border-top: 1px solid #1b2430; padding-top: 4px; }
            </style>
            <div class="cab"><img src="${LOGO_URL}" alt="La Fábrica de Chocolate">
                <div class="der">Guadalajara, Jalisco, a ${larga(hoy)}<br>Referencia: Local ${esc(locales)} · Depósito en garantía</div></div>
            <h1>REQUERIMIENTO DE PAGO</h1>
            <div class="sub">Saldo del depósito en garantía</div>
            <div class="dest"><strong>${esc(c.razonSocial)}</strong><br>
                ${c.representante ? `Atención: ${esc(c.representante)}, representante<br>` : ''}
                <span class="gris">Local ${esc(locales)}${dir ? ` · ${dir}` : ''}${obligados ? `<br>Con copia al obligado solidario: ${esc(obligados)}` : ''}</span></div>
            <p>LAFABDECHOC S DE RL DE CV, arrendador del local ${esc(locales)} conforme al contrato de arrendamiento ${c.inicio ? `con inicio el ${esc(fechaTxt(c.inicio))}` : 'vigente'}, le requiere el pago del saldo pendiente del depósito en garantía pactado en dicho contrato, equivalente a ${(c.mesesDeposito || 1) === 1 ? 'un mes' : `${c.mesesDeposito} meses`} de renta vigente ${baseTxt}.</p>
            <table>
                <thead><tr><th>Concepto</th><th class="n">Importe</th></tr></thead>
                <tbody>
                    <tr><td>${requeridoTxt}</td><td class="n">${dinero(r.requerido)}</td></tr>
                    <tr><td>${pagadoTxt}</td><td class="n">−${dinero(r.pagado)}</td></tr>
                    <tr class="tot"><td>Saldo por pagar</td><td class="n">${dinero(r.saldo)}</td></tr>
                </tbody>
            </table>
            <p class="nota">Este depósito no se factura por tratarse de un depósito en garantía.</p>
            <p>Le pedimos cubrir este saldo a más tardar el <strong>${larga(lim)}</strong>, mediante transferencia a la cuenta siguiente, y enviar su comprobante a facturas@fabrica.la.</p>
            <div class="banco">
                <b>Beneficiario</b><span>${esc(cta.beneficiario)}</span>
                <b>Banco</b><span>${esc(cta.banco)}</span>
                <b>Cuenta</b><span>${esc(cta.cuenta)}</span>
                <b>CLABE</b><span>${esc(cta.clabe)}</span>
                <b>Referencia</b><span>LOCAL ${esc(locales)} DEPOSITO</span>
            </div>
            <div class="firmas"><div>Administración<br><span class="gris">LAFABDECHOC S DE RL DE CV</span></div><div>Recibí<br><span class="gris">Nombre, firma y fecha</span></div></div>
        </div>`;
        imprimirHojas(html, `Requerimiento de depósito · Local ${locales} · ${iso(hoy)}`, { vertical: true });
        // Queda anotado en el historial del contrato
        const user = getCurrentUser();
        await addDoc(collection(db, 'contratos', c.id, 'historial'), {
            antes: { requerimientoDeposito: null },
            despues: { requerimientoDeposito: `${iso(hoy).split('-').reverse().join('/')}: saldo ${dinero(r.saldo)}, límite ${iso(lim).split('-').reverse().join('/')}` },
            por: user.email, en: serverTimestamp()
        });
    } catch (err) {
        console.error(err);
        alert('No se pudo generar el requerimiento: ' + err.message);
    } finally { if (btn) btn.disabled = false; }
}

