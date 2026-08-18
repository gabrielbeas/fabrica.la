/**
 * LFdC - Conector de datos en vivo (cliente)
 * -------------------------------------------
 * Consume el JSON crudo que devuelve el Apps Script (Code.gs) y lo
 * transforma en los mismos objetos `building` / `contracts` que ya
 * usan las páginas del panel (index.html, hidraulico.html,
 * lecturas-agua.html, agua-cobros.html).
 *
 * Diseño defensivo: cualquier fallo de red o de formato de las
 * hojas NUNCA debe tumbar la página. Cada función pública devuelve
 * `null` en caso de error (y deja un console.warn con el motivo) en
 * vez de lanzar una excepción; quien la llama decide si usa el
 * fallback local (datos embebidos / data.json).
 */

(function (global) {
  'use strict';

  // ---- Configuración: rellenar con los valores reales del deploy ----
  var CONFIG = {
    endpoint: '', // ej. 'https://script.google.com/macros/s/AKfycb.../exec'
    token: '',    // el mismo ACCESS_TOKEN configurado en Apps Script
    cacheMinutes: 5
  };

  function configure(opts) {
    if (opts.endpoint) CONFIG.endpoint = opts.endpoint;
    if (opts.token) CONFIG.token = opts.token;
    if (opts.cacheMinutes) CONFIG.cacheMinutes = opts.cacheMinutes;
  }

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------

  function normalizeName(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/\b(SAPI|SA|SRL|S DE RL|DE RL|DE CV|DE C V|C V)\b/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }

  function looksLikeIsoDate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);
  }

  // Convierte 'YYYY-MM-DDT..Z' (o ya un string simple) a 'YYYY-MM-DD'.
  function isoDateOnly(v) {
    if (!v) return null;
    if (looksLikeIsoDate(v)) return v.slice(0, 10);
    return String(v);
  }

  function money(n) {
    if (n === null || n === undefined || n === '') return null;
    var num = typeof n === 'number' ? n : parseFloat(String(n).replace(/[^0-9.\-]/g, ''));
    if (isNaN(num)) return null;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
  }

  function pct(n) {
    if (n === null || n === undefined || n === '') return null;
    var num = typeof n === 'number' ? n : parseFloat(n);
    if (isNaN(num)) return null;
    // Los porcentajes en la hoja vienen como fracción (0.1 = 10%) casi
    // siempre, pero algunos ya vienen como número entero grande (ej. '6% inc. mant').
    if (Math.abs(num) <= 1) return (num * 100).toFixed(2) + '%';
    return num.toFixed(2) + '%';
  }

  function findTab(bookData, tabName) {
    if (!bookData || !bookData.tabs) return null;
    for (var i = 0; i < bookData.tabs.length; i++) {
      if (bookData.tabs[i].name === tabName) return bookData.tabs[i];
    }
    return null;
  }

  // ---------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------

  function cacheKey(book) {
    return 'lfdc_sheets_' + book;
  }

  function readCache(book) {
    try {
      var raw = sessionStorage ? null : null; // ver nota abajo
    } catch (e) { /* noop */ }
    return null; // Nunca usamos localStorage/sessionStorage (política del panel).
  }

  /**
   * Descarga el libro (book: 'admin' | 'operacion') desde el Apps
   * Script. Devuelve la promesa con el objeto crudo
   * { spreadsheetName, tabs: [...] } o null si falla.
   */
  function fetchBook(book) {
    if (!CONFIG.endpoint || !CONFIG.token) {
      console.warn('[lfdc-sheets] No configurado (endpoint/token vacío).');
      return Promise.resolve(null);
    }
    var url = CONFIG.endpoint + '?token=' + encodeURIComponent(CONFIG.token) + '&book=' + encodeURIComponent(book);
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        if (payload.error) throw new Error(payload.error);
        return (payload.data && payload.data[book]) || null;
      })
      .catch(function (err) {
        console.warn('[lfdc-sheets] fetchBook(' + book + ') falló:', err.message);
        return null;
      });
  }

  // ---------------------------------------------------------------
  // Parsers: LFdC_CONTROL ADMIN 202608
  // ---------------------------------------------------------------

  // DIRECTORIO: encabezado en fila con 'NOMBRE DE ENCARGADO'; filas
  // siguientes: col1=LOCAL N (puede venir vacío en sub-renglones),
  // col2=empresa, col3=contacto, col4..6=emails, col8=celular.
  function parseDirectorio(tab) {
    var out = []; // [{ localLabel, empresa, contact, emails:[], cel }]
    if (!tab) return out;
    tab.values.forEach(function (row) {
      var empresa = (row[2] || '').toString().trim();
      if (!empresa) return;
      var emails = [row[4], row[5], row[6]]
        .map(function (x) { return (x || '').toString().trim(); })
        .filter(Boolean);
      out.push({
        localLabel: (row[1] || '').toString().trim() || null,
        empresa: empresa,
        contact: (row[3] || '').toString().trim() || null,
        emails: emails,
        cel: (row[8] || '').toString().trim() || null
      });
    });
    return out;
  }

  // RENTAS X LOCAL: fuente de verdad para local <-> empresa <-> área <-> renta neta.
  function parseRentasXLocal(tab) {
    var out = []; // [{ localLabel, empresa, rentaNeta2025, mt2, pesoPorMt2, renta2026, mt2026 }]
    if (!tab) return out;
    tab.values.forEach(function (row) {
      var localLabel = (row[1] || '').toString().trim();
      var empresa = (row[2] || '').toString().trim();
      if (!/^LOCAL/i.test(localLabel) || !empresa) return;
      out.push({
        localLabel: localLabel,
        empresa: empresa,
        rentaNeta: typeof row[3] === 'number' ? row[3] : null,
        mt2: typeof row[4] === 'number' ? row[4] : null,
        pesoPorMt2: typeof row[5] === 'number' ? row[5] : null,
        pesoPorMt2Proyectado: typeof row[6] === 'number' ? row[6] : null,
        rentaNetaProyectada: typeof row[7] === 'number' ? row[7] : null
      });
    });
    return out;
  }

  // AREAS LOCALES: totales de m2 por categoría. La hoja tiene varias
  // tablitas lado a lado (LOCALES COMERCIALES / OFICINAS arriba,
  // LOCALES CENTRALES / ÁREAS COMUNES abajo) y ambas usan la
  // etiqueta "TOTAL" repetida — por eso NO nos quedamos con "el
  // último TOTAL que aparezca" (eso pisaba comerciales con
  // centrales); en vez de eso sumamos cada "TOTAL" de col1/2 y nos
  // quedamos aparte con "TOTAL RENTABLES", que es el resumen real
  // de m² rentables de todo el edificio.
  function parseAreasLocales(tab) {
    var result = { locales: [], oficinas: [], centrales: [], comunes: [], totals: { localesSum: 0 } };
    if (!tab) return result;
    var vals = tab.values;
    vals.forEach(function (row) {
      var label = (row[1] || '').toString().trim();
      var m2 = row[2];
      if (label && typeof m2 === 'number') {
        if (/^Local \d+$/i.test(label)) result.locales.push({ label: label, m2: m2 });
        else if (/^TOTAL$/i.test(label)) result.totals.localesSum += m2;
      }
      var label2 = (row[4] || '').toString().trim();
      var m22 = row[5];
      if (label2 && typeof m22 === 'number') {
        if (/^Local \d+$/i.test(label2)) result.oficinas.push({ label: label2, m2: m22 });
        else if (/^TOTAL RENTABLES$/i.test(label2)) result.totals.totalRentable = m22;
        else if (/^TOTAL$/i.test(label2)) result.totals.oficinasSum = (result.totals.oficinasSum || 0) + m22;
      }
    });
    return result;
  }

  // DEPÓSITOS: tabla plana FECHA / CONCEPTO / LOCAL / BANCO / INGRESOS
  // con el registro real de cada depósito cobrado. Es la fuente de
  // verdad para "fecha de depósito" (INQUILINOS casi nunca trae esa
  // fecha junto al monto). La hoja tiene, más abajo, un resumen por
  // empresa y luego una sección de otro proyecto (no de este
  // edificio) reutilizando las mismas columnas — por eso nos
  // detenemos en la primera fila totalmente vacía después de haber
  // leído al menos un depósito real.
  function parseDepositos(tab) {
    var out = []; // [{ fecha, concepto, localRaw, banco, ingresos }]
    if (!tab) return out;
    var vals = tab.values;
    var headerIdx = -1, col = null;
    for (var i = 0; i < vals.length && headerIdx === -1; i++) {
      var row = vals[i];
      for (var c = 0; c < row.length; c++) {
        if ((row[c] || '').toString().trim().toUpperCase() === 'FECHA' &&
            (row[c + 1] || '').toString().trim().toUpperCase() === 'CONCEPTO') {
          headerIdx = i;
          col = { fecha: c, concepto: c + 1, local: c + 2, banco: c + 3, ingresos: c + 4 };
          break;
        }
      }
    }
    if (headerIdx === -1) return out;

    for (var r = headerIdx + 1; r < vals.length; r++) {
      var row2 = vals[r];
      var fecha = row2[col.fecha], concepto = row2[col.concepto], local = row2[col.local],
        banco = row2[col.banco], ingresos = row2[col.ingresos];
      var allEmpty = !fecha && !concepto && !local && !banco &&
        (ingresos === '' || ingresos === undefined || ingresos === null);
      if (allEmpty) {
        if (out.length > 0) break; // fin de la lista real de depósitos
        continue; // fila vacía antes de que arranquen los datos
      }
      if (!looksLikeIsoDate(fecha)) continue; // fila corrupta / no es un depósito
      out.push({
        fecha: fecha,
        concepto: (concepto || '').toString().trim(),
        localRaw: local,
        banco: (banco || '').toString().trim() || null,
        ingresos: typeof ingresos === 'number' ? ingresos : null
      });
    }
    return out;
  }

  // INQUILINOS: bloques irregulares "clave/valor" por contrato. La
  // fila que marca el inicio de bloque es la que trae
  // col[4] === 'FIRMA DE CONTRATO'. Dentro del bloque se escanean
  // TODAS las filas buscando pares (columna 2/3) y (columna 4/5)
  // con etiquetas conocidas, sin asumir un offset de fila fijo
  // (la hoja no es tabular estricta).
  var LABELS_45 = [
    'FIRMA DE CONTRATO', 'PLAZO', 'INICIO DEL CONTRATO',
    'FIN DEL CONTRATO', 'FIN DEL CONTRTATO', // typo real en la hoja
    'INCREMENTO DE RENTA', 'FECHA LÍMITE', 'DEPÓSITO', 'DEPÓSITO (PAGADO)',
    'MESES', 'MESES DEPÓSITO', 'MESES DE GRACIA', 'POR PAGAR', 'MANTENIMIENTO',
    'RENTA BASE', 'TOTAL', 'TOTAL + IVA', 'BASE INCREMENTO 2025', 'MANTENIENTO'
  ];

  function parseInquilinos(tab) {
    var blocks = [];
    if (!tab) return blocks;
    var vals = tab.values;
    var startIdxs = [];
    vals.forEach(function (row, i) {
      if ((row[4] || '').toString().trim().toUpperCase() === 'FIRMA DE CONTRATO') startIdxs.push(i);
    });

    startIdxs.forEach(function (startIdx, bi) {
      var endIdx = bi + 1 < startIdxs.length ? startIdxs[bi + 1] : vals.length;
      var block = {
        empresa: (vals[startIdx][2] || '').toString().trim(),
        rfc: null,
        localesRaw: null,
        mt2: null,
        garantia: null,
        direccion: null,
        detail: {}
      };
      var rentasPorAnio = {}; // { '2024': {monto, incremento} }

      for (var r = startIdx; r < endIdx; r++) {
        var row = vals[r];

        // Pares en columnas 2/3
        var label23 = (row[2] || '').toString().trim().toUpperCase().replace(/:$/, '');
        if (label23 === 'RFC' && row[3]) block.rfc = row[3];
        if (label23 === 'LOCALES') block.localesRaw = row[3];
        if (label23 === 'MT2' && typeof row[3] === 'number') block.mt2 = row[3];
        if (label23 === 'GARANTÍA') block.garantia = row[3];
        if (label23 === 'DIRECCIÓN') {
          var dirParts = [row[3]];
          if (vals[r + 1] && /^COL\./i.test((vals[r + 1][3] || ''))) dirParts.push(vals[r + 1][3]);
          if (vals[r + 2] && /^CP:/i.test((vals[r + 2][3] || ''))) dirParts.push(vals[r + 2][3]);
          block.direccion = dirParts.filter(Boolean).join(', ');
        }
        // A veces RFC viene solo en col2 (sin 'RFC:' en col2 y el
        // valor tipo 'XXX000000XX0' cae directo en col2 del renglón
        // siguiente al de la empresa) — lo dejamos pasar, no crítico.

        // Pares en columnas 4/5
        var label45 = (row[4] || '').toString().trim().toUpperCase();
        if (label45 && row[5] !== undefined && row[5] !== '') {
          var rentaMatch = label45.match(/RENTA\s+MENSUAL\s*([0-9]{4})/);
          if (rentaMatch) {
            var year = rentaMatch[1];
            rentasPorAnio[year] = rentasPorAnio[year] || {};
            rentasPorAnio[year].monto = row[5];
            if (typeof row[6] === 'number') rentasPorAnio[year].incremento = row[6];
          } else if (LABELS_45.indexOf(label45) !== -1) {
            block.detail[label45] = { value: row[5], extra: row[6] };
          }
        }
      }

      block.rentasPorAnio = rentasPorAnio;
      blocks.push(block);
    });

    return blocks;
  }

  // ---------------------------------------------------------------
  // Ensamblado final: construir `contracts` y `building` con el
  // mismo esquema que ya usan index.html / detail.html.
  // ---------------------------------------------------------------

  function pickDetailValue(block, key) {
    var d = block.detail[key];
    return d ? d.value : null;
  }

  function pickDetailExtra(block, key) {
    var d = block.detail[key];
    return d ? d.extra : null;
  }

  function buildContractsFromAdmin(adminBook) {
    var rentas = parseRentasXLocal(findTab(adminBook, 'RENTAS X LOCAL'));
    var directorio = parseDirectorio(findTab(adminBook, 'DIRECTORIO'));
    var inquilinos = parseInquilinos(findTab(adminBook, 'INQUILINOS'));
    var depositos = parseDepositos(findTab(adminBook, 'DEPÓSITOS'));

    // Índice de depósitos por número de local: SOLO renglones cuyo
    // campo LOCAL es un número suelto (ej. "2"), no listas como
    // "6,7,15". Esas listas son de una etapa anterior del edificio
    // (antes de subdividir el espacio en locales individuales) y
    // "repartirlas" entre los locales 6, 7 y 15 por igual terminaba
    // asignando depósitos de una empresa distinta a la que hoy ocupa
    // cada local (se detectó con COCKTAILS AND DIAMONDS, que heredaba
    // por error la fecha de un depósito de "A MI ME GUSTA LA GASOLINA").
    var depositosByLocalStrict = {};
    var depositosByNombre = {};
    depositos.forEach(function (dep) {
      var raw = dep.localRaw;
      if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw.trim()))) {
        var key = String(raw).trim();
        (depositosByLocalStrict[key] = depositosByLocalStrict[key] || []).push(dep);
      }
      var nameKey = normalizeName(dep.concepto);
      if (nameKey) (depositosByNombre[nameKey] = depositosByNombre[nameKey] || []).push(dep);
    });
    function sortByFechaAsc(list) {
      return list.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : 0); });
    }

    // Índice de inquilinos por local (usando localesRaw si es un
    // número/lista de números válida) y por nombre normalizado como
    // respaldo SOLO para los bloques cuyo campo LOCALES no se pudo
    // leer como número (ej. quedó capturado como fecha por un typo
    // en la hoja). Un bloque que ya matcheó por número queda
    // excluido del respaldo por nombre, para no "robarle" el match
    // a otro local con la misma empresa (pasa con SEMILLERO STUDIOS,
    // que tiene dos contratos distintos: LOCAL 10 y LOCAL 11,12,13).
    var byLocalNumber = {};
    var byNormNameList = {};
    inquilinos.forEach(function (blk) {
      var raw = blk.localesRaw;
      var validNumeric = (typeof raw === 'number') ||
        (typeof raw === 'string' && /^\d+(\s*,\s*\d+)*$/.test(raw.trim()));
      if (validNumeric) {
        String(raw).split(',').forEach(function (n) {
          byLocalNumber[n.trim()] = blk;
        });
      } else {
        var key = normalizeName(blk.empresa);
        (byNormNameList[key] = byNormNameList[key] || []).push(blk);
      }
    });

    var contracts = rentas.map(function (r, idx) {
      var localNumMatch = r.localLabel.match(/LOCAL\s+([\d,\s]+)/i);
      var firstLocalNum = localNumMatch ? localNumMatch[1].split(',')[0].trim() : null;

      var blk = firstLocalNum && byLocalNumber[firstLocalNum];
      if (!blk) {
        var candidates = byNormNameList[normalizeName(r.empresa)] || [];
        if (candidates.length === 1) {
          blk = candidates[0];
        } else if (candidates.length > 1) {
          console.warn('[lfdc-sheets] Ambiguo: "' + r.empresa + '" (' + r.localLabel + ') tiene ' + candidates.length + ' contratos candidatos en INQUILINOS y ninguno con LOCALES numérico válido; se deja sin datos de detalle.');
        }
      }

      var dir = directorio.filter(function (d) {
        return normalizeName(d.empresa) === normalizeName(r.empresa) ||
          (d.localLabel && r.localLabel && d.localLabel.toUpperCase() === r.localLabel.toUpperCase());
      })[0];

      // Depósito: la fecha real de cobro vive en la pestaña DEPÓSITOS,
      // no en INQUILINOS (que casi siempre trae el monto sin fecha).
      // Prioridad: (1) match exacto por número de local suelto, (2)
      // si no hay, match por nombre de empresa normalizado (cubre los
      // renglones "6,7,15" que sí traen el nombre correcto aunque el
      // campo LOCAL sea una lista histórica), (3) nada — se deja que
      // el llamador use el respaldo de INQUILINOS. Con varios
      // candidatos válidos se toma el más antiguo (el depósito
      // original, no una renovación posterior).
      var depositoMatch = null;
      var depCandidates = (firstLocalNum && depositosByLocalStrict[firstLocalNum]) || [];
      if (!depCandidates.length) {
        depCandidates = depositosByNombre[normalizeName(r.empresa)] || [];
        if (depCandidates.length > 1) {
          console.warn('[lfdc-sheets] "' + r.empresa + '" (' + r.localLabel + ') tiene ' + depCandidates.length + ' depósitos por coincidencia de nombre (sin match exacto de local); se usa el más antiguo.');
        }
      }
      if (depCandidates.length) {
        depositoMatch = sortByFechaAsc(depCandidates)[0];
      }

      var detail = null;
      if (blk) {
        var years = Object.keys(blk.rentasPorAnio).sort();
        var lastYear = years[years.length - 1];
        var lastYearMonto = lastYear ? blk.rentasPorAnio[lastYear].monto : null;
        var totalRaw = pickDetailValue(blk, 'TOTAL');
        var porcentajeMantRaw = pickDetailValue(blk, 'MANTENIMIENTO');
        // El monto en $ del mantenimiento no viene directo en la hoja
        // (solo el %); pero TOTAL = renta del último año + mantenimiento
        // en todos los contratos verificados, así que se deriva de ahí
        // en vez de asumir una fórmula sobre el % (más confiable).
        var mantenimientoMonto = (typeof totalRaw === 'number' && typeof lastYearMonto === 'number')
          ? Math.round((totalRaw - lastYearMonto) * 100) / 100
          : null;

        detail = {
          firmaContrato: isoDateOnly(pickDetailValue(blk, 'FIRMA DE CONTRATO')),
          plazo: pickDetailValue(blk, 'PLAZO'),
          inicioContrato: isoDateOnly(pickDetailValue(blk, 'INICIO DEL CONTRATO')),
          finContrato: isoDateOnly(pickDetailValue(blk, 'FIN DEL CONTRATO') || pickDetailValue(blk, 'FIN DEL CONTRTATO')),
          incrementoRenta: isoDateOnly(pickDetailValue(blk, 'INCREMENTO DE RENTA')),
          incrementoTipo: pickDetailExtra(blk, 'INCREMENTO DE RENTA'),
          fechaLimite: pickDetailValue(blk, 'FECHA LÍMITE'),
          deposito: money(pickDetailValue(blk, 'DEPÓSITO') !== null ? pickDetailValue(blk, 'DEPÓSITO') : pickDetailValue(blk, 'DEPÓSITO (PAGADO)')),
          fechaDeposito: isoDateOnly(depositoMatch ? depositoMatch.fecha : (pickDetailExtra(blk, 'DEPÓSITO') || pickDetailExtra(blk, 'DEPÓSITO (PAGADO)'))),
          depositoBanco: depositoMatch ? depositoMatch.banco : null,
          meses: pickDetailValue(blk, 'MESES') || pickDetailValue(blk, 'MESES DEPÓSITO'),
          porPagar: money(pickDetailValue(blk, 'POR PAGAR')),
          mantenimiento: mantenimientoMonto !== null ? money(mantenimientoMonto) : null,
          porcentajeMantenimiento: pct(porcentajeMantRaw),
          total: money(totalRaw),
          totalIVA: money(pickDetailValue(blk, 'TOTAL + IVA')),
          direccion: blk.direccion || null,
          rfc: blk.rfc || null,
          rentasPorAnio: {}
        };
        years.forEach(function (y) {
          detail.rentasPorAnio[y] = {
            monto: money(blk.rentasPorAnio[y].monto),
            incremento: blk.rentasPorAnio[y].incremento !== undefined ? pct(blk.rentasPorAnio[y].incremento) : null
          };
          // Claves "planas" (renta2024, incremento2025, ...) para
          // compatibilidad con detail.html, que no conoce rentasPorAnio.
          detail['renta' + y] = detail.rentasPorAnio[y].monto;
          detail['incremento' + y] = detail.rentasPorAnio[y].incremento;
        });
      }

      return {
        id: idx + 1,
        number: r.localLabel.toUpperCase(),
        name: r.empresa,
        area: r.mt2 !== null ? (r.mt2 + ' m²') : null,
        rent: money(r.rentaNeta),
        contact: dir ? dir.contact : null,
        email: dir && dir.emails.length ? dir.emails.join(' | ') : null,
        cel: dir ? dir.cel : null,
        detail: detail,
        _matched: !!blk
      };
    });

    return contracts;
  }

  function buildBuildingFromAdmin(adminBook, contracts) {
    var areas = parseAreasLocales(findTab(adminBook, 'AREAS LOCALES'));
    var totalMonthly = contracts.reduce(function (sum, c) {
      var n = c.rent ? parseFloat(c.rent.replace(/[^0-9.]/g, '')) : 0;
      return sum + (isNaN(n) ? 0 : n);
    }, 0);

    return {
      totalArea: areas.totals.totalRentable ? (areas.totals.totalRentable.toLocaleString('en-US') + ' m²') : null,
      numberOfLocals: contracts.length,
      status: {
        monthlyIncome: money(totalMonthly),
        occupiedLocals: contracts.filter(function (c) { return c._matched; }).length,
        occupancyPercentage: contracts.length ? Math.round(100 * contracts.filter(function (c) { return c._matched; }).length / contracts.length) : null
      }
    };
  }

  // ---------------------------------------------------------------
  // Parsers: LFdC_OPERACION 202608
  // ---------------------------------------------------------------

  // MEDIDORES HIDRAULICO: tabla limpia, encabezado en la fila que
  // trae 'LOCAL' en col1. Alimenta hidraulico.html (mismo esquema
  // que ya usa esa página: local/tubo/medidor/empresa/diametro/fecha/notas).
  function parseMedidoresHidraulico(tab) {
    var out = [];
    if (!tab) return out;
    var vals = tab.values;
    var headerIdx = vals.findIndex(function (row) { return (row[1] || '').toString().trim().toUpperCase() === 'LOCAL'; });
    if (headerIdx === -1) return out;
    for (var i = headerIdx + 1; i < vals.length; i++) {
      var row = vals[i];
      if (row[1] === '' && row[2] === '' ) continue;
      out.push({
        local: row[1] === '' || row[1] === undefined ? '' : String(row[1]),
        tubo: row[2] === '' || row[2] === undefined ? '' : String(row[2]),
        medidor: (row[3] || '').toString().trim(),
        empresa: (row[4] || '').toString().trim(),
        diametro: (row[5] || '').toString().trim(),
        fecha: isoDateOnly(row[6]),
        notas: (row[7] || '').toString().trim()
      });
    }
    return out;
  }

  // HIDRAULICO (operación): las primeras filas (después del
  // encabezado 'LOCAL'/'CONSUMO MT3'/'EMPRESA') son la "foto" del
  // consumo del mes vigente por medidor — es la que alimenta
  // agua-cobros.html. El campo LOCAL de esta tabla tiene el mismo
  // tipo de corrupción que vimos en INQUILINOS (Sheets convirtió
  // algunos valores tipo "8, 9" en fecha). Cuando pasa, preferimos
  // reconstruir el local "agrupado" (ej. "8, 9", "7, 15") cruzando
  // por nombre de empresa contra RENTAS X LOCAL del libro admin
  // (rentasByNormName) — así el resultado coincide con la
  // convención que ya usa el sitio, en vez de mostrar solo el
  // número de tubo (que no agrupa locales compartidos).
  function parseConsumoActual(tab, medidores, rentasByNormName) {
    var out = [];
    if (!tab) return out;
    var vals = tab.values;
    var headerIdx = vals.findIndex(function (row) {
      return (row[1] || '').toString().trim().toUpperCase() === 'LOCAL' && (row[4] || '').toString().trim().toUpperCase() === 'CONSUMO MT3';
    });
    if (headerIdx === -1) return out;

    var tuboToLocal = {};
    (medidores || []).forEach(function (m) { if (m.tubo) tuboToLocal[m.tubo] = m.local; });

    var latestRate = null; // último "COSTO X M3" no vacío visto en toda la hoja (tarifa vigente)

    for (var i = headerIdx + 1; i < vals.length; i++) {
      var row = vals[i];
      var tubo = row[2];
      var empresa = (row[5] || '').toString().trim();
      if (!empresa && (tubo === '' || tubo === undefined)) break; // fin de la tabla
      if (!empresa) continue;

      var localRaw = row[1];
      var localLabel;
      if (typeof localRaw === 'number' || (typeof localRaw === 'string' && /^[\d,\s]+$/.test(localRaw))) {
        localLabel = String(localRaw);
      } else {
        var rentaMatch = rentasByNormName && rentasByNormName[normalizeName(empresa)];
        if (rentaMatch) {
          localLabel = rentaMatch.localLabel.replace(/^LOCAL\s+/i, '');
        } else {
          localLabel = tuboToLocal[String(tubo)] || String(tubo);
        }
      }

      out.push({
        local: localLabel,
        tubo: String(tubo),
        empresa: empresa,
        consumo: typeof row[4] === 'number' ? row[4] : null,
        costoM3: typeof row[6] === 'number' && row[6] > 0 ? row[6] : null,
        monto: typeof row[7] === 'number' && row[7] > 0 ? row[7] : null
      });
    }

    // Tarifa vigente ($/m3): tomamos el último valor numérico > 0 en
    // la columna COSTO X M3 (índice 5) de TODA la hoja — los bloques
    // históricos por medidor, más abajo, sí la traen mes a mes y el
    // último que aparece es la tarifa SIAPA más reciente registrada.
    vals.forEach(function (row) {
      var v = row[5];
      if (typeof v === 'number' && v > 0) latestRate = v;
    });

    if (latestRate) {
      out.forEach(function (item) {
        if (item.monto === null && item.consumo !== null) {
          item.costoM3 = item.costoM3 || latestRate;
          item.monto = Math.round(item.consumo * latestRate * 100) / 100;
        }
      });
    }

    return { items: out, costoM3Actual: latestRate };
  }

  // Resumen "SERVICIOS GENERAL / MAESTRO / DIFERENCIA" que aparece
  // justo debajo de la tabla de consumo actual en la pestaña
  // HIDRAULICO — alimenta el resumen de agua-cobros.html.
  function parseMaestroResumen(tab) {
    var result = { consumoServicios: null, maestro: null, diferencia: null };
    if (!tab) return result;
    tab.values.forEach(function (row) {
      var label = (row[4] || '').toString().trim().toUpperCase();
      var val = row[6];
      if (typeof val !== 'number') return;
      if (label === 'SERVICIOS GENERAL') result.consumoServicios = val;
      else if (label === 'MAESTRO') result.maestro = val;
      else if (label === 'DIFERENCIA') result.diferencia = val;
    });
    return result;
  }

  function buildOperacionData(operacionBook, adminBook) {
    var medidores = parseMedidoresHidraulico(findTab(operacionBook, 'MEDIDORES HIDRAULICO'));

    var rentasByNormName = null;
    if (adminBook) {
      rentasByNormName = {};
      parseRentasXLocal(findTab(adminBook, 'RENTAS X LOCAL')).forEach(function (r) {
        rentasByNormName[normalizeName(r.empresa)] = r;
      });
    }

    var hidraulicoTab = findTab(operacionBook, 'HIDRAULICO');
    var consumo = parseConsumoActual(hidraulicoTab, medidores, rentasByNormName);
    var maestro = parseMaestroResumen(hidraulicoTab);
    maestro.consumoLocales = Math.round(consumo.items.reduce(function (sum, i) { return sum + (i.consumo || 0); }, 0) * 1000) / 1000;
    return { medidores: medidores, consumoActual: consumo.items, costoM3Actual: consumo.costoM3Actual, maestro: maestro };
  }

  // Adapta la salida de buildContractsFromAdmin() (que trae solo lo
  // que sale de las hojas) al esquema completo que ya usan
  // index.html / detail.html: agrega `tenant`, `status`,
  // `startDate`/`endDate` (derivados de detail) y una `notes` que
  // indica que el dato es en vivo. No inventa nada que no venga de
  // la hoja o de una fecha calculable.
  function adaptContractsForUI(rawContracts) {
    var today = new Date();
    return (rawContracts || []).map(function (c, idx) {
      var startDate = c.detail ? c.detail.inicioContrato : null;
      var endDate = c.detail ? c.detail.finContrato : null;
      var status = 'active';
      if (endDate) {
        var end = new Date(endDate + 'T00:00:00');
        var diffDays = Math.round((end - today) / 86400000);
        if (diffDays < 0) status = 'expired';
        else if (diffDays <= 90) status = 'expiring';
      }
      var notes = c._matched
        ? 'Datos en vivo desde Google Sheets (LFdC_CONTROL ADMIN). Actualizado: ' + new Date().toISOString().slice(0, 10) + '.'
        : 'Sin contrato registrado en INQUILINOS — solo datos de renta/área de RENTAS X LOCAL.';
      return {
        id: c.id !== undefined ? c.id : idx + 1,
        number: c.number,
        name: c.name,
        tenant: c.name,
        area: c.area,
        rent: c.rent,
        status: status,
        startDate: startDate,
        endDate: endDate,
        contact: c.contact,
        email: c.email,
        notes: notes,
        detail: c.detail
      };
    });
  }

  // ---------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------

  function loadLiveData() {
    return Promise.all([fetchBook('admin'), fetchBook('operacion')]).then(function (books) {
      var adminBook = books[0], operacionBook = books[1];
      var result = { contracts: null, building: null, medidores: null, consumoActual: null, costoM3Actual: null, maestro: null, raw: {} };

      if (adminBook) {
        try {
          result.contracts = buildContractsFromAdmin(adminBook);
          result.contractsUI = adaptContractsForUI(result.contracts);
          result.building = buildBuildingFromAdmin(adminBook, result.contracts);
          result.raw.admin = adminBook;
        } catch (err) {
          console.warn('[lfdc-sheets] Error parseando admin book:', err);
        }
      }

      if (operacionBook) {
        try {
          var op = buildOperacionData(operacionBook, adminBook);
          result.medidores = op.medidores;
          result.consumoActual = op.consumoActual;
          result.costoM3Actual = op.costoM3Actual;
          result.maestro = op.maestro;
          result.raw.operacion = operacionBook;
        } catch (err) {
          console.warn('[lfdc-sheets] Error parseando operacion book:', err);
        }
      }

      if (!result.contracts && !result.medidores) return null;
      return result;
    });
  }

  var api = {
    configure: configure,
    fetchBook: fetchBook,
    loadLiveData: loadLiveData,
    adaptContractsForUI: adaptContractsForUI,
    // expuestos para pruebas / depuración:
    _internal: {
      normalizeName: normalizeName,
      parseDirectorio: parseDirectorio,
      parseRentasXLocal: parseRentasXLocal,
      parseAreasLocales: parseAreasLocales,
      parseInquilinos: parseInquilinos,
      buildContractsFromAdmin: buildContractsFromAdmin,
      buildBuildingFromAdmin: buildBuildingFromAdmin,
      parseMedidoresHidraulico: parseMedidoresHidraulico,
      parseConsumoActual: parseConsumoActual,
      parseMaestroResumen: parseMaestroResumen,
      buildOperacionData: buildOperacionData,
      findTab: findTab,
      money: money,
      pct: pct
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.LFdCSheets = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
