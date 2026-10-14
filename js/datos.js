/* =====================================================================
   datos.js — Dónde se guarda la información
   ---------------------------------------------------------------------
   En la página publicada se usa la base de datos COMPARTIDA (todos los
   usuarios ven y editan lo mismo, en vivo). Si se abre fuera de Claude
   (por ejemplo, el archivo en la computadora), se guarda en este
   navegador como respaldo.

   Documentos:
     proyectos/<id>        un proyecto (tiene su fecha)
     dias/<AAAA-MM-DD>     restricciones del día (no disponibles, etc.)
     asignaciones/<fecha>  propuesta generada para ese día
     parametros/general    parámetros que se pueden ajustar
   ===================================================================== */

import { hoyISO, sumarDias } from './util.js';
import { ZONAS } from './bases.js';

/** Orden fijo de zonas: Licitación, Zona 1, Zona 2. */
const ORDEN_ZONA = Object.fromEntries(ZONAS.map((z, i) => [z.id, i]));

/** Valores iniciales de los parámetros (editables en la pestaña Parámetros). */
export const PARAM_DEF = {
  horasCombinacion: 3,              // Zona 2: horas mínimas libres para atender 2 proyectos (sin contar el viaje)
  mesesVerano: [12, 1, 2, 3, 4],    // densímetro puede ir en cualquier vehículo
  velocidad: 40,                    // km/h promedio para estimar el viaje
  factor: 1.35,                     // km por carretera ÷ km en línea recta
  margenLlegada: 15,                // minutos antes de la hora requerida
  capacidad: 4,                     // pasajeros por vehículo
  desvioMax: 90,                    // minutos extra máximos para pasar dejando a alguien
  compartir: 30,                    // minutos extra máximos para que técnicos que manejan compartan vehículo
  reserva: ['ALEJANDRO PEREZ', 'STEVEN BAUTISTA'],   // laboratoristas que se usan solo si no alcanza el resto
};

const CLAVE_LOCAL = 'tplab-rutas-v1';

/** Copia limpia en JSON (quita valores undefined antes de guardar). */
const limpio = o => JSON.parse(JSON.stringify(o));

/**
 * Crea el almacén. Llama a `alCambiar()` cada vez que llegan datos nuevos.
 * @returns {Promise<object>} almacén con métodos de lectura y escritura
 */
export async function crearAlmacen(alCambiar) {
  const estado = {
    modo: 'cargando',
    proyectos: {},          // id → proyecto
    param: { ...PARAM_DEF },
    restricciones: {},      // del día que se está viendo
    asignacion: null,       // del día que se está viendo
    listo: false,
  };
  let db = null, fechaVista = null, desdeVista = null;
  const bajas = { proyectos: null, dia: null, asig: null, param: null };

  /* ---------- Intentar la base compartida ---------- */
  if (window.claude && typeof window.claude.use === 'function') {
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
  }

  /* ---------- Modo local (sin base compartida) ---------- */
  let local = { proyectos: {}, dias: {}, asignaciones: {}, param: {} };
  function leerLocal() {
    try { local = Object.assign(local, JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}')); } catch (e) { /* vacío */ }
  }
  function guardarLocal() {
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(local)); } catch (e) { /* sin espacio o bloqueado */ }
  }
  function refrescarLocal() {
    estado.proyectos = { ...local.proyectos };
    estado.param = { ...PARAM_DEF, ...local.param };
    estado.restricciones = local.dias[fechaVista] || {};
    estado.asignacion = local.asignaciones[fechaVista] || null;
    estado.listo = true;
    alCambiar();
  }

  if (db) {
    estado.modo = 'compartido';
    bajas.param = db.doc('parametros/general').onSnapshot(
      snap => { estado.param = { ...PARAM_DEF, ...(snap.exists ? snap.data() : {}) }; alCambiar(); },
      () => { estado.modo = 'sin-conexion'; alCambiar(); });
  } else {
    estado.modo = 'local';
    leerLocal();
  }

  /** Cambia el día que se está viendo y se suscribe a sus datos. */
  function verFecha(fecha) {
    fechaVista = fecha;
    if (!db) { refrescarLocal(); return; }

    // Proyectos: desde 7 días antes de hoy (para recolecciones) o desde la fecha vista si es anterior
    const desde = [fecha, sumarDias(hoyISO(), -7)].sort()[0];
    if (desde !== desdeVista) {
      desdeVista = desde;
      if (bajas.proyectos) bajas.proyectos();
      bajas.proyectos = db.collection('proyectos').where('fecha', '>=', desde).onSnapshot(snap => {
        const o = {}; snap.docs.forEach(d => { o[d.id] = d.data(); });
        estado.proyectos = o; estado.listo = true; alCambiar();
      }, () => { estado.modo = 'sin-conexion'; alCambiar(); });
    }
    if (bajas.dia) bajas.dia();
    if (bajas.asig) bajas.asig();
    estado.restricciones = {}; estado.asignacion = null;
    bajas.dia = db.doc('dias/' + fecha).onSnapshot(s => { estado.restricciones = s.exists ? s.data() : {}; alCambiar(); });
    bajas.asig = db.doc('asignaciones/' + fecha).onSnapshot(s => { estado.asignacion = s.exists ? s.data() : null; alCambiar(); });
  }

  /* ---------- Escrituras (una a la vez por documento) ---------- */
  async function guardarProyecto(id, datos) {
    if (db) return db.doc('proyectos/' + id).set(limpio(datos));
    local.proyectos[id] = datos; guardarLocal(); refrescarLocal();
  }
  async function borrarProyecto(id) {
    if (db) return db.doc('proyectos/' + id).delete();
    delete local.proyectos[id]; guardarLocal(); refrescarLocal();
  }
  async function guardarRestricciones(fecha, datos) {
    if (db) return db.doc('dias/' + fecha).set(limpio(datos));
    local.dias[fecha] = datos; guardarLocal(); refrescarLocal();
  }
  async function guardarAsignacion(fecha, datos) {
    if (db) return datos ? db.doc('asignaciones/' + fecha).set(limpio(datos)) : db.doc('asignaciones/' + fecha).delete();
    if (datos) local.asignaciones[fecha] = datos; else delete local.asignaciones[fecha];
    guardarLocal(); refrescarLocal();
  }
  async function guardarParam(datos) {
    if (db) return db.doc('parametros/general').set(limpio(datos));
    local.param = datos; guardarLocal(); refrescarLocal();
  }

  /**
   * Reemplaza TODO lo de un día (al cargar un respaldo):
   * borra los proyectos de esa fecha, escribe los del respaldo,
   * y reemplaza restricciones y propuesta.
   */
  async function reemplazarDia(fecha, { proyectos, restricciones, asignacion }, progreso) {
    const actuales = Object.keys(estado.proyectos).filter(id => estado.proyectos[id].fecha === fecha);
    const nuevos = new Set(proyectos.map(p => p.id));
    let n = 0, total = actuales.length + proyectos.length + 2;
    for (const id of actuales) if (!nuevos.has(id)) { await borrarProyecto(id); progreso && progreso(++n, total); }
    for (const p of proyectos) { const { id, ...resto } = p; await guardarProyecto(id, resto); progreso && progreso(++n, total); }
    await guardarRestricciones(fecha, restricciones || {}); progreso && progreso(++n, total);
    await guardarAsignacion(fecha, asignacion || null); progreso && progreso(++n, total);
  }

  /** Lista de proyectos (con su id) de una fecha: por zona (Licitación, Zona 1, Zona 2) y luego por hora. */
  function proyectosDe(fecha) {
    return Object.keys(estado.proyectos).filter(id => estado.proyectos[id].fecha === fecha)
      .map(id => ({ id, ...estado.proyectos[id] }))
      .sort((a, b) => (ORDEN_ZONA[a.zona] ?? 9) - (ORDEN_ZONA[b.zona] ?? 9) ||
        String(a.horaLlegada).localeCompare(String(b.horaLlegada)) || String(a.nombre).localeCompare(String(b.nombre)));
  }
  function todosLosProyectos() { return Object.keys(estado.proyectos).map(id => ({ id, ...estado.proyectos[id] })); }

  return {
    estado, verFecha, proyectosDe, todosLosProyectos,
    guardarProyecto, borrarProyecto, guardarRestricciones, guardarAsignacion, guardarParam, reemplazarDia,
  };
}

/** Texto amigable para un error al guardar. */
export function textoError(e) {
  const c = e && e.code;
  if (c === 'invalid_argument') return 'No tienes permiso para modificar estos datos. Pide acceso de Colaborador o Editor.';
  if (c === 'quota_exceeded') return 'Se llenó el espacio de datos. Hay que borrar proyectos antiguos.';
  if (c === 'resource_exhausted') return 'Demasiados cambios seguidos. Espera unos segundos e intenta de nuevo.';
  return 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
}
