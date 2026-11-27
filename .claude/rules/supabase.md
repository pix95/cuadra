---
paths:
  - "supabase/**"
  - "src/motores/**"
  - "server/**"
---

# Supabase y los dos motores

## Los dos motores

Hay dos motores y los dos deben seguir funcionando:

- `src/motores/supabase.js`: copia local más cola sin conexión. Adapta `aFila`, `deFila`, `CONFLICTO`, la descarga y `aplicarLocal`.
- `src/motores/servidor.js` + `server/rutas.js`: las operaciones compuestas van por `POST /api/op/:nombre` y tienen que estar en la lista `OPS_COMPUESTAS`.

## Cambios en el esquema

- Van en `supabase/esquema.sql` y son idempotentes (`create table if not exists`, `add column if not exists`).
- Cada tabla lleva `user_id default auth.uid()`, RLS y `grant`. Una tabla nueva se añade al bucle de seguridad del final del archivo.
- Los datos que ya existen tienen que seguir funcionando sin migraciones a mano.
