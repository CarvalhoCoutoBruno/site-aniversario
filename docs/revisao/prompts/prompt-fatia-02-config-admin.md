# Fatia 2 — Config de preços e taxas na área admin

## Objetivo
Tela na área administrativa para ver e editar a linha única de `config`: preços de
referência, taxas de consumo estimado e o prazo de confirmação. É a base que alimenta a
estimativa (Fatia 4) e dá ao organizador controle sem depender de `git push` nem do SQL editor.

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §2.3 (campos de `config`), §3/§4 (prazo, taxas).
- `supabase-setup.sql` — tabela `config`, RLS (`is_admin()` no select/update), tipos
  (`numeric(10,2)` dinheiro, `numeric(6,3)` litros).
- `js/calculo.js` — como taxas/preços são consumidos (paridade de parsing pt-BR).

## Escopo (o que entra)
1. **Tela de config atrás do login** (reusa o login admin já existente). Só admin lê/grava —
   a RLS já garante no banco; a UI fica atrás do login.
2. **Campos editáveis:**
   - Preços de referência: `preco_litro_chopp`, `preco_litro_refri`, `preco_litro_agua`,
     `preco_pizza_adulto`, `preco_pizza_crianca`.
   - Taxas de consumo: `litros_chopp_por_adulto`, `litros_refri_por_pessoa`,
     `litros_agua_por_pessoa` (sementes 2,0 / 0,6 / 0,5).
   - **Prazo de confirmação:** input de **data**; salvar como **fim do dia -03:00**
     (`AAAA-MM-DDT23:59:59-03:00`); vazio = `NULL` (sem limite). Ao carregar, pré-preencher a
     data convertendo o `prazo_confirmacao` de volta para -03:00.
3. **Carregar:** ler a linha `config` (id=1) e popular o form.
4. **Salvar:** `update` na `config` (id=1), setando `atualizado_em = now()`. Feedback de
   sucesso/erro legível.
5. **Parsing pt-BR:** aceitar vírgula decimal ("18,00") e converter para número antes de gravar.
   Dinheiro com 2 casas, taxas com até 3 — coerente com o `calculo.js`.
6. **Validação no cliente:** não-negativos e números válidos, com mensagem amigável (o banco é
   o backstop pelos tipos `numeric`). Não deixar erro cru de constraint vazar pra tela.

## Fora de escopo (não tocar)
- **Fechamento** (`custo_real_*`, `preco_real_pizza_*`) — é a Fatia 5; **não** editar aqui.
- Estimativa (Fatia 4), cadastro de aniversariantes (Fatia 3), listagem de confirmações (já existe).

## Verify (portão desta fatia)
- `./verify.sh` verde (sem regressão; cálculo não muda).
- **Integrada, com saída crua no `status.md`:**
  - logar como admin, carregar a config → mostra as sementes (2,0/0,6/0,5) e os preços;
  - editar um preço + uma taxa + definir um prazo → salvar → reler por `SELECT` (cru) provando
    os novos valores e o `prazo_confirmacao` gravado como `23:59:59-03:00` da data escolhida;
  - **ponta a ponta:** com o prazo definido, o formulário público passa a mostrar "Confirme
    até DD/MM" (e, se data passada, fecha) — provar que a config dirige o form;
  - limpar o prazo (vazio) → `NULL` → form sem prazo;
  - **negativo:** anon ou deslogado **não** lê nem grava `config` (RLS) — saída crua;
  - restaurar a config para as sementes ao fim.

## Observações
- Prazo: cuidado com fuso — gravar sempre fim do dia -03:00 e pré-preencher convertendo de
  volta pra -03:00, senão a data "anda" um dia.
- `atualizado_em` deve refletir a edição (setar no update).
