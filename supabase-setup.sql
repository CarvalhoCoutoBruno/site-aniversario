-- =============================================================
--  BANCO DE DADOS — rode isto UMA VEZ no Supabase
--  (Supabase > SQL Editor > New query > cole tudo > Run)
-- =============================================================

-- Tabela de confirmações -------------------------------------
create table if not exists public.rsvps (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  responsavel    text not null,             -- quem está confirmando
  contato        text,                       -- whatsapp/telefone (opcional)
  aniversariantes text[] not null default '{}', -- quais aniversariantes convidaram
  pessoas        jsonb not null default '[]', -- lista de pessoas + preferências
  mensagem       text,                       -- recado opcional
  total_pessoas  int  not null default 1
);

-- Índice para ordenar por data
create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);

-- Segurança (Row Level Security) -----------------------------
alter table public.rsvps enable row level security;

-- Qualquer visitante pode CONFIRMAR (inserir)
drop policy if exists "qualquer um pode confirmar" on public.rsvps;
create policy "qualquer um pode confirmar"
  on public.rsvps for insert
  to anon, authenticated
  with check (true);

-- Só o admin logado pode LER as confirmações
drop policy if exists "so admin le" on public.rsvps;
create policy "so admin le"
  on public.rsvps for select
  to authenticated
  using (true);

-- Só o admin logado pode APAGAR
drop policy if exists "so admin apaga" on public.rsvps;
create policy "so admin apaga"
  on public.rsvps for delete
  to authenticated
  using (true);

-- =============================================================
--  STORAGE DE FOTOS
-- =============================================================
-- Cria o bucket público "fotos"
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Todo mundo pode VER as fotos (bucket público)
drop policy if exists "fotos leitura publica" on storage.objects;
create policy "fotos leitura publica"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'fotos');

-- Só o admin logado pode SUBIR fotos
drop policy if exists "admin sobe fotos" on storage.objects;
create policy "admin sobe fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos');

-- Só o admin logado pode APAGAR fotos
drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos');
