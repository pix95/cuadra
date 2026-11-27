---
paths:
  - "src/pantallas/**"
  - "src/components/**"
  - "src/estilos.css"
  - "src/App.jsx"
  - "src/store.jsx"
---

# Interfaz

## Navegación

- 4 pestañas en `src/App.jsx` (`PESTAÑAS`). Las vistas siguen siendo las de siempre (`#/ahorros`, `#/coche`…).
- Una vista puede llevar subruta (`ui.sub`): `#/areas/<categoría>` y `#/coche/<id del vehículo>`. Se navega con `ui.irA(vista, datos, sub)`.
- El coche cuelga de Áreas (alias en la pestaña Herramientas).
- Áreas: `resumenArea` y `areas` en `src/lib/calculos.js`.

## Estilo visual

- Tema oscuro. Los colores y las fuentes son variables en `:root` de `src/estilos.css`: usa esas variables, no colores sueltos.
- Las tarjetas destacadas usan el degradado `--fondo-saldo` (clase `fondo-degradado`), con `--texto-sobre-degradado` para el texto secundario.
- En el móvil, la app es una columna de 440 px como máximo (`--ancho`, `.marco`). A partir de 900 px cambia de diseño: ver el bloque «Pantallas grandes» al final de `src/estilos.css`.

## Textos

- Toda la interfaz en español, con comillas latinas («») para nombrar botones, cuentas y partidas.
