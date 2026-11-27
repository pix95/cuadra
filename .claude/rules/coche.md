---
paths:
  - "src/pantallas/Coche*.jsx"
  - "test/coche.test.js"
  - "shared/modelo.js"
  - "src/lib/calculos.js"
---

# Coche

- Tablas: `vehiculos`, `repostajes`, `mantenimientos`, `recordatorios`.
- Repostajes y mantenimientos apuntan a su gasto con `movimientoId`; `op.guardarGasto` los crea, actualiza o borra en la misma operación.
- `borrarMovimiento` / `restaurarMovimientos` los llevan juntos (marcados con `_tabla`).
