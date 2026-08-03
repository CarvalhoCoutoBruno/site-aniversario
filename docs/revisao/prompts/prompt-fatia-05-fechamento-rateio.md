# Fatia 5 — Fechamento e rateio no admin

## Objetivo
Tela no admin pra lançar o **custo real** do que foi comprado e ver o **rateio**: as 3 contas
(uma por aniversariante), o total e o selo `confere`. É o "fechamento" — o segundo momento do
modelo (o primeiro é a estimativa). O cálculo já existe e é testado (`Calculo.rateio`); faltam a
tela e o load dos grupos.

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §4.2/§4.3 (quem paga são os aniversariantes; alocação por
  `convidado_por`; centavos + maior-resto; divisão-por-zero → selo vermelho).
- `js/calculo.js` — `rateio(pessoas, config, grupos)` → `porAniversariante` (detalhe por item),
  `totalRateado`, `custoRealTotal`, `fechamentoCompleto`, `confere`. E `precoPizza` (usa o real
  quando preenchido, senão o de referência).
- `supabase-setup.sql` — `config`: campos `custo_real_*` e `preco_real_pizza_*` (nascem NULL) e a RLS.

## Escopo (o que entra)
1. **Load dos grupos:** `carregarRSVPs` já busca os `rsvps` (com `convidado_por`); guardar em
   `ultimosGrupos` além de `ultimasPessoas` — o rateio precisa dos grupos (é o elo convidado→pagante).
2. **Seção nova no admin** (`<details>`, ordem ET §7.2: depois da estimativa), com:
   - Inputs de **custo real**: `custo_real_chopp`, `custo_real_refri`, `custo_real_agua`
     (dinheiro digitado, pt-BR).
   - Inputs de **preço real da pizza**: `preco_real_pizza_adulto`, `preco_real_pizza_crianca`
     (opcionais; vazio = usa o de referência, como o `precoPizza` já faz).
   - Botão salvar + toast.
3. **Salvar (update estreito):** só os **5 campos de fechamento** + `atualizado_em`. **Nunca**
   tocar em preços de referência, taxas ou prazo (são da Fatia 2). Vazio = `NULL` ("ainda não
   fechei") — ao contrário da Fatia 2, aqui vazio é válido e significa não-fechado.
4. **Rateio (só leitura, computado):** chamar `Calculo.rateio(pessoas, config, grupos)` e exibir:
   - As **3 contas** por aniversariante (nome + total; e o detalhe por item — chopp/refri/água/pizza).
   - `custoRealTotal` e `totalRateado`.
   - O **selo `confere`**: verde só com os 3 `custo_real_*` preenchidos **e** a soma batendo;
     senão cinza ("fechamento incompleto") ou vermelho (soma ≠ total — o caso órfão/divisão por zero).
5. **Recalcular** ao salvar e no "↻ Atualizar".

## Fora de escopo (não tocar)
Estimativa (Fatia 4), config de preços/taxas/prazo (Fatia 2 — não editar esses campos aqui),
formulário público, e os itens de polimento da Fatia 6 (dedup já no schema, countdown no passado,
README/HANDOFF, exportar resumo do rateio).

## Verify (portão desta fatia)
- `./verify.sh` verde (o `calculo.js` não muda; 41/41).
- **Integrada, com saída crua no `status.md`:**
  - base conhecida (grupos com `convidado_por` — incluir um **compartilhado [1,2]** — + os 3
    aniversariantes) → lançar `custo_real_*` → rateio: as **3 contas conferidas na mão** (ex.: o
    padrão do ×6,5), o convidado compartilhado dividido **50/50**, e `Σ 3 contas === custoRealTotal`
    com o **selo verde**;
  - **pizza real vs referência:** preencher `preco_real_pizza_*` e provar que entra; deixar vazio
    e provar que cai no de referência;
  - **caso órfão:** lançar `custo_real` de um item que ninguém consome → selo **vermelho**
    (Σ ≠ total), sem quebrar;
  - **fechamento incompleto:** com menos de 3 `custo_real_*` → selo cinza, não verde;
  - **update estreito:** preços de referência / taxas / prazo (Fatia 2) **intactos** após salvar
    o fechamento — provar por `SELECT`;
  - **negativo (RLS):** anon não lê nem grava `config` — provar pelo **estado do banco** (não pelo HTTP);
  - restaurar a base ao fim.

## Observações
- Vazio = `NULL` aqui é intencional (não-fechado), ao contrário da Fatia 2 onde vazio era recusado.
- O rateio é leitura pura sobre a config salva: salvar o custo real primeiro, depois recomputar.
- Selo verde exige as **duas** coisas: 3 custos lançados **e** soma batendo — não só um.
