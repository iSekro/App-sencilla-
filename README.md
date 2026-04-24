# App Sencilla — Lista de Tareas (Electron)

Aplicación web simple de lista de tareas hecha con **HTML, CSS y JavaScript puro**, empaquetada como **app de escritorio con Electron** para Windows, Linux y macOS.

## Funcionalidades

- Añadir tareas.
- Marcar tareas como hechas.
- Borrar tareas individualmente.
- Filtrar por: Todas / Pendientes / Hechas.
- Borrar todas las tareas hechas de un clic.
- Contador de tareas pendientes.
- Persistencia en `localStorage` (las tareas sobreviven al cerrar la app).

## Uso en navegador

Abre `index.html` directamente en el navegador. No necesita servidor ni build step.

## Uso como app de escritorio (Electron)

### Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye npm).

### Desarrollo

```bash
npm install
npm start
```

Se abrirá la app en una ventana nativa.

### Generar ejecutable (.exe para Windows)

Desde **Windows**:

```bash
npm install
npm run dist:win
```

Esto genera dos artefactos en la carpeta `dist/`:

- `App Sencilla Setup <version>.exe` — instalador NSIS (crea accesos directos y entrada de desinstalación).
- `AppSencilla-Portable-<version>.exe` — ejecutable portable (no requiere instalación).

Desde **Linux/macOS** también se puede cross-compilar a Windows, pero electron-builder necesita `wine` instalado para firmar/empaquetar. Si no lo tienes, lo más fiable es generar el `.exe` desde una máquina Windows.

### Otros targets

- `npm run dist` — build para el SO actual.
- `npm run pack` — empaqueta sin generar instalador (útil para testear rápido).

## Estructura

- `index.html` — marcado y punto de entrada del renderer.
- `styles.css` — estilos de la interfaz.
- `app.js` — lógica de la aplicación (renderer process).
- `main.js` — proceso principal de Electron (crea la BrowserWindow).
- `package.json` — dependencias y configuración de electron-builder.
