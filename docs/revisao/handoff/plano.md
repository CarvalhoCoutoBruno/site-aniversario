# Plano — Fatia 12: Admin, casca (abas + roteamento + login) e a aba Resumo

Branch: `feat/fatia-12-admin-casca`

Entradas: `docs/revisao/handoff/prompt.md` (Cowork) + `docs/revisao/design/admin/prompt-design.md`
e o mockup `admin/mockups/admin-organizador.html`. Decodifiquei o fonte do bundle (linha 382)
para trabalhar com os valores do design, como na Fatia 11.

---

## As quatro decisões que o prompt pediu

### 1. Carregamento com abas: **as abas não carregam nada**

**As abas trocam visibilidade, só isso.** Todo o carregamento continua acontecendo uma vez, no
`mostrarPainel()`, com a serialização de hoje intacta:

```js
await carregarConvite();          // a festa PRIMEIRO e sozinha — os nomes saem dela
carregarConfig(); carregarAniversariantes(); carregarRSVPs(); carregarFotos();
```

Três razões, em ordem de peso:

- **A guarda de completude não sobrevive a carregamento sob demanda.** `recomputar()` exige
  `ultimaConfig && ultimasPessoas && ultimosGrupos && ultimaFesta` juntos ([admin.js:544]). Se a
  aba Contas disparasse o próprio fetch, ela renderizaria antes de `pessoas` chegar — que é
  exatamente a corrida que a Fatia 4 matou. Manter a guarda **e** carregar sob demanda exigiria
  reintroduzir o problema para depois defendê-lo.
- **Não há o que otimizar.** É uma festa: ~30 grupos, ~60 pessoas, uma linha de `config` e uma de
  `festa`. O ganho de lazy loading aqui é zero e o risco é real.
- **Trocar de aba fica instantâneo**, que é o comportamento que o mockup sugere (as abas não têm
  estado de carregando).

O botão **↻** continua sendo o único ponto de refetch, e mantém a mesma ordem — `await` na festa
antes dos dependentes.

### 2. Modo escuro: **o admin passa a ser claro em qualquer esquema**

Hoje o painel **usa** o `@media (prefers-color-scheme: dark)` do `:root` — a verificação da Fatia
11 mediu `input[type=text]` em `rgb(30,24,48)` no escuro. A paleta nova do design é clara e a
tabela de contraste dele foi medida sobre fundo claro. Manter escuro exigiria um segundo conjunto
de tokens que **não existe no pacote**, e ficar meio a meio é o defeito que o prompt já antecipa.

**Decisão: claro nos dois esquemas**, pelo mesmo mecanismo que o convite usa —
`<body class="pagina-admin">` remapeando as variáveis globais dentro do escopo. Entra no
**primeiro commit** e vira asserção.

⚠️ **É mudança visível para quem usa o painel à noite.** Bruno: se você usa no escuro e prefere
manter, isso volta para o Design como pedido de tokens escuros e a fatia espera. Não é bloqueante
— sigo com o claro salvo aviso em contrário.

Efeito colateral que vale registrar: quando a Fatia 14 terminar, **nenhuma página lerá o `:root`
no escuro**, e o bloco `@media (prefers-color-scheme: dark)` pode ser removido. Fica como dívida
anotada, não faço agora.

### 3. Não vazar, nos dois sentidos

O convite tem `.pagina-convite`; o admin passa a ter `.pagina-admin`. Toda regra nova nasce
escopada. A asserção é dupla:

- `admin.html` renderiza sem nenhuma fonte do convite (`Anton`) e sem a paleta dele;
- `index.html` renderiza **idêntico** ao de hoje — capturo `getComputedStyle` de um conjunto de
  elementos antes de começar e comparo no fim.

A Fatia 11 mostrou como isso quebra: a pele antiga ficou fora de escopo e venceu por
especificidade. Aqui o risco é o mesmo com os papéis trocados, então **nada de regra nova sem
prefixo**.

### 4. Estado da aba na recarga: **hash** (`#resumo`, `#quem-vem`, `#compras`, `#contas`, `#ajustes`)

Escolhido sobre `localStorage` e sobre "sempre volta no Resumo":

- **sobrevive ao reload** e ao voltar/avançar do navegador, que é o que o organizador faz depois
  de salvar alguma coisa;
- **é compartilhável** — "olha em `admin.html#contas`" funciona;
- **não guarda estado do usuário em lugar nenhum**, então não há o que limpar nem o que sincronizar
  entre aparelhos;
- **degrada sozinho**: hash ausente ou desconhecido cai no Resumo. O link do rodapé do convite
  aponta para `admin.html` sem hash e continua funcionando.

Escuto `hashchange` para o botão voltar funcionar, e uso `history.replaceState` ao clicar numa aba
para não empilhar uma entrada de histórico por toque.

---

## O que muda na tela

### Casca

- Coluna `max-width: 560px`, fundo da página `#eceae5`, coluna `#f7f6f3` com
  `box-shadow: 0 0 0 1px #dedbd4`.
- Cabeçalho `position: sticky; top: 0`, com "Organizador", a linha mono "atualizado às HH:MM"
  (no fuso de São Paulo — ver o item do `verify.sh`), o ↻ de 44px e o "Sair".
- Barra de abas `position: fixed; bottom: 0`, `grid-template-columns: repeat(5, 1fr)`,
  `min-height: 58px`, `padding-bottom: calc(10px + env(safe-area-inset-bottom))`, borda superior
  de 3px azul na ativa. Rótulo de texto, sem ícone.
- O conteúdo ganha `padding-bottom: 82px` para não ficar embaixo da barra.

### As abas e o que vai dentro delas nesta fatia

| Aba | Conteúdo nesta fatia |
|---|---|
| **Resumo** | novo, completo |
| **Quem vem** | `#stats` sai daqui; fica o bloco da tabela de hoje, provisório |
| **Compras** | `estSecao` de hoje, provisório |
| **Contas** | `fecSecao` de hoje, provisório |
| **Ajustes** | `conviteSecao` + `configSecao` + `anivSecao` + fotos, provisórios |

Os `<details>` **não são apagados nem reescritos** — cada um só passa a morar dentro do painel da
aba correspondente. Feio é aceitável; quebrado não é.

### Aba Resumo

Sai de `render()` ([admin.js:923]), que já calcula tudo — não há dado novo nem consulta nova:

1. **Dois cartões**: "Confirmados" (preto, número grande, "N adultos · M crianças") e "Respostas"
   (branco, nº de grupos).
2. **Prazo com barra** — ver **P1**, é a única coisa que o mockup não determina.
3. **"Quem consome o quê"** em barras: Água, Refri, Chopp, Pizza, com a contagem à direita. A
   largura de cada barra é a proporção sobre o total de pessoas.
4. **Recados e restrições**: um bloco por grupo com `observacoes` preenchido, com o nome do
   responsável e borda-esquerda vermelha quando o texto casa com palavra de restrição
   (alergia/intolerância/restrição/celíac/vegetarian/vegan), cinza nos demais — é o que o mockup
   desenha. `esc()` em tudo: é texto que o convidado escreveu.

`#stats` deixa de existir como bloco de cartões. **`render()` é atualizado no mesmo commit** —
apagar um id sem mexer em quem escreve nele foi como as setas do carrossel quase derrubaram a
IIFE na Fatia 11.

### Login

Cartão branco de `border-radius: 14px`, campos de 16px, botão preto. E é aqui que a dívida dos
seletores começa a ser paga: `input[type=email]` e `input[type=password]` **não** são cobertos
pelo seletor atual (`input[type=text], input[type=tel], textarea, select`) e hoje ficam com o
visual padrão do navegador. Corrijo os dois nesta fatia, porque são a tela de login; `date` e
`url` caem na **Fatia 14**, com os formulários de Ajustes.

---

## Commits

1. `feat`: escopo `.pagina-admin`, tokens, fontes (Space Grotesk + DM Mono, saem Fraunces e Inter)
   e o **remapeamento das variáveis globais** — a decisão do modo escuro entra aqui, não no fim.
2. `feat`: casca — cabeçalho fixo, barra de 5 abas, roteamento por hash, painéis das abas com o
   conteúdo de hoje redistribuído.
3. `feat`: login no visual novo + seletor cobrindo `email` e `password`.
4. `feat`: aba Resumo.
5. `chore`: `verify.sh` ganha a asserção de fuso (abaixo).

---

## `verify.sh`: a asserção de fuso, barata e nesta fatia

O prompt pede até a Fatia 15 e "melhor se couber barato aqui". Cabe, mas **não** como teste de
execução: `dataCurta()` mora dentro da IIFE do `main.js` e não é exportável sem inventar API.

O que cabe é um **invariante estático**, na mesma família dos dois que o `verify.sh` já tem:

> nenhum `toLocaleDateString` / `toLocaleString` / `toLocaleTimeString` em `js/` sem `timeZone`.

Pega a família inteira, inclusive nos arquivos que ainda não existem, e teria pegado tanto o bug
da Fatia 7 quanto o da 11. Custa uma linha de `grep` com pathspec. O carimbo "atualizado às HH:MM"
do cabeçalho novo já nasce sob essa regra.

---

## Verificação

`./verify.sh` verde em cada commit — e verde aqui **não é entrega verificada**, então:

1. **Não-regressão do que está em uso, com saída crua do banco.** Editar e salvar pelo painel:
   preços/taxas/prazo, convite, aniversariantes; conferir cada um por `pg8000` e **restaurar os
   valores do Bruno** ao fim. Estimativa e rateio conferidos contra `tests/calculo.test.js`.
2. **Guarda de completude** — o teste da Fatia 4: forçar `ultimasPessoas = null` e provar que
   nenhuma tela calcula com estado parcial.
3. **Modo escuro** — `getComputedStyle` nos dois esquemas, no admin: tem que dar **idêntico**.
4. **Convite intacto** — comparação antes/depois de `getComputedStyle` em elementos do
   `index.html`; e `grep` de `Anton` no admin = 0.
5. **Roteamento** — abrir `admin.html#contas` direto, recarregar, voltar/avançar, hash inválido.
6. **Screenshots a 390px** da casca, do login e do Resumo; mais um de desktop, para a coluna de
   560px.
7. **Dado do Bruno preservado** ao fim: prazo 01/10/2026 23:59 SP, preços, os 3 aniversariantes
   (com o nome novo, **JH Boca**), fotos.
8. **Contraste** medido sobre o CSS final, não sobre o mockup — foi assim que o botão do convite
   reprovou na Fatia 11.

---

## Perguntas

**P1 — a barra do prazo mede o quê?** O mockup mostra 62% preenchido, mas não diz de onde sai o
começo da régua. Não existe "data de abertura das confirmações" no schema. **Proponho** usar a
**primeira confirmação recebida** (`min(rsvps.criado_em)`) como origem e o prazo como fim — é dado
real e responde "quanto do período de confirmação já passou". Sem nenhuma confirmação ainda, a
barra não aparece e fica só a data com o "faltam N dias". Confirma, ou o Design tem outra régua em
mente?

**P2 — modo escuro do painel.** Decidi por claro nos dois esquemas (justificado acima), mas quem
usa o painel é você. Se você abre isso de noite e prefere o escuro, me diz agora: vira pedido de
tokens escuros para o Design e a fatia espera esse retorno.

**P3 — o "atualizado às 21:57" do cabeçalho.** É a hora do último carregamento na sessão, ou o
`festa.atualizado_em` do banco? O mockup não diz. **Proponho o último carregamento** — é o que
responde "esse número na minha tela está velho?", que é a pergunta de quem olha. Confirma?

Nenhuma das três bloqueia os commits 1, 2, 3 e 5: só a P1 e a P3 tocam a aba Resumo, e a P2 só
inverte uma decisão que já está tomada e justificada.
