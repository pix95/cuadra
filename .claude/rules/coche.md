---
paths:
  - "src/pantallas/Coche*.jsx"
  - "test/coche.test.js"
  - "shared/modelo.js"
  - "src/lib/calculos.js"
---

# Coche

- Tablas: `vehiculos`, `repostajes`, `mantenimientos` y `recordatorios`.
- Repostajes y mantenimientos apuntan a su gasto con `movimientoId`. `op.guardarGasto` los crea, actualiza o borra en la misma operación.
- `borrarMovimiento` y `restaurarMovimientos` los llevan junto con su gasto (marcados con `_tabla`).
- Un vehículo va al área de su partida de combustible (`categoriaVehiculo`).
