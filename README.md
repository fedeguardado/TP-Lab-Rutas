# TP Lab Rutas

App web para proponer cada día qué técnico va a cada proyecto, en qué vehículo,
quién lleva a quién, la hora de salida recomendada y la distancia. Genera el
**informe de salida de rutas** y el **informe de recolecciones** en Excel, y
guarda/carga el **log del día** (respaldo en Excel).

## Uso diario

1. **Proyectos del día → Cargar proyectos desde Excel.** El Excel usa las columnas del informe de
   salida (solicitante, nombre, fecha, horas, transporte, actividad). Solo se cargan Licitación,
   Zona 1 y Zona 2. Si se carga dos veces, actualiza en lugar de duplicar.
2. En cada proyecto, **Completar**: pegar la ubicación de Google Maps y confirmar los ensayos
   (la app los sugiere leyendo la actividad).
3. **Propuesta → Generar propuesta → Descargar Excel.**
4. **Guardar log del día** (cabecera) para respaldar.

## Estructura

```
tplab-rutas/
├── index.html              → estructura de la página (cabecera, pestañas, formularios)
├── img/                    → icono de la pestaña del navegador
├── css/
│   ├── variables.css       → colores (degradado azul), tipografías y espacios
│   ├── base.css            → página, cabecera, pestañas
│   └── componentes.css     → tarjetas, formularios, botones, tablas, etiquetas
└── js/
    ├── main.js             → arranque, día de trabajo y pestañas
    ├── bases.js            → BASES FIJAS: personal, vehículos, ensayos, equipos, salidas, prioridad DOM
    ├── datos.js            → dónde se guarda la información
    ├── importar.js         → cargar proyectos desde el Excel (formato del informe de salida)
    ├── ubicaciones.js      → leer enlaces de Google Maps y coordenadas
    ├── distancias.js       → distancia y tiempo de viaje estimados
    ├── asignacion.js       → reglas de la propuesta (personas, vehículos, quién lleva a quién)
    ├── recolecciones.js    → plazos y día sugerido de recolección
    ├── excel.js            → informe de salida, recolecciones y log del día
    ├── util.js             → fechas, horas y ayudantes
    └── ui-*.js             → una por pestaña (proyectos, propuesta, recolecciones, parámetros, bases, log)
```

Para cambiar personal, vehículos, habilitaciones o ensayos se edita `js/bases.js`.

## Publicar en GitHub Pages

1. Crea un repositorio y sube **el contenido** de esta carpeta (que `index.html` quede en la raíz).
2. En el repositorio: **Settings → Pages → Build and deployment**, elige *Deploy from a branch*,
   rama `main` y carpeta `/ (root)`. Guarda.
3. En uno o dos minutos GitHub muestra el enlace (`https://<usuario>.github.io/<repositorio>/`).

> Importante: abre la app desde ese enlace (o desde un servidor local). Si haces doble clic en
> `index.html`, el navegador bloquea los archivos de `js/` y la página queda en blanco.

## Dónde quedan los datos

En GitHub Pages los datos se guardan **en el navegador de cada computadora** (no se comparten
entre usuarios). Para pasar el trabajo de un día a otra persona o computadora:
**Guardar log del día** → enviar el Excel → la otra persona usa **Cargar log del día**.

Necesita internet para cargar la librería de Excel (SheetJS) y las tipografías.
