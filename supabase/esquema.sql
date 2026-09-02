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

-- ═══ Actividad pública de la red (prueba social, 02-09-2026) ═══
-- Muestra el pulso de la red SIN revelar qué pyme miró qué proceso: la
-- identidad solo aparece en adjudicaciones (celebración pública). El resto
-- va anonimizado por rubro ("una pyme de aseo guardó…").

create or replace view public.actividad_publica as
  select
    a.tipo,
    a.proceso_id,
    a.creado,
    case when a.tipo = 'postulada' and (a.datos->>'resultado') = 'adjudicada'
         then p.nombre_pyme end as nombre_pyme,
    coalesce(p.palabras[1], 'mercado público') as rubro,
    a.datos->>'titulo' as titulo,
    a.datos->>'resultado' as resultado
  from public.acciones_pyme a
  join public.perfiles p on p.id = a.user_id
  order by a.creado desc
  limit 40;

grant select on public.actividad_publica to anon, authenticated;

-- ═══ Catálogo oficial de rubros MP + rubros por perfil (02-09-2026) ═══
-- catalogo_mp guarda el árbol rubro→categoría→subcategoría extraído del
-- portal proveedor (respaldo del JSON src/data/rubros-mp.json de la app).

create table if not exists public.catalogo_mp (
  id smallint primary key,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.catalogo_mp enable row level security;
create policy "catalogo_leer" on public.catalogo_mp for select using (true);
create policy "catalogo_escribir" on public.catalogo_mp for insert with check (auth.role() = 'authenticated');
create policy "catalogo_actualizar" on public.catalogo_mp for update using (auth.role() = 'authenticated');

alter table public.perfiles add column if not exists rubros_mp jsonb not null default '[]'::jsonb;

-- ═══ Comentarios por oportunidad (02-09-2026) ═══
-- Conversación pública de la red sobre cada proceso: preguntas, datos y
-- alertas entre pymes. La identidad visible es el nombre público de la pyme.

create table if not exists public.comentarios (
  id         bigint generated always as identity primary key,
  proceso_id text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  texto      text not null check (char_length(texto) between 2 and 600),
  creado     timestamptz not null default now()
);
create index if not exists comentarios_proceso on public.comentarios (proceso_id, creado desc);

alter table public.comentarios enable row level security;

drop policy if exists "comentarios_leer" on public.comentarios;
create policy "comentarios_leer" on public.comentarios for select using (true);

drop policy if exists "comentarios_crear" on public.comentarios;
create policy "comentarios_crear" on public.comentarios for insert
  with check (auth.uid() = user_id);

drop policy if exists "comentarios_borrar_propios" on public.comentarios;
create policy "comentarios_borrar_propios" on public.comentarios for delete
  using (auth.uid() = user_id);

-- Vista con autor resuelto (nombre de pyme y rubro) para pintar la conversación.
create or replace view public.comentarios_publicos as
  select c.id, c.proceso_id, c.texto, c.creado, c.user_id,
         coalesce(p.nombre_pyme, 'Una pyme de ' || coalesce(p.palabras[1], 'la red')) as autor
  from public.comentarios c
  join public.perfiles p on p.id = c.user_id
  order by c.creado asc;

grant select on public.comentarios_publicos to anon, authenticated;
