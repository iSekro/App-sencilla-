# App Sencilla — Lista de Tareas

Aplicación web simple de lista de tareas hecha con **HTML, CSS y JavaScript puro** (sin frameworks ni dependencias).

## Funcionalidades

- Añadir tareas.
- Marcar tareas como hechas.
- Borrar tareas individualmente.
- Filtrar por: Todas / Pendientes / Hechas.
- Borrar todas las tareas hechas de un clic.
- Contador de tareas pendientes.
- Las tareas se guardan en `localStorage`, así que persisten al recargar la página.

## Cómo usar

Abre `index.html` en tu navegador. No necesita servidor ni build step.

```bash
# Opcional: servir con un servidor estático
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

## Estructura

- `index.html` — marcado y punto de entrada.
- `styles.css` — estilos de la interfaz.
- `app.js` — lógica de la aplicación.
