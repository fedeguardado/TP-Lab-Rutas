/* =====================================================================
   ui-bases.js — Pestaña "Bases" (solo lectura)
   Muestra lo que la app sabe de personal, vehículos, ensayos y equipos.
   ===================================================================== */

import { PERSONAL, VEHICULOS, ENSAYOS, EQUIPOS, PUNTOS_SALIDA, PRIORIDAD_DOM, SOLO_ZONAS, ZONA } from './bases.js';
import { enlacePunto, coordTexto } from './ubicaciones.js';
import { $, esc, nombrePropio } from './util.js';

const abreviatura = n => n.replace('Control de colado de ', 'Colado ').replace('Cálculo de densidad de campo', 'Dens. campo')
  .replace('Extracción de núcleos', 'Núcleos').replace('Densidad cono y arena', 'Cono y arena').replace('Briquetas de suelo-cemento', 'Briquetas')
  .replace('Densímetro nuclear', 'Densímetro');

export function iniciar() {
  const veh = Object.fromEntries(VEHICULOS.map(v => [v.id, v]));

  // 1) Personal: rol, salida, vehículos y ensayos
  const personal = `<article class="tarjeta"><h3>Personal (${PERSONAL.length})</h3>
    <div class="tabla-caja" style="margin-top:12px"><table class="matriz">
      <thead><tr><th>Persona</th><th>Rol</th><th>Sale de</th><th>Vehículo</th>${ENSAYOS.map(e => `<th title="${esc(e.nombre)}">${esc(abreviatura(e.nombre))}</th>`).join('')}</tr></thead>
      <tbody>${PERSONAL.map(p => `<tr>
        <td><b>${esc(nombrePropio(p.nombre))}</b>${SOLO_ZONAS[p.nombre] ? `<span class="sub">Solo ${SOLO_ZONAS[p.nombre].map(z => ZONA[z].nombre).join(' y ')}</span>` : ''}</td>
        <td>${p.lab ? 'Laboratorista' : ''}${p.lab && p.maneja ? ' · ' : ''}${p.maneja ? 'Maneja' : ''}</td>
        <td>${esc(PUNTOS_SALIDA[p.salida].nombre)}</td>
        <td>${p.propio ? '<span class="etiqueta etiqueta--ok">Propio</span>' : p.vehiculos.length ? `<span class="sub">${p.vehiculos.map(id => esc(veh[id].texto.split(' (')[0])).join(', ')}</span>` : '—'}</td>
        ${ENSAYOS.map(e => `<td class="centro">${p.ensayos.includes(e.id) ? '<span class="si">✓</span>' : '<span class="no">·</span>'}</td>`).join('')}
      </tr>`).join('')}</tbody></table></div></article>`;

  // 2) Vehículos, equipos, puntos de salida y prioridad DOM
  const vehiculos = `<article class="tarjeta"><h3>Vehículos de empresa</h3><ul>${VEHICULOS.map(v =>
    `<li>${esc(v.texto)}${v.densimetro ? ' · <span class="etiqueta etiqueta--ensayo">sirve para densímetro</span>' : ''}${v.exclusivo ? ' · exclusivo de ' + esc(nombrePropio(v.exclusivo)) : ''}</li>`).join('')}</ul>
    <p class="ayuda">Se recogen en TP Lab. De diciembre a abril el densímetro puede ir en cualquier vehículo (ajustable en Parámetros).</p></article>`;
  const equipos = `<article class="tarjeta"><h3>Equipos limitados por día</h3><ul>${Object.values(EQUIPOS).map(e =>
    `<li>${esc(e.nombre)}: <b>${e.cantidad}</b>${e.propios ? ' + los de ' + e.propios.map(nombrePropio).join(' y ') + ' (los llevan ellos)' : ''}</li>`).join('')}</ul>
    <h3 style="margin-top:12px">Recolección</h3><ul>${ENSAYOS.filter(e => e.recoleccion).map(e => `<li>${esc(e.nombre)}: ${esc(e.recoleccion.texto)}</li>`).join('')}</ul></article>`;
  const puntos = `<article class="tarjeta"><h3>Puntos de salida</h3><ul>${Object.values(PUNTOS_SALIDA).map(p =>
    `<li>${esc(p.nombre)}: <a href="${enlacePunto(p)}" target="_blank" rel="noopener">${esc(coordTexto(p))}</a></li>`).join('')}</ul>
    <h3 style="margin-top:12px">Prioridad DOM Licitación</h3><ol>${PRIORIDAD_DOM.map(n => `<li>${esc(nombrePropio(n))}</li>`).join('')}</ol></article>`;

  $('contenidoBases').innerHTML = personal +
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:16px">${vehiculos}${equipos}${puntos}</div>`;
}

export function dibujar() { /* contenido fijo: se dibuja una sola vez al iniciar */ }
