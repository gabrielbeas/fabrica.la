// Nuevos inquilinos (11/11/2026): proceso para cambiar de inquilino (o renovar) en un local que ya existe.
// Un proceso = documento `nuevos_inquilinos/{id}`:
//   contratoId (contrato del local que se reemplaza), locales, estado (en_proceso | activado | descartado),
//   interesado, datos {propuesta + cuestionario + contrato, mismas claves}, propuestaEnviada, aceptada (fechas),
//   versionPdf (PDF del contrato), pagos [{concepto, fecha, monto, nota}], contratoNuevoId.
// Solo admin (regla general de Firestore).

export const ETAPAS = [
    { clave: 'local', nombre: 'Local', corto: 'Local' },
    { clave: 'propuesta', nombre: 'Propuesta enviada', corto: 'Propuesta' },
    { clave: 'cuestionario', nombre: 'Cuestionario de datos', corto: 'Cuestionario' },
    { clave: 'contrato', nombre: 'Contrato (borrador y PDF)', corto: 'Contrato' },
    { clave: 'pagos', nombre: 'Firma y pagos', corto: 'Firma y pagos' },
    { clave: 'activo', nombre: 'Activo', corto: 'Activo' }
];

/** Cada etapa con `hecho` true/false, según lo que ya tiene el proceso. */
export function pasosDe(p) {
    const d = p.datos || {}, pagos = p.pagos || [];
    const hecho = {
        local: true,
        propuesta: !!p.propuestaEnviada,
        cuestionario: !!p.aceptada && !!(d.razonSocial && d.rfc),
        contrato: (p.versionPdf || 0) > 0,
        pagos: !!d.firma && pagos.some(x => x.concepto === 'deposito') && pagos.some(x => x.concepto === 'primera_renta'),
        activo: p.estado === 'activado'
    };
    return ETAPAS.map(e => ({ ...e, hecho: hecho[e.clave] }));
}

/** Etapa en la que va: la primera que no está hecha. */
export function etapaDe(p) {
    if (p.estado === 'descartado') return { clave: 'descartado', nombre: 'Descartado' };
    const pasos = pasosDe(p);
    return pasos.find(x => !x.hecho) || pasos[pasos.length - 1];
}

// ---------- Documentos que debe enviar el interesado ----------
// Grupos: A = persona moral, B = persona física, C = obligado solidario. Lo recibido se guarda en `p.documentos`
// ({ clave: { recibido: 'AAAA-MM-DD' | '', nota } }). Es solo un checklist: no bloquea la activación.
const GRUPOS = { A: 'A · Arrendatario, persona moral', B: 'B · Arrendatario, persona física', C: 'C · Obligado solidario' };
export { GRUPOS as GRUPOS_DOCUMENTOS };

/** Documentos que corresponden a este proceso, según el tipo de persona y los socios capturados.
 *  `todos`: mientras no se defina el tipo de persona, muestra los dos grupos (A y B) para poder verlos y exportarlos. */
export function documentosDe(datos = {}, todos = false) {
    const d = datos, lista = [];
    const add = (grupo, clave, nombre, detalle = '', opcional = false, detallePdf = detalle) => lista.push({ grupo, clave, nombre, detalle, opcional, detallePdf });   // detallePdf = texto que sale en el PDF para el interesado
    const moral = d.tipoPersona === 'moral', fisica = d.tipoPersona === 'fisica';
    if (moral || (todos && !fisica)) {
        add('A', 'm_acta', 'Acta constitutiva con boleta de inscripción en el Registro Público de Comercio', 'Para la declaración de constitución (escritura, notario, folio mercantil).');
        add('A', 'm_reformas', 'Reformas o actas de asamblea posteriores', 'Si cambió su capital o su administración.', true);
        add('A', 'm_csf', 'Constancia de situación fiscal (RFC) de la empresa, actualizada');
        add('A', 'm_poder', 'Poder del representante legal, con su inscripción', 'Pleitos y cobranzas y actos de administración (general, fiscal y laboral).');
        add('A', 'm_idRep', 'Identificación oficial vigente del representante legal');
        add('A', 'm_curpRep', 'CURP y constancia de situación fiscal (RFC) del representante legal');
        const socios = [1, 2, 3, 4].filter(n => (d[`socio${n}`] || '').trim());
        if (socios.length) socios.forEach(n => {
            add('A', `m_socio${n}_csf`, `Constancia de situación fiscal (RFC) del socio: ${d[`socio${n}`].trim()}`);
            add('A', `m_socio${n}_curp`, `CURP del socio: ${d[`socio${n}`].trim()}`);
        });
        else add('A', 'm_socios', 'Constancia de situación fiscal (RFC) y CURP de cada uno de los socios', 'Captura los socios en el cuestionario para que salga un renglón por socio.', false, 'Uno por cada socio o accionista.');
        add('A', 'm_domicilio', 'Comprobante de domicilio fiscal (no mayor a 3 meses)');
        add('A', 'm_opinion', 'Opinión de cumplimiento del SAT (32-D) en positivo');
    }
    if (fisica || (todos && !moral)) {
        add('B', 'f_id', 'Identificación oficial vigente');
        add('B', 'f_curpcsf', 'CURP y constancia de situación fiscal (RFC)');
        add('B', 'f_domicilio', 'Comprobante de domicilio (no mayor a 3 meses)');
        add('B', 'f_nacionalidad', 'Acta de nacimiento o comprobante de nacionalidad mexicana');
    }
    add('C', 'o_id', 'Identificación oficial vigente del obligado solidario');
    add('C', 'o_curpcsf', 'CURP y constancia de situación fiscal (RFC) del obligado solidario');
    add('C', 'o_domicilio', 'Comprobante de domicilio del obligado solidario');
    add('C', 'o_escritura', 'Escritura del inmueble en garantía, con su inscripción en el Registro Público de la Propiedad', 'Para la declaración III.C (escritura, notario, folio real).');
    add('C', 'o_predial', 'Boleta predial y clave catastral del inmueble');
    add('C', 'o_conyuge', 'Si es casado: acta de matrimonio y régimen, o consentimiento del cónyuge', 'Sugerencia: no lo pide el contrato actual; confirmar con el abogado.', true, '');
    return lista;
}

/** { total, recibidos } de los documentos obligatorios (los opcionales no cuentan). */
export function resumenDocumentos(p) {
    const lista = documentosDe(p.datos || {}).filter(x => !x.opcional), doc = p.documentos || {};
    return { total: lista.length, recibidos: lista.filter(x => doc[x.clave]?.recibido).length };
}
