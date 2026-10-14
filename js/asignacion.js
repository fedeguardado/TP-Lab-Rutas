/* =====================================================================
   asignacion.js — Propuesta de quién va a cada proyecto
   ---------------------------------------------------------------------
   La propuesta se arma en 3 pasos:
     1. PERSONAS: para cada proyecto se elige al técnico habilitado en
        TODOS sus ensayos, respetando disponibilidad, prohibiciones, la
        prioridad de DOM Licitación, la zona de Luis Cortez y los equipos
        limitados (densímetro, extractora, speedy). La extracción de
        núcleos lleva un ayudante. Si en Zona 2 nadie queda libre, se
        sugiere que un técnico atienda dos proyectos (requiere autorización).
     2. VEHÍCULOS: se reparten los vehículos de empresa entre quienes
        manejan; el densímetro (fuera de verano) va en L200 o Panel.
     3. QUIÉN LLEVA A QUIÉN: los que no manejan, o se quedaron sin
        vehículo, se suben con un técnico que pase cerca de su proyecto
        (lo deja primero y sigue al suyo; no espera).
   Todo es una SUGERENCIA: el resultado final se ajusta en el Excel.
   ===================================================================== */

import { PERSONAL, PERSONA, VEHICULOS, ENSAYO, EQUIPOS, PUNTOS_SALIDA, PRIORIDAD_DOM, SOLO_ZONAS, ZONAS, PREFERIDOS, RESERVA_INICIAL } from './bases.js';
import { viaje } from './distancias.js';
import { aMin, aHHMM, deISO, nombrePropio } from './util.js';

const TPLAB = PUNTOS_SALIDA.TPLAB;
const NELSON_MENA = 'NELSON MENA';
const ORDEN_ZONA = Object.fromEntries(ZONAS.map((z, i) => [z.id, i]));
const SIN_UBICACION = 'Falta la ubicación: sin km ni salida recomendada.';

/** Qué necesita un proyecto: equipos, número de personas y si lleva densímetro. */
export function necesidades(proy) {
  const equipos = new Set();
  let personas = 1;
  (proy.ensayos || []).forEach(id => {
    const e = ENSAYO[id]; if (!e) return;
    if (e.equipo) equipos.add(e.equipo);
    if (e.personas) personas = Math.max(personas, e.personas);
  });
  // Vehículo obligatorio por ensayo (ej. extractora → Panel)
  const vehiculo = (proy.ensayos || []).map(id => ENSAYO[id] && ENSAYO[id].vehiculo).find(Boolean) || null;
  return { equipos, personas, densimetro: equipos.has('densimetro'), vehiculo };
}

/** Punto de salida de una persona. */
function salidaDe(persona) { return { ...PUNTOS_SALIDA[persona.salida], id: persona.salida }; }

/**
 * Genera la propuesta del día.
 * @param {object} datos  { fecha, proyectos, restricciones, param }
 * @returns {{ filas: object[], alertas: string[] }}
 */
export function proponer({ fecha, proyectos, restricciones = {}, param }) {
  const mes = deISO(fecha).getMonth() + 1;
  const verano = (param.mesesVerano || []).includes(mes);
  const noDisponibles = new Set(restricciones.noDisponibles || []);
  const vehNoDisponibles = new Set(restricciones.vehiculosNoDisponibles || []);
  const prohibido = new Set((restricciones.prohibiciones || []).map(x => x.persona + '|' + x.proyectoId));
  const margen = +param.margenLlegada || 0;
  const reserva = new Set(param.reserva || RESERVA_INICIAL);
  const esPreferido = (per, proy) => (proy.ensayos || []).some(e => (PREFERIDOS[e] || []).includes(per.nombre));
  const alertas = [];

  /* ---------- Estado de la propuesta mientras se arma ---------- */
  const filas = [];                       // una fila por persona y proyecto (o "sin asignar")
  const ocupados = new Map();             // persona → filas que ya tiene
  const usoEquipo = { densimetro: 0, extractora: 0, speedy: 0 };
  let flotaLibre = VEHICULOS.filter(v => !v.exclusivo && !vehNoDisponibles.has(v.id)).length;

  /* ---------- Proyectos válidos (con hora de llegada) ----------
     Los que no tienen ubicación SÍ se asignan (por ensayos, prioridad y
     vehículos), pero sin distancias: no hay km ni salida recomendada. */
  const validos = [];
  proyectos.forEach(p => {
    if (aMin(p.horaLlegada) == null) filas.push(filaSinAsignar(p, 'Falta la hora de llegada.'));
    else validos.push(p);
  });
  const sinUbicacion = validos.filter(p => p.lat == null).length;

  /* ---------- Filtros que se usan en el paso 1 ---------- */
  const puedeHacer = (per, proy) => (proy.ensayos || []).every(e => per.ensayos.includes(e)) &&
    (per.lab || (proy.ensayos || []).length > 0);           // Nelson Mena solo si el proyecto pide algo que él hace (recolección)
  const zonaPermitida = (per, proy) => !SOLO_ZONAS[per.nombre] || SOLO_ZONAS[per.nombre].includes(proy.zona);
  const disponible = (per, proy) => !noDisponibles.has(per.nombre) && !prohibido.has(per.nombre + '|' + proy.id) &&
    zonaPermitida(per, proy);

  /** ¿Alcanzan los equipos si esta persona hace este proyecto? */
  function equiposAlcanzan(per, nec) {
    for (const eq of nec.equipos) {
      if (eq === 'speedy' && EQUIPOS.speedy.propios.includes(per.nombre)) continue;   // lleva el suyo
      if (usoEquipo[eq] >= EQUIPOS[eq].cantidad) return false;
    }
    return true;
  }
  function usarEquipos(per, nec) {
    nec.equipos.forEach(eq => {
      if (eq === 'speedy' && EQUIPOS.speedy.propios.includes(per.nombre)) return;
      usoEquipo[eq]++;
    });
  }

  /** Puntaje de un candidato (menor = mejor), comparado en orden. */
  function puntaje(per, proy) {
    const soloRecoleccion = (proy.ensayos || []).length === 1 && proy.ensayos[0] === 'RECOLECCION';
    const prefNelson = soloRecoleccion ? (per.nombre === NELSON_MENA ? 0 : 1) : 0;
    const iDom = PRIORIDAD_DOM.indexOf(per.nombre);
    const prioDom = proy.zona === 'DOM' ? (iDom >= 0 ? iDom : 50) : 0;
    // Costo en "minutos equivalentes": viaje desde su punto de salida
    // + 60 min si tendría que ir de pasajero (no maneja o ya no hay vehículos)
    // + 2 min por cada ensayo que sabe hacer (se guarda a los más versátiles)
    let costo = 0;
    if (proy.transporte !== 'CLIENTE') {
      costo += viaje(salidaDe(per), proy, param).min;
      const vaPorSuCuenta = per.propio || per.nombre === NELSON_MENA || (per.maneja && flotaLibre > 0);
      if (!vaPorSuCuenta) costo += 60;
    }
    costo += per.ensayos.length * 2;
    if (esPreferido(per, proy)) costo -= 200;
    if (reserva.has(per.nombre)) costo += 300;
    return [prefNelson, prioDom, Math.round(costo)];
  }
  const comparar = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

  /** Registra una asignación. */
  function asignar(per, proy, rol, extra = {}) {
    const fila = { proyectoId: proy.id, persona: per.nombre, rol, sugerencias: [], ...extra };
    filas.push(fila);
    if (!ocupados.has(per.nombre)) ocupados.set(per.nombre, []);
    ocupados.get(per.nombre).push(fila);
    return fila;
  }

  /* ================= PASO 1: PERSONAS ================= */

  /* 1a) Reparto GLOBAL: se busca la combinación proyecto ↔ persona con
     menor costo total (no proyecto por proyecto), para que cada técnico
     quede en la zona que le corresponde por cercanía. Costo en "minutos":
       viaje desde su punto de salida
       + 150 si no puede llegar por su cuenta (no maneja)
       + prioridad DOM: los de la lista según su orden; los demás +45;
         Zacarías Guzmán solo en última instancia
       + 1.5 por cada ensayo que sabe hacer (se cuidan los más versátiles)
       − 100 a Nelson Mena en proyectos que solo son recolección
       − 200 a los preferidos del ensayo (Jonathan Menjívar en extracciones)
       + 300 al personal de reserva (carga fija en el laboratorio)          */
  const preasignado = (() => {
    const lista = validos.filter(p => true);
    const personas = PERSONAL.filter(per => !noDisponibles.has(per.nombre));
    const INF = 1e7;
    const costo = (per, proy) => {
      if (!puedeHacer(per, proy) || !disponible(per, proy)) return INF;
      let c = 0;
      if (proy.transporte !== 'CLIENTE') {
        c += viaje(salidaDe(per), proy, param).min;
        if (!(per.propio || per.nombre === NELSON_MENA || per.maneja)) c += 150;
      }
      if (proy.zona === 'DOM') {
        const i = PRIORIDAD_DOM.indexOf(per.nombre);
        c += i < 0 ? 45 : (i === PRIORIDAD_DOM.length - 1 ? 90 : i * 6);
      }
      const soloRecoleccion = (proy.ensayos || []).length === 1 && proy.ensayos[0] === 'RECOLECCION';
      if (soloRecoleccion && per.nombre === NELSON_MENA) c -= 100;
      if (esPreferido(per, proy)) c -= 200;                 // ej. Jonathan Menjívar en extracciones
      // Densímetro fuera de verano: mejor quien tiene vehículo propio o puede manejar la L200
      const necP = necesidades(proy);
      if (necP.densimetro && !verano && !per.propio && !per.vehiculos.includes('L200')) c += 60;
      if (reserva.has(per.nombre)) c += 300;                // carga fija en el laboratorio: al final
      return c + per.ensayos.length * 1.5;
    };
    const matriz = lista.map(p => personas.map(per => costo(per, p)));
    const asig = hungaro(matriz, INF);
    const r = {};
    asig.forEach((j, i) => { if (j >= 0 && matriz[i][j] < INF) r[lista[i].id] = personas[j].nombre; });
    return r;
  })();

  // Primero los proyectos con menos candidatos (más difíciles de cubrir);
  // a igualdad, DOM Licitación y luego por hora de llegada.
  const candidatosIniciales = p => PERSONAL.filter(per => puedeHacer(per, p) && disponible(per, p)).length;
  const orden = validos.map(p => ({ p, n: candidatosIniciales(p) }))
    .sort((a, b) => a.n - b.n || (a.p.zona === 'DOM' ? 0 : 1) - (b.p.zona === 'DOM' ? 0 : 1) ||
                    aMin(a.p.horaLlegada) - aMin(b.p.horaLlegada))
    .map(x => x.p);

  orden.forEach(proy => {
    const nec = necesidades(proy);
    const libres = PERSONAL.filter(per => !ocupados.has(per.nombre) && puedeHacer(per, proy) && disponible(per, proy));
    const conEquipo = libres.filter(per => equiposAlcanzan(per, nec));

    if (conEquipo.length) {
      // 1b) Se usa el reparto global; si esa persona ya no sirve (equipos), el mejor puntaje
      const sugerido = conEquipo.find(per => per.nombre === preasignado[proy.id]);
      const elegido = sugerido || conEquipo.sort((a, b) => comparar(puntaje(a, proy), puntaje(b, proy)))[0];
      asignar(elegido, proy, 'principal');
      usarEquipos(elegido, nec);
      if (proy.transporte !== 'CLIENTE' && elegido.maneja && !elegido.propio && elegido.nombre !== NELSON_MENA) flotaLibre--;

      // Extracción de núcleos: ayudante = quien menos ensayos puede hacer
      if (nec.personas > 1) {
        // Orden: laboratoristas libres (el que menos ensayos sabe) → reserva → apoyo externo (Mario Ruiz)
        const grupo = per => per.apoyo ? 2 : reserva.has(per.nombre) ? 1 : 0;
        const ayudantes = PERSONAL.filter(per => (per.lab || per.apoyo) && !ocupados.has(per.nombre) && disponible(per, proy))
          .sort((a, b) => grupo(a) - grupo(b) || a.ensayos.length - b.ensayos.length || (a.maneja ? 1 : 0) - (b.maneja ? 1 : 0));
        if (ayudantes.length) {
          const ay = asignar(ayudantes[0], proy, 'ayudante');
          ay.sugerencias.push(ayudantes[0].apoyo ? 'Ayudante de extracción (apoyo externo: ya no queda personal del laboratorio).' : 'Ayudante de extracción de núcleos');
        } else {
          filas.push(filaSinAsignar(proy, 'Falta ayudante para la extracción de núcleos. Pedir apoyo a Perforaciones.'));
        }
      }
      return;
    }

    // Nadie libre: ¿alguien puede atender dos proyectos?
    const combinacion = buscarCombinacion(proy, nec);
    if (combinacion && proy.zona === 'ZONA2') {
      const f = asignar(combinacion.per, proy, 'combinacion', { previo: combinacion.previo.proyectoId });
      f.sugerencias.push('Atiende 2 proyectos: llega desde "' + combinacion.previoNombre + '". Requiere autorización.');
      return;
    }

    // Sin asignar: explica por qué y, si aplica, deja una sugerencia
    let motivo = libres.length ? 'No alcanzan los equipos (' + [...nec.equipos].map(e => EQUIPOS[e].nombre).join(', ') + ').'
                               : 'No hay técnico libre habilitado para todos los ensayos pedidos. Pedir apoyo a Perforaciones.';
    const fila = filaSinAsignar(proy, motivo);
    if (combinacion) {
      fila.sugerencias.push('Podría cubrirlo ' + nombrePropio(combinacion.per.nombre) + ' después de "' +
        combinacion.previoNombre + '" (fuera de la regla de zona; requiere autorización).');
    }
    filas.push(fila);
  });

  /** Busca un técnico ya asignado a UN proyecto que pueda atender también este. */
  function buscarCombinacion(proy, nec) {
    let mejor = null;
    for (const [nombre, susFilas] of ocupados) {
      if (susFilas.length !== 1) continue;
      const per = PERSONA[nombre], previoFila = susFilas[0];
      const previo = validos.find(p => p.id === previoFila.proyectoId);
      if (!previo || previoFila.rol === 'ayudante' || !puedeHacer(per, proy) || !disponible(per, proy)) continue;
      if (proy.zona === 'ZONA2' && previo.zona !== 'ZONA2') continue;     // misma zona
      const [A, B] = aMin(previo.horaLlegada) <= aMin(proy.horaLlegada) ? [previo, proy] : [proy, previo];
      const tAB = viaje(A, B, param).min;
      const libre = aMin(B.horaLlegada) - aMin(A.horaLlegada) - tAB;
      if (libre < (+param.horasCombinacion || 3) * 60) continue;
      // Equipos: si el proyecto nuevo pide un equipo que el previo no usaba, debe alcanzar
      const necPrevio = necesidades(previo);
      const extra = { equipos: new Set([...nec.equipos].filter(e => !necPrevio.equipos.has(e))) };
      if (!equiposAlcanzan(per, extra)) continue;
      if (!mejor || tAB < mejor.tAB) mejor = { per, previo: previoFila, previoNombre: previo.nombre, tAB };
    }
    return mejor;
  }

  /* ================= PASO 2: VEHÍCULOS ================= */

  const proyPorId = Object.fromEntries(validos.map(p => [p.id, p]));
  const vehLibres = VEHICULOS.filter(v => !vehNoDisponibles.has(v.id));
  const tomados = new Set();
  const conductores = [];                    // filas que manejan un vehículo de empresa

  // Calcula salida recomendada y km desde un punto de inicio
  function completarViaje(fila, inicio) {
    const proy = proyPorId[fila.proyectoId];
    const v = viaje(inicio, proy, param);
    fila.inicio = { lat: inicio.lat, lng: inicio.lng, nombre: inicio.nombre };
    if (v.km == null) {                         // falta la ubicación: no se calcula salida ni km
      fila.km = null; fila.salidaMin = null;
      if (!fila.sugerencias.includes(SIN_UBICACION)) fila.sugerencias.push(SIN_UBICACION);
      return;
    }
    fila.km = v.km;
    fila.salidaMin = aMin(proy.horaLlegada) - margen - v.min;
  }

  const asignadas = filas.filter(f => f.persona);
  // Orden: primero quien necesita un vehículo específico (extractora → Panel; densímetro fuera
  // de verano → L200/Panel), luego por hora; Ricardo al final porque puede llevar el suyo.
  const prioridadVeh = f => {
    const n = necesidades(proyPorId[f.proyectoId]);
    if (n.vehiculo) return 0;
    if (n.densimetro && !verano) return 1;
    if (PERSONA[f.persona].propioOpcional) return 3;
    return 2;
  };
  asignadas.sort((a, b) => prioridadVeh(a) - prioridadVeh(b) ||
    aMin(proyPorId[a.proyectoId].horaLlegada) - aMin(proyPorId[b.proyectoId].horaLlegada));

  /** Busca un vehículo de empresa libre para esta fila (respeta habilitación y vehículo exigido). */
  function tomarVehiculo(fila, per, proy) {
    const nec = necesidades(proy);
    const habil = vehLibres.filter(v => !tomados.has(v.id) && (v.exclusivo ? v.exclusivo === per.nombre : per.vehiculos.includes(v.id)));
    let opciones;
    if (per.nombre === NELSON_MENA) opciones = habil.filter(v => v.exclusivo === NELSON_MENA);
    else if (nec.vehiculo) opciones = habil.filter(v => nec.vehiculo.includes(v.id));
    else if (nec.densimetro && !verano) opciones = habil.filter(v => v.densimetro);
    else opciones = habil.filter(v => !v.densimetro).concat(habil.filter(v => v.densimetro));   // guarda L200 y Panel
    const veh = opciones[0];
    if (!veh) return { veh: null, habil, nec };
    tomados.add(veh.id);
    fila.vehiculoId = veh.id; fila.vehiculo = veh.texto; fila.pasajeros = [];
    completarViaje(fila, TPLAB);
    conductores.push(fila);
    return { veh, habil, nec };
  }

  asignadas.forEach(fila => {
    const per = PERSONA[fila.persona], proy = proyPorId[fila.proyectoId];

    if (fila.rol === 'combinacion') return;                         // se completa al final con el vehículo del 1er proyecto
    if (proy.transporte === 'CLIENTE') { fila.vehiculo = 'NO APLICA'; fila.transporteCliente = true; return; }
    if (per.propio) { fila.vehiculo = 'Vehículo Propio'; completarViaje(fila, salidaDe(per)); return; }

    if (per.maneja) {
      const { veh, habil, nec } = tomarVehiculo(fila, per, proy);
      if (veh) return;
      fila.sinVehiculo = true;                                      // se reintenta si se libera alguno (paso 2b)
      // Ricardo Rodríguez: si no alcanzan los vehículos de empresa, lleva el suyo
      if (per.propioOpcional) {
        fila.vehiculo = 'Vehículo Propio';
        fila.sugerencias.push('No alcanzaron los vehículos de empresa: se sugiere que lleve su vehículo propio.');
        completarViaje(fila, TPLAB);
        return;
      }
      if (nec.vehiculo && habil.length) fila.sugerencias.push('Este ensayo necesita ' + nec.vehiculo.map(id => (VEHICULOS.find(v => v.id === id) || {}).texto).join(' o ') + ' y no está libre.');
      else if (nec.densimetro && !verano && habil.length) fila.sugerencias.push('El densímetro necesita L200 o Panel y no hay libre.');
      fila.sugerencias.push('No alcanzaron los vehículos: va de pasajero.');
    }
    fila.necesitaTransporte = true;                                 // se resuelve en el paso 3
  });

  /* ============ PASO 2b: COMPARTIR VEHÍCULO ENTRE TÉCNICOS QUE MANEJAN ============
     Si dos técnicos salen de TP Lab y uno queda de camino al otro, van en un
     solo vehículo: el que va más lejos maneja y deja al otro primero (no espera).
     Se libera el otro vehículo. Límite: parámetro "compartir" (min extra).        */
  const compartirMax = +param.compartir || 0;
  if (compartirMax > 0) {
    const capacidadC = +param.capacidad || 4;
    // Los que van más lejos primero: ellos manejan
    const ordenados = conductores.filter(c => c.vehiculoId !== 'HYU1' && proyPorId[c.proyectoId].lat != null && !necesidades(proyPorId[c.proyectoId]).vehiculo)
      .sort((a, b) => viaje(TPLAB, proyPorId[b.proyectoId], param).min - viaje(TPLAB, proyPorId[a.proyectoId], param).min);
    const quedan = new Set(conductores);
    ordenados.forEach(b => {                                          // b: candidato a ir de pasajero
      if (!quedan.has(b) || (b.pasajeros || []).length) return;
      const necB = necesidades(proyPorId[b.proyectoId]);
      if (necB.densimetro && !verano) return;                         // lleva equipo que exige su vehículo
      const P = proyPorId[b.proyectoId], hP = aMin(P.horaLlegada), tLP = viaje(TPLAB, P, param).min;
      let mejor = null;
      ordenados.forEach(a => {                                        // a: el que maneja
        if (a === b || !quedan.has(a) || a.compartidoCon) return;
        if ((a.pasajeros || []).length + 1 > capacidadC) return;
        const Q = proyPorId[a.proyectoId], hQ = aMin(Q.horaLlegada);
        const tPQ = viaje(P, Q, param).min, tLQ = viaje(TPLAB, Q, param).min;
        const desvio = tLP + tPQ - tLQ;
        if (desvio > compartirMax) return;
        const salida = Math.min(hP - margen - tLP, hQ - margen - tLP - tPQ);
        if (hQ - (salida + tLP + tPQ) > 120) return;                  // el que maneja no llega con más de 2 h de anticipación
        if (hP - (salida + tLP) > 120) return;                        // ni el que deja
        if (!mejor || desvio < mejor.desvio) mejor = { a, desvio, salida };
      });
      if (!mejor) return;
      const a = mejor.a;
      tomados.delete(b.vehiculoId);                                   // se libera el vehículo de b
      quedan.delete(b);
      a.pasajeros.push(b.persona);
      a.salidaMin = Math.min(a.salidaMin, mejor.salida);
      a.sugerencias.push('Comparte vehículo: deja a ' + nombrePropio(b.persona) + ' en "' + P.nombre + '" (+' + Math.round(mejor.desvio) + ' min).');
      b.vehiculo = a.vehiculo; b.vehiculoId = undefined; b.compartidoCon = a.persona;   // técnico que maneja: solo el vehículo
      b.salidaMin = mejor.salida;
      b.sugerencias.push('Va en el vehículo de ' + nombrePropio(a.persona) + ' (misma ruta).');
    });
    for (let i = conductores.length - 1; i >= 0; i--) if (!quedan.has(conductores[i])) conductores.splice(i, 1);
  }

  // Ricardo Rodríguez puede llevar su vehículo propio: si alguien se quedó sin vehículo,
  // Ricardo le cede el de empresa y se sugiere que use el suyo
  filas.filter(f => f.sinVehiculo && !PERSONA[f.persona].propioOpcional).forEach(f => {
    const per = PERSONA[f.persona], nec = necesidades(proyPorId[f.proyectoId]);
    const r = conductores.find(c => PERSONA[c.persona].propioOpcional && !(c.pasajeros || []).length &&
      per.vehiculos.includes(c.vehiculoId) &&
      (!nec.vehiculo || nec.vehiculo.includes(c.vehiculoId)) &&
      (!(nec.densimetro && !verano) || (VEHICULOS.find(v => v.id === c.vehiculoId) || {}).densimetro));
    if (!r) return;
    tomados.delete(r.vehiculoId);
    conductores.splice(conductores.indexOf(r), 1);
    r.vehiculoId = undefined; r.vehiculo = 'Vehículo Propio';
    r.sugerencias.push('Se sugiere que lleve su vehículo propio para dejar libre uno de la empresa.');
  });

  // Los vehículos liberados se dan a quienes se habían quedado sin vehículo
  filas.filter(f => f.sinVehiculo).forEach(f => {
    const per = PERSONA[f.persona], proy = proyPorId[f.proyectoId];
    const { veh } = tomarVehiculo(f, per, proy);
    if (!veh) return;
    f.sinVehiculo = false; f.necesitaTransporte = false;
    f.sugerencias = f.sugerencias.filter(t => !/^No alcanzaron|necesita .* y no está libre|densímetro necesita/.test(t));
  });

  /* ================= PASO 3: QUIÉN LLEVA A QUIÉN ================= */

  const capacidad = +param.capacidad || 4;
  const desvioMax = +param.desvioMax || 90;

  // Nelson Mena puede ir a dejar a alguien aunque no tenga recolección asignada
  const hyundai = vehLibres.find(v => v.exclusivo === NELSON_MENA);
  let nelsonLibre = hyundai && !tomados.has(hyundai.id) && !ocupados.has(NELSON_MENA) && !noDisponibles.has(NELSON_MENA);

  const pasajeros = filas.filter(f => f.necesitaTransporte)
    .sort((a, b) => aMin(proyPorId[a.proyectoId].horaLlegada) - aMin(proyPorId[b.proyectoId].horaLlegada));

  pasajeros.forEach(fila => {
    const P = proyPorId[fila.proyectoId], hP = aMin(P.horaLlegada);
    const tLP = viaje(TPLAB, P, param);
    let mejor = null;

    conductores.forEach(c => {
      if (c.pasajeros.length >= capacidad) return;
      const Q = proyPorId[c.proyectoId], hQ = aMin(Q.horaLlegada);
      // Sin ubicación no se sabe si le queda de camino: solo si van al mismo proyecto
      if (Q.id !== P.id && (P.lat == null || Q.lat == null)) return;
      let desvio, salida;
      if (Q.id === P.id) { desvio = 0; salida = hQ - margen - viaje(TPLAB, Q, param).min; }
      else {
        const tPQ = viaje(P, Q, param).min, tLQ = viaje(TPLAB, Q, param).min;
        desvio = tLP.min + tPQ - tLQ;                                 // minutos extra por pasar dejándolo
        salida = Math.min(hP - margen - tLP.min, hQ - margen - tLP.min - tPQ);
      }
      if (desvio > desvioMax) return;
      if (!mejor || desvio < mejor.desvio) mejor = { c, desvio, salida };
    });

    if (mejor) {
      const c = mejor.c;
      c.pasajeros.push(fila.persona);
      if (c.salidaMin != null && P.lat != null) c.salidaMin = Math.min(c.salidaMin, mejor.salida);             // el conductor sale antes si hace falta
      // Convención TP Lab: si el que va de pasajero también maneja, solo se anota el vehículo
      fila.vehiculo = PERSONA[fila.persona].maneja ? c.vehiculo : c.vehiculo + ' ' + c.persona;
      fila.conductor = c.persona;
      completarViaje(fila, TPLAB);
      if (fila.salidaMin != null) fila.salidaMin = mejor.salida;
      if (c.proyectoId !== fila.proyectoId) {
        c.sugerencias.push('Deja a ' + nombrePropio(fila.persona) + ' en "' + P.nombre + '" (+' + Math.round(mejor.desvio) + ' min).');
        fila.sugerencias.push('Lo lleva ' + nombrePropio(c.persona) + '.');
      }
      return;
    }

    if (nelsonLibre) {                                                // Nelson Mena solo como transporte
      fila.vehiculo = hyundai.texto + ' ' + NELSON_MENA;
      fila.conductor = NELSON_MENA;
      completarViaje(fila, TPLAB);
      fila.sugerencias.push('Lo lleva Nelson Mena (después puede hacer recolecciones).');
      nelsonLibre = false;
      return;
    }

    fila.vehiculo = 'SIN TRANSPORTE';
    completarViaje(fila, TPLAB);
    fila.sugerencias.push(P.lat == null ? 'Falta la ubicación para saber quién lo puede llevar.' : 'Nadie pasa cerca para llevarlo: coordinar transporte.');
  });

  /* ---------- Combinaciones: usan el vehículo del primer proyecto ---------- */
  filas.filter(f => f.rol === 'combinacion').forEach(f => {
    const previo = filas.find(x => x === ocupados.get(f.persona)[0]);
    const proy = proyPorId[f.proyectoId], A = proyPorId[previo.proyectoId];
    f.vehiculo = previo.vehiculo || '';
    if (proy.transporte === 'CLIENTE') { f.vehiculo = 'NO APLICA'; return; }
    if (aMin(A.horaLlegada) <= aMin(proy.horaLlegada)) {
      completarViaje(f, { ...A, nombre: A.nombre });                   // sale del primer proyecto
    } else {
      // el proyecto "nuevo" es el primero del día: sale de su punto habitual
      completarViaje(f, PERSONA[f.persona].propio ? salidaDe(PERSONA[f.persona]) : TPLAB);
    }
  });

  /* ---------- Formato final ---------- */
  filas.forEach(f => {
    f.salidaRecomendada = f.salidaMin != null ? aHHMM(f.salidaMin, true) : '';
    f.km = f.km != null ? Math.round(f.km * 10) / 10 : null;
    delete f.salidaMin; delete f.necesitaTransporte;
  });

  // Avisos generales
  if (sinUbicacion) alertas.push(sinUbicacion + ' proyecto(s) sin ubicación: se asignaron sin calcular distancias, salida recomendada ni quién lleva a quién. Completa la ubicación y vuelve a generar.');
  const sinAsignar = filas.filter(f => !f.persona).length;
  if (sinAsignar) alertas.push(sinAsignar + ' proyecto(s) quedaron sin asignar.');
  const sinTransporte = filas.filter(f => f.vehiculo === 'SIN TRANSPORTE').length;
  if (sinTransporte) alertas.push(sinTransporte + ' persona(s) sin transporte.');
  Object.keys(usoEquipo).forEach(eq => {
    if (usoEquipo[eq] && usoEquipo[eq] >= EQUIPOS[eq].cantidad) alertas.push('Se usan todos los equipos: ' + EQUIPOS[eq].nombre + ' (' + usoEquipo[eq] + ').');
  });

  // Orden de salida: zona, hora de llegada y luego principal → ayudante
  const rolOrden = { principal: 0, combinacion: 1, ayudante: 2, sin: 3 };
  filas.sort((a, b) => {
    const pa = proyPorId[a.proyectoId] || proyectos.find(p => p.id === a.proyectoId) || {};
    const pb = proyPorId[b.proyectoId] || proyectos.find(p => p.id === b.proyectoId) || {};
    return (ORDEN_ZONA[pa.zona] ?? 9) - (ORDEN_ZONA[pb.zona] ?? 9) ||
           (aMin(pa.horaLlegada) ?? 9999) - (aMin(pb.horaLlegada) ?? 9999) ||
           String(pa.nombre).localeCompare(String(pb.nombre)) ||
           rolOrden[a.rol] - rolOrden[b.rol];
  });

  return { filas, alertas };
}

/**
 * Algoritmo húngaro (asignación de costo mínimo).
 * matriz[i][j] = costo de dar el proyecto i a la persona j.
 * Devuelve, para cada proyecto i, el índice j de la persona (o -1).
 */
function hungaro(matriz, INF) {
  const n = matriz.length; if (!n) return [];
  const m0 = matriz[0].length, m = Math.max(n, m0);
  const a = matriz.map(f => f.concat(Array(m - m0).fill(INF)));         // columnas ficticias si faltan personas
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), usado = Array(m + 1).fill(false);
    do {
      usado[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!usado[j]) {
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) { if (usado[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j] && j - 1 < m0) res[p[j] - 1] = j - 1;
  return res;
}

/** Fila para un proyecto que no se pudo cubrir. */
function filaSinAsignar(proy, motivo) {
  return { proyectoId: proy.id, persona: null, rol: 'sin', vehiculo: '', sugerencias: [motivo] };
}
