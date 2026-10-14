/* =====================================================================
   ui-proyectos.js — Pestaña "Proyectos del día"
   Formulario para agregar/editar proyectos, carga desde Excel y lista del día.
   ===================================================================== */

import { ZONAS, ZONA, ENSAYOS, ENSAYO, PUNTOS_SALIDA } from './bases.js';
import { viaje } from './distancias.js';
import { leerUbicacion, coordTexto, enlacePunto } from './ubicaciones.js';
import { textoError } from './datos.js';
import { leerExcelProyectos, claveProyecto } from './importar.js';
import { generarPropuesta } from './ui-propuesta.js';
import { $, esc, mensaje, nuevoId, fechaLarga, aMin, aHHMM, duracion } from './util.js';

let editando = null;      // id del proyecto que se está editando
let borrando = null;      // id del proyecto con la confirmación de borrar visible
let ctxActual = null;
let revisando = null;     // borrador de la fila abierta para marcar ensayos: { id, ensayos: Set, ubicacion }     // contexto (para recalcular la recomendada al limpiar el formulario)

/**
 * Hora de salida recomendada desde un punto: llegada − margen − viaje,
 * redondeada a 5 minutos hacia abajo. Devuelve { hora, km, min }.
 */
export function salidaRecomendada(desde, proyecto, horaLlegada, param) {
  const llegada = aMin(horaLlegada);
  if (llegada == null || proyecto.lat == null) return null;
  const v = viaje(desde, proyecto, param);
  return { hora: aHHMM(llegada - (+param.margenLlegada || 0) - v.min, true), km: v.km, min: v.min };
}

/* ---------------------------- Iniciar ---------------------------- */
export function iniciar(ctx) {
  // Opciones de zona y casillas de ensayos (salen de las bases)
  $('pZona').innerHTML = ZONAS.map(z => `<option value="${z.id}">${esc(z.nombre)}</option>`).join('');
  $('pEnsayos').innerHTML = ENSAYOS.map(e =>
    `<label class="casilla"><input type="checkbox" value="${esc(e.id)}"> ${esc(e.nombre)}</label>`).join('');

  // Lectura en vivo de la ubicación pegada y de la hora de salida recomendada
  $('pUbicacion').addEventListener('input', () => { mostrarLectura(); mostrarRecomendada(ctx); });
  $('pLlegada').addEventListener('input', () => mostrarRecomendada(ctx));
  $('pSalida').addEventListener('input', () => mostrarRecomendada(ctx));
  ctxActual = ctx;
  $('pFecha').value = ctx.fecha;

  // Limpiar día: primer clic pide confirmar; el segundo borra todo lo del día visible
  $('btnLimpiarDia').addEventListener('click', () => {
    const n = ctx.store.proyectosDe(ctx.fecha).length;
    mensaje($('msgImportar'), '');
    $('msgImportar').innerHTML = `<span class="aviso aviso--alerta" style="display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center">
      ¿Borrar los ${n} proyectos, la propuesta y las restricciones del ${esc(fechaLarga(ctx.fecha))}? No se puede deshacer
      (puedes guardar antes el log del día).
      <button class="boton boton--chico boton--peligro confirmar" type="button" id="btnLimpiarSi">Sí, limpiar</button>
      <button class="boton boton--chico" type="button" id="btnLimpiarNo">Cancelar</button></span>`;
  });
  $('msgImportar').addEventListener('click', async ev => {
    if (ev.target.id === 'btnLimpiarNo') { mensaje($('msgImportar'), ''); return; }
    if (ev.target.id !== 'btnLimpiarSi') return;
    const fecha = ctx.fecha;
    try {
      limpiar(); revisando = null;
      await ctx.store.reemplazarDia(fecha, { proyectos: [], restricciones: {}, asignacion: null },
        (n, t) => mensaje($('msgImportar'), `Limpiando ${n} de ${t}…`));
      mensaje($('msgImportar'), 'Listo: el ' + fechaLarga(fecha) + ' quedó en cero. Ya puedes cargar otro Excel.', 'ok');
    } catch (e) { mensaje($('msgImportar'), textoError(e), 'error'); }
  });

  // Cargar proyectos desde el Excel de los administradores
  $('archivoProyectos').addEventListener('change', ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    const lector = new FileReader();
    lector.onload = () => importar(ctx, lector.result);
    lector.readAsArrayBuffer(f);
  });

  // Botón "Usar esta hora": copia la recomendada al campo Hora de salida
  $('pSalidaRec').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-hora]'); if (!b) return;
    $('pSalida').value = b.dataset.hora; mostrarRecomendada(ctx);
  });

  // Guardar
  $('formProyecto').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = $('msgProyecto');
    const datos = leerFormulario(ctx);
    if (datos.error) { mensaje(msg, datos.error, 'error'); return; }
    const id = editando || nuevoId();
    const anterior = editando && ctx.store.estado.proyectos[editando];
    if (anterior && anterior.recogido) datos.recogido = anterior.recogido;   // conserva lo ya recogido
    try {
      await ctx.store.guardarProyecto(id, datos);
      const otroDia = datos.fecha !== ctx.fecha ? ' para el ' + fechaLarga(datos.fecha) : '';
      mensaje(msg, (editando ? 'Cambios guardados' : 'Proyecto agregado') + otroDia + '.', 'ok');
      limpiar();
    } catch (e) { mensaje(msg, textoError(e), 'error'); }
  });
  $('btnCancelarEdicion').addEventListener('click', () => { limpiar(); ctx.dibujar(); });

  // Casillas y ubicación del panel de revisión (se guardan al confirmar)
  $('listaProyectos').addEventListener('change', ev => {
    if (!revisando || !ev.target.matches('input.rev-ensayo')) return;
    if (ev.target.checked) revisando.ensayos.add(ev.target.value); else revisando.ensayos.delete(ev.target.value);
  });
  $('listaProyectos').addEventListener('input', ev => {
    if (!revisando || !ev.target.matches('input.rev-ubicacion')) return;
    revisando.ubicacion = ev.target.value;
    const u = leerUbicacion(ev.target.value), el = $('revLectura');
    if (el) el.innerHTML = !ev.target.value.trim() ? '' : u.error ? `<span class="lectura--error">${esc(u.error)}</span>` : `<span class="lectura--ok">✓ ${esc(coordTexto(u))}</span>`;
  });

  // Acciones de la lista (editar / eliminar / ensayos)
  $('listaProyectos').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.accion === 'editar') { cargarEnFormulario(ctx, id); ctx.dibujar(); }
    if (b.dataset.accion === 'revisar') { abrirRevision(ctx, revisando && revisando.id === id ? null : id); }
    if (b.dataset.accion === 'cerrar') { abrirRevision(ctx, null); }
    if (b.dataset.accion === 'confirmar') { await confirmarRevision(ctx, b.dataset.siguiente === '1'); }
    if (b.dataset.accion === 'borrar') {
      if (borrando !== id) { borrando = id; ctx.dibujar(); return; }      // primer clic: pide confirmar
      borrando = null;
      try { await ctx.store.borrarProyecto(id); if (editando === id) limpiar(); }
      catch (e) { mensaje($('msgProyecto'), textoError(e), 'error'); }
    }
  });
}

export function alCambiarFecha() { limpiar(); borrando = null; revisando = null; }

/* ------------- Marcar ensayos fila por fila (después de cargar Excel) -------------
   Cada fila tiene el botón "Ensayos": abre debajo las 13 casillas (y la
   ubicación si falta). "Confirmar y siguiente" guarda, regenera la propuesta
   y abre la próxima fila pendiente. */

/** Abre (o cierra con null) el panel de ensayos de una fila. */
function abrirRevision(ctx, id) {
  const p = id && ctx.store.estado.proyectos[id];
  revisando = p ? { id, ensayos: new Set(p.ensayos || []), ubicacion: p.lat == null ? (p.ubicacion || '') : null } : null;
  ctx.dibujar();
  if (revisando) setTimeout(() => { const f = document.getElementById('fila-' + id); if (f) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
}

/** Guarda los ensayos marcados (y la ubicación, si se escribió) y pasa a la siguiente pendiente. */
async function confirmarRevision(ctx, siguiente) {
  if (!revisando) return;
  const msg = $('msgImportar'), id = revisando.id;
  const p = ctx.store.estado.proyectos[id]; if (!p) { revisando = null; return; }
  if (!revisando.ensayos.size) { mensaje(msg, 'Marca al menos un ensayo.', 'error'); return; }
  const datos = { ...p, ensayos: [...revisando.ensayos], ensayosRevisar: false };
  if (revisando.ubicacion != null && revisando.ubicacion.trim()) {
    const u = leerUbicacion(revisando.ubicacion);
    if (u.error) { mensaje(msg, u.error, 'error'); return; }
    Object.assign(datos, { ubicacion: revisando.ubicacion.trim(), lat: u.lat, lng: u.lng });
  }
  // La siguiente fila pendiente (en el orden de la lista)
  const lista = ctx.store.proyectosDe(ctx.fecha);
  const i = lista.findIndex(x => x.id === id);
  const prox = lista.slice(i + 1).concat(lista.slice(0, i)).find(x => x.ensayosRevisar || x.lat == null);
  try {
    await ctx.store.guardarProyecto(id, datos);
    const quedan = lista.filter(x => x.id !== id && (x.ensayosRevisar || x.lat == null)).length;
    mensaje(msg, quedan ? `Guardado. Quedan ${quedan} por revisar.` : 'Guardado. Todos los proyectos del día están revisados; la propuesta se actualizó.', 'ok');
    abrirRevision(ctx, siguiente && prox ? prox.id : null);
    generarPropuesta(ctx).catch(() => {});                 // mantiene la propuesta al día
  } catch (e) { mensaje(msg, textoError(e), 'error'); }
}

/** Panel con las casillas de ensayos de la fila abierta. */
function panelRevision(p) {
  const r = revisando;
  const ub = r.ubicacion != null ? (() => {
    const u = r.ubicacion.trim() ? leerUbicacion(r.ubicacion) : null;
    const lectura = !u ? '' : u.error ? `<span class="lectura--error">${esc(u.error)}</span>` : `<span class="lectura--ok">✓ ${esc(coordTexto(u))}</span>`;
    return `<label class="campo campo--12"><span>Ubicación (falta)</span>
      <input class="rev-ubicacion" value="${esc(r.ubicacion)}" placeholder="Enlace largo de Maps o coordenadas"></label>
      <div class="campo campo--12 lectura" id="revLectura">${lectura}</div>`;
  })() : '';
  return `<tr class="fila-revision"><td colspan="8">
    <div class="revision">
      <div class="revision__titulo"><b>Ensayos de este proyecto</b>
        <span class="sub">Actividad: ${esc(p.actividad || '—')}</span></div>
      <div class="casillas">${ENSAYOS.map(e => `<label class="casilla"><input type="checkbox" class="rev-ensayo" value="${esc(e.id)}"${r.ensayos.has(e.id) ? ' checked' : ''}> ${esc(e.nombre)}</label>`).join('')}</div>
      <div class="formulario">${ub}</div>
      <div class="botones">
        <button class="boton boton--primario" type="button" data-accion="confirmar" data-siguiente="1">Confirmar y siguiente</button>
        <button class="boton" type="button" data-accion="confirmar" data-siguiente="0">Confirmar</button>
        <button class="boton" type="button" data-accion="cerrar">Cerrar</button>
      </div>
    </div></td></tr>`;
}

/* ---------------------- Carga desde Excel ---------------------- */

/**
 * Guarda los proyectos del Excel. Si un proyecto ya existe (misma fecha,
 * nombre y hora de llegada) se actualiza sin perder la ubicación, los
 * ensayos confirmados ni lo ya recogido.
 */
async function importar(ctx, buffer) {
  const msg = $('msgImportar');
  let r;
  try { r = leerExcelProyectos(buffer); }
  catch (e) { mensaje(msg, e.message || 'No pude leer el archivo.', 'error'); return; }
  if (!r.proyectos.length) { mensaje(msg, 'El Excel no trae proyectos de Licitación, Zona 1 o Zona 2.', 'error'); return; }

  const existentes = {};
  ctx.store.todosLosProyectos().forEach(p => { existentes[claveProyecto(p)] = p; });
  let nuevos = 0, actualizados = 0;
  const guardados = [];                                   // proyectos con su id, para generar la propuesta
  try {
    for (let i = 0; i < r.proyectos.length; i++) {
      mensaje(msg, `Guardando ${i + 1} de ${r.proyectos.length}…`);
      const p = r.proyectos[i], previo = existentes[claveProyecto(p)];
      if (previo) {
        const { id, ...antes } = previo;
        const mezcla = { ...antes, ...p };
        if (p.lat == null) { mezcla.ubicacion = antes.ubicacion || ''; mezcla.lat = antes.lat ?? null; mezcla.lng = antes.lng ?? null; }
        if (!antes.ensayosRevisar && (antes.ensayos || []).length) { mezcla.ensayos = antes.ensayos; mezcla.ensayosRevisar = false; }
        if (!p.horaSalida) mezcla.horaSalida = antes.horaSalida || '';
        if (!p.observaciones) mezcla.observaciones = antes.observaciones || '';
        await ctx.store.guardarProyecto(id, mezcla); actualizados++;
        guardados.push({ id, ...mezcla });
      } else {
        const id = nuevoId();
        await ctx.store.guardarProyecto(id, p); nuevos++;
        guardados.push({ id, ...p });
      }
    }
  } catch (e) { mensaje(msg, textoError(e), 'error'); return; }

  // Generar la propuesta de cada día cargado (con todos los proyectos de ese día)
  const fechas = [...new Set(guardados.map(p => p.fecha))].sort();
  try {
    for (const f of fechas) {
      const delDia = ctx.store.proyectosDe(f).filter(p => !guardados.some(g => g.id === p.id)).concat(guardados.filter(g => g.fecha === f));
      mensaje(msg, 'Generando la propuesta del ' + fechaLarga(f) + '…');
      await generarPropuesta(ctx, f, delDia);
    }
  } catch (e) { mensaje(msg, 'Proyectos cargados, pero no se pudo generar la propuesta: ' + (e.code ? textoError(e) : e.message), 'error'); return; }

  const faltan = guardados.filter(p => p.lat == null).length;
  mensaje(msg, `Listo: ${nuevos} nuevos y ${actualizados} actualizados (${fechas.map(fechaLarga).join(', ')}). Propuesta generada: revísala en la pestaña Propuesta.` +
    (faltan ? ` ${faltan} sin ubicación: la propuesta no calcula distancias ni salida para ellos hasta que la completes y vuelvas a generar.` : '') +
    (r.omitidos.length ? ` No se cargaron ${r.omitidos.length}: ${r.omitidos.join(' ')}` : ''), 'ok');
  // Si el día visible no tiene ninguno de estos proyectos, ir al primero cargado
  if (!fechas.includes(ctx.fecha)) { $('fecha').value = fechas[0]; $('fecha').dispatchEvent(new Event('change')); }
}

/* ------------------------- Formulario ------------------------- */

/** Muestra lo que la app entendió de la ubicación. */
function mostrarLectura() {
  const el = $('pLectura'), txt = $('pUbicacion').value;
  if (!txt.trim()) { el.textContent = '—'; el.className = 'lectura'; return; }
  const r = leerUbicacion(txt);
  if (r.error) { el.textContent = r.error; el.className = 'lectura lectura--error'; return; }
  el.innerHTML = `✓ ${esc(coordTexto(r))} · <a href="${enlacePunto(r)}" target="_blank" rel="noopener">ver en Maps</a>` +
    (r.aviso ? `<br><span class="lectura--alerta">${esc(r.aviso)}</span>` : '');
  el.className = 'lectura lectura--ok';
}

/**
 * Muestra en el formulario la hora de salida recomendada desde TP Lab
 * (de donde sale la mayoría) y, en pequeño, desde las otras salidas.
 * Si ya escribieron una hora de salida, avisa si no alcanza.
 */
function mostrarRecomendada(ctx) {
  const el = $('pSalidaRec');
  if (!ctx || !ctx.store) return;
  const u = leerUbicacion($('pUbicacion').value), llegada = $('pLlegada').value;
  if (u.error || !llegada) { el.textContent = 'Escribe la ubicación y la hora de llegada para calcularla.'; return; }
  const param = ctx.store.estado.param;
  const r = salidaRecomendada(PUNTOS_SALIDA.TPLAB, u, llegada, param);

  // ¿La hora escrita alcanza? (se compara con la llegada estimada)
  let comparacion = '';
  const escrita = aMin($('pSalida').value);
  if (escrita != null) {
    const llegaria = escrita + r.min, diferencia = llegaria - aMin(llegada);
    comparacion = diferencia > 0
      ? `<span class="lectura--error">Saliendo a las ${esc($('pSalida').value)} llegaría ~${aHHMM(llegaria)}: ${duracion(diferencia)} tarde.</span>`
      : `<span class="lectura--ok">Con ${esc($('pSalida').value)} llega ~${aHHMM(llegaria)} (${duracion(-diferencia)} antes).</span>`;
  }

  const otras = ['MELVIN', 'NELSON', 'ANGEL', 'MANOLO'].map(id => {
    const o = salidaRecomendada(PUNTOS_SALIDA[id], u, llegada, param);
    return `${esc(PUNTOS_SALIDA[id].nombre.replace('Salida de ', ''))} ${o.hora} (${Math.round(o.km)} km)`;
  }).join(' · ');

  el.innerHTML = `<span class="recomendada__hora">${r.hora}</span>
    <span>desde TP Lab · ${r.km.toFixed(1)} km · ${duracion(r.min)} de viaje · llegando ${+param.margenLlegada || 0} min antes</span>
    <button class="boton boton--chico" type="button" data-hora="${r.hora}">Usar esta hora</button>
    ${comparacion}
    <span class="recomendada__otras">Desde otras salidas: ${otras}. Estimado; la propuesta la ajusta según quién vaya y si lleva pasajeros.</span>`;
}

/** Lee y valida el formulario. Devuelve los datos o { error }. */
function leerFormulario(ctx) {
  const nombre = $('pNombre').value.trim();
  if (!nombre) return { error: 'Escribe el nombre del proyecto.' };
  if (!$('pFecha').value) return { error: 'Indica la fecha programada.' };
  if (!$('pLlegada').value) return { error: 'Indica la hora de llegada.' };
  const u = leerUbicacion($('pUbicacion').value);
  if (u.error) return { error: u.error };
  const ensayos = [...$('pEnsayos').querySelectorAll('input:checked')].map(i => i.value);
  if (!ensayos.length) return { error: 'Marca al menos un ensayo.' };
  return {
    fecha: $('pFecha').value,
    zona: $('pZona').value,
    nombre,
    horaLlegada: $('pLlegada').value,
    horaSalida: $('pSalida').value,
    ubicacion: $('pUbicacion').value.trim(),
    lat: u.lat, lng: u.lng,
    ensayos,
    transporte: document.querySelector('input[name="pTransporte"]:checked').value,
    actividad: $('pActividad').value.trim(),
    observaciones: $('pObservaciones').value.trim(),
    ensayosRevisar: false,           // al guardar desde el formulario, los ensayos quedan confirmados
  };
}

/** Pasa un proyecto al formulario para editarlo. */
function cargarEnFormulario(ctx, id) {
  const p = ctx.store.estado.proyectos[id]; if (!p) return;
  editando = id;
  $('pZona').value = p.zona; $('pNombre').value = p.nombre || ''; $('pFecha').value = p.fecha || ctx.fecha;
  $('pLlegada').value = p.horaLlegada || ''; $('pSalida').value = p.horaSalida || '';
  $('pUbicacion').value = p.ubicacion || ''; mostrarLectura(); mostrarRecomendada(ctx);
  $('pEnsayos').querySelectorAll('input').forEach(i => { i.checked = (p.ensayos || []).includes(i.value); });
  document.querySelector(`input[name="pTransporte"][value="${p.transporte === 'CLIENTE' ? 'CLIENTE' : 'TPLAB'}"]`).checked = true;
  $('pActividad').value = p.actividad || ''; $('pObservaciones').value = p.observaciones || '';
  $('tituloFormulario').textContent = 'Editar proyecto';
  $('btnGuardarProyecto').textContent = 'Guardar cambios';
  $('btnCancelarEdicion').hidden = false;
  (p.lat == null ? $('pUbicacion') : $('pNombre')).focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Deja el formulario vacío para un proyecto nuevo. */
function limpiar() {
  editando = null;
  $('formProyecto').reset();
  if (ctxActual) $('pFecha').value = ctxActual.fecha;
  mostrarLectura(); mostrarRecomendada(ctxActual);
  $('tituloFormulario').textContent = 'Agregar proyecto';
  $('btnGuardarProyecto').textContent = 'Agregar proyecto';
  $('btnCancelarEdicion').hidden = true;
}

/* ---------------------------- Dibujar ---------------------------- */
export function dibujar(ctx) {
  if (!$('formProyecto').contains(document.activeElement)) mostrarRecomendada(ctx);
  const lista = ctx.store.proyectosDe(ctx.fecha);
  $('cuentaProyectos').textContent = lista.length;
  $('tituloLista').textContent = 'Proyectos del ' + fechaLarga(ctx.fecha);

  if ($('listaProyectos').contains(document.activeElement) && document.activeElement.matches('input.rev-ubicacion')) return;
  if (revisando && !ctx.store.estado.proyectos[revisando.id]) revisando = null;
  if (!ctx.store.estado.listo) { $('listaProyectos').innerHTML = '<div class="vacio">Cargando proyectos…</div>'; return; }
  if (!lista.length) {
    $('listaProyectos').innerHTML = '<div class="vacio">No hay proyectos para este día. Cárgalos desde Excel con el botón de arriba, o agrégalos con el formulario.</div>';
    return;
  }

  $('listaProyectos').innerHTML = `<div class="tabla-caja"><table>
    <thead><tr><th>Llegada</th><th>Salida</th><th>Zona</th><th>Proyecto</th><th>Ensayos</th><th>Transporte</th><th>Ubicación</th><th></th></tr></thead>
    <tbody>${lista.map(p => `
      <tr id="fila-${p.id}"${editando === p.id || (revisando && revisando.id === p.id) ? ' class="fila--grupo"' : ''}>
        <td class="dato">${esc(p.horaLlegada || '—')}</td>
        <td class="dato">${esc(p.horaSalida || '—')}${(r => r ? `<span class="sub">rec. ${r.hora}</span>` : '')(salidaRecomendada(PUNTOS_SALIDA.TPLAB, p, p.horaLlegada, ctx.store.estado.param))}</td>
        <td><span class="etiqueta etiqueta--zona etiqueta--${esc(p.zona)}">${esc((ZONA[p.zona] || {}).nombre || p.zona)}</span></td>
        <td><b>${esc(p.nombre)}</b>${p.actividad ? `<span class="sub">${esc(p.actividad)}</span>` : ''}${p.observaciones ? `<span class="sub">Obs.: ${esc(p.observaciones)}</span>` : ''}</td>
        <td>${(p.ensayos || []).map(e => `<span class="etiqueta etiqueta--ensayo">${esc((ENSAYO[e] || {}).nombre || e)}</span>`).join('')}
            ${p.ensayosRevisar ? '<span class="etiqueta etiqueta--alerta">Sugeridos: confirmar</span>' : ''}</td>
        <td>${p.transporte === 'CLIENTE' ? '<span class="etiqueta etiqueta--alerta">Cliente</span>' : '<span class="etiqueta etiqueta--gris">TP Lab</span>'}</td>
        <td class="dato">${p.lat != null ? `<a href="${enlacePunto(p)}" target="_blank" rel="noopener">${esc(coordTexto(p))}</a>` : '<span class="etiqueta etiqueta--error">Sin ubicación</span>'}</td>
        <td style="white-space:nowrap">
          <button class="boton boton--chico${p.lat == null || p.ensayosRevisar ? ' boton--primario' : ''}" type="button" data-accion="revisar" data-id="${p.id}">${revisando && revisando.id === p.id ? 'Ensayos ▴' : 'Ensayos ▾'}</button>
          <button class="boton boton--chico" type="button" data-accion="editar" data-id="${p.id}">Editar</button>
          <button class="boton boton--chico boton--peligro${borrando === p.id ? ' confirmar' : ''}" type="button" data-accion="borrar" data-id="${p.id}">${borrando === p.id ? '¿Eliminar?' : 'Eliminar'}</button>
        </td>
      </tr>${revisando && revisando.id === p.id ? panelRevision(p) : ''}`).join('')}
    </tbody></table></div>`;
}
