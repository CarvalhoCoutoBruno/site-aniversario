# Fatia 3 — Cadastro dos aniversariantes no admin

## Objetivo
Tela na área admin para registrar os 3 aniversariantes como **consumidores** — as linhas
`pessoas` com `papel='aniversariante'`, `rsvp_id=NULL` e `aniversariante_id` 1/2/3. É o que dá
ao rateio o consumo próprio de cada um (pagam 100% do que consomem) e o que a estimativa
precisa. Pré-requisito da Fatia 4 (estimativa) e da 5 (fechamento).

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §2.2 (`aniversariante_id`), §4 (aniversariante paga o próprio consumo).
- `supabase-setup.sql` — `pessoas` (constraints `aniversariante_sem_grupo`,
  `aniversariante_id_coerente`, `chopp_nao_para_crianca`; índice único por `aniversariante_id`)
  e as policies `admin cadastra/edita/le/apaga pessoas` via `is_admin()`.
- `js/config.js` — os 3 nomes e a ordem (Bruno=1, Braz=2, Bocão=3).

## Escopo (o que entra)
1. **Seção nova no admin** (atrás do login), com os **3 aniversariantes fixos** do `config.js`
   (nomes vêm de lá, ids 1/2/3 — não são digitados).
2. **Por aniversariante:** `tipo` (default **adulto**; campo mantido por consistência do modelo)
   + checkboxes água, refri, chopp, pizza.
3. **Chopp × criança:** mesma regra do formulário (desmarca/desabilita chopp se criança); o
   banco é o backstop (`chopp_nao_para_crianca`).
4. **Carregar:** ler as linhas `pessoas` com `papel='aniversariante'`, casar por
   `aniversariante_id` com os 3 nomes, popular. Quem ainda não tem linha aparece vazio.
5. **Salvar (upsert por `aniversariante_id`):** linha existe → `update`; não existe → `insert`
   com `rsvp_id=NULL`, `papel='aniversariante'`, `aniversariante_id=k`, `nome` = nome do
   `config.js`, `tipo`, bebidas, pizza. **Nunca** setar `rsvp_id` (a constraint barra) nem
   `convidado_por` (aniversariante não tem).
6. **Feedback** de sucesso/erro legível; só admin (RLS backstop).

## Fora de escopo (não tocar)
Estimativa (Fatia 4), fechamento/`custo_real_*` (Fatia 5), formulário público, config (Fatia 2,
pronta), listagem de confirmações (já existe).

## Verify (portão desta fatia)
- `./verify.sh` verde (cálculo não muda).
- **Integrada, com saída crua no `status.md`:**
  - logar como admin → tela mostra Bruno/Braz/Bocão (ids 1/2/3);
  - definir consumo dos 3 (ex.: Bruno adulto chopp+pizza; Braz adulto refri; Bocão adulto água)
    → salvar → `SELECT` cru provando 3 linhas com `papel='aniversariante'`, `rsvp_id=NULL`,
    `aniversariante_id` 1/2/3, `nome` batendo com o `config.js`, bebidas/pizza corretas;
  - **recarregar** → valores persistem;
  - marcar um como criança → chopp desabilita na tela (regra espelhada);
  - **upsert:** salvar de novo com valores diferentes → não cria linha duplicada (mesmo
    `aniversariante_id`), faz `update`;
  - **negativo (RLS):** anon não lê nem grava `pessoas` de aniversariante — provar pelo
    **estado do banco**, não pelo código HTTP (lembrar do 204 da Fatia 2);
  - restaurar a base ao fim (remover as linhas de aniversariante de teste; `pessoas=0`).

## Observações
- `nome` vem do `config.js` (não é campo editável) — mantém a fonte única da identidade (a
  ordem no `config.js` é o id; renomear lá reflete aqui no próximo save).
- Aniversariante não entra na lista de confirmações (não tem `rsvp_id`); é gerido só nesta tela.
