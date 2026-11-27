# Cuadra

App de finanzas personales en español. Se publica en GitHub Pages al subir a `main`.

**Stack:** React + Vite, con un servidor Node opcional y los datos en Supabase.

## Comandos

- `npm test`: ejecuta las pruebas (`node --test`).
- `npm run dev`: abre la web en local con Vite.
- `npm run build`: compila para publicar.

## Reglas que valen siempre

- Todo en español: interfaz, código, comentarios y mensajes de commit.
- El repositorio es **público**: nunca pongas cifras ni datos reales (presupuesto, sueldo, matrícula, km, importes) en el código ni en las pruebas. Usa datos inventados. El presupuesto real vive solo en `presupuesto-personal.js`, que git ignora.
- Commits pequeños con mensaje en español.
- Actualiza `README.md` cuando cambie lo que ve el usuario.
- Cada cálculo u operación nueva lleva su prueba.

## Memoria por temas

Cada archivo se carga solo cuando tocas los archivos de su tema:

- [`.claude/rules/datos-y-modelo.md`](.claude/rules/datos-y-modelo.md): `op.*` y `{ r, cambios }`, cálculos puros, pruebas, tipos de movimiento, cuentas fijas, nómina, `mesDe` y `mesEnCurso`.
- [`.claude/rules/supabase.md`](.claude/rules/supabase.md): los dos motores (Supabase y servidor Node), `aFila`/`deFila`/`CONFLICTO`, la cola sin conexión, `OPS_COMPUESTAS` y el esquema idempotente con RLS y `grant`.
- [`.claude/rules/pantallas-y-navegacion.md`](.claude/rules/pantallas-y-navegacion.md): las 4 pestañas, las subrutas (`ui.sub`, `ui.irA`) y Áreas, con el coche dentro de su área.
- [`.claude/rules/coche.md`](.claude/rules/coche.md): las tablas del coche y cómo van con su gasto.

**Este archivo no crece:** los detalles nuevos van en el archivo de su tema, o en uno nuevo de `.claude/rules/` que se añade a esta lista. Cada regla vive en un solo sitio.
