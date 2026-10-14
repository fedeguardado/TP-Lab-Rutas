/* =====================================================================
   recolecciones.js — Informe de muestras que hay que ir a recoger
   ---------------------------------------------------------------------
   Reglas acordadas:
     · Control de colado de concreto, cubos de mortero y prismas de grout:
       máximo 48 h → se puede recoger del día siguiente al segundo día.
     · Control de colado de lodocreto: mínimo 3 días, máximo 4 días.
   El día sugerido es el primero dentro del plazo que no sea domingo,
   agrupando cuando hay otras recolecciones cerca ese mismo día.
   ===================================================================== */

import { ENSAYO } from './bases.js';
import { sumarDias, deISO, difDias } from './util.js';
import { kmLineaRecta } from './distancias.js';

/**
 * Lista de recolecciones a partir de los proyectos.
 * @param {object[]} proyectos  todos los proyectos cargados
 * @param {string} hoy          fecha de referencia (AAAA-MM-DD)
 * @returns {object[]} una fila por proyecto y ensayo que requiere recolección
 */
export function calcularRecolecciones(proyectos, hoy) {
  const filas = [];
  proyectos.forEach(p => {
    (p.ensayos || []).forEach(id => {
      const regla = ENSAYO[id] && ENSAYO[id].recoleccion;
      if (!regla || !p.fecha) return;
      const desde = sumarDias(p.fecha, regla.desde);
      const hasta = sumarDias(p.fecha, regla.hasta);
      const recogido = !!(p.recogido && p.recogido[id]);
      filas.push({
        proyectoId: p.id, proyecto: p.nombre, zona: p.zona, fechaEnsayo: p.fecha,
        ensayoId: id, ensayo: ENSAYO[id].nombre, plazo: regla.texto,
        desde, hasta, recogido, lat: p.lat, lng: p.lng,
        diasRestantes: difDias(hoy, hasta),
      });
    });
  });

  // Día sugerido: primer día hábil (no domingo) del plazo que no esté vencido
  filas.forEach(f => {
    let d = f.desde < hoy ? hoy : f.desde;
    while (d <= f.hasta && deISO(d).getDay() === 0) d = sumarDias(d, 1);
    f.sugerido = d <= f.hasta ? d : f.hasta;
  });

  // Agrupar: si otra recolección cercana (≤ 25 km) puede ir el mismo día, se alinean
  filas.forEach(f => {
    const vecina = filas.find(o => o !== f && !o.recogido && o.lat != null && f.lat != null &&
      o.sugerido >= f.desde && o.sugerido <= f.hasta && o.sugerido !== f.sugerido &&
      kmLineaRecta(o, f) <= 25);
    if (vecina && !f.recogido) { f.sugerido = vecina.sugerido; f.agrupada = vecina.proyecto; }
  });

  // Estado para mostrar
  filas.forEach(f => {
    f.estado = f.recogido ? 'recogido' : f.hasta < hoy ? 'vencido' : f.hasta === hoy ? 'vence-hoy'
             : f.desde > hoy ? 'aun-no' : 'en-plazo';
  });

  return filas.sort((a, b) => a.sugerido.localeCompare(b.sugerido) || a.hasta.localeCompare(b.hasta) || a.proyecto.localeCompare(b.proyecto));
}
