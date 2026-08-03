# Review — Fatia 7

**Veredito: aprovado, sem ajustes.** Bom plano pra fechar, e o catch do countdown é o certo.

## O countdown — o catch é exatamente o que importa
A armadilha não é o `Math.max(0, diff)`, é a "correção óbvia": `diff <= 0 → passou` **quebraria
durante a festa** (das 11h às 23h59 de 31/10 o diff já é negativo, mas é dia de festa → tem que
dizer "É hoje!", não "acabou"). Derivar o estado da **comparação de datas em São Paulo** (não do
sinal do diff), validado em 3 fusos, é a solução — mesma disciplina do prazo. A duplicação
consciente do cálculo de fuso (~8 linhas; `calculo.js` puro não conhece fuso de apresentação) é
aceitável, pelo mesmo motivo do chopp.

## `resumoAcerto` no `calculo.js` — sim, mantém
Não vejo violação de pureza: o `calculo.js` **já tem** o `formatarBRL`, que também é formatação.
"Puro" aqui é *sem DOM, sem rede* — e o `resumoAcerto` respeita (dados → string). Ganhar teste
vale mais que a separação estrita. E o caso especial (**completo sem transferências** = cada um
pagou a própria parte → texto próprio, não lista vazia) é um bom detalhe.

## Robustez que gostei
- `navigator.clipboard` pode ser negada → cair num `<textarea>` selecionado em vez de erro sem saída.
- **Conferir as docs antes de escrever** (grep do Netlify, versão do REGRAS, seções reais) — é o
  princípio do fluxo aplicado, "nada de número inventado".

## Nota leve (não bloqueia)
O resumo compartilhado poderia **abrir com um título** ("Acerto da festa dos 160 anos 🎉") antes
das linhas de transferência — assim a mensagem no WhatsApp se explica sozinha, em vez de chegar
como linhas soltas. Detalhe de UX, opcional.

## Verify
Cobre o que importa: os **três estados do countdown** (com o dia-da-festa-depois-da-hora →
"É hoje!", que é o que o ingênuo erra), o resumo batendo com as transferências, e o `grep`
provando as docs corrigidas.

Pode `executa`. É a última — depois dela o backlog zera.
