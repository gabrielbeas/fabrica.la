// Nuevos contratos (11/11/2026): proceso para cambiar de inquilino (o renovar) en un local que ya existe.
// Un proceso = documento `nuevos_contratos/{id}`:
//   contratoId (contrato del local que se reemplaza), locales, estado (en_proceso | activado | descartado),
//   interesado, datos {propuesta + cuestionario + contrato, mismas claves}, propuestaEnviada, aceptada (fechas),
//   versionPdf (PDF del contrato), pagos [{concepto, fecha, monto, nota}], contratoNuevoId.
// Solo admin (regla general de Firestore).

export const ETAPAS = [
    { clave: 'local', nombre: 'Local', corto: 'Local' },
    { clave: 'propuesta', nombre: 'Propuesta enviada', corto: 'Propuesta' },
    { clave: 'contrato', nombre: 'Contrato, datos y documentos', corto: 'Contrato' },
    { clave: 'pagos', nombre: 'Firma y pagos', corto: 'Firma y pagos' },
    { clave: 'activo', nombre: 'Activo', corto: 'Activo' }
];

/** Cada etapa con `hecho` true/false, según lo que ya tiene el proceso. */
export function pasosDe(p) {
    const d = p.datos || {}, pagos = p.pagos || [];
    const hecho = {
        local: true,
        propuesta: !!p.propuestaEnviada,
        contrato: (p.versionPdf || 0) > 0 && !!(d.razonSocial && d.rfc),   // PDF generado y datos del arrendatario capturados (en una renovación se precargan del contrato actual)
        pagos: !!d.firma && pagos.some(x => x.concepto === 'deposito') && pagos.some(x => x.concepto === 'primera_renta'),
        activo: p.estado === 'activado'
    };
    // `fuera` = el paso ya está hecho pero hay uno anterior (sin contar «Local») que todavía no: se hizo fuera de orden
    let pendiente = false;
    return ETAPAS.map(e => {
        const fuera = hecho[e.clave] && pendiente && e.clave !== 'local';
        if (!hecho[e.clave] && e.clave !== 'local') pendiente = true;
        return { ...e, hecho: hecho[e.clave], fuera };
    });
}

/** Etapa en la que va: la primera que no está hecha. */
export function etapaDe(p) {
    if (p.estado === 'descartado') return { clave: 'descartado', nombre: 'Descartado' };
    const pasos = pasosDe(p);
    return pasos.find(x => !x.hecho) || pasos[pasos.length - 1];
}

// ---------- Documentos que debe enviar el interesado ----------
// Grupos: A = persona moral, B = persona física, C = obligado solidario. Lo recibido se guarda en `p.documentos`
// ({ clave: { recibido: 'AAAA-MM-DD' | '', nota } }). Es solo un checklist: no bloquea la activación. Toda constancia de situación fiscal (RFC) debe tener no más de 30 días de emitida (regla de Gabriel, 17/11/2026): no se marca como recibida una más vieja.
const GRUPOS = { A: 'A · Arrendatario, persona moral', B: 'B · Arrendatario, persona física', C: 'C · Obligado solidario' };
export { GRUPOS as GRUPOS_DOCUMENTOS };

/** Documentos que corresponden a este proceso, según el tipo de persona y los socios capturados.
 *  `todos`: mientras no se defina el tipo de persona, muestra los dos grupos (A y B) para poder verlos y exportarlos. */
export function documentosDe(datos = {}, todos = false) {
    const d = datos, lista = [];
    const add = (grupo, clave, nombre, detalle = '', opcional = false, detallePdf = detalle) => lista.push({ grupo, clave, nombre, detalle, opcional, detallePdf });   // detallePdf = texto que sale en el PDF para el interesado
    const moral = d.tipoPersona === 'moral', fisica = d.tipoPersona === 'fisica';
    // Renovación: el acta y el poder ya constan del contrato anterior, solo se piden si cambiaron; el obligado solidario solo si lo hay
    const renov = d.tipoContrato === 'renovacion';
    const conObligado = !renov || !!((d.obligadosSolidarios || '').trim() || (d.osNombre || '').trim() || /obligado|aval|fiador/i.test(d.garantia || ''));
    if (moral || (todos && !fisica)) {
        add('A', 'm_acta', 'Acta constitutiva con boleta de inscripción en el Registro Público de Comercio', renov ? 'Ya consta del contrato anterior: solo si cambió.' : 'Para la declaración de constitución (escritura, notario, folio mercantil).', renov);
        add('A', 'm_reformas', 'Reformas o actas de asamblea posteriores', 'Si cambió su capital o su administración.', true);
        add('A', 'm_csf', 'Constancia de situación fiscal (RFC) de la empresa, emitida hace no más de 30 días');
        add('A', 'm_poder', 'Poder del representante legal, con su inscripción', renov ? 'Ya consta del contrato anterior: solo si cambió el representante o sus facultades.' : 'Pleitos y cobranzas y actos de administración (general, fiscal y laboral).', renov);
        add('A', 'm_idRep', 'Identificación oficial vigente del representante legal');
        add('A', 'm_curpRep', 'CURP y constancia de situación fiscal (RFC) del representante legal (la constancia, emitida hace no más de 30 días)');
        const socios = [1, 2, 3, 4].filter(n => (d[`socio${n}`] || '').trim());
        if (socios.length) socios.forEach(n => {
            add('A', `m_socio${n}_csf`, `Constancia de situación fiscal (RFC) del socio: ${d[`socio${n}`].trim()}, emitida hace no más de 30 días`);
            add('A', `m_socio${n}_curp`, `CURP del socio: ${d[`socio${n}`].trim()}`);
        });
        else add('A', 'm_socios', 'Constancia de situación fiscal (RFC), emitida hace no más de 30 días, y CURP de cada uno de los socios', 'Captura los socios en el cuestionario para que salga un renglón por socio.', false, 'Uno por cada socio o accionista.');
        add('A', 'm_domicilio', 'Comprobante de domicilio fiscal (no mayor a 3 meses)');
        add('A', 'm_opinion', 'Opinión de cumplimiento del SAT (32-D) en positivo');
    }
    if (fisica || (todos && !moral)) {
        add('B', 'f_id', 'Identificación oficial vigente');
        add('B', 'f_curpcsf', 'CURP y constancia de situación fiscal (RFC), esta última emitida hace no más de 30 días');
        add('B', 'f_domicilio', 'Comprobante de domicilio (no mayor a 3 meses)');
        add('B', 'f_nacionalidad', 'Acta de nacimiento o comprobante de nacionalidad mexicana');
    }
    if (conObligado) {
    add('C', 'o_id', 'Identificación oficial vigente del obligado solidario');
    add('C', 'o_curpcsf', 'CURP y constancia de situación fiscal (RFC) del obligado solidario (la constancia, emitida hace no más de 30 días)');
    add('C', 'o_domicilio', 'Comprobante de domicilio del obligado solidario');
    add('C', 'o_escritura', 'Escritura del inmueble en garantía, con su inscripción en el Registro Público de la Propiedad', 'Para la declaración III.C (escritura, notario, folio real).');
    add('C', 'o_predial', 'Boleta predial y clave catastral del inmueble');
    add('C', 'o_conyuge', 'Si es casado: acta de matrimonio y régimen, o consentimiento del cónyuge', 'Sugerencia: no lo pide el contrato actual; confirmar con el abogado.', true, '');
    }
    return lista;
}

/** { total, recibidos } de los documentos obligatorios (los opcionales no cuentan). */
export function resumenDocumentos(p) {
    const lista = documentosDe(p.datos || {}).filter(x => !x.opcional), doc = p.documentos || {};
    return { total: lista.length, recibidos: lista.filter(x => doc[x.clave]?.recibido).length };
}

// ---- Precarga de una renovación con lo que ya consta en el contrato actual (17/11/2026) ----
// Una renovación es el mismo inquilino: su razón social, RFC, representante, domicilio, correos, garantía, etc. ya están en
// `contratos/{id}`. Esto devuelve esos datos con las claves del cuestionario y del borrador del contrato; solo trae lo que
// existe (nunca inventa) y quien lo use debe llenar únicamente los campos vacíos.
const lineas = x => Array.isArray(x) ? x.map(s => String(s).trim()).filter(Boolean).join('\n') : String(x ?? '').trim();
const ES_MORAL = /(\bS\.?\s?A\.?\s?P\.?\s?I\.?\b|\bS\.?\s?A\.?(\s|,|$)|\bS\.?\s?DE\s?R\.?\s?L\.?|\bDE\s+C\.?\s?V\.?\s*$|\bS\.?\s?C\.?\s*$|\bA\.?\s?C\.?\s*$)/i;
export function datosDeContrato(c) {
    const dc = c.datosContrato || {};
    const pagado = (c.historialDepositos || []).filter(p => p.tipo !== 'compartido').reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const socios = Array.isArray(c.socios) ? c.socios : [];
    const d = {
        tipoPersona: c.tipoPersona || dc.tipoPersona || (c.razonSocial ? (ES_MORAL.test(c.razonSocial) ? 'moral' : 'fisica') : ''),
        razonSocial: c.razonSocial, rfc: c.rfc, curp: c.curp, nombreComercial: c.nombreComercial, giro: c.giro,
        telefono: c.telefono, correosNotificacion: lineas(c.correosNotificacion), correosFacturacion: lineas(c.facturacion?.correos),
        direccion: lineas(c.direccion), representante: c.representante, repRfc: c.repRfc, repCurp: c.repCurp,
        garantia: c.garantia, garantiaDetalle: c.garantiaDetalle, obligadosSolidarios: lineas(c.obligadosSolidarios),
        // Solo en el borrador del contrato
        entradaLocal: dc.entradaLocal, constitucion: dc.constitucion, poderRepresentante: dc.poderRepresentante,
        osNombre: dc.osNombre, osCurp: dc.osCurp, osRfc: dc.osRfc, osDomicilio: dc.osDomicilio, osInmueble: dc.osInmueble, osEscritura: dc.osEscritura,
        posesionDesde: c.posesionDesde || dc.posesionDesde || c.inicio, depositoAnterior: pagado > 0 ? String(Math.round(pagado * 100) / 100) : ''
    };
    socios.slice(0, 4).forEach((s, i) => { d[`socio${i + 1}`] = s.nombre; d[`socio${i + 1}Rfc`] = s.rfc; d[`socio${i + 1}Curp`] = s.curp; });
    return Object.fromEntries(Object.entries(d).map(([k, x]) => [k, String(x ?? '').trim()]).filter(([, x]) => x));
}
