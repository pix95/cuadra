-- Cuadra 2.0 · base de datos en Supabase
--
-- Pégalo entero en Supabase → SQL Editor → New query y pulsa Run.
-- Se puede ejecutar más de una vez sin problema:
--   · si vienes de la versión anterior, añade lo que falta y conserva tus datos;
--   · si es un proyecto nuevo, lo crea todo.
-- La versión anterior de la app sigue funcionando después de ejecutarlo.

-- ---------- Partidas del presupuesto ----------
create table if not exists public.partidas (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  categoria text not null default 'Otros',
  importe numeric(12, 2) not null default 0,
  frecuencia text not null default 'Mensual',
  orden integer not null default 0,
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.partidas enable row level security;
alter table public.partidas add column if not exists recibo boolean not null default false;
alter table public.partidas add column if not exists icono text not null default 'paquete';

-- ---------- Objetivos de ahorro ----------
create table if not exists public.objetivos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  meta numeric(12, 2) not null default 0,
  fecha text,                       -- mes objetivo, "2027-03"
  icono text not null default 'hucha',
  creado timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.objetivos enable row level security;

-- ---------- Movimientos (gastos, ingresos y ahorro) ----------
create table if not exists public.movimientos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null,
  importe numeric(12, 2) not null,
  partida_id uuid,
  concepto text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.movimientos enable row level security;
alter table public.movimientos add column if not exists tipo text not null default 'gasto';
alter table public.movimientos add column if not exists objetivo_id uuid;
alter table public.movimientos add column if not exists creado timestamptz not null default now();
-- Los ingresos y el ahorro no llevan partida
alter table public.movimientos alter column partida_id drop not null;
create index if not exists movimientos_usuario_fecha on public.movimientos (user_id, fecha);

-- ---------- Sueldo de cada mes ----------
create table if not exists public.meses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mes text not null,                -- "2026-11"
  sueldo numeric(12, 2) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, mes)
);
alter table public.meses enable row level security;

-- ---------- Escenarios del simulador ----------
create table if not exists public.simulaciones (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default 'Escenario',
  datos jsonb not null default '{}'::jsonb,   -- sueldo, partidas, gastos puntuales…
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.simulaciones enable row level security;

-- ---------- Ajustes ----------
create table if not exists public.ajustes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sueldo numeric(12, 2),            -- último sueldo usado (sugerencia para el mes siguiente)
  updated_at timestamptz not null default now()
);
alter table public.ajustes enable row level security;
alter table public.ajustes add column if not exists nombre text not null default '';

-- ---------- Seguridad: cada persona solo ve y cambia lo suyo ----------
do $$
declare
  t text;
begin
  foreach t in array array['partidas', 'objetivos', 'movimientos', 'meses', 'simulaciones', 'ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    -- Solo se crea la regla si la tabla no tenía ninguna (la versión anterior ya trae las suyas)
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format(
        'create policy "solo_lo_mio" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
        t
      );
    end if;
  end loop;
end
$$;

-- Que la API vea las columnas y tablas nuevas al momento
notify pgrst, 'reload schema';
