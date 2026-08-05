# Plano — Fatia 11: redesign do convite ("cartaz de boteco")

> **Entrada desta fatia:** `docs/revisao/design/convite/prompt-design.md` + o mockup
> `docs/revisao/design/convite/mockups/convite-boteco.html`.
> **Não há `prompt.md` do Cowork nesta fatia** — foi decisão do Bruno (ver a seção abaixo).

Branch: `feat/fatia-11-convite-boteco`

---

## Para o Cowork: o que aconteceu enquanto você não estava na sala

Entrou uma terceira sessão, **Design**. A primeira versão da adaptação punha o Design como
terceira ponta do ciclo, com um `prompt-design.md` por fatia em paralelo ao seu `prompt.md`.
Isso foi **revertido** depois de uma conversa entre o Bruno e o Design. O motivo, que me parece
certo: trabalho de design não fecha por gatilho determinístico — ele fecha por aprovação humana,
com variações lado a lado e "não gostei disso". Não cabe num slot de arquivo sobrescrito a cada
rodada.

**O que ficou:** Design é uma **fase a montante**, não um ponto do ciclo. Ela roda até o humano
dizer que fechou, entrega um pacote por superfície, e aí o ciclo `próxima → planeja → revisa →
executa → fechou` roda por cima do pacote, **intacto**. O `WORKFLOW.md` não mudou uma linha — eu
conferi byte a byte contra a cópia que o Bruno tinha fora do repo. O registro durável está em
[FLUXO.md](FLUXO.md), seção "A fase de Design".

**O pacote já está no repo**, em `docs/revisao/design/<superfície>/`:

| Superfície | O que tem |
|---|---|
| `convite/` | `prompt-design.md`, mockup autônomo, `assets/og-160.png` (1200×630) |
| `admin/` | `prompt-design.md`, mockup autônomo |

**Por que esta fatia veio sem o seu `prompt.md`.** O Bruno perguntou se eu conseguia tocar o
convite direto com o Design, e eu respondi que sim — mas separando as duas superfícies:

- **Convite (esta fatia):** sem schema, sem contrato de dados, núcleo de cálculo intocado, e o
  `prompt-design.md` já vem mais especificado que um `prompt.md` típico (tokens, contraste
  medido, 7 estados, regras de mobile, ordem de implementação). Toquei sem você.
- **Admin (a próxima):** **recomendei chamar você.** Não é polimento — são 5 abas com
  roteamento, a tabela de 7 colunas morrendo, o `admin.js` remexido e a aba Contas com as 4
  fases do acerto. É dinheiro. Fatiar por risco ali é o seu trabalho, não o meu.

Este `plano.md` continua sendo seu de ler no `revisa`. Se você achar que o convite também
precisava de fatiamento seu, é só dizer — eu paro e espero o `prompt.md`.

**As 6 perguntas da seção final são para o Bruno**, não para você. Mas duas (P2 e P6) têm cheiro
de arquitetura, e eu ficaria mais tranquilo com a sua opinião no `review.md`.

---

## Objetivo

Trocar a pele do convite pela direção "cartaz de boteco" do mockup, e implementar as mudanças
de comportamento que vêm junto. **Schema e contrato de dados ficam intactos**; `js/main.js` muda
de verdade; `js/calculo.js` e `admin.html` não são tocados.

## O que o mockup é, tecnicamente

Bundle autoextraível com React. O fonte real (HTML + CSS inline, com os valores exatos) está na
linha 382, como string JSON. Decodifiquei para trabalhar com os valores do design em vez de
estimar a olho:

```bash
python3 -c "import json;print(json.loads(open('docs/revisao/design/convite/mockups/convite-boteco.html').read().split(chr(10))[381]))" > /tmp/convite-src.html
```

Toda medida citada abaixo saiu daí.

## Mudança estrutural que o mockup impõe

O convite deixa de ser "hero escuro + seções claras" e vira **uma coluna de 460px, papel creme,
com blocos pretos pontuais**. Consequências:

1. **`#secaoOnde` deixa de ser seção.** O endereço sobe para dentro do hero, numa grade
   `Dia / Onde` (`grid-template-columns: auto 1fr; gap: 8px 14px`). O id continua existindo,
   agora envolvendo essa grade — o fail-loud depende dele.
2. **Não existe mais hero escuro.** O preto vira: seção de fotos, barra "Total", cabeçalho dos
   cards de pessoa e rodapé. O fundo do `<body>` é `#14110d` e a coluna de 460px é `#f4efe2` —
   no desktop sobram faixas pretas nas laterais, e isso é intencional.
3. **O confete decorativo do hero sai.** No lugar entra textura de pontos
   (`radial-gradient(#14110d 1px, transparent 1px)`, `background-size: 5px 5px`, `opacity: .07`).
4. **Data e local passam a conviver no mesmo bloco**, com rótulos mono em `#8a5a12`.

## Os 7 estados e como mapeiam no código de hoje

| Estado do mockup | De onde sai | O que muda |
|---|---|---|
| `carregando` | antes do `carregarFesta()` | "160" pulsando, tela cheia — hoje é uma linha de texto |
| `contagem` | `estadoDaFesta() === "contagem"` | countdown de 4 caixas com borda 2px |
| `e-hoje` | `estadoDaFesta() === "e-hoje"` | carimbo vermelho torto (`rotate(-1deg)`), countdown some |
| `passou` | `estadoDaFesta() === "passou"` | bloco "ACABOU 🍕" **e o RSVP fecha junto** ⚠ |
| `rsvp-encerrado` | `status_rsvp().aberto === false` | card "PRAZO ENCERRADO" + botão de WhatsApp ⚠ |
| `enviado` | pós-submit | **novo** — tela cheia com resumo nominal |
| `erro` | `falhaConvite()` | "POXA" tela cheia, com botão "tentar de novo" |

⚠ **`passou` fechando o RSVP é comportamento novo.** Hoje a festa pode ter passado e o
formulário continuar aberto (só o prazo o fecha). No mockup, `rsvpEncerrado` é verdadeiro para
`passou` **e** para `rsvp-encerrado`. Vou seguir o mockup: festa passada fecha o formulário, com
texto próprio ("a festa já aconteceu"), diferente do texto de prazo.

## Contraste — medido, incluindo o que a tabela do design não cobria

A tabela do `prompt-design.md` bate com a minha medição. Medi também os 12 pares que aparecem no
mockup e não estavam listados:

| Par | Ratio | Uso |
|---|---|---|
| `#8a8579` sobre `#14110d` | 5.12:1 ✔ | rodapé mono 10px |
| `#e8a33d` sobre `#14110d` | 8.73:1 ✔ | link do rodapé |
| `#37332c` sobre `#fff` | 12.56:1 ✔ | corpo dentro de card |
| `#4a4640` sobre `#f4efe2` | 8.16:1 ✔ | sub do RSVP |
| `#6b665d` sobre `#fff` | 5.70:1 ✔ | dica mono 11px |
| `#c9c3b4` sobre `#23201a` | 9.24:1 ✔ | legenda das fotos |
| `#c9c3b4` sobre `#14110d` | 10.71:1 ✔ | rótulo "Total" |
| `#f4efe2` sobre `#1d4ed8` | 5.84:1 ✔ | botão azul |
| `#f4efe2` sobre `#6b665d` | 4.97:1 ✔ | cabeçalho de acompanhante |
| `#14110d` sobre `#fbf9f3` | 17.88:1 ✔ | input dentro de card |
| `#b52a20` sobre `#fff` | 6.33:1 ✔ | kicker vermelho em card |
| `#f4efe2` sobre `#14110d` | 16.39:1 ✔ | texto sobre preto |

**Nenhum par reprova.** Não preciso inventar cor nenhuma.

## O risco número um: o modo escuro

A Fatia 9 quebrou exatamente aqui. O `:root` do `style.css` tem
`@media (prefers-color-scheme: dark)`, e os componentes compartilhados (`input`, `.chip`,
`.pessoa-card`) leem as variáveis globais. Sem remapear dentro de `.pagina-convite`, o
formulário renderiza preto dentro de cards brancos.

A paleta boteco é **clara em qualquer esquema**. Então o bloco que remapeia `--bg`, `--ink`,
`--line` e `--brand` dentro de `.pagina-convite` **continua obrigatório**, agora com os valores
novos. Entra no primeiro commit, não no último, e vira asserção da verificação.

---

## Commits

Cada um verde no `./verify.sh`, separado por concern.

### 1 — `feat`: fontes, tokens e casca

- `index.html`: trocar o `<link>` do Google Fonts (Anton 400, Space Grotesk 400/500/600/700,
  DM Mono 400/500). Fredoka e Nunito saem do convite; **continuam no `admin.html`** — conferir
  que não é o mesmo `<link>`.
- `css/style.css`, dentro de `.pagina-convite`: substituir os `--cv-*` pelos tokens novos e
  **remapear os globais**.
- Coluna: `body` preto, wrapper `max-width: 460px; margin: 0 auto; background: #f4efe2`.
- `input, textarea, select { font-size: 16px }` dentro do escopo (zoom do iOS).

### 2 — `feat`: hero, com o endereço dentro

- Selo "Convocação oficial": mono 11px, `letter-spacing: .2em`, borda 2px `#b52a20`,
  `padding: 5px 10px`, `rotate(-2deg)`.
- `#festaTitulo`: Anton 66px, `line-height: .84`, `letter-spacing: -.02em`, uppercase.
  O mockup quebra em três linhas e pinta a última de `#d8352a` — como o título vem do banco, vou
  aplicar a cor na **última palavra** por script, não com `<br>` fixo.
- `#heroNomes`: a equação vira faixa entre duas linhas `2px dashed`, números Anton 35px, nomes
  11px/700 uppercase, operadores `+` em `#1d4ed8` e `=` em `#d8352a`, total num bloco `#d8352a`
  com `rotate(1.5deg)` e `flex: 1.15`.
- `#secaoOnde` vira a grade `Dia | Onde` dentro do hero. `#cardLocal` e `#festaLocal` mudam de
  lugar, não de id. Link do mapa: `min-height: 44px; line-height: 44px`, azul com
  `border-bottom: 2px solid`.
- `#countdown`: 4 caixas `flex: 1`, borda 2px, número Anton 23px, rótulo 9px.
- `#festaEstado` deixa de ser um `<p>` e passa a ter duas caras: carimbo (`e-hoje`) e bloco
  branco com borda 3px (`passou`).
- CTA "Tô dentro →": preto, Anton 22px, `box-shadow: 5px 5px 0 #d8352a`. Some em `passou` e em
  `rsvp-encerrado`.

### 3 — `feat`: seção de fotos

- Bloco preto, kicker âmbar "Registros do futuro", `<h2>` Anton 34px **"Fotos da festa"**.
- Moldura: `aspect-ratio: 4/5`, `border: 3px solid #f4efe2`, fundo `#23201a`.
- Legenda fixa sobre o gradiente: "Nenhuma destas fotos aconteceu. Ainda." (mono 10px).
- `#carrosselVazio` reescrito no tom novo.
- **Ver P1** — o mockup não cobre navegação com N fotos.

### 4 — `feat`: RSVP (aqui estão as mudanças de comportamento)

`index.html` + `#tplPessoa` + `js/main.js`:

- **Bebida e comida numa lista só.** Os 4 chips (Água · Refri · Chopp · Pizza) passam a viver no
  mesmo contêiner. `lerPessoa()` deixa de ler `.p-bebidas` e `.p-comida` separados e passa a ler
  `[data-bebida]` e `[data-comida]` em qualquer lugar do card. **Nada muda no payload.**
- **O `<select>` `.p-relacao` sai.** Era ele que vazava a 390px. Confirmei que é **escrito e
  nunca lido**: não existe coluna `relacao` no schema e nada o coleta no envio ([main.js:324]).
  Sai junto o `relacoes` do `js/config.js`, que fica sem consumidor.
- **O card "Você" perde o campo de nome.** O nome vem do campo de cima, que já é o que o submit
  usa (`pessoas[0].nome = responsavel`, main.js:458). O cabeçalho preto mostra o rótulo fixo
  `ADULTO`, e o rádio Adulto/Criança **só existe em acompanhante** — mas `lerPessoa()` continua
  mandando `tipo: "adulto"` para o principal, então o payload não muda.
- **Contador ao vivo**: barra preta "TOTAL / N pessoas", atualizada ao adicionar e remover.
- Cabeçalho do acompanhante em `#6b665d`, com o ✕ de 44px de alvo.
- **A regra do chopp fica** — ver P4.

### 5 — `feat`: os estados de tela cheia (`carregando`, `erro`, `enviado`)

- `#conviteCarregando` vira o "160" pulsando (`@keyframes`, `opacity 1 → .35`).
- `#conviteErro` vira o card "POXA", `box-shadow: 6px 6px 0 #d8352a`, com botão de recarregar.
  Mantenho o **rodapé visível** no erro: o mockup mostra o erro sozinho, mas o fail-loud de hoje
  deixa o rodapé de propósito, e ele é a única pista de que a página é a certa.
- `sucesso()` deixa de injetar um bloco dentro de `#confirmar` e passa a **substituir a tela**:
  card branco com faixa "Confirmação registrada", "TÁ ANOTADO", resumo nominal de quem vai
  (`Você / Acompanhante` + nome + adulto|criança) e os dois botões.
- **Confete**: recolorir para `#d8352a`, `#1d4ed8`, `#e8a33d`, `#14110d` — ver P5.

### 6 — `feat`: `localStorage` (o combinado da conversa)

- No sucesso, gravar `{ responsavel, contato, convidadoPor, pessoas, mensagem, rsvpId, em }`.
- No load, havendo registro **e prazo aberto**, preencher o formulário e mostrar uma tarja
  discreta: "você já confirmou em DD/MM — enviar de novo substitui a confirmação anterior".
- "Mudar minha confirmação" na tela de sucesso reabre o formulário preenchido, sem recarregar.
- **Sem RPC nova nesta fatia.** Desconfirmar fica fora — ver P6.

### 7 — `feat`: preview do link no WhatsApp

- `og-160.png` copiado do pacote de design para a **raiz do site** — o `docs/` também é
  publicado, mas o caminho ficaria feio na URL que o WhatsApp mostra.
- `<meta>` de `og:title`, `og:description`, `og:image`, `og:url` e `twitter:card` no `<head>`.
- `og:url` aponta para `https://carvalhocoutobruno.github.io/site-aniversario/` — o mockup mostra
  `festados160.com.br`, que é ilustrativo e não existe.

### 8 — `chore`: limpeza

- Remover o CSS do tema anterior que ficou órfão dentro de `.pagina-convite`.
- Conferir que nenhuma regra nova vazou para fora do escopo.

### Fora do git: o dado

`festa.local` passa de "Salão 3" para **"Salão Grande"**. É `UPDATE`, não código. Backup da
linha impresso na conversa antes, conferência depois, saída crua no `status.md` — o mesmo
procedimento da Fatia 8.

---

## Verificação

`./verify.sh` verde em cada commit. Verde aqui **não é entrega verificada**, então:

1. **Os 7 estados, a 390px**, na cópia servida do scratchpad. Screenshot de cada um.
2. **Fail-loud, um estado só** — a asserção que já quebrou três vezes:
   `{ erro: true, hero: false, secaoOnde: false, secaoFotos: false, secaoRsvp: false, rodape: true, chips: 0 }`.
3. **Modo escuro não regride** — mesmo `getComputedStyle` de corpo, input, texto e card com
   `prefers-color-scheme` claro e escuro. Tem que dar idêntico.
4. **Admin intacto** — `grep -c "pagina-convite\|Anton" admin.html` = 0, e o painel renderiza
   com Fraunces/Inter.
5. **RSVP ponta a ponta** contra o banco: enviar, ler `rsvps` e `pessoas` com `pg8000`, conferir
   que o payload não mudou de forma, apagar depois.
6. **`localStorage`**: enviar, recarregar, conferir que voltou preenchido; limpar, recarregar,
   conferir que voltou vazio.
7. **Contraste**: a tabela acima, recalculada sobre o CSS final e não sobre o mockup.

---

## Perguntas (não invento — são de hierarquia ou de escopo)

**P1 — Carrossel: o mockup não cobre N fotos.** Ele tem 3 slides fixos com animação CSS de 15s,
sem setas e sem dots. Na vida real são N fotos vindas do Storage, e `#carPrev`, `#carNext` e
`#carDots` são contrato do `main.js`. **Proponho** ficar com a moldura do mockup (4/5, borda 3px,
legenda) e com os **dots** — com N variável, eles informam quantas fotos existem — e **tirar as
setas laterais**, que numa coluna de 460px roubam área e cujo gesto natural é arrastar. Confirma?

**P2 — "Falar com o Bruno" no prazo encerrado.** O botão precisa de um telefone, e não existe
telefone em `festa` nem em `config`. Opções: (a) coluna nova `whatsapp_contato` em `festa`,
aditiva e editável pelo painel; (b) o botão sai e fica só o texto; (c) hardcode. **Recomendo (a)**
— é o único jeito de continuar editável, e schema aditivo é permitido desde a Fatia 8. Mas (a)
mexe em schema e em painel, então talvez valha esperar a fatia do admin. Qual?

**P3 — "Salvar na agenda 📅".** Está no mockup, mas **não** está na lista de ⚠ do
`prompt-design.md`. Dá para fazer sem dependência nenhuma: um `.ics` montado em `data:` URI a
partir de `festa.data` e `festa.local`. Entra nesta fatia?

**P4 — Chopp para criança.** O mockup mostra os 4 chips iguais no card de acompanhante, sem a
regra e sem o aviso. A constraint do banco proíbe, e hoje a tela desabilita o chip e explica.
**Vou manter a regra** — é o banco que manda —, com o aviso redesenhado no tom novo. Registro
como divergência consciente do mockup; só confirma que concorda.

**P5 — Confete.** Sumiu do mockup: o hero tem textura de pontos e a tela de sucesso não tem
confete. **Proponho** tirar o confete decorativo do hero (a textura o substitui) e **manter a
chuva no sucesso**, recolorida para a paleta nova — é a recompensa emocional do envio e não
disputa espaço com texto nenhum. Ou prefere sem confete nenhum?

**P6 — Desconfirmar.** Preciso corrigir uma coisa que eu disse na conversa: o `localStorage`
resolve o preenchimento, mas **não** resolve desconfirmar. Não existe caminho — a `criar_rsvp`
exige de 1 a 6 pessoas, então não dá para enviar grupo vazio, e não há RPC de exclusão para o
anônimo. O caminho barato: a `criar_rsvp` **já devolve o `uuid`** do RSVP; guardando esse uuid no
`localStorage`, uma `cancelar_rsvp(p_id uuid)` funciona com o próprio id servindo de credencial —
128 bits, não se adivinha, e sem coluna nova. É pequeno, mas **é backend**, e eu tinha dito "zero
de backend". Entra nesta fatia, vira fatia própria, ou fica de fora e "mudar" cobre?

**Enquanto P1–P6 não voltarem**, os commits 1, 2, 4 e 8 já podem andar: nenhum deles depende das
respostas.
