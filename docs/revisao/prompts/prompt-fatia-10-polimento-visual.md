# Fatia 10 — Polimento visual do convite

## Objetivo
Quatro ajustes de apresentação encontrados na revisão dos screenshots do convite redesenhado
(Fatia 9). Só CSS/markup — **nenhuma** mudança de lógica, dados ou schema. É o acabamento antes
do go-live.

## Contexto
O redesign ficou bom: a paleta preto+azul+vermelho funcionou, o título com o "160" em destaque
resolveu a redundância com a equação, e o modo escuro está correto. O que segue são defeitos de
ritmo e de detalhe, não de conceito.

## Escopo (os quatro itens, em ordem de impacto)

### 1. Data duplicada
A data aparece **duas vezes com a string idêntica**: no pill do hero (`#festaData`) e de novo no
card esquerdo da seção "Anota aí", ~400px abaixo. O card da esquerda existe só pra repetir.
Resolver de uma das duas formas (escolha sua, justifique no plano):
- tirar o pill do hero (o countdown logo abaixo já dá a urgência da data), **ou**
- manter o pill e dar ao card esquerdo informação nova (ex.: dia da semana + horário destacados
  de forma diferente, ou "chegue a partir das 11h").
Não pode sobrar a mesma frase duas vezes.

### 2. Carrossel grande demais no desktop
A foto sozinha ocupa perto de **um terço da altura da página** em 1360px. Limitar a altura do
slide (teto em px ou `aspect-ratio`) com `object-fit: cover` para não distorcer. Manter o
comportamento atual no mobile se já estiver bom.

### 3. Ar sobrando entre as seções (desktop)
A "Anota aí" tem dois cards baixos com muito vazio em volta — a seção parece inacabada. Ajustar o
ritmo vertical (padding das seções e/ou altura mínima dos cards) para o desktop respirar sem
parecer vazio. Não apertar o mobile, que está com bom espaçamento.

### 4. Confete colidindo com o texto no mobile
Em 390px, partículas caem **sobre o conteúdo** (uma bolinha vermelha encosta em "anos" no título,
outra sobre o card do Bruno). No desktop elas ficam nas margens. Reduzir a densidade e/ou
concentrar nas bordas abaixo de certa largura — o confete é enfeite, não pode disputar com o texto.

### 5. Higiene
Apagar a pasta `docs/revisao/design/_to_delete/` (arquivos temporários que o Cowork criou para
renderizar os screenshots; não fazem falta).

## Fora de escopo
`admin.html` (o restyle segue escopado em `.pagina-convite` — não deixar vazar), lógica, dados,
schema, e a produtização.

## Verify
- `./verify.sh` verde (nada de lógica muda).
- **Não-regressão:** os estados da Fatia 8/9 continuam coerentes — carregando, erro de carga
  (**um estado só**), countdown nos 3 estados, encerrado, carrossel vazio, e um RSVP real ponta a
  ponta (grava e apaga).
- **Visual (a evidência):** screenshots **antes e depois** de cada item, em desktop (≥1360px) e
  mobile (390px):
  - a data aparecendo uma vez só;
  - o carrossel com altura contida (com foto real no bucket);
  - o ritmo vertical da "Anota aí";
  - o hero mobile sem confete sobre o texto.
- **Modo escuro:** conferir que segue idêntico ao claro (o fix da Fatia 9 não pode regredir).
- **Admin intacto:** `admin.html` sem a classe `pagina-convite` e sem as fontes do convite.

## Observações
- É acabamento: se algum item exigir mexer em lógica pra resolver, pare e diga no plano em vez de
  ampliar o escopo.
- Depois desta fatia o convite está pronto para o go-live.
