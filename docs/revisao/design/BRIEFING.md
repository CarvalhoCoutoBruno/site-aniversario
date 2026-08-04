# Briefing de design — site-aniversario

> Para uma sessão de design entrar no projeto sem precisar garimpar.
> Estado em 2026-08-03, commit `cd701cd`.

## O que é

Convite de aniversário para **três aniversariantes** (Bruno, Braz, Bocão) — a festa dos **160
anos**, que é a soma das idades (40 + 50 + 70). Tem RSVP com acompanhantes e preferências de
consumo, e um painel de organizador que vai da estimativa de compra ao acerto de contas.

- **Repositório:** https://github.com/CarvalhoCoutoBruno/site-aniversario (público)
- **No ar:** https://carvalhocoutobruno.github.io/site-aniversario/
- **Festa:** 31/10/2026, 11h — Salão 3, Av. Cel. Marcos 627, Porto Alegre/RS

```bash
git clone https://github.com/CarvalhoCoutoBruno/site-aniversario.git
```

## Stack — e a regra de ouro

**Site estático: HTML, CSS e JS puro. Sem build, sem framework, sem `node_modules`.**

Nada de bundler, pré-processador ou passo de compilação. Todo CSS entra em `css/style.css`; todo
JS entra por `<script>`. Fontes vêm por `<link>` do Google Fonts. Deploy é GitHub Pages: `git
push` na `main` publica em 1-2 min.

Se uma proposta exigir build, ela está fora do projeto.

## Mapa dos arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | **o convite** — é aqui que o design mora |
| `css/style.css` | **todo o estilo**, do convite e do painel (ver o aviso abaixo) |
| `js/main.js` | lógica do convite: carrega os dados, monta a equação, countdown, RSVP |
| `admin.html` / `js/admin.js` | painel do organizador — **fora do escopo de design** |
| `js/calculo.js` | cálculo puro (rateio/acerto). Não tem nada visual |
| `docs/revisao/design/mockup-convite.html` | o mockup roxo que originou o redesign (histórico) |

## ⚠️ O `style.css` é compartilhado com o painel

O `admin.html` usa **o mesmo arquivo**. Para o restyle do convite não vazar para lá, tudo que é
do convite está escopado em **`.pagina-convite`** — a classe do `<body>` do `index.html`.

```css
.pagina-convite { --cv-preto: #0a0c12; ... }
.pagina-convite .hero { ... }
```

Dentro desse escopo, as variáveis **globais** também são remapeadas (`--bg`, `--ink`, `--line`,
`--brand`…). Isso existe por um motivo concreto: o `:root` tem um bloco
`@media (prefers-color-scheme: dark)`, e sem o remapeamento os componentes compartilhados
(`input`, `.chip`, `.pessoa-card`) apareciam **pretos** dentro das seções claras do convite.

**Não mexer em `:root` nem nas classes compartilhadas** (`.btn`, `.chip`, `.campo`, `.stat`,
`.selo`, `.conta-aniv`, `.msg-toast`) — elas vestem o painel.

## Sistema visual atual

**Paleta** (preto + azul + vermelho, escolhida pelo Bruno):

```
--cv-preto: #0a0c12     --cv-azul: #3b82f6        (acento sobre o hero escuro)
--cv-preto-2: #12161f   --cv-azul-texto: #2563eb  (azul para texto sobre claro)
--cv-claro: #f7f8fb     --cv-azul-claro: #7cb1ff
--cv-tinta: #12161f     --cv-vermelho: #ef4444
--cv-tinta-suave: #4a5164   --cv-vermelho-claro: #ff7a7a
--cv-linha: #dfe3ec
```

**Existem dois azuis de propósito.** O `#3b82f6` reprovou no contraste AA sobre fundo claro
(3,46 — o mínimo é 4,5), então texto azul sobre claro usa `#2563eb` (4,87). O tom original só
aparece sobre o hero escuro.

**Fontes:** `Fredoka` (títulos, números) + `Nunito` (corpo), por `<link>`.
*O painel usa Fraunces + Inter — não misturar.*

**Estrutura do convite:** hero escuro (título → equação 40+50+70=160 → pílula da data →
countdown → CTA) · seção clara "onde" · carrossel de fotos · formulário de RSVP · rodapé escuro.

O confete do hero é **CSS puro** (`::before`/`::after` com `radial-gradient`), sem markup e sem
JS. Abaixo de 560px a densidade cai e as partículas vão para as bordas — no mobile elas caíam
sobre o título.

## Restrições duras

### 1. Os ids do markup são contrato

O `main.js` escreve nestes elementos. **Se um sumir do HTML, o convite quebra:**

```
#conviteCarregando #hero-conteudo #conviteErro #festaTitulo #festaSubtitulo #heroNomes
#festaData #countdown #cdDias #cdHoras #cdMin #cdSeg #festaEstado
#secaoOnde #cardLocal #festaLocal
#secaoFotos #carrossel #carrosselTrack #carrosselVazio #carPrev #carNext #carDots
#confirmar #rsvpForm #rsvpEncerrado #rsvpEncerradoTexto #responsavel #contato
#chipsAniversariantes #pessoasLista #addPessoa #limiteAcompanhantes #mensagem
#contadorMensagem #prazoAberto #btnEnviar #formStatus #tplPessoa #rodapeFesta #confetti
```

Reorganizar, aninhar e re-estilizar: à vontade. Renomear ou remover: não, sem ajustar o
`main.js` junto.

### 2. Seis estados precisam continuar funcionando

O convite não é uma página só. Tem:

1. **carregando** — os dados vêm do banco, não do HTML;
2. **erro de carga** — se os dados não vierem, **só o erro e o rodapé aparecem**. Nada de hero
   pela metade ao lado de formulário escondido. Esta regra já quebrou três vezes;
3. **countdown contando** / 4. **"É hoje!"** / 5. **"A festa já aconteceu"**;
6. **"confirmações encerradas"** — quando o organizador define prazo e ele passa.

Mais o carrossel vazio e o sucesso do RSVP (com confete animado).

### 3. O conteúdo é editável — nada de hardcodar

Título, subtítulo, data, local, link do mapa e os três nomes vêm do **banco**, editáveis pelo
painel. Só as **idades** (`IDADES = [40, 50, 70]` no `main.js`) ainda vivem no código, e o "160"
do hero é a **soma** delas — não um literal.

### 4. Acessibilidade é medida, não estimada

Todo par texto/fundo passa no **WCAG AA** (4,5 para texto normal). Isso foi calculado, e foi como
o problema do azul apareceu — os dois tons reprovados pareciam perfeitamente legíveis a olho.

Proposta de cor nova vem com a razão de contraste calculada.

### 5. Mobile primeiro na prática

A maioria confirma pelo celular. Testar em **390px** de largura, não só no desktop.

## Como ver rodando

O jeito mais rápido é o site no ar (com dados reais):
https://carvalhocoutobruno.github.io/site-aniversario/

Localmente, qualquer servidor estático serve — mas **não** basta abrir o `index.html` como
arquivo: ele busca os dados por rede.

```bash
python3 -m http.server 4321   # e abrir http://localhost:4321
```

> No Mac do Bruno o sandbox impede servir de dentro de `~/Documents`. A saída é copiar
> `index.html admin.html css js` para uma pasta temporária e servir de lá.

As chaves do Supabase já estão no `js/config.js` e são públicas por natureza — a segurança está
nas regras do banco. Não é preciso configurar nada para ver o convite.

## O que já foi decidido (para não refazer)

| Decisão | Por quê |
|---|---|
| Título como `<h1>` visível, com a equação como apoio | o Bruno quer o nome da festa no topo |
| Data só no pill do hero | aparecia duas vezes, com a string idêntica |
| Seção "onde" com um bloco só | dois cards baixos deixavam a seção com cara de inacabada |
| Carrossel `2/1` no desktop | `16/10` dava 562px — um terço da tela |
| Confete nas bordas no mobile | caía sobre o título e sobre os cards |

O mockup roxo em `docs/revisao/design/mockup-convite.html` é **histórico**: a paleta foi trocada
para preto/azul/vermelho depois dele.

## Como trabalhamos

O projeto roda num fluxo de fatias com handoff por arquivos, descrito em
`docs/revisao/WORKFLOW.md` e `docs/revisao/handoff/FLUXO.md`. Em resumo: uma sessão arquiteta e
revisa, outra executa e commita.

Para uma sessão de design, o encaixe natural é **produzir a direção e o `prompt.md` da fatia** —
mockups, paleta, referências, decisões — e deixar a implementação e a verificação para a sessão de
execução, que tem o git e roda os testes.

Duas coisas que essa sessão sempre entrega junto com o código: **screenshots antes e depois**, em
desktop e mobile, e a **medição de contraste**.
