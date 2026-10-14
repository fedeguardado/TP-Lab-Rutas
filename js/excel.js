/* =====================================================================
   excel.js — Archivos de Excel
   ---------------------------------------------------------------------
   1. Informe de salida de rutas (plantilla de TP Lab + 4 columnas extra)
   2. Informe de recolecciones
   3. Respaldo del día (descargar y volver a cargar)
   Usa la librería SheetJS (variable global XLSX, cargada en index.html).
   ===================================================================== */

import { ZONA } from './bases.js';
import { aMin, deISO } from './util.js';

/* ------------------------- Ayudantes de celdas ------------------------- */

/** 'HH:MM' → celda de hora de Excel (fracción del día con formato hh:mm). */
function celdaHora(hhmm) {
  const m = aMin(hhmm);
  return m == null ? { t: 's', v: hhmm || '' } : { t: 'n', v: m / 1440, z: 'hh:mm' };
}
/** 'AAAA-MM-DD' → celda de fecha de Excel. */
function celdaFecha(iso) {
  return iso ? { t: 'd', v: deISO(iso), z: 'dd/mm/yyyy' } : { t: 's', v: '' };
}
/** Crea una hoja a partir de filas (arreglo de arreglos) con anchos de columna. */
function hoja(filas, anchos) {
  const ws = XLSX.utils.aoa_to_sheet(filas, { cellDates: true });
  ws['!cols'] = anchos.map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

/**
 * Entrega el archivo al usuario. En la página publicada usa la función
 * de descargas de Claude (pide confirmación); fuera de ella, descarga directa.
 */
export async function guardarArchivo(wb, nombre, descargas) {
  if (descargas) {
    const datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
    await descargas.save({ filename: nombre, data: new Uint8Array(datos) });
  } else {
    XLSX.writeFile(wb, nombre, { cellDates: true });
  }
}

/* ===================== 1. Informe de salida de rutas ===================== */

const ENCABEZADO_RUTAS = [
  'SOLICITANTE/CLIENTE', 'NOMBRE DEL PROYECTO', 'FECHA PROGRAMADA (FECHA DE MUESTREO)',
  'HORA DE SALIDA PROGRAMADA', 'HORA DE LLEGADA PROGRAMADA', 'TRANSPORTE', 'VEHICULO ASIGNADO',
  'ACTIVIDAD A REALIZAR / TIPO DE MUESTRA', 'PERSONA ASIGNADA',
  'OBSERVACIONES', 'HORA DE SALIDA RECOMENDADA', 'DISTANCIA (KM)', 'SUGERENCIA',
];

/** Arma el libro del informe de salida para un día. */
export function libroRutas(fecha, filas, proyectosPorId) {
  const datos = [ENCABEZADO_RUTAS];
  filas.forEach(f => {
    const p = proyectosPorId[f.proyectoId] || {};
    datos.push([
      (ZONA[p.zona] || {}).solicitante || '',
      p.nombre || '',
      celdaFecha(p.fecha || fecha),
      celdaHora(p.horaSalida),
      celdaHora(p.horaLlegada),
      p.transporte === 'CLIENTE' ? 'CLIENTE' : 'TPLAB',
      f.vehiculo || '',
      p.actividad || '',
      f.persona || 'SIN ASIGNAR',
      f.observaciones || '',
      f.salidaRecomendada ? celdaHora(f.salidaRecomendada) : '',
      f.km != null ? { t: 'n', v: f.km, z: '0.0' } : '',
      (f.sugerencias || []).join(' / '),
    ]);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(datos, [42, 60, 14, 12, 12, 11, 40, 60, 26, 36, 14, 10, 60]), 'Hoja1');
  return wb;
}

/* ======================== 2. Informe de recolecciones ======================== */

const ESTADOS = { 'recogido': 'Recogido', 'vencido': 'Vencido', 'vence-hoy': 'Vence hoy', 'aun-no': 'Aún no se puede', 'en-plazo': 'En plazo' };

export function libroRecolecciones(filas) {
  const datos = [['DÍA SUGERIDO', 'ESTADO', 'PROYECTO', 'ZONA', 'ENSAYO', 'FECHA DEL ENSAYO', 'RECOGER DESDE', 'FECHA LÍMITE', 'PLAZO', 'UBICACIÓN']];
  filas.forEach(f => datos.push([
    celdaFecha(f.sugerido), ESTADOS[f.estado] || f.estado, f.proyecto, (ZONA[f.zona] || {}).nombre || '',
    f.ensayo, celdaFecha(f.fechaEnsayo), celdaFecha(f.desde), celdaFecha(f.hasta), f.plazo,
    f.lat != null ? f.lat.toFixed(6) + ', ' + f.lng.toFixed(6) : '',
  ]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(datos, [14, 16, 60, 16, 30, 14, 14, 14, 12, 24]), 'Recolecciones');
  return wb;
}

/* =========================== 3. Respaldo del día =========================== */
/* El respaldo guarda SOLO lo cargado ese día: proyectos, restricciones y
   propuesta. Las hojas van protegidas para que no se modifiquen por error. */

const COL_PROY = ['id', 'fecha', 'zona', 'nombre', 'horaLlegada', 'horaSalida', 'ubicacion', 'lat', 'lng', 'ensayos', 'transporte', 'actividad', 'observaciones', 'recogido'];
const COL_FILA = ['proyectoId', 'persona', 'rol', 'vehiculo', 'conductor', 'salidaRecomendada', 'km', 'inicioNombre', 'inicioLat', 'inicioLng', 'sugerencias', 'observaciones'];

export function libroRespaldo(fecha, proyectos, restricciones, asignacion) {
  const wb = XLSX.utils.book_new();
  const proteger = ws => { ws['!protect'] = { selectLockedCells: true, selectUnlockedCells: true }; return ws; };

  const info = XLSX.utils.aoa_to_sheet([
    ['RESPALDO TP LAB RUTAS'], ['fecha', fecha], ['creado', new Date().toISOString()], ['version', 1],
    ['Este archivo se carga con el botón "Cargar respaldo del día". No lo modifiques.'],
  ]);
  XLSX.utils.book_append_sheet(wb, proteger(info), 'Info');

  const hp = [COL_PROY].concat(proyectos.map(p => COL_PROY.map(c => {
    if (c === 'ensayos') return (p.ensayos || []).join(',');
    if (c === 'recogido') return JSON.stringify(p.recogido || {});
    return p[c] ?? '';
  })));
  XLSX.utils.book_append_sheet(wb, proteger(XLSX.utils.aoa_to_sheet(hp)), 'Proyectos');

  const r = restricciones || {};
  const hr = [['tipo', 'valor', 'proyectoId']]
    .concat((r.noDisponibles || []).map(n => ['noDisponible', n, '']))
    .concat((r.vehiculosNoDisponibles || []).map(v => ['vehiculoNoDisponible', v, '']))
    .concat((r.prohibiciones || []).map(x => ['prohibicion', x.persona, x.proyectoId]));
  XLSX.utils.book_append_sheet(wb, proteger(XLSX.utils.aoa_to_sheet(hr)), 'Restricciones');

  const filas = (asignacion && asignacion.filas) || [];
  const ha = [COL_FILA].concat(filas.map(f => COL_FILA.map(c => {
    if (c === 'inicioNombre') return f.inicio ? f.inicio.nombre : '';
    if (c === 'inicioLat') return f.inicio ? f.inicio.lat : '';
    if (c === 'inicioLng') return f.inicio ? f.inicio.lng : '';
    if (c === 'sugerencias') return (f.sugerencias || []).join(' || ');
    return f[c] ?? '';
  })));
  XLSX.utils.book_append_sheet(wb, proteger(XLSX.utils.aoa_to_sheet(ha)), 'Propuesta');
  return wb;
}

/** Lee un respaldo. Devuelve { fecha, proyectos, restricciones, asignacion } o lanza un Error con explicación. */
export function leerRespaldo(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  if (!wb.Sheets.Info || !wb.Sheets.Proyectos) throw new Error('Este archivo no es un respaldo de TP Lab Rutas.');
  const info = XLSX.utils.sheet_to_json(wb.Sheets.Info, { header: 1 });
  const fila = info.find(r => r[0] === 'fecha');
  const fecha = fila && String(fila[1]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) throw new Error('El respaldo no indica una fecha válida.');

  const proyectos = XLSX.utils.sheet_to_json(wb.Sheets.Proyectos, { defval: '' }).map(r => {
    const p = { ...r };
    p.ensayos = String(r.ensayos || '').split(',').map(s => s.trim()).filter(Boolean);
    p.lat = r.lat === '' ? null : +r.lat; p.lng = r.lng === '' ? null : +r.lng;
    try { p.recogido = JSON.parse(r.recogido || '{}'); } catch (e) { p.recogido = {}; }
    p.fecha = fecha; p.id = String(r.id);
    Object.keys(p).forEach(k => { if (typeof p[k] === 'number' && !['lat', 'lng'].includes(k)) p[k] = String(p[k]); });
    return p;
  });

  const restricciones = { noDisponibles: [], vehiculosNoDisponibles: [], prohibiciones: [] };
  if (wb.Sheets.Restricciones) XLSX.utils.sheet_to_json(wb.Sheets.Restricciones, { defval: '' }).forEach(r => {
    if (r.tipo === 'noDisponible') restricciones.noDisponibles.push(r.valor);
    if (r.tipo === 'vehiculoNoDisponible') restricciones.vehiculosNoDisponibles.push(r.valor);
    if (r.tipo === 'prohibicion') restricciones.prohibiciones.push({ persona: r.valor, proyectoId: String(r.proyectoId) });
  });

  let asignacion = null;
  if (wb.Sheets.Propuesta) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets.Propuesta, { defval: '' }).map(r => ({
      proyectoId: String(r.proyectoId), persona: r.persona || null, rol: r.rol, vehiculo: r.vehiculo,
      conductor: r.conductor || undefined, salidaRecomendada: r.salidaRecomendada, km: r.km === '' ? null : +r.km,
      inicio: r.inicioLat === '' ? undefined : { nombre: r.inicioNombre, lat: +r.inicioLat, lng: +r.inicioLng },
      sugerencias: String(r.sugerencias || '').split(' || ').filter(Boolean), observaciones: r.observaciones || '',
    }));
    if (filas.length) asignacion = { filas, alertas: [], generado: new Date().toISOString(), restaurado: true };
  }
  return { fecha, proyectos, restricciones, asignacion };
}

/** Nombre de archivo con la fecha. */
export function nombreArchivo(base, fecha) { return base + '_' + fecha + '.xlsx'; }

