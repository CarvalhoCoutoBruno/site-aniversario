# Plano — Fatia 10: polimento visual do convite

Branch: `chore/fatia-10-polimento-visual`

## O que medi

| Item | Causa concreta |
|---|---|
| Data duplicada | `main.js:74` e `main.js:76` escrevem **a mesma** `dataTexto` em `#festaData` e `#cardData` |
| Carrossel grande | `.carrossel { max-width: 900px; aspect-ratio: 16/10 }` → **562px** de altura fixa, sem teto |
| Ar sobrando | `.secao { padding: 3.5rem }` com dois `.card-info` baixos num grid de 2 colunas |
| Confete no texto | as posições são **percentuais** (`22% 30%`, `74% 8%`, `14% 62%`); num viewport estreito o "meio" é onde o texto está |
| `_to_delete` | 4 arquivos, **não rastreados** pelo git — `rm -rf` basta, sem `git rm` |

## Item 1 — proponho um terceiro caminho

O prompt oferece duas saídas: tirar o pill do hero, ou dar informação nova ao card.

**Tirar o pill** custa caro: o convite é aberto no celular, e a data sairia de cima da dobra. O
countdown diz "88 dias", que não é a mesma informação — ninguém anota "88 dias" na agenda.

**Dar informação nova ao card** é inventar texto para justificar um duplicado que não precisa
existir.

**Proponho:** manter o pill no hero e **tirar o card de data**, refocando a seção no **lugar** —
endereço em destaque e o botão do mapa. Fica assim:

- **hero** responde *o quê* e *quando* (título, equação, data, countdown);
- **seção** responde *onde* (endereço + como chegar).

Cada bloco com um trabalho só, nenhuma frase repetida, e a data segue acima da dobra.

Isso também **resolve o item 3 de graça**: em vez de dois cards baixos com vazio entre eles, um
bloco centrado com conteúdo de verdade. O kicker vira "O lugar" e o título "Onde vai ser".

> Se o review preferir manter as duas colunas, digo como — mas aí volta a questão do que colocar
> na segunda sem encher linguiça.

## Itens 2, 3 e 4

**Carrossel:** manter o `aspect-ratio` (ele governa o mobile, que está bom) e somar
`max-height: 420px` no desktop, com o `object-fit: cover` que já existe. O `max-width` de 900px
some em favor do teto de altura, senão a proporção volta a mandar.

**Ritmo:** o problema não é padding a mais, é conteúdo de menos — resolvido no item 1. Ajusto o
padding das seções para respirar com o bloco novo, sem tocar no mobile (que está bom).

**Confete:** duas mudanças. Abaixo de 560px, reduzo a densidade (algumas partículas saem) e
**empurro as restantes para as bordas** — trocando percentuais do miolo por posições coladas nas
laterais. Enfeite não disputa com texto.

## Verify

`./verify.sh` verde — nada de lógica muda.

**Antes e depois:** capturo os screenshots do estado atual **antes** de mexer, para a comparação
ser real e não de memória. Desktop (≥1360px) e mobile (390px).

**Não-regressão**, com saída crua:
1. RSVP real ponta a ponta (grava e apago);
2. countdown nos 3 estados;
3. falha de carga com **um estado só visível** — a asserção que já quebrou duas vezes;
4. carrossel com foto e vazio;
5. "confirmações encerradas".

**Modo escuro:** o fix da Fatia 9 (remapear as variáveis globais dentro de `.pagina-convite`) não
pode regredir. Comparo claro e escuro.

**Admin intacto:** `admin.html` sem a classe e sem as fontes do convite.

## Para o review

1. **O terceiro caminho do item 1** — pill no hero, seção só sobre o lugar. Aceita?
2. **Teto de 420px** no carrossel: chute informado a partir do que vi nos screenshots. Se quiser
   outro número, é uma linha.

Parado, sem implementar, aguardando `review.md`.
