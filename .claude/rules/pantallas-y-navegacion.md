---
paths:
  - "src/App.jsx"
  - "src/store.jsx"
  - "src/pantallas/**"
  - "src/components/**"
  - "src/estilos.css"
---

# Pantallas y navegación

- Navegación: 4 pestañas en `src/App.jsx` (`PESTAÑAS`); las vistas siguen siendo las de siempre (`#/ahorros`, `#/coche`…).
- Una vista puede llevar subruta (`ui.sub`): `#/areas/<categoría>` y `#/coche/<id del vehículo>`; `ui.irA(vista, datos, sub)`.
- El coche cuelga de Áreas (alias en la pestaña Herramientas).
- Áreas: `resumenArea` y `areas` en `calculos.js`; un vehículo va al área de su partida de combustible (`categoriaVehiculo`).
