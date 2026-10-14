/* =====================================================================
   bases.js — Bases fijas de TP Lab
   ---------------------------------------------------------------------
   Aquí viven los datos que NO cambian día a día: personal, vehículos,
   ensayos, equipos, puntos de salida y la prioridad de DOM Licitación.
   Para modificarlos se edita este archivo (no hay pantallas de registro,
   tal como se acordó).
   ===================================================================== */

/* ---------- Puntos de salida (coordenadas exactas compartidas) ---------- */
export const PUNTOS_SALIDA = {
  TPLAB:  { nombre: 'TP Lab',          lat: 13.675254532389589, lng: -89.24173530545393 },
  MELVIN: { nombre: 'Salida de Melvin', lat: 13.926667,          lng: -89.505000 },          // 13°55'36.0"N 89°30'18.0"W
  NELSON: { nombre: 'Salida de Nelson', lat: 13.968417,          lng: -89.589167 },          // 13°58'06.3"N 89°35'21.0"W
  ANGEL:  { nombre: 'Salida de Ángel',  lat: 14.064806,          lng: -88.794972 },          // 14°03'53.3"N 88°47'41.9"W
  MANOLO: { nombre: 'Salida de Manolo', lat: 13.47333725961727,  lng: -88.17228562070552 },
};

/* ---------- Vehículos de la empresa ----------
   Todos se recogen en TP Lab. "exclusivo" = solo esa persona lo usa. */
export const VEHICULOS = [
  { id: 'TOY1', texto: 'TOYOTA 1 (P 117 3BC)' },
  { id: 'TOY2', texto: 'TOYOTA 2 (P120 8D8)' },
  { id: 'TOY3', texto: 'TOYOTA 3 (P120 88B)' },
  { id: 'JMC1', texto: 'JMC 1 (P101 4DF)' },
  { id: 'JMC2', texto: 'JMC 2 (P101 4BA)' },
  { id: 'TOY4', texto: 'TOYOTA 4 PANEL (P120 8D4)', densimetro: true },
  { id: 'L200', texto: 'MITSUBISHI L200 (P254 620)', densimetro: true },
  { id: 'HYU1', texto: 'HYUNDAI 1 (P55 90D)', exclusivo: 'NELSON MENA' },
];
// El orden de la lista es el orden de preferencia al repartir:
// la Panel y la L200 van al final para guardarlas para el densímetro nuclear.

/* ---------- Ensayos ----------
   recoleccion: ventana en días después de la fecha del ensayo
   equipo: equipo limitado que consume
   personas: técnicos que requiere (extracción = 2) */
export const ENSAYOS = [
  { id: 'EXTRACCIONNUCLEOS',  nombre: 'Extracción de núcleos', equipo: 'extractora', personas: 2, vehiculo: ['TOY4'] },
  { id: 'DENSCONOYARENA',     nombre: 'Densidad cono y arena' },
  { id: 'BRIQUETASS/C',       nombre: 'Briquetas de suelo-cemento' },
  { id: 'CONTROLCOLCONCRETO', nombre: 'Control de colado de concreto', recoleccion: { desde: 1, hasta: 2, texto: 'máx. 48 h' } },
  { id: 'CONTROLCOLLODO',     nombre: 'Control de colado de lodocreto', recoleccion: { desde: 3, hasta: 4, texto: '3 a 4 días' } },
  { id: 'SPEEDYTESTER',       nombre: 'Speedy test', equipo: 'speedy' },
  { id: 'CUBOSMORTERO',       nombre: 'Cubos de mortero', recoleccion: { desde: 1, hasta: 2, texto: 'máx. 48 h' } },
  { id: 'DENSIMNUCLEAR',      nombre: 'Densímetro nuclear', equipo: 'densimetro' },
  { id: 'CALCDENSCAMPO',      nombre: 'Cálculo de densidad de campo', nota: 'Llevar cocina y tambo de gas' },
  { id: 'RECOLECCION',        nombre: 'Recolección' },
  { id: 'CONTROLCOLMAC',      nombre: 'Control de colado de MAC' },
  { id: 'CALICATAS',          nombre: 'Calicatas' },
  { id: 'PRISMASGROUT',       nombre: 'Prismas de grout', recoleccion: { desde: 1, hasta: 2, texto: 'máx. 48 h' } },
];
export const ENSAYO = Object.fromEntries(ENSAYOS.map(e => [e.id, e]));

/* ---------- Equipos limitados por día ----------
   Los speedy de Melvin y Nelson Sánchez los resguardan ellos: solo cuentan
   cuando ellos mismos van; los demás salen de los 3 de TP Lab. */
export const EQUIPOS = {
  densimetro: { nombre: 'Densímetro nuclear', cantidad: 2 },
  extractora: { nombre: 'Extractora de núcleos', cantidad: 2 },
  speedy:     { nombre: 'Speedy test (TP Lab)', cantidad: 3, propios: ['MELVIN HENRRIQUEZ', 'NELSON SANCHEZ'] },
};

/* ---------- Zonas ---------- */
export const ZONAS = [
  { id: 'DOM',   nombre: 'DOM Licitación', solicitante: 'DIRECCION DE OBRAS MUNICIPALES (LICITACION)' },
  { id: 'ZONA1', nombre: 'Zona 1',         solicitante: 'DIRECCION DE OBRAS MUNICIPALES (ZONA 1)' },
  { id: 'ZONA2', nombre: 'Zona 2',         solicitante: 'DIRECCION DE OBRAS MUNICIPALES (ZONA 2)', combina: true },
];
export const ZONA = Object.fromEntries(ZONAS.map(z => [z.id, z]));

/* ---------- Prioridad para DOM Licitación (en orden) ---------- */
export const PRIORIDAD_DOM = [
  'JONATHAN MENJIVAR', 'KEVIN PORTILLO', 'ENOC MONTES', 'GERSON GUZMAN',
  'WILLIAM GAMERO', 'FRANCISCO MEJIA', 'MANOLO PORTILLO', 'ZACARIAS GUZMAN',
];

/* ---------- Preferidos por ensayo ----------
   Si el proyecto pide ese ensayo, estas personas van primero (antes que la
   prioridad de DOM). Ej.: Jonathan Menjívar es quien hace las extracciones. */
export const PREFERIDOS = { EXTRACCIONNUCLEOS: ['JONATHAN MENJIVAR'] };

/* ---------- Personal de reserva (valor inicial; se cambia en Parámetros) ----------
   Laboratoristas con carga fija en el laboratorio: se usan solo si no alcanza el resto. */
export const RESERVA_INICIAL = ['ALEJANDRO PEREZ', 'STEVEN BAUTISTA'];

/* ---------- Restricciones fijas de zona por persona ---------- */
export const SOLO_ZONAS = { 'LUIS CORTEZ': ['ZONA1', 'ZONA2'] };

/* ---------- Personal ----------
   lab: es laboratorista · maneja: es motorista · salida: punto de salida
   propio: tiene vehículo propio (no puede llevar a otros)
   vehiculos: vehículos de empresa habilitados · ensayos: lo que puede hacer */
export const PERSONAL = [
  {"nombre": "ZACARIAS GUZMAN", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "DENSIMNUCLEAR", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "KEVIN PORTILLO", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2", "L200"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "DENSIMNUCLEAR", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "GERSON GUZMAN", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "DENSIMNUCLEAR", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "JONATHAN MENJIVAR", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ARMANDO VASQUEZ", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CUBOSMORTERO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "WILLIAM GAMERO", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ERICK RAMIREZ", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ENOC MONTES", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ESTIVEN DUBON", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ALEJANDRO PEREZ", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "FREDY BENITEZ", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "RICARDO RODRIGUEZ", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "propioOpcional": true, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2", "L200"], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "CARLOS GUZMAN", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2", "L200"], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "FRANCISCO MEJIA", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "DENSIMNUCLEAR", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "JONATHAN GARCIA", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["EXTRACCIONNUCLEOS", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "JONATHAN VASQUEZ", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "STEVEN BAUTISTA", "lab": true, "maneja": false, "salida": "TPLAB", "propio": false, "vehiculos": [], "ensayos": ["CONTROLCOLCONCRETO", "CONTROLCOLLODO", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "MANOLO PORTILLO", "lab": true, "maneja": true, "salida": "MANOLO", "propio": true, "vehiculos": [], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "RECOLECCION", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "MELVIN HENRRIQUEZ", "lab": true, "maneja": true, "salida": "MELVIN", "propio": true, "vehiculos": [], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "NELSON SANCHEZ", "lab": true, "maneja": true, "salida": "NELSON", "propio": true, "vehiculos": [], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "LUIS CORTEZ", "lab": true, "maneja": true, "salida": "TPLAB", "propio": true, "vehiculos": [], "ensayos": ["EXTRACCIONNUCLEOS", "DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "DENSIMNUCLEAR", "CALCDENSCAMPO", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "ANGEL PINEDA", "lab": true, "maneja": true, "salida": "ANGEL", "propio": true, "vehiculos": [], "ensayos": ["DENSCONOYARENA", "BRIQUETASS/C", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "SPEEDYTESTER", "CUBOSMORTERO", "CALCDENSCAMPO", "CONTROLCOLMAC", "CALICATAS", "PRISMASGROUT"]},
  {"nombre": "NELSON MENA", "lab": false, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["HYU1"], "ensayos": ["RECOLECCION"]},
  {"nombre": "STEVEN VIDES", "lab": true, "maneja": true, "salida": "TPLAB", "propio": false, "vehiculos": ["TOY1", "TOY2", "TOY3", "TOY4", "JMC1", "JMC2"], "ensayos": ["DENSCONOYARENA", "CONTROLCOLCONCRETO", "CONTROLCOLLODO", "RECOLECCION", "CALICATAS", "PRISMASGROUT"]},
  // Apoyo externo (no es laboratorista): solo como ayudante cuando ya no queda personal del laboratorio
  {"nombre": "MARIO RUIZ", "lab": false, "maneja": false, "salida": "TPLAB", "propio": false, "apoyo": true, "vehiculos": [], "ensayos": []},
];
export const PERSONA = Object.fromEntries(PERSONAL.map(p => [p.nombre, p]));
