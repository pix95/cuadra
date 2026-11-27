---
paths:
  - "shared/**"
  - "src/lib/calculos.js"
  - "test/**"
---

# Datos y modelo

## Dónde va cada cosa

- La lógica de datos va en `shared/modelo.js`: validación y operaciones `op.*`, que devuelven `{ r, cambios }`.
- Los cálculos van en `src/lib/calculos.js`: funciones puras, con `hoy` como parámetro para las pruebas.
- Pruebas en `test/` con `node --test`, sin dependencias nuevas.

## Conceptos

- Movimientos: `gasto`, `ingreso`, `ahorro`, `ajuste` («Cuadrar con el banco») e `inicial` (antiguo, se trata como ajuste). `enlace` une un gasto con su retirada de la hucha «Recibos no mensuales».
- Cuentas fijas con id reservado: cuenta principal, Ahorros principales y «Recibos no mensuales» (ver `shared/modelo.js`).
- Nómina: `meses[mes] = { sueldo, ingresada }`. La nómina siempre cuenta para el mes siguiente al día en que entra (`mesDeNomina`). `ajustes.nomina.diaCorte` solo dice desde qué día la recuerda la campana.
- Mes de un movimiento: `mesDe(m)`, que es el campo `mes` si lo tiene (solo puede ser el mes siguiente al de la fecha) y si no, el mes de la fecha. Agrupa siempre por `mesDe`, nunca por `fecha.slice(0, 7)`.
- `mesEnCurso(db)` es el mes siguiente en cuanto su nómina está ingresada.
