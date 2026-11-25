# Cuadra 2.0

Tu app para apuntar gastos y controlar el mes frente a tu presupuesto. Hecha con **React** y **Node**, con los datos en **Supabase** para tenerla igual en el móvil y en el ordenador.

- **App publicada:** <https://pix95.github.io/cuadra/>. Se instala en el móvil como una app y funciona sin conexión.
- **Datos:** en tu proyecto de Supabase. Lo que apuntas en un dispositivo aparece en el otro.

## Ponerla en marcha (una sola vez)

### 1 · Actualizar la base de datos

En Supabase → **SQL Editor → New query**, pega el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y pulsa **Run**. Debe decir *Success*.

Añade lo que necesita la versión nueva (sueldo de cada mes, objetivos, simulaciones, recibos e iconos) **sin borrar nada**. Se puede ejecutar más de una vez.

### 2 · Publicar con GitHub Actions

En GitHub, en el repositorio: **Settings → Pages → Build and deployment → Source: «GitHub Actions»**.

A partir de ahí, cada vez que se sube algo a la rama `main`, GitHub compila la app y la publica sola (pestaña **Actions** para ver cómo va).

### 3 · En el móvil

Abre <https://pix95.github.io/cuadra/> y entra con tu email y contraseña.

- **Android (Chrome):** menú ⋮ → **Instalar aplicación** (o el botón «Instalar Cuadra» en Ajustes).
- **iPhone:** ábrela en **Safari** → Compartir → **Añadir a pantalla de inicio**.
- **Ordenador (Chrome o Edge):** icono de instalar en la barra de direcciones, o úsala como web.

Sin conexión puedes seguir apuntando: los cambios esperan en el dispositivo y se envían en cuanto vuelve internet (al lado del saludo verás «X sin enviar»).

## Tu presupuesto

- **El sueldo no es fijo.** Cada mes, al abrir la app, te pregunta con qué sueldo empiezas (con tus sueldos anteriores como sugerencia). Lo puedes cambiar cuando quieras con el botón «Sueldo».
- Las partidas se editan desde la pestaña **Presupuesto** y se guardan en tu cuenta de Supabase.
- `presupuesto-inicial.js` es solo un **ejemplo** con cifras inventadas para cuentas nuevas. Tu presupuesto real nunca va en el repositorio: para el modo local, guárdalo en `presupuesto-personal.js`, que git ignora.

## Cómo se usa

- **Inicio**: lo que te queda este mes y la **previsión a fin de mes** (lo que te sobraría si lo que falta lo gastas tal como está presupuestado). Accesos rápidos para apuntar un gasto o un ingreso, cambiar el sueldo o ir al simulador. Debajo, los recibos del mes, tus objetivos de ahorro y lo último que has apuntado. La campana avisa si te pasas en alguna partida o si quedan recibos pendientes.
- **Apuntar** (botón Gasto): teclado numérico, partidas frecuentes arriba, «Cambiar» para elegir cualquier partida y «desliza para apuntar». También sirve para ingresos extra y para apartar dinero a un objetivo. En el ordenador puedes escribir el importe con el teclado y pulsar Intro. «Devolución» apunta un importe negativo. Si te equivocas, el aviso de abajo tiene «Deshacer».
- **Recibos del mes**: la lista de cargos fijos (hipoteca, luz, móvil, gimnasio…). Toca «Cargado» cuando te lo cobren y se apunta con su importe. Abajo están también los recibos periódicos (comunidad, agua, IBI…).
- **Historial**: todos los movimientos por días, con búsqueda en todos los meses y filtros. Toca uno para corregirlo o borrarlo.
- **Análisis**: por semana, mes o año. Gasto total comparado con el periodo anterior, % del presupuesto, gasto diario, gasto por categorías, cómo va cada partida (con una rayita que marca dónde deberías ir hoy) y, en el año, el resumen mes a mes.
- **Presupuesto**: el reparto de tu sueldo (recibos, gasto variable, periódicos y margen) y todas las partidas. Toca una para cambiar el importe, la frecuencia, el icono o si es un recibo. Archivar oculta una partida sin borrar sus gastos.
- **Simulador**: escenarios de «¿y si…?». Parte de tu presupuesto o empieza de cero, pon otro sueldo, desmarca o cambia gastos, marca qué pagos periódicos caerían ese mes enteros y añade gastos puntuales (un viaje, una reparación…). Ves al momento cuánto te sobraría o faltaría y qué cambia frente a tu mes real. Si te convence, «Aplicar a mi presupuesto».
- **Ajustes** (tu avatar en Inicio): tu nombre, el estado de la sincronización, exportar a CSV para Excel, descargar una copia completa e importar un CSV.

## Para tocar el código

Necesitas Node 20.19 o superior.

```powershell
npm install
```

```powershell
npm run dev
```

Abre <http://localhost:5173>: es la app con tus datos de Supabase (entras con tu cuenta). Los cambios se ven al momento. Para publicarlos, súbelos a `main` y GitHub Actions hace el resto.

### Modo local (sin Supabase, con el servidor Node)

Si algún día quieres los datos solo en tu ordenador, sin nube:

```powershell
npm run app
```

Compila la app en modo local y arranca el servidor Node en <http://localhost:3001>. Los datos van a `datos/cuadra.json` (con una copia diaria en `datos/copias/`). `npm run red` lo abre a tu wifi de casa (sin contraseña) y `npm run dev:local` es el modo de desarrollo.

## Carpetas

| Carpeta / archivo | Qué es |
|---|---|
| `src/` | La app en React: pantallas en `src/pantallas`, cálculos en `src/lib/calculos.js`, estilos en `src/estilos.css` |
| `src/motores/` | Dónde se guardan los datos: `supabase.js` (nube, con cola sin conexión) o `servidor.js` (Node local) |
| `src/config.js` | La dirección y la clave pública de Supabase |
| `shared/` | Las reglas de los datos (validación, operaciones, CSV), compartidas por la app y el servidor |
| `server/` | El servidor Node/Express del modo local |
| `supabase/esquema.sql` | Las tablas de Supabase |
| `presupuesto-inicial.js` | Presupuesto de ejemplo para cuentas nuevas (tu presupuesto real va en `presupuesto-personal.js`, que no se sube) |
| `public/` | Iconos, manifest y service worker (lo que la hace instalable y sin conexión) |
| `.github/workflows/publicar.yml` | La publicación automática en GitHub Pages |
