# Plano — Fatia 6: acerto (quem deve a quem)

Branch: `feat/fatia-6-acerto`

## O que validei antes de planejar

### O algoritmo fecha, e é mínimo

Prototipei o acerto e rodei contra o caso do ×6,5 e contra cenários aleatórios:

```
caso do x6,5 — Bruno pagou o chopp de 700,00:
  aniv 1: deve=65000 pagou=70000 saldo=-5000
  aniv 2: deve=5000  pagou=0     saldo=5000
  aniv 3: deve=0     pagou=0     saldo=0
  soma dos saldos = 0
  transferencias: [{"de":2,"para":1,"valor":5000}]

20.000 cenarios aleatorios:
  falhas = 0
  maximo de transferencias = 2 (esperado <= 2)
```

Guloso — casar o maior devedor com o maior credor — é **ótimo para 3 pessoas**: com soma zero,
três saldos não-nulos exigem no mínimo 2 transferências, e o guloso dá exatamente 2.

### O `rateio` não expõe o que o acerto precisa

Os custos por item (`custos.chopp/refri/agua` e `totalPizza`) são **variáveis internas** do
`rateio`. O prompt pede para reaproveitá-los "não recomputar de forma divergente" — então vou
**adicionar `custosPorItem` ao retorno do `rateio`**. Mudança aditiva; as 41 asserções continuam
valendo e serão re-rodadas.

Consequência boa: o `acerto` recebe o **resultado do rateio** e os `pago_por_*`, e mais nada.
Menos parâmetros, zero chance de os dois lados divergirem sobre quanto custou o chopp.

### O `status` precisa olhar o `confere`, não só os pagadores

Achado que não estava explícito no prompt: se o rateio **não confere** (caso órfão — custo
lançado para item que ninguém consome), então `Σ deve = totalRateado` mas `Σ pagou =
custoRealTotal`, e os dois diferem. Resultado: `Σ saldo ≠ 0` e **as transferências não zeram os
saldos**.

Se eu checasse só "todo item tem pagador", esse caso produziria um acerto silenciosamente
errado — alguém transferiria um valor que não quita nada.

Então: **`completo` = `rateio.confere` E nenhum item com custo > 0 sem pagador.** As duas
condições, pelo mesmo motivo que o selo verde da Fatia 5 exige duas.

## O ponto que quero levantar: o custo do reset está subindo

Esta fatia adiciona 4 colunas em `config`. Pela política do projeto (sem migrations de errata),
isso significa **recriar o schema** rodando o `supabase-setup.sql`, que dá `drop table` em
`config`, `pessoas` e `rsvps`.

Hoje isso é gratuito: a base está zerada e a `config` está nas sementes. **É provavelmente a
última vez que é gratuito.** Duas coisas mudaram desde que a política foi escrita:

1. A `config` agora guarda **dados reais do organizador** — preços, prazo, custo real gasto.
   A `admins` sobrevive ao reset de propósito; a `config` não.
2. A trava do reset olha **só `rsvps`**. Uma base com `rsvps` vazio mas `config` preenchida
   passa pela trava e perde os preços e o fechamento em silêncio.

Não vou resolver isso por conta própria — é decisão de arquitetura. Mas registro que, depois do
lançamento, o `supabase-setup.sql` vira uma arma apontada para os dados. **Sugestão:** estender a
trava para abortar também se `config` tiver `custo_real_*` ou preços preenchidos. São ~6 linhas
no bloco de reset. Se o review achar que cabe aqui, incluo; se preferir na 7, tudo bem.

## Implementação

### Schema (`supabase-setup.sql`)
4 colunas em `config`: `pago_por_chopp`, `pago_por_refri`, `pago_por_agua`, `pago_por_pizza` —
`smallint`, NULL por padrão, com `CHECK (x is null or x between 1 and 3)`.

> Uso `CHECK` simples aqui, não o padrão `CASE` que precisei em `aniversariante_id_coerente`. Lá
> o `CASE` era necessário porque a expressão podia avaliar para `NULL` e o `CHECK` só rejeita em
> `FALSE`. Aqui `x is null or ...` nunca devolve `NULL`, então está seguro. Vou testar mesmo
> assim, incluindo o valor 4 e o 0.

### `js/calculo.js`
- `rateio` passa a devolver `custosPorItem: { chopp, refri, agua, pizza }` (centavos).
- `acerto(resultadoRateio, pagoPor)` → `{ saldos, transferencias, status, faltaPagador }`.
  - `saldos`: `[{ aniversarianteId, nome, deve, pagou, saldo }]`
  - `transferencias`: `[{ de, para, valor }]`, ≤ 2
  - `status`: `"completo"` | `"incompleto"`, com `motivo` legível

### `tests/calculo.test.js`
Seção nova: o ×6,5 do acerto (Braz → Bruno R$ 50,00), `Σ saldo = 0` e **as transferências zeram
os saldos** em milhares de cenários aleatórios, o caso órfão barrando o status, item sem pagador,
e o teto de 2 transferências. Mutação para confirmar que os testes têm dente.

### `admin.html` / `js/admin.js`
Bloco **Acerto** dentro da seção de fechamento: um `<select>` "pago por" por item, com o valor do
item ao lado (vindo do `custosPorItem`, não digitado); o quadro deve/pagou/saldo por
aniversariante; e as transferências em frase ("Braz → Bruno: R$ 50,00").

Estados: fechamento incompleto → "feche o custo real primeiro"; falta pagador → "indique quem
pagou: chopp"; completo → mostra o acerto.

Salvar: **update estreito** dos 4 `pago_por_*` + `atualizado_em`.

## Fora de escopo
Preços/taxas/prazo (Fatia 2), `custo_real_*` (Fatia 5 — o `pago_por` é aditivo), formulário
público, e o polimento mecânico (countdown, README, HANDOFF), que fica para a Fatia 7.

## Verify

`./verify.sh` verde **com as asserções novas** (a contagem sobe de 41).

Integrada, com saída crua no `status.md`:

1. base do ×6,5 → marcar **Bruno pagou o chopp** → saldos −50 / +50 / 0 → **Braz → Bruno
   R$ 50,00**, conferido na mão, `Σ saldo = 0`;
2. **reconciliação:** aplicar as transferências e provar que os saldos zeram;
3. **falta pagador:** item com custo e `pago_por` NULL → status incompleto nomeando o item, sem
   acerto falso;
4. **caso órfão:** rateio não confere → acerto **não** aparece, mesmo com todos os pagadores
   marcados (é o achado acima);
5. **fechamento incompleto** → acerto adia;
6. **`CHECK` do domínio:** `pago_por = 4` e `= 0` rejeitados no banco; `NULL` aceito;
7. **update estreito:** `custo_real_*` e os campos da Fatia 2 intactos após salvar — por `SELECT`;
8. **negativo (RLS):** anon não lê nem grava — pelo estado do banco;
9. restaurar a base ao fim.

## Para o review

1. **A trava do reset** (seção acima): estendo agora para proteger a `config`, ou fica na 7?
2. Confirmar o **`status` gated no `confere`** — é mais restritivo que o prompt pedia, e faz o
   acerto sumir em casos onde o prompt só falava de pagador faltando.

Parado, sem implementar, aguardando `review.md`.
