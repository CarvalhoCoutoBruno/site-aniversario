-- =============================================================
--  SITE ANIVERSÁRIO — schema completo
--  Rode no Supabase (SQL Editor > New query > cole tudo > Run)
--
--  Este arquivo é a FONTE DA VERDADE do schema. Não existem migrations
--  de errata: quando o modelo muda, corrige-se aqui e recria-se do zero.
--  O bloco de RESET abaixo se recusa a rodar se já houver confirmação
--  salva, para não apagar dado real por engano.
--
--  ⚠️ DEPOIS DE RODAR (uma vez só, no painel):
--   Authentication > Sign In / Providers > Email
--   > desligue "Allow new users to sign up"
--
--  Detalhes e justificativas: docs/ESPECIFICACAO-TECNICA.md
-- =============================================================

create extension if not exists pgcrypto;

-- =============================================================
--  RESET — recria o schema do zero.
--  Trava de segurança: aborta se a tabela rsvps já tiver dados.
--  Se o descarte for mesmo intencional, apague as linhas antes.
-- =============================================================
do $$
declare
  v_cfg    jsonb;
  v_reason text;
begin
  -- (1) confirmações
  if to_regclass('public.rsvps') is not null then
    if (select count(*) from public.rsvps) > 0 then
      raise exception
        'ABORTADO: public.rsvps tem % confirmacao(oes). Recriar o schema apagaria dado real. Apague manualmente antes se for intencional.',
        (select count(*) from public.rsvps);
    end if;
  end if;

  -- (2) config com dado real do organizador.
  -- A `admins` sobrevive ao reset; a `config` NÃO — e ela guarda preços,
  -- prazo, custo real e quem pagou. Sem esta trava, uma base com rsvps
  -- vazio mas config preenchida perderia tudo isso em silêncio.
  --
  -- Leitura via to_jsonb + EXECUTE de propósito: colunas novas (paid_by_*)
  -- podem ainda não existir na primeira execução, e referenciá-las direto
  -- quebraria o script no parse.
  if to_regclass('public.settings') is not null then
    execute 'select to_jsonb(c) from public.settings c where id = 1' into v_cfg;
    if v_cfg is not null then
      if  (v_cfg->>'actual_beer_cost')        is not null
       or (v_cfg->>'actual_soda_cost')        is not null
       or (v_cfg->>'actual_water_cost')         is not null
       or (v_cfg->>'actual_adult_pizza_price') is not null
       or (v_cfg->>'actual_child_pizza_price')is not null then
        v_reason := 'custo real de fechamento lancado';
      elsif (v_cfg->>'beer_paid_by') is not null
         or (v_cfg->>'soda_paid_by') is not null
         or (v_cfg->>'water_paid_by')  is not null
         or (v_cfg->>'pizza_paid_by') is not null then
        v_reason := 'pagadores do acerto marcados';
      elsif (v_cfg->>'rsvp_deadline') is not null then
        v_reason := 'prazo de confirmacao definido';
      elsif coalesce((v_cfg->>'beer_price_per_liter')::numeric, 0)   > 0
         or coalesce((v_cfg->>'soda_price_per_liter')::numeric, 0)   > 0
         or coalesce((v_cfg->>'water_price_per_liter')::numeric, 0)    > 0
         or coalesce((v_cfg->>'adult_pizza_price')::numeric, 0)  > 0
         or coalesce((v_cfg->>'child_pizza_price')::numeric, 0) > 0 then
        v_reason := 'precos de referencia preenchidos';
      end if;

      if v_reason is not null then
        raise exception
          'ABORTADO: public.settings tem dado real (%). Recriar o schema apagaria preco, prazo e fechamento. Limpe a settings manualmente antes se o descarte for intencional.',
          v_reason;
      end if;
    end if;
  end if;

  -- (3) convite editado pelo organizador.
  -- Aqui "tem linha" NÃO serve de sinal: a party é semeada por este
  -- próprio script, então existiria desde o primeiro Run e a trava
  -- dispararia para sempre. O sinal é updated_at: NULL no seed,
  -- preenchido quando alguém salva pelo painel.
  if to_regclass('public.party') is not null then
    execute 'select to_jsonb(f) from public.party f where id = 1' into v_cfg;
    if v_cfg is not null and (v_cfg->>'updated_at') is not null then
      raise exception
        'ABORTADO: public.party foi editada pelo painel (titulo, data, local ou nomes). Recriar o schema voltaria o convite para os valores do seed.';
    end if;
  end if;
end $$;

drop function if exists public.create_rsvp(text, text, smallint[], text, jsonb);
drop function if exists public.rsvp_status();
drop table if exists public.people;
drop table if exists public.rsvps;
drop table if exists public.settings;
drop table if exists public.party;
-- admins e is_admin() sobrevivem ao reset: guardam os UIDs das contas
-- do painel, que não têm nada a ver com o modelo de dados da festa.

-- =============================================================
--  ADMINS — quem entra na área administrativa
--  Eixo independente de "aniversariante" e de "quem paga".
--  Adicionar admin = inserir uma linha (o sign-up público é desligado,
--  então a conta em si é criada à mão em Authentication > Users).
-- =============================================================
create table if not exists public.admins (
  uid       uuid primary key,
  name      text not null,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER para ler admins sem esbarrar na RLS da própria
-- tabela (evita recursão de policy). STABLE porque o resultado não
-- muda dentro da mesma query.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.uid = auth.uid())
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;

-- admin enxerga a lista; ninguém escreve pela API (só por SQL)
drop policy if exists "admin reads admins" on public.admins;
create policy "admin reads admins" on public.admins
  for select to authenticated
  using (public.is_admin());

-- Os quatro organizadores. Rosaura é admin e convidada, sem ser
-- aniversariante — admin, aniversariante e pagante são eixos
-- independentes, e é por isso que a autorização passa por esta tabela
-- em vez de um papel fixo.
insert into public.admins (uid, name) values
  ('406ce6c3-f700-4393-b587-1322f04d1564', 'Bruno'),
  ('e3d8d44b-d748-48d5-bd38-b0782ef6f38d', 'Braz'),
  ('f595acd0-8f69-4972-a613-5e49f4107b8f', 'Bocão'),
  ('92bec53c-d288-4ad9-be53-fe263ae94874', 'Rosaura')
on conflict (uid) do nothing;

-- Para liberar mais alguém: crie a conta em Authentication > Users
-- (com Auto Confirm), copie o UID e rode:
--   insert into public.admins (uid, nome) values ('<UID>', '<Nome>');

-- =============================================================
--  NORMALIZAÇÃO DE CONTATO (base do dedupe por reenvio)
--  E-mail  -> minúsculo, sem espaços
--  Telefone-> só os dígitos: "(51) 99999-9999" == "51999999999"
-- =============================================================
create or replace function public.normalize_contact(p text)
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
--  VALIDAÇÃO DE invited_by
--  Guarda IDs estáveis (1, 2, 3) apontando para as posições de
--  festa.aniversariantes no config.js — não o nome. É a CHAVE do
--  rateio: define qual aniversariante banca o consumo do grupo.
--  Regras: 1 a 3 itens, todos em {1,2,3}, sem repetição.
--  (função auxiliar porque CHECK não aceita subconsulta direto)
-- =============================================================
create or replace function public.valid_invited_by(a smallint[])
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
create table public.rsvps (
  id             uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  lead_name text not null check (length(btrim(lead_name)) between 1 and 120),
  contact        text not null check (length(btrim(contact)) between 3 and 160),
  contact_norm   text generated always as (public.normalize_contact(contact)) stored,
  invited_by  smallint[] not null check (public.valid_invited_by(invited_by)),
  notes    text check (notes is null or length(notes) <= 500)
);

create index rsvps_created_at_idx    on public.rsvps (created_at desc);
create index rsvps_contact_norm_idx on public.rsvps (contact_norm);

-- =============================================================
--  TABELA: pessoas — unidade de consumo
--  Principal, acompanhante e aniversariante são todos linhas aqui.
-- =============================================================
create table public.people (
  id                uuid primary key default gen_random_uuid(),
  rsvp_id           uuid references public.rsvps(id) on delete cascade,
  name              text,
  age_group              text not null check (age_group in ('adult', 'child')),
  wants_water         boolean not null default false,
  wants_soda        boolean not null default false,
  wants_beer        boolean not null default false,
  wants_pizza        boolean not null default false,
  role             text not null check (role in ('lead', 'companion', 'celebrant')),
  -- 1/2/3 só para aniversariante: é o elo entre invited_by e a
  -- linha pagante. Mesmos valores que invited_by usa.
  celebrant_id smallint,
  sort_order             smallint not null default 0,
  created_at         timestamptz not null default now(),

  -- regra dura: criança não bebe chopp
  constraint no_beer_for_children
    check (not (wants_beer and age_group = 'child')),

  -- aniversariante vive fora de grupo; todo o resto pertence a um grupo.
  -- Efeito: o formulário público (que sempre manda rsvp_id) não consegue
  -- forjar um aniversariante.
  constraint celebrant_has_no_group
    check (
      (role =  'celebrant' and rsvp_id is null) or
      (role <> 'celebrant' and rsvp_id is not null)
    ),

  -- celebrant_id existe se e somente se papel = 'aniversariante'.
  -- CASE (e não OR de dois ramos) porque CHECK só rejeita em FALSE:
  -- com id NULL, "papel = 'aniversariante' and id between 1 and 3"
  -- avalia para NULL, e a linha passaria batido.
  constraint celebrant_id_consistent
    check (
      case when role = 'celebrant'
           then celebrant_id is not null and celebrant_id between 1 and 3
           else celebrant_id is null
      end
    ),

  -- nome é obrigatório só para quem preencheu o formulário
  constraint lead_has_name
    check (role <> 'lead' or length(btrim(coalesce(name, ''))) > 0)
);

create index people_rsvp_idx on public.people (rsvp_id);

-- no máximo um principal por grupo
create unique index people_one_lead_per_group
  on public.people (rsvp_id) where role = 'lead';

-- cada aniversariante cadastrado uma única vez
create unique index people_celebrant_id_unique
  on public.people (celebrant_id) where role = 'celebrant';

-- =============================================================
--  TABELA: festa — os dados do convite, editáveis pelo painel
--
--  É a ÚNICA tabela que o visitante anônimo lê direto. Por isso só
--  entra aqui o que já aparece impresso no convite: título, data,
--  local e os nomes. Preço, custo real e pagadores seguem na `config`,
--  que continua fechada.
--
--  A posição do aniversariante é o id (1/2/3) usado em invited_by e
--  em celebrant_id. Em colunas nomeadas, e não num array, a
--  posição fica explícita — não dá para reordenar sem perceber.
-- =============================================================
create table public.party (
  id            smallint primary key default 1 check (id = 1),
  title        text not null check (length(btrim(title)) between 1 and 120),
  subtitle     text check (subtitle is null or length(subtitle) <= 200),
  -- ISO com offset -03:00; base do countdown
  starts_at          timestamptz not null,
  -- vazio = gerado a partir de `data` na tela
  date_text    text check (date_text is null or length(date_text) <= 160),
  venue         text not null check (length(btrim(venue)) between 1 and 200),
  map_url    text check (map_url is null or map_url ~ '^https?://'),
  celebrant_1_name   text not null check (length(btrim(celebrant_1_name)) between 1 and 60),
  celebrant_2_name   text not null check (length(btrim(celebrant_2_name)) between 1 and 60),
  celebrant_3_name   text not null check (length(btrim(celebrant_3_name)) between 1 and 60),
  -- NULL até alguém salvar pelo painel; é o sinal da trava do reset
  updated_at timestamptz
);

insert into public.party (id, title, subtitle, starts_at, date_text, venue, map_url,
                          celebrant_1_name, celebrant_2_name, celebrant_3_name)
values (1,
  'Festa dos 160 anos',
  null,
  '2026-10-31T11:00:00-03:00',
  'Sábado, 31 de outubro de 2026, às 11h',
  'Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS',
  'https://www.google.com/maps/search/?api=1&query=Av.+Cel.+Marcos%2C+627+-+Pedra+Redonda%2C+Porto+Alegre+-+RS%2C+91760-000',
  'Bruno', 'Braz', 'JH Boca')
on conflict (id) do nothing;

-- =============================================================
--  TABELA: config — linha única, editável pelo painel
--  actual_* nasce NULL de propósito:
--  NULL = "ainda não fechei"; 0 = "não gastei nada".
-- =============================================================
create table public.settings (
  id smallint primary key default 1 check (id = 1),

  -- preços de referência (estimativa)
  beer_price_per_liter       numeric(10,2) not null default 0,
  soda_price_per_liter       numeric(10,2) not null default 0,
  water_price_per_liter        numeric(10,2) not null default 0,
  adult_pizza_price      numeric(10,2) not null default 0,
  child_pizza_price     numeric(10,2) not null default 0,

  -- taxas de consumo (sementes definidas na regra de negócio, editáveis na tela)
  beer_liters_per_adult numeric(6,3) not null default 2.0,
  soda_liters_per_person numeric(6,3) not null default 0.6,
  water_liters_per_person  numeric(6,3) not null default 0.5,

  -- prazo de confirmação: NULL = sem limite.
  -- O painel grava a data escolhida como fim do dia (23:59:59-03:00).
  rsvp_deadline       timestamptz,

  -- fechamento (preenchido depois da compra)
  actual_beer_cost        numeric(10,2),
  actual_soda_cost        numeric(10,2),
  actual_water_cost         numeric(10,2),
  actual_adult_pizza_price numeric(10,2),
  actual_child_pizza_price numeric(10,2),

  -- acerto: quem bancou cada item. NULL = ninguém marcado ainda.
  -- O valor do item não é digitado — vem do custo já calculado no
  -- fechamento; aqui só se registra o pagador.
  -- CHECK simples basta: "x is null or ..." nunca avalia para NULL, ao
  -- contrário do que aconteceu em celebrant_id_consistent.
  beer_paid_by  smallint check (beer_paid_by  is null or beer_paid_by  between 1 and 3),
  soda_paid_by  smallint check (soda_paid_by  is null or soda_paid_by  between 1 and 3),
  water_paid_by   smallint check (water_paid_by   is null or water_paid_by   between 1 and 3),
  pizza_paid_by  smallint check (pizza_paid_by  is null or pizza_paid_by  between 1 and 3),

  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- =============================================================
--  RPC: create_rsvp — insert atômico (grupo + pessoas numa transação)
--
--  SECURITY DEFINER: roda com o privilégio do dono, então a RLS das
--  tabelas não se aplica. Por isso NÃO existe política de insert para
--  anon — o único caminho de escrita do visitante é esta função, que
--  valida tudo antes. Mais restritivo que liberar insert direto.
-- =============================================================
create or replace function public.create_rsvp(
  p_lead_name text,
  p_contact        text,
  p_invited_by  smallint[],
  p_notes    text,
  p_people        jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id         uuid;
  v_count        int;
  v_leads int;
  v_deadline      timestamptz;
begin
  -- prazo de confirmação: o banco é a última linha de defesa.
  -- A tela também fecha (via rsvp_status), mas isso não é confiável sozinho.
  select rsvp_deadline into v_deadline from public.settings where id = 1;
  if v_deadline is not null and now() > v_deadline then
    raise exception 'As confirmações foram encerradas em %.',
      to_char(v_deadline at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  end if;

  if coalesce(btrim(p_lead_name), '') = '' then
    raise exception 'Informe o seu nome.';
  end if;

  if coalesce(btrim(p_contact), '') = '' then
    raise exception 'Informe um contato (WhatsApp ou e-mail).';
  end if;

  if not public.valid_invited_by(p_invited_by) then
    raise exception 'Escolha de 1 a 3 aniversariantes, sem repetir.';
  end if;

  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    raise exception 'Lista de pessoas inválida.';
  end if;

  -- 1 principal + teto de 5 acompanhantes
  v_count := jsonb_array_length(p_people);
  if v_count < 1 or v_count > 6 then
    raise exception 'O grupo precisa ter de 1 a 6 pessoas (você + até 5 acompanhantes).';
  end if;

  select count(*) into v_leads
  from jsonb_array_elements(p_people) e
  where e->>'role' = 'lead';

  if v_leads <> 1 then
    raise exception 'O grupo precisa ter exatamente um responsável.';
  end if;

  -- dedupe: reenvio com o mesmo contato substitui o anterior
  -- (pessoas somem junto pelo ON DELETE CASCADE)
  delete from public.rsvps
   where contact_norm = public.normalize_contact(p_contact);

  insert into public.rsvps (lead_name, contact, invited_by, notes)
  values (
    btrim(p_lead_name),
    btrim(p_contact),
    p_invited_by,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  -- celebrant_id fica NULL: a constraint celebrant_id_consistent
  -- garante que ninguém vindo do formulário público é pagante.
  insert into public.people
    (rsvp_id, name, age_group, wants_water, wants_soda, wants_beer, wants_pizza, role, sort_order)
  select
    v_id,
    nullif(btrim(coalesce(e->>'name', '')), ''),
    e->>'age_group',
    coalesce((e->>'wants_water')::boolean,  false),
    coalesce((e->>'wants_soda')::boolean, false),
    coalesce((e->>'wants_beer')::boolean, false),
    coalesce((e->>'wants_pizza')::boolean, false),
    e->>'role',
    (ord - 1)::smallint
  from jsonb_array_elements(p_people) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke all on function public.create_rsvp(text, text, smallint[], text, jsonb) from public;
grant execute on function public.create_rsvp(text, text, smallint[], text, jsonb) to anon, authenticated;

-- =============================================================
--  RPC: rsvp_status — o formulário público precisa saber se ainda
--  está aberto, mas o anon NÃO pode ler a tabela settings (lá tem preço).
--  Esta função devolve só o necessário: aberto? e qual o prazo.
-- =============================================================
create or replace function public.rsvp_status()
returns table (is_open boolean, deadline timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select (c.rsvp_deadline is null or now() <= c.rsvp_deadline),
         c.rsvp_deadline
    from public.settings c
   where c.id = 1
$$;

revoke all on function public.rsvp_status() from public;
grant execute on function public.rsvp_status() to anon, authenticated;

-- =============================================================
--  HIGIENE: o anon só deve executar create_rsvp e rsvp_status.
--  As auxiliares ganham EXECUTE para PUBLIC por default do Postgres.
--  Não são brecha (validadores puros, sem acesso a dado), mas nada as
--  chama a partir do anon: rodam na coluna gerada, no CHECK da tabela
--  e dentro do create_rsvp, sempre com o privilégio do dono.
-- =============================================================
revoke all on function public.normalize_contact(text) from public, anon, authenticated;
revoke all on function public.valid_invited_by(smallint[]) from public, anon, authenticated;

-- =============================================================
--  RLS — acesso administrativo via is_admin().
--  NUNCA use o papel genérico "authenticated" como autorização.
-- =============================================================
alter table public.party   enable row level security;
alter table public.rsvps   enable row level security;
alter table public.people enable row level security;
alter table public.settings  enable row level security;

-- ---- festa: leitura PÚBLICA (é o convite), escrita só admin ----
drop policy if exists "party public read" on public.party;
create policy "party public read" on public.party
  for select to anon, authenticated
  using (true);

drop policy if exists "admin edits party" on public.party;
create policy "admin edits party" on public.party
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- rsvps ----
drop policy if exists "admin reads rsvps" on public.rsvps;
create policy "admin reads rsvps" on public.rsvps
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin deletes rsvps" on public.rsvps;
create policy "admin deletes rsvps" on public.rsvps
  for delete to authenticated
  using (public.is_admin());

-- ---- pessoas ----
drop policy if exists "admin reads people" on public.people;
create policy "admin reads people" on public.people
  for select to authenticated
  using (public.is_admin());

-- insert direto serve para cadastrar os 3 aniversariantes pelo painel
drop policy if exists "admin creates people" on public.people;
create policy "admin creates people" on public.people
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admin edits people" on public.people;
create policy "admin edits people" on public.people
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin deletes people" on public.people;
create policy "admin deletes people" on public.people
  for delete to authenticated
  using (public.is_admin());

-- ---- config ----
drop policy if exists "admin reads settings" on public.settings;
create policy "admin reads settings" on public.settings
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admin edits settings" on public.settings;
create policy "admin edits settings" on public.settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================
--  STORAGE — bucket "fotos": leitura pública, escrita só admin
-- =============================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fotos');

drop policy if exists "admin uploads photos" on storage.objects;
create policy "admin uploads photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());

drop policy if exists "admin deletes photos" on storage.objects;
create policy "admin deletes photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
