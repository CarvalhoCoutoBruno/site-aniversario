# Briefing de design — site-aniversario

> Para uma sessão de design entrar no projeto sem precisar garimpar.
> Estado em 2026-08-05, depois da Fatia 11 (pele "cartaz de boteco").

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
| `js/calc.js` | cálculo puro (rateio/acerto). Não tem nada visual |
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

**Paleta** (cartaz de boteco — papel creme, traço preto, vermelho e azul):

```
--cv-tinta: #14110d      --cv-vermelho:     #d8352a   (SÓ display >= 24px)
--cv-papel: #f4efe2      --cv-vermelho-txt: #b52a20   (vermelho para texto < 24px)
--cv-papel-2: #ffffff    --cv-azul:  #1d4ed8
--cv-papel-3: #fbf9f3    --cv-ambar: #e8a33d   (rótulo sobre bloco escuro)
--cv-mudo: #6b665d       --cv-mudo-2: #8a5a12  (rótulos "Dia"/"Onde")
--cv-corpo: #37332c      --cv-linha: #dcd5c4
```

**Existem dois vermelhos de propósito.** O `#d8352a` sobre o papel dá **4,10:1** — passa em AA
large (>= 24px bold), não em AA para texto normal. Abaixo de 24px usa-se o `#b52a20` (5,51:1).

**Fontes:** `Anton` (display, uppercase) + `Space Grotesk` (corpo) + `DM Mono` (rótulos
técnicos, countdown, notas). *O painel usa Fraunces + Inter — não misturar.*

**Estrutura:** coluna única de **460px** em papel creme, centralizada sobre fundo preto. Blocos
escuros pontuais: fotos, barra do total, cabeçalho dos cards de pessoa e rodapé. O hero é claro,
alinhado à esquerda, com textura de pontos em CSS puro — **não existe mais hero escuro**, e o
endereço vive dentro dele, numa ficha `Dia / Onde`.

## Restrições duras

### 1. Os ids do markup são contrato

O `main.js` escreve nestes elementos. **Se um sumir do HTML, o convite quebra:**

```
#conviteCarregando #hero-conteudo #conviteErro #festaTitulo #festaSubtitulo #heroNomes
#festaData #countdown #cdDias #cdHoras #cdMin #cdSeg #festaEstado
#secaoOnde #cardLocal #festaLocal   (agora DENTRO do hero, não mais uma seção)
#secaoFotos #carrossel #carrosselTrack #carrosselVazio #carDots
#confirmar #rsvpForm #rsvpEncerrado #rsvpEncerradoTexto #responsavel #contato
#chipsAniversariantes #pessoasLista #addPessoa #limiteAcompanhantes #mensagem
#contadorMensagem #prazoAberto #btnEnviar #formStatus #tplPessoa #rodapeFesta #confetti
#ctaTopo #totalPessoas #rsvpSucesso #sucessoResumo #sucessoLista #btnAgenda #btnMudar
```

Reorganizar, aninhar e re-estilizar: à vontade. Renomear ou remover: não, sem ajustar o
`main.js` junto.

### 2. Sete estados precisam continuar funcionando

O convite não é uma página só. Tem:

1. **carregando** — os dados vêm do banco, não do HTML;
2. **erro de carga** — se os dados não vierem, **só o erro e o rodapé aparecem**. Nada de hero
   pela metade ao lado de formulário escondido. Esta regra já quebrou três vezes;
3. **countdown contando** / 4. **"É hoje!"** / 5. **"A festa já aconteceu"**;
6. **"confirmações encerradas"** — quando o organizador define prazo e ele passa, **ou** quando
   a festa já aconteceu (os dois fecham o formulário; o primeiro a fechar escreve o texto);
7. **"enviado"** — tela de sucesso, que substitui o convite mas **não destrói o formulário**:
   "mudar minha confirmação" precisa dele de volta preenchido.

Mais o carrossel vazio e o confete do sucesso.

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
| Coluna de 460px, sem layout de desktop | o convite é peça de celular; duas layouts dobram a manutenção |
| Endereço dentro do hero | a seção separada repetia a data e ficava com cara de inacabada |
| Carrossel sem setas, com dots | numa coluna de 460px as setas roubam a foto; o gesto é arrastar |
| Chopp para criança continua bloqueado | a constraint do banco manda, não o mockup |
| `<select>` de relação removido | vazava da tela a 390px e o valor nunca foi lido |
| Card do responsável sem nome nem tipo | o nome vem do campo de cima; convite não é mandado para criança |

O mockup vigente é `docs/revisao/design/convite/mockups/convite-boteco.html`. O
`mockup-convite.html` na raiz de `design/` é **histórico** (paleta roxa), e a pele
preto/azul/vermelho das Fatias 9 e 10 também já foi superada.

## Como trabalhamos

O projeto roda num fluxo de fatias com handoff por arquivos, descrito em
`docs/revisao/WORKFLOW.md` e `docs/revisao/handoff/FLUXO.md`. Em resumo: uma sessão arquiteta e
revisa, outra executa e commita.

Para uma sessão de design, o encaixe natural é **produzir a direção e o `prompt.md` da fatia** —
mockups, paleta, referências, decisões — e deixar a implementação e a verificação para a sessão de
execução, que tem o git e roda os testes.

Duas coisas que essa sessão sempre entrega junto com o código: **screenshots antes e depois**, em
desktop e mobile, e a **medição de contraste**.
