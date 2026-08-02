-- =============================================================
--  SITE ANIVERSÁRIO — schema completo
--  Rode UMA VEZ no Supabase (SQL Editor > New query > cole tudo > Run)
--
--  UID do organizador já preenchido: 406ce6c3-f700-4393-b587-1322f04d1564
--  (usuário criado em Authentication > Users, com Auto Confirm).
--
--  ⚠️ DEPOIS DE RODAR:
--   Authentication > Sign In / Providers > Email
--   > desligue "Allow new users to sign up"
--
--  Se um dia o usuário admin for recriado, o UID muda: troque as 12
--  ocorrências nas policies abaixo, senão o painel fica inacessível.
--  Detalhes e justificativas: docs/ESPECIFICACAO-TECNICA.md
-- =============================================================

create extension if not exists pgcrypto;

-- =============================================================
--  NORMALIZAÇÃO DE CONTATO (base do dedupe por reenvio)
--  E-mail  -> minúsculo, sem espaços
--  Telefone-> só os dígitos: "(11) 99999-9999" == "11999999999"
-- =============================================================
create or replace function public.normaliza_contato(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when position('@' in p) > 0 then lower(btrim(p))
    when regexp_replace(p, '\D', '', 'g') <> '' then regexp_replace(p, '\D', '', 'g')
    else lower(btrim(p))
  end
$$;

-- =============================================================
--  VALIDAÇÃO DE convidado_por
--  Guardamos IDs estáveis (1, 2, 3) que apontam para as posições de
--  festa.aniversariantes no config.js — não o nome. Assim dá para
--  renomear um aniversariante sem quebrar registro nem estatística.
--  Regras: 1 a 3 itens, todos em {1,2,3}, sem repetição.
--  (função auxiliar porque CHECK não aceita subconsulta direto)
-- =============================================================
create or replace function public.convidado_por_valido(a smallint[])
returns boolean
language sql
immutable
as $$
  select a is not null
     and cardinality(a) between 1 and 3
     and a <@ array[1, 2, 3]::smallint[]
     and cardinality(a) = (select count(distinct x) from unnest(a) as x)
$$;

-- =============================================================
--  TABELA: rsvps — o grupo (uma linha por envio do formulário)
--  Aniversariantes NÃO geram linha aqui.
-- =============================================================
create table if not exists public.rsvps (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  nome_principal text not null check (length(btrim(nome_principal)) between 1 and 120),
  contato        text not null check (length(btrim(contato)) between 3 and 160),
  contato_norm   text generated always as (public.normaliza_contato(contato)) stored,
  convidado_por  smallint[] not null check (public.convidado_por_valido(convidado_por)),
  observacoes    text check (observacoes is null or length(observacoes) <= 500)
);

create index if not exists rsvps_criado_em_idx    on public.rsvps (criado_em desc);
create index if not exists rsvps_contato_norm_idx on public.rsvps (contato_norm);

-- =============================================================
--  TABELA: pessoas — unidade de consumo
--  Principal, acompanhante e aniversariante são todos linhas aqui.
-- =============================================================
create table if not exists public.pessoas (
  id         uuid primary key default gen_random_uuid(),
  rsvp_id    uuid references public.rsvps(id) on delete cascade,
  nome       text,
  tipo       text not null check (tipo in ('adulto', 'crianca')),
  bebe_agua  boolean not null default false,
  bebe_refri boolean not null default false,
  bebe_chopp boolean not null default false,
  come_pizza boolean not null default false,
  papel      text not null check (papel in ('principal', 'acompanhante', 'aniversariante')),
  ordem      smallint not null default 0,
  criado_em  timestamptz not null default now(),

  -- regra dura: criança não bebe chopp
  constraint chopp_nao_para_crianca
    check (not (bebe_chopp and tipo = 'crianca')),

  -- aniversariante vive fora de grupo; todo o resto pertence a um grupo.
  -- Efeito: o formulário público (que sempre manda rsvp_id) não consegue
  -- forjar um aniversariante.
  constraint aniversariante_sem_grupo
    check (
      (papel =  'aniversariante' and rsvp_id is null) or
      (papel <> 'aniversariante' and rsvp_id is not null)
    ),

  -- nome é obrigatório só para quem preencheu o formulário
  constraint principal_tem_nome
    check (papel <> 'principal' or length(btrim(coalesce(nome, ''))) > 0)
);

create index if not exists pessoas_rsvp_idx on public.pessoas (rsvp_id);

-- no máximo um principal por grupo
create unique index if not exists pessoas_um_principal_por_grupo
  on public.pessoas (rsvp_id) where papel = 'principal';

-- =============================================================
--  TABELA: config — linha única, editável pelo painel
--  custo_real_* nasce NULL de propósito:
--  NULL = "ainda não fechei"; 0 = "não gastei nada".
-- =============================================================
create table if not exists public.config (
  id smallint primary key default 1 check (id = 1),

  -- preços de referência (estimativa)
  preco_litro_chopp       numeric(10,2) not null default 0,
  preco_litro_refri       numeric(10,2) not null default 0,
  preco_litro_agua        numeric(10,2) not null default 0,
  preco_pizza_adulto      numeric(10,2) not null default 0,
  preco_pizza_crianca     numeric(10,2) not null default 0,

  -- taxas de consumo (sementes definidas na regra de negócio, editáveis na tela)
  litros_chopp_por_adulto numeric(6,3) not null default 2.0,
  litros_refri_por_pessoa numeric(6,3) not null default 0.6,
  litros_agua_por_pessoa  numeric(6,3) not null default 0.5,

  -- prazo de confirmação: NULL = sem limite.
  -- O painel grava a data escolhida como fim do dia (23:59:59-03:00).
  prazo_confirmacao       timestamptz,

  -- fechamento (preenchido depois da compra)
  custo_real_chopp        numeric(10,2),
  custo_real_refri        numeric(10,2),
  custo_real_agua         numeric(10,2),
  preco_real_pizza_adulto numeric(10,2),
  preco_real_pizza_crianca numeric(10,2),

  atualizado_em timestamptz not null default now()
);

insert into public.config (id) values (1) on conflict (id) do nothing;

-- =============================================================
--  RPC: criar_rsvp — insert atômico (grupo + pessoas numa transação)
--
--  SECURITY DEFINER: roda com o privilégio do dono, então a RLS das
--  tabelas não se aplica. Por isso NÃO existe política de insert para
--  anon — o único caminho de escrita do visitante é esta função, que
--  valida tudo antes. Mais restritivo que liberar insert direto.
-- =============================================================
create or replace function public.criar_rsvp(
  p_nome_principal text,
  p_contato        text,
  p_convidado_por  smallint[],
  p_observacoes    text,
  p_pessoas        jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id         uuid;
  v_qtd        int;
  v_principais int;
  v_prazo      timestamptz;
begin
  -- prazo de confirmação: o banco é a última linha de defesa.
  -- A tela também fecha (via status_rsvp), mas isso não é confiável sozinho.
  select prazo_confirmacao into v_prazo from public.config where id = 1;
  if v_prazo is not null and now() > v_prazo then
    raise exception 'As confirmações foram encerradas em %.',
      to_char(v_prazo at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  end if;

  if coalesce(btrim(p_nome_principal), '') = '' then
    raise exception 'Informe o seu nome.';
  end if;

  if coalesce(btrim(p_contato), '') = '' then
    raise exception 'Informe um contato (WhatsApp ou e-mail).';
  end if;

  if not public.convidado_por_valido(p_convidado_por) then
    raise exception 'Escolha de 1 a 3 aniversariantes, sem repetir.';
  end if;

  if p_pessoas is null or jsonb_typeof(p_pessoas) <> 'array' then
    raise exception 'Lista de pessoas inválida.';
  end if;

  -- 1 principal + teto de 5 acompanhantes
  v_qtd := jsonb_array_length(p_pessoas);
  if v_qtd < 1 or v_qtd > 6 then
    raise exception 'O grupo precisa ter de 1 a 6 pessoas (você + até 5 acompanhantes).';
  end if;

  select count(*) into v_principais
  from jsonb_array_elements(p_pessoas) e
  where e->>'papel' = 'principal';

  if v_principais <> 1 then
    raise exception 'O grupo precisa ter exatamente um responsável.';
  end if;

  -- dedupe: reenvio com o mesmo contato substitui o anterior
  -- (pessoas somem junto pelo ON DELETE CASCADE)
  delete from public.rsvps
   where contato_norm = public.normaliza_contato(p_contato);

  insert into public.rsvps (nome_principal, contato, convidado_por, observacoes)
  values (
    btrim(p_nome_principal),
    btrim(p_contato),
    p_convidado_por,
    nullif(btrim(coalesce(p_observacoes, '')), '')
  )
  returning id into v_id;

  insert into public.pessoas
    (rsvp_id, nome, tipo, bebe_agua, bebe_refri, bebe_chopp, come_pizza, papel, ordem)
  select
    v_id,
    nullif(btrim(coalesce(e->>'nome', '')), ''),
    e->>'tipo',
    coalesce((e->>'bebe_agua')::boolean,  false),
    coalesce((e->>'bebe_refri')::boolean, false),
    coalesce((e->>'bebe_chopp')::boolean, false),
    coalesce((e->>'come_pizza')::boolean, false),
    e->>'papel',
    (ord - 1)::smallint
  from jsonb_array_elements(p_pessoas) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke all on function public.criar_rsvp(text, text, smallint[], text, jsonb) from public;
grant execute on function public.criar_rsvp(text, text, smallint[], text, jsonb) to anon, authenticated;

-- =============================================================
--  RPC: status_rsvp — o formulário público precisa saber se ainda
--  está aberto, mas o anon NÃO pode ler a tabela config (lá tem preço).
--  Esta função devolve só o necessário: aberto? e qual o prazo.
-- =============================================================
create or replace function public.status_rsvp()
returns table (aberto boolean, prazo timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select (c.prazo_confirmacao is null or now() <= c.prazo_confirmacao),
         c.prazo_confirmacao
    from public.config c
   where c.id = 1
$$;

revoke all on function public.status_rsvp() from public;
grant execute on function public.status_rsvp() to anon, authenticated;

-- =============================================================
--  HIGIENE: o anon só deve executar criar_rsvp e status_rsvp.
--  As duas funções auxiliares ganham EXECUTE para PUBLIC por default
--  do Postgres. Não são brecha (são validadores puros, sem acesso a
--  dado), mas nada as chama a partir do anon:
--   - normaliza_contato roda na coluna gerada, com o privilégio do dono
--   - convidado_por_valido roda no CHECK da tabela
--   - ambas são chamadas por criar_rsvp, que é security definer
-- =============================================================
revoke all on function public.normaliza_contato(text) from public, anon, authenticated;
revoke all on function public.convidado_por_valido(smallint[]) from public, anon, authenticated;

-- =============================================================
--  RLS — leitura/escrita administrativa amarrada ao UID do organizador.
--  NUNCA use o papel genérico "authenticated" aqui.
-- =============================================================
alter table public.rsvps   enable row level security;
alter table public.pessoas enable row level security;
alter table public.config  enable row level security;

-- ---- rsvps ----
drop policy if exists "admin le rsvps" on public.rsvps;
create policy "admin le rsvps" on public.rsvps
  for select to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

drop policy if exists "admin apaga rsvps" on public.rsvps;
create policy "admin apaga rsvps" on public.rsvps
  for delete to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

-- ---- pessoas ----
drop policy if exists "admin le pessoas" on public.pessoas;
create policy "admin le pessoas" on public.pessoas
  for select to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

-- insert direto serve para cadastrar os 3 aniversariantes pelo painel
drop policy if exists "admin cadastra pessoas" on public.pessoas;
create policy "admin cadastra pessoas" on public.pessoas
  for insert to authenticated
  with check (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

drop policy if exists "admin edita pessoas" on public.pessoas;
create policy "admin edita pessoas" on public.pessoas
  for update to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid)
  with check (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

drop policy if exists "admin apaga pessoas" on public.pessoas;
create policy "admin apaga pessoas" on public.pessoas
  for delete to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

-- ---- config ----
drop policy if exists "admin le config" on public.config;
create policy "admin le config" on public.config
  for select to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

drop policy if exists "admin edita config" on public.config;
create policy "admin edita config" on public.config
  for update to authenticated
  using (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid)
  with check (auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

-- =============================================================
--  STORAGE — bucket "fotos": leitura pública, escrita só admin
-- =============================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos leitura publica" on storage.objects;
create policy "fotos leitura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fotos');

drop policy if exists "admin sobe fotos" on storage.objects;
create policy "admin sobe fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);

drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and auth.uid() = '406ce6c3-f700-4393-b587-1322f04d1564'::uuid);
