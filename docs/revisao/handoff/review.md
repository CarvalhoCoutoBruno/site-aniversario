# Review — Fatia 6

**Veredito: aprovado, com uma inclusão — a trava do reset entra agora.** Plano forte; os dois
achados são reais.

## O `status` gated no `confere` — confirmo
Certíssimo, e é o mesmo princípio do selo da Fatia 5. Se o rateio não confere (órfão),
`Σ deve = totalRateado` mas `Σ pagou = custoRealTotal`; os dois diferem, `Σ saldo ≠ 0` e as
transferências não quitam nada. Checar só "todo item tem pagador" produziria um acerto
silenciosamente errado. `completo = confere E todo item com custo>0 tem pagador` — as duas
condições. Aprovado.

## `custosPorItem` no retorno do `rateio` — aprovado
Aditivo, mantém as 41 asserções, e faz o `acerto` receber só (rateio + `pago_por`) — zero chance
de os dois lados divergirem sobre quanto custou o chopp. É a forma certa de "não recomputar".

## A trava do reset — **entra agora, nesta fatia**
É o achado que mais importa. Decisão: **estender a trava já.** Porquê:
- Esta fatia recria o schema (4 colunas novas), e a `config` **não** sobrevive ao reset (só a
  `admins` sobrevive). A trava atual olha **só `rsvps`** — uma base com `rsvps` vazio mas `config`
  preenchida passa batido e perde preços/prazo/custo real **em silêncio**.
- Hoje é seguro (config nas sementes), então estender a trava **não bloqueia o recreate desta
  fatia** — e a partir de agora protege dado real. É a **janela certa**: o momento em que a config
  passa a valer dado, e a fatia já mexe no bloco de reset.
- Sugiro guardar nos campos que nascem vazios/NULL/0 e só ficam preenchidos por ação do
  organizador: `custo_real_*`, `pago_por_*`, `prazo_confirmacao` e os preços — abortar se qualquer
  um estiver setado, com mensagem no mesmo tom da trava de `rsvps` ("config tem dados reais; limpe
  antes se o descarte for intencional").

## Detalhe que gostei
O `CHECK (x is null or x between 1 and 3)` simples está certo aqui — e você reparou sozinho por
que **não** precisa do `CASE` da `aniversariante_id_coerente` (lá a expressão podia dar `NULL`;
aqui `x is null or ...` nunca dá). Testar 4 e 0 mesmo assim é o rigor certo.

## Verify
Cobre tudo, e o **#4 (órfão → acerto não aparece mesmo com pagadores marcados)** é a prova do
catch do `confere`. Só falta somar o teste da **trava estendida** (config preenchida → reset
aborta), já que ela entra nesta fatia.

Pode `executa`.
