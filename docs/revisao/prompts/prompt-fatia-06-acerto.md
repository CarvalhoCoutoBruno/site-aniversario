# Fatia 6 — Acerto: quem deve a quem

## Objetivo
Fechar o ciclo do dinheiro: além de "quanto cada aniversariante DEVE" (o rateio, pronto),
registrar "quanto cada um PAGOU" aos fornecedores e calcular o **acerto** entre os três — quem
transfere quanto pra quem. Feature nova (tem lógica de negócio), não polimento.

## Modelo (as duas grandezas)
- **DEVE** (`deve_k`): a conta do aniversariante `k` no rateio (`Calculo.rateio` já dá).
- **PAGOU** (`pagou_k`): a soma dos **itens que `k` bancou**. Cada item (chopp, refri, água,
  pizza) tem **um pagador** (um aniversariante), e o valor do item é o **custo já calculado no
  fechamento** — o organizador **não digita valor**, só marca quem pagou.
  - chopp = `custo_real_chopp`; refri = `custo_real_refri`; água = `custo_real_agua`;
    pizza = o **total de pizza derivado** (Σ `precoPizza` por quem come — o mesmo que o rateio usa).
- **SALDO** (`saldo_k = deve_k − pagou_k`): positivo = `k` tem a **pagar** ao bolo; negativo =
  tem a **receber**.
- **ACERTO:** como `Σ deve = Σ pagou = custoRealTotal`, então `Σ saldo = 0` e o acerto sempre
  fecha. Gerar as **transferências mínimas** entre os 3 (no máximo 2): casar quem deve com quem
  tem a receber. Tudo em **centavos inteiros** (`saldo = deve − pagou`, ambos já em centavos).

## Fontes da verdade
- `docs/REGRAS-NEGOCIO.md` (v5) — §4.2/§4.3 (o rateio, base do `deve`). *(O acerto entra no doc
  como v6; este prompt já traz o modelo completo.)*
- `js/calculo.js` — `rateio()` (totais por aniversariante e `custoRealTotal`) e `precoPizza`.
- `supabase-setup.sql` — `config` (onde entram os `pago_por_*`) e a RLS.

## Escopo (o que entra)
1. **Schema:** 4 campos em `config` — `pago_por_chopp`, `pago_por_refri`, `pago_por_agua`,
   `pago_por_pizza` — `smallint`, **NULL** por padrão (ninguém marcado), com `CHECK` de que cada
   um é `NULL` ou está em `{1,2,3}` (mesmo domínio do `aniversariante_id`).
2. **`calculo.js` — função pura `acerto(...)`** (ao lado do `rateio`, mesmo padrão): recebe o
   necessário (rateio + os `pago_por_*` + os custos por item) e devolve:
   - `saldos`: por aniversariante, `{ deve, pagou, saldo }` (centavos);
   - `transferencias`: lista `{ de, para, valor }` (mínimas, ≤ 2);
   - `status`: `completo` (rateio `confere` **e** todo item com custo>0 tem pagador) ou
     `incompleto` (falta custo ou falta pagador — dizer o quê).
   Reaproveitar os totais por item do `rateio` (não recomputar de forma divergente).
3. **`calculo.test.js`:** testes próprios do `acerto` — o exemplo do ×6,5 (Bruno deve 650, paga
   o chopp de 700 → saldo −50 → Braz transfere 50 pro Bruno) e a asserção forte em cenários
   aleatórios: **`Σ saldo === 0`** e **as transferências zeram os saldos** ao centavo. (O
   `verify.sh` deve passar a mostrar mais que 41 asserções.)
4. **UI (admin):** na área de fechamento, um bloco **Acerto**:
   - por item (chopp/refri/água/pizza), um seletor **"pago por"** (os 3 aniversariantes + "—"),
     com o valor do item ao lado (vindo do custo real);
   - o quadro **"quem deve a quem"**: por aniversariante o `deve`/`pagou`/`saldo`, e a lista de
     transferências ("Braz → Bruno: R$ 50,00");
   - status: fechamento incompleto → "feche o custo real primeiro"; falta pagador em algum item →
     "indique quem pagou: chopp"; completo → mostra o acerto.
5. **Salvar (update estreito):** os 4 `pago_por_*` + `atualizado_em`. **Nunca** tocar em
   `custo_real_*` (Fatia 5) nem nos campos da Fatia 2.

## Fora de escopo (não tocar)
Preços/taxas/prazo (Fatia 2), `custo_real_*` (Fatia 5 — o `pago_por` é aditivo, não mexe neles),
formulário público, e o polimento mecânico (countdown, README, HANDOFF) — que é a Fatia 7. Extras
fora do modelo (gorjeta, frete) ficam de fora: pagamento = custo calculado.

## Verify (portão desta fatia)
- `./verify.sh` verde, **com as novas asserções do `acerto`** (Σ saldo = 0; transferências zeram
  os saldos; o ×6,5).
- **Integrada, com saída crua no `status.md`:**
  - base do ×6,5 (Bruno deve 650, Braz 50, Bocão 0) → marcar **Bruno pagou o chopp (700)** →
    saldos: Bruno −50 (a receber), Braz +50 (a pagar), Bocão 0 → transferência **Braz → Bruno
    R$ 50,00**, conferida na mão; `Σ saldo = 0`;
  - **reconciliação:** as transferências zeram exatamente os saldos;
  - **falta pagador:** um item com custo e `pago_por` NULL → status "indique quem pagou X", sem
    acerto falso;
  - **fechamento incompleto** (menos de 3 custos) → acerto adia, não inventa;
  - **update estreito:** `custo_real_*` (Fatia 5) e os campos da Fatia 2 **intactos** após salvar
    os `pago_por` — provar por `SELECT`;
  - **negativo (RLS):** anon não lê nem grava `config` — provar pelo **estado do banco** (o 204);
  - restaurar a base ao fim.

## Observações
- Tudo em centavos; o acerto herda a exatidão do rateio (Σ fecha).
- O "bucket" da pizza usa o **total derivado** (mesma conta do rateio), não um campo de custo próprio.
- Marcar pagador num item de custo 0 é inócuo (soma 0) — não precisa barrar.
