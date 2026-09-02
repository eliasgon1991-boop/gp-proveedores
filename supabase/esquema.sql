-- ═══ GP Proveedores · esquema de cuentas y perfiles ═══
-- Ejecutar en Supabase → SQL Editor (una sola vez por proyecto).
-- Crea la tabla de perfiles públicos de pymes, ligada 1:1 a auth.users.

create table if not exists public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre_pyme  text,
  rut          text,
  palabras     text[] not null default '{}',   -- rubros del perfil ("aseo", "ferretería", …)
  region       text,
  racha_dias   integer not null default 0,
  racha_ultima date,                            -- último día (America/Santiago) con ronda completa
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Perfil PÚBLICO: cualquiera puede leerlo (base de la red social).
-- El RUT es dato comercial sensible: si más adelante se quiere ocultar,
-- moverlo a una tabla privada en vez de cambiar esta política.
drop policy if exists "perfiles_lectura_publica" on public.perfiles;
create policy "perfiles_lectura_publica"
  on public.perfiles for select
  using (true);

-- Solo el dueño crea y edita su propio perfil.
drop policy if exists "perfiles_crear_propio" on public.perfiles;
create policy "perfiles_crear_propio"
  on public.perfiles for insert
  with check (auth.uid() = id);

drop policy if exists "perfiles_editar_propio" on public.perfiles;
create policy "perfiles_editar_propio"
  on public.perfiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Mantener "actualizado" al día en cada cambio.
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists perfiles_tocar_actualizado on public.perfiles;
create trigger perfiles_tocar_actualizado
  before update on public.perfiles
  for each row execute function public.tocar_actualizado();

-- ═══ Acciones por usuario: me gusta, carro y postuladas (02-09-2026) ═══
-- "datos" guarda la tarjeta serializada para poder re-render el carro
-- aunque la oportunidad ya no venga en el feed del día.

create table if not exists public.acciones_pyme (
  user_id    uuid not null references auth.users (id) on delete cascade,
  proceso_id text not null,
  tipo       text not null check (tipo in ('like', 'carro', 'postulada')),
  datos      jsonb,
  creado     timestamptz not null default now(),
  primary key (user_id, proceso_id, tipo)
);

alter table public.acciones_pyme enable row level security;

-- Las filas crudas son privadas: cada pyme ve y maneja solo lo suyo.
drop policy if exists "acciones_leer_propias" on public.acciones_pyme;
create policy "acciones_leer_propias"
  on public.acciones_pyme for select
  using (auth.uid() = user_id);

drop policy if exists "acciones_crear_propias" on public.acciones_pyme;
create policy "acciones_crear_propias"
  on public.acciones_pyme for insert
  with check (auth.uid() = user_id);

drop policy if exists "acciones_borrar_propias" on public.acciones_pyme;
create policy "acciones_borrar_propias"
  on public.acciones_pyme for delete
  using (auth.uid() = user_id);

-- Lo público son solo los AGREGADOS: cuántas pymes marcaron like/carro
-- por proceso, sin revelar quiénes. (Vista security definer a propósito.)
create or replace view public.conteos_publicos as
  select proceso_id, tipo, count(*)::int as total
  from public.acciones_pyme
  where tipo in ('like', 'carro')
  group by proceso_id, tipo;

grant select on public.conteos_publicos to anon, authenticated;

-- ═══ Seguimientos: organismos que cada pyme sigue (02-09-2026) ═══
-- Al cargar el reparto, la app avisa cuántas oportunidades vienen de
-- organismos seguidos y las destaca en la tarjeta.

create table if not exists public.seguimientos (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo    text not null default 'organismo' check (tipo in ('organismo', 'rubro')),
  valor   text not null,
  creado  timestamptz not null default now(),
  primary key (user_id, tipo, valor)
);

alter table public.seguimientos enable row level security;

drop policy if exists "seguimientos_leer_propios" on public.seguimientos;
create policy "seguimientos_leer_propios"
  on public.seguimientos for select
  using (auth.uid() = user_id);

drop policy if exists "seguimientos_crear_propios" on public.seguimientos;
create policy "seguimientos_crear_propios"
  on public.seguimientos for insert
  with check (auth.uid() = user_id);

drop policy if exists "seguimientos_borrar_propios" on public.seguimientos;
create policy "seguimientos_borrar_propios"
  on public.seguimientos for delete
  using (auth.uid() = user_id);
