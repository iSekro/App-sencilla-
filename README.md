# Sekro Download Manager

Gestor de descargas portable para Windows inspirado en Internet Download Manager (IDM). Construido con **Electron** y **JavaScript puro**.

## Características

- **Descargas multi-hilo** — Divide archivos en múltiples conexiones simultáneas (hasta 32) para máxima velocidad.
- **Pausa y reanudación** — Pausa cualquier descarga y reanúdala donde la dejaste.
- **Cola inteligente** — Gestiona descargas simultáneas con límite configurable.
- **Progreso en tiempo real** — Barra de progreso, velocidad, ETA y porcentaje para cada descarga.
- **Categorización automática** — Organiza archivos por tipo: vídeo, audio, documentos, imágenes, archivos comprimidos, programas.
- **Interfaz moderna** — Tema oscuro estilo profesional con barra de título personalizada.
- **Portable (.exe)** — Ejecutable portable para Windows, sin instalación necesaria.
- **Instalador NSIS** — También disponible como instalador tradicional.
- **Atajos de teclado** — `Ctrl+N` para nueva descarga, `Esc` para cerrar diálogos.

## Capturas de pantalla

La interfaz incluye:
- Panel lateral con navegación (Descargas, Completadas, Categorías, Ajustes)
- Barra de herramientas con acciones rápidas y estadísticas en vivo
- Modal de nueva descarga con opciones de URL, nombre, carpeta y conexiones
- Vista de categorías con conteo por tipo de archivo

## Cómo usar

### Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start
```

### Compilar para Windows

```bash
# Generar .exe portable
npm run build:portable

# Generar instalador NSIS
npm run build:installer

# Generar ambos (portable + instalador)
npm run build:all
```

Los archivos compilados se generan en la carpeta `dist/`:
- `SekroDownloadManager-1.0.0-Portable.exe` — Ejecutable portable
- `SekroDownloadManager-1.0.0-Setup.exe` — Instalador

## Estructura del proyecto

| Archivo | Descripción |
|---------|-------------|
| `main.js` | Proceso principal de Electron (ventana, IPC, configuración) |
| `preload.js` | Bridge seguro entre el proceso principal y el renderer |
| `download-engine.js` | Motor de descargas (multi-hilo, pausa/reanudar, cola, merge de chunks) |
| `index.html` | Interfaz gráfica |
| `app.js` | Lógica del renderer (UI, eventos, renderizado) |
| `styles.css` | Estilos (tema oscuro, layouts, componentes) |
| `package.json` | Configuración del proyecto y electron-builder |

## Arquitectura

```
┌──────────────────────────────────────┐
│           Electron Main              │
│  ┌─────────────┐  ┌──────────────┐  │
│  │   main.js   │  │ download-    │  │
│  │   (IPC)     │◄─┤ engine.js    │  │
│  └──────┬──────┘  │ (multi-hilo) │  │
│         │         └──────────────┘  │
│  ┌──────┴──────┐                    │
│  │ preload.js  │                    │
│  │ (bridge)    │                    │
│  └──────┬──────┘                    │
├─────────┼────────────────────────────┤
│  ┌──────┴──────┐                    │
│  │  Renderer   │                    │
│  │  app.js     │                    │
│  │  index.html │                    │
│  │  styles.css │                    │
│  └─────────────┘                    │
│           Electron Renderer          │
└──────────────────────────────────────┘
```

## Licencia

MIT
