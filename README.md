# App Sencilla — Lista de Tareas

Aplicación de escritorio de lista de tareas hecha con **Electron, HTML, CSS y JavaScript puro**.

## Funcionalidades

- Añadir tareas.
- Marcar tareas como hechas.
- Borrar tareas individualmente.
- Filtrar por: Todas / Pendientes / Hechas.
- Borrar todas las tareas hechas de un clic.
- Contador de tareas pendientes.
- Las tareas se guardan en `localStorage`, así que persisten al recargar la página.

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior recomendado)
- npm (incluido con Node.js)

## Instalación

```bash
npm install
```

## Uso en modo desarrollo

```bash
npm start
```

Esto abrirá la aplicación de escritorio con Electron.

## Generar ejecutable (.exe) para Windows

```bash
npm run dist
```

El instalador `.exe` se generará en la carpeta `dist/`.

## Generar para todas las plataformas

```bash
npm run dist:all
```

## Estructura

- `main.js` — punto de entrada de Electron (proceso principal).
- `index.html` — marcado y punto de entrada del renderizador.
- `styles.css` — estilos de la interfaz.
- `app.js` — lógica de la aplicación (proceso renderizador).
- `package.json` — configuración del proyecto, scripts y configuración de electron-builder.
