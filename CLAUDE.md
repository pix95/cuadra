# Cuadra · notas para trabajar en el código

App de finanzas personales en español (React + Vite, servidor Node opcional, datos en Supabase). Se publica en GitHub Pages al subir a `main`.

## Reglas

- Todo en español: interfaz, código, comentarios y mensajes de commit.
- El repositorio es **público**: nunca pongas cifras ni datos reales (presupuesto, sueldo, matrícula, km, importes) en el código ni en las pruebas. Usa datos inventados. El presupuesto real vive solo en `presupuesto-personal.js` (ignorado por git).
- La lógica de datos va en `shared/modelo.js` (validación y operaciones `op.*` que devuelven `{ r, cambios }`) y los cálculos en `src/lib/calculos.js` (funciones puras, con `hoy` como parámetro para las pruebas).
- Hay dos motores y los dos deben seguir funcionando: `src/motores/supabase.js` (copia local + cola sin conexión; adapta `aFila`, `deFila`, `CONFLICTO`, la descarga y `aplicarLocal`) y `src/motores/servidor.js` + `server/rutas.js` (las operaciones compuestas van por `POST /api/op/:nombre`, en la lista `OPS_COMPUESTAS`).
- Cambios en Supabase: en `supabase/esquema.sql`, idempotentes (`create table if not exists`, `add column if not exists`), con `user_id default auth.uid()`, RLS y `grant` (la tabla nueva se añade al bucle de seguridad del final). Los datos que ya existen tienen que seguir funcionando sin migraciones a mano.
- Pruebas: `npm test` (`node --test`, sin dependencias nuevas). Añade pruebas para cada cálculo u operación nueva.
- Commits pequeños con mensaje en español. Actualiza `README.md` cuando cambie lo que ve el usuario.

## Conceptos

- Movimientos: `gasto`, `ingreso`, `ahorro`, `ajuste` («Cuadrar con el banco») e `inicial` (antiguo, se trata como ajuste). `enlace` une un gasto con su retirada de la hucha «Recibos no mensuales».
- Cuentas fijas con id reservado: cuenta principal, Ahorros principales y «Recibos no mensuales» (ver `shared/modelo.js`).
- Nómina: `meses[mes] = { sueldo, ingresada }`; desde el día de corte (`ajustes.nomina.diaCorte`, 20 por defecto) cuenta para el mes siguiente.
- Mes de un movimiento: `mesDe(m)` (el campo `mes` si lo tiene, que solo puede ser el mes siguiente al de la fecha; si no, el de la fecha). Agrupa siempre por `mesDe`, nunca por `fecha.slice(0, 7)`. `mesEnCurso(db)` es el mes siguiente en cuanto su nómina está ingresada.
- Coche: `vehiculos`, `repostajes`, `mantenimientos`, `recordatorios`. Repostajes y mantenimientos apuntan a su gasto con `movimientoId`; `op.guardarGasto` los crea, actualiza o borra en la misma operación, y `borrarMovimiento` / `restaurarMovimientos` los llevan juntos (marcados con `_tabla`).
- Navegación: 4 pestañas en `src/App.jsx` (`PESTAÑAS`); las vistas siguen siendo las de siempre (`#/ahorros`, `#/coche`…).
