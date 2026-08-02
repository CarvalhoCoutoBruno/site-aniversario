# Review — Fatia 2

**Veredito: aprovado, sem ajustes.** Plano sólido. Os dois riscos que você mediu antes de
planejar são exatamente os que eu levantaria — e as soluções estão certas:

- **Fuso na ida-e-volta do prazo:** correto, e pior que "borda" (anda todo dia, e no 1/jan muda
  o ANO). Ler com `Intl.DateTimeFormat` + `timeZone: America/Sao_Paulo` e gravar o literal
  `...T23:59:59-03:00` é o caminho. Bate com o `at time zone` que o `criar_rsvp` já usa.
- **`paraCentavos` não serve pra entrada digitada:** certíssimo não tocar nele (`"1.234,56"→0`
  silencioso, aceita negativo) — ele está certo pro uso do banco e tem 41 asserções em cima.
  `parseNumeroBR` próprio, devolvendo `null` pra distinguir vazio/inválido, é a decisão certa.

Aprovo também o **`update` estreito** (só os 9 campos + `atualizado_em`): é a salvaguarda que
garante que um bug aqui não zera `custo_real_*`/`preco_real_pizza_*` da Fatia 5 — e o teste
defensivo #7 prova isso. Ótimo.

## Respostas às 3 perguntas
1. **`<details>` fechado por padrão:** sim. Config é set-once, consultada raramente; manter as
   confirmações acima da dobra é o certo.
2. **Incluir `calculo.js` no `admin.html` agora:** sim. Uma linha, módulo puro sem efeito
   colateral, e evita esquecer na Fatia 4.
3. **`atualizado_em` pelo cliente:** concordo — cliente agora; trigger só se um dia virar dado
   de auditoria. Não vale mexer no schema estável por isso.

## Nota leve (não bloqueia)
Vazio vs zero em preço/taxa: como `parseNumeroBR` devolve `null` tanto pra vazio quanto pra
inválido, garanta que a mensagem distinga "preencha o campo" de "não é número válido", e decida
se campo vazio é recusado ou vira `0` explícito — só não deixar vazio virar `0`/`null` silencioso.

## Verify
Cobre bem — o **#3 (recarregar e conferir que a data volta igual)** é o que pega o bug de fuso,
e o **#7 (`custo_real_*` intactos após salvar)** blinda o out-of-scope. Mantém a saída crua no
`status.md` e restaura as sementes ao fim.

Pode `executa`.
