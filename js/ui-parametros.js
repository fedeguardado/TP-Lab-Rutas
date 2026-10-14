/* =====================================================================
   ui-parametros.js — Pestaña "Parámetros"
   · Restricciones del día: personal y vehículos no disponibles, y
     técnicos que no deben ir a cierto proyecto.
   · Parámetros generales: regla de Zona 2, verano, velocidad, etc.
   ===================================================================== */

import { PERSONAL, VEHICULOS } from './bases.js';
import { PARAM_DEF, textoError } from './datos.js';
import { $, esc, mensaje, fechaLarga, nombrePropio } from './util.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

let prohibiciones = [];         // lista en edición (se guarda con el botón)
let restriccionesSucias = false;
let parametrosSucios = false;

export function iniciar(ctx) {
  // Casillas fijas: personal, vehículos y meses
  $('rPersonal').innerHTML = PERSONAL.map(p =>
    `<label class="casilla casilla--alerta"><input type="checkbox" value="${esc(p.nombre)}"> ${esc(nombrePropio(p.nombre))}</label>`).join('');
  $('rVehiculos').innerHTML = VEHICULOS.map(v =>
    `<label class="casilla casilla--alerta"><input type="checkbox" value="${v.id}"> ${esc(v.texto)}</label>`).join('');
  $('aReserva').innerHTML = PERSONAL.filter(p => p.lab).map(p =>
    `<label class="casilla"><input type="checkbox" value="${esc(p.nombre)}"> ${esc(nombrePropio(p.nombre))}</label>`).join('');
  $('aMeses').innerHTML = MESES.map((m, i) =>
    `<label class="casilla"><input type="checkbox" value="${i + 1}"> ${m}</label>`).join('');
  $('rProhPersona').innerHTML = PERSONAL.map(p => `<option value="${esc(p.nombre)}">${esc(nombrePropio(p.nombre))}</option>`).join('');

  // Marcar como "con cambios sin guardar" para no pisarlos al redibujar
  $('formRestricciones').addEventListener('input', () => { restriccionesSucias = true; });
  $('formParametros').addEventListener('input', () => { parametrosSucios = true; });

  // Agregar / quitar prohibiciones
  $('btnAgregarProhibicion').addEventListener('click', () => {
    const persona = $('rProhPersona').value, proyectoId = $('rProhProyecto').value;
    if (!proyectoId) { mensaje($('msgRestricciones'), 'No hay proyectos este día.', 'error'); return; }
    if (!prohibiciones.some(x => x.persona === persona && x.proyectoId === proyectoId)) prohibiciones.push({ persona, proyectoId });
    restriccionesSucias = true; dibujarProhibiciones(ctx);
  });
  $('rProhibiciones').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-i]'); if (!b) return;
    prohibiciones.splice(+b.dataset.i, 1); restriccionesSucias = true; dibujarProhibiciones(ctx);
  });

  // Guardar restricciones del día
  $('formRestricciones').addEventListener('submit', async ev => {
    ev.preventDefault();
    const datos = {
      noDisponibles: [...$('rPersonal').querySelectorAll('input:checked')].map(i => i.value),
      vehiculosNoDisponibles: [...$('rVehiculos').querySelectorAll('input:checked')].map(i => i.value),
      prohibiciones,
    };
    try { await ctx.store.guardarRestricciones(ctx.fecha, datos); restriccionesSucias = false; mensaje($('msgRestricciones'), 'Restricciones guardadas.', 'ok'); }
    catch (e) { mensaje($('msgRestricciones'), textoError(e), 'error'); }
  });

  // Guardar parámetros generales
  $('formParametros').addEventListener('submit', async ev => {
    ev.preventDefault();
    const num = (id, def) => { const v = parseFloat($(id).value); return isFinite(v) ? v : def; };
    const datos = {
      horasCombinacion: num('aHoras', PARAM_DEF.horasCombinacion),
      velocidad: Math.max(5, num('aVelocidad', PARAM_DEF.velocidad)),
      factor: Math.max(1, num('aFactor', PARAM_DEF.factor)),
      margenLlegada: num('aMargen', PARAM_DEF.margenLlegada),
      capacidad: Math.max(1, Math.round(num('aCapacidad', PARAM_DEF.capacidad))),
      desvioMax: num('aDesvio', PARAM_DEF.desvioMax),
      compartir: num('aCompartir', PARAM_DEF.compartir),
      reserva: [...$('aReserva').querySelectorAll('input:checked')].map(i => i.value),
      mesesVerano: [...$('aMeses').querySelectorAll('input:checked')].map(i => +i.value),
    };
    try { await ctx.store.guardarParam(datos); parametrosSucios = false; mensaje($('msgParametros'), 'Parámetros guardados.', 'ok'); }
    catch (e) { mensaje($('msgParametros'), textoError(e), 'error'); }
  });
}

export function alCambiarFecha() { restriccionesSucias = false; mensaje($('msgRestricciones'), ''); }

function dibujarProhibiciones(ctx) {
  const nombres = Object.fromEntries(ctx.store.todosLosProyectos().map(p => [p.id, p.nombre]));
  $('rProhibiciones').innerHTML = prohibiciones.length ? `<div class="casillas" style="margin-top:8px">${prohibiciones.map((x, i) =>
    `<span class="casilla">${esc(nombrePropio(x.persona))} ✕ ${esc(nombres[x.proyectoId] || 'proyecto eliminado')}
      <button class="boton boton--chico" type="button" data-i="${i}" aria-label="Quitar">Quitar</button></span>`).join('')}</div>` : '';
}

export function dibujar(ctx) {
  const e = ctx.store.estado;
  $('tituloRestricciones').textContent = 'Restricciones del ' + fechaLarga(ctx.fecha);

  // Proyectos del día para la lista de prohibiciones
  const delDia = ctx.store.proyectosDe(ctx.fecha);
  const sel = $('rProhProyecto'), actual = sel.value;
  sel.innerHTML = delDia.length ? delDia.map(p => `<option value="${p.id}">${esc(p.horaLlegada + ' · ' + p.nombre)}</option>`).join('')
                                : '<option value="">Sin proyectos este día</option>';
  if (delDia.some(p => p.id === actual)) sel.value = actual;

  // Restricciones guardadas (si no hay cambios sin guardar)
  if (!restriccionesSucias) {
    const r = e.restricciones || {};
    $('rPersonal').querySelectorAll('input').forEach(i => { i.checked = (r.noDisponibles || []).includes(i.value); });
    $('rVehiculos').querySelectorAll('input').forEach(i => { i.checked = (r.vehiculosNoDisponibles || []).includes(i.value); });
    prohibiciones = (r.prohibiciones || []).map(x => ({ ...x }));
    dibujarProhibiciones(ctx);
  }

  // Parámetros generales
  if (!parametrosSucios) {
    const p = e.param;
    $('aHoras').value = p.horasCombinacion; $('aVelocidad').value = p.velocidad; $('aFactor').value = p.factor;
    $('aMargen').value = p.margenLlegada; $('aCapacidad').value = p.capacidad; $('aDesvio').value = p.desvioMax;
    $('aCompartir').value = p.compartir ?? PARAM_DEF.compartir;
    $('aReserva').querySelectorAll('input').forEach(i => { i.checked = (p.reserva || PARAM_DEF.reserva).includes(i.value); });
    $('aMeses').querySelectorAll('input').forEach(i => { i.checked = (p.mesesVerano || []).includes(+i.value); });
  }
}
