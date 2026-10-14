/* =====================================================================
   importar.js — Cargar proyectos desde el Excel de los administradores
   ---------------------------------------------------------------------
   El Excel trae las mismas columnas del informe de salida:
     A SOLICITANTE/CLIENTE        → zona (Licitación / Zona 1 / Zona 2)
     B NOMBRE DEL PROYECTO        → nombre
     C FECHA PROGRAMADA           → fecha
     D HORA DE SALIDA PROGRAMADA  → hora de salida (opcional)
     E HORA DE LLEGADA PROGRAMADA → hora de llegada
     F TRANSPORTE                 → TPLAB o Cliente
     H ACTIVIDAD A REALIZAR       → actividad (y de aquí se SUGIEREN los ensayos)
   Columnas opcionales que también se leen si existen:
     UBICACION, OBSERVACIONES.
   La ubicación y la confirmación de ensayos se completan en la app.
   ===================================================================== */

import { leerUbicacion } from './ubicaciones.js';
import { aISO, aHHMM } from './util.js';

/** Quita tildes y pasa a mayúsculas para comparar textos. */
const normal = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Zona a partir del solicitante. Devuelve null si es un cliente privado. */
export function zonaDeSolicitante(texto) {
  const t = normal(texto);
  if (/LICITACION/.test(t)) return 'DOM';
  if (/ZONA\s*1\b/.test(t)) return 'ZONA1';
  if (/ZONA\s*2\b/.test(t)) return 'ZONA2';
  return null;
}

/**
 * Ensayos sugeridos a partir del texto de la actividad.
 * Es una ayuda: el administrador los revisa y confirma en la app.
 */
export function ensayosDeActividad(texto) {
  const t = normal(texto), e = new Set();
  const hay = re => re.test(t);
  // "Extracción de núcleos de MRBC" es extracción, no control de colado de lodocreto
  if (hay(/LODOCRETO|MRBC|MRCB/) && !hay(/NUCLEOS?\b|EXTRACCION/)) e.add('CONTROLCOLLODO');
  if (hay(/CONCRETO|REVENIMIENTO|VIGAS?\b/) && !hay(/^[^,]*LODOCRETO[^,]*$/)) e.add('CONTROLCOLCONCRETO');
  if (hay(/MORTERO|CUBOS?\b/)) e.add('CUBOSMORTERO');
  if (hay(/PRISMA|GROUT|GORUT/)) e.add('PRISMASGROUT');
  if (hay(/SUELO[ -]?CEMENTO|BRIQUETA/)) e.add('BRIQUETASS/C');
  if (hay(/NUCLEAR|DENSIMETRO/)) e.add('DENSIMNUCLEAR');
  if (hay(/CONO/) || (hay(/DENSIDAD/) && !hay(/NUCLEAR|DENSIMETRO/))) e.add('DENSCONOYARENA');
  if (hay(/CALCULAR|CALCULADAS|IN[ -]?SITU|EN CAMPO|COCINA|EN EL LUGAR/) && hay(/DENSIDAD|HUMEDAD/)) e.add('CALCDENSCAMPO');
  if (hay(/SPEEDY/)) e.add('SPEEDYTESTER');
  if (hay(/NUCLEOS?\b|EXTRACCION/)) e.add('EXTRACCIONNUCLEOS');
  if (hay(/MEZCLA ASFALTICA|\bMAC\b|ASFALTIC/)) e.add('CONTROLCOLMAC');
  if (hay(/CALICATA/)) e.add('CALICATAS');
  if (hay(/RECOLECCION/)) e.add('RECOLECCION');
  return [...e];
}

/** Valor de celda → 'AAAA-MM-DD'. */
function fechaCelda(v) {
  if (v instanceof Date && !isNaN(v)) return aISO(v);
  const s = String(v ?? '').trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s))) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  return '';
}

/** Valor de celda → 'HH:MM' (acepta hora de Excel, texto "7:30", "7:30 am"). */
function horaCelda(v) {
  if (v instanceof Date && !isNaN(v)) return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  if (typeof v === 'number' && v >= 0 && v < 1) return aHHMM(Math.round(v * 1440));
  const s = normal(v); const m = /(\d{1,2})(?::(\d{2}))?\s*(A\.?\s?M|P\.?\s?M)?/.exec(s);
  if (!m || s === '---') return '';
  let h = +m[1]; const mi = +(m[2] || 0);
  if (m[3] && m[3][0] === 'P' && h < 12) h += 12;
  if (m[3] && m[3][0] === 'A' && h === 12) h = 0;
  return h < 24 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : '';
}

/**
 * Lee el Excel y devuelve { proyectos, omitidos }.
 * proyectos: listos para guardar (sin id). omitidos: filas que no se cargaron y por qué.
 */
export function leerExcelProyectos(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  // Buscar la fila de encabezados y la posición de cada columna (por nombre, no por letra)
  let iEnc = filas.findIndex(f => f.some(c => /NOMBRE DEL PROYECTO/.test(normal(c))));
  if (iEnc < 0) throw new Error('No encontré la columna "NOMBRE DEL PROYECTO". Usa el formato del informe de salida.');
  const enc = filas[iEnc].map(normal);
  const col = (...nombres) => enc.findIndex(h => nombres.some(n => h.startsWith(n)));
  const c = {
    solicitante: col('SOLICITANTE', 'CLIENTE'), nombre: col('NOMBRE DEL PROYECTO'), fecha: col('FECHA PROGRAMADA', 'FECHA'),
    salida: col('HORA DE SALIDA'), llegada: col('HORA DE LLEGADA'), transporte: col('TRANSPORTE'),
    actividad: col('ACTIVIDAD'), ubicacion: col('UBICACION', 'COORDENADAS', 'MAPS'), observaciones: col('OBSERVACIONES'),
  };

  const proyectos = [], omitidos = [];
  filas.slice(iEnc + 1).forEach((f, k) => {
    const n = iEnc + k + 2;                                      // número de fila en Excel
    const v = i => (i >= 0 ? f[i] : '');
    const nombre = String(v(c.nombre)).trim();
    if (!nombre) return;                                        // fila vacía
    const zona = zonaDeSolicitante(v(c.solicitante));
    if (!zona) { omitidos.push(`Fila ${n}: cliente "${String(v(c.solicitante)).trim() || 'sin solicitante'}" no es Licitación, Zona 1 ni Zona 2.`); return; }
    const fecha = fechaCelda(v(c.fecha));
    if (!fecha) { omitidos.push(`Fila ${n}: falta la fecha programada.`); return; }
    const actividad = String(v(c.actividad)).trim();
    const p = {
      fecha, zona, nombre,
      horaLlegada: horaCelda(v(c.llegada)),
      horaSalida: horaCelda(v(c.salida)),
      transporte: normal(v(c.transporte)) === 'TPLAB' || !String(v(c.transporte)).trim() ? 'TPLAB' : 'CLIENTE',
      actividad,
      observaciones: String(v(c.observaciones)).trim(),
      ensayos: ensayosDeActividad(actividad),
      ensayosRevisar: true,                                      // sugeridos: falta confirmarlos
      ubicacion: '', lat: null, lng: null,
    };
    const ub = String(v(c.ubicacion)).trim();
    if (ub) { const u = leerUbicacion(ub); p.ubicacion = ub; if (!u.error) { p.lat = u.lat; p.lng = u.lng; } }
    proyectos.push(p);
  });
  return { proyectos, omitidos };
}

/** Clave para reconocer el mismo proyecto si el Excel se carga dos veces. */
export const claveProyecto = p => p.fecha + '|' + normal(p.nombre) + '|' + (p.horaLlegada || '');
