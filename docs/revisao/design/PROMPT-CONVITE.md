# Fatia — Convite (redesign "Cartaz de boteco")

Mockup de referência: `Convite Boteco.dc.html` (design session). Abre no navegador; os
estados trocam pelo painel de Tweaks (prop `estado`).

Substitui o visual de `index.html` + o bloco `.pagina-convite` de `css/style.css`.
**Não muda contrato de dados, nem `js/main.js`, nem o schema.** É troca de pele + duas
mudanças de UX marcadas abaixo com ⚠.

---

## 1. Tokens

```css
--tinta:        #14110d;  /* preto quente, texto e traços */
--papel:        #f4efe2;  /* fundo creme */
--papel-2:      #fff;     /* cards internos */
--papel-3:      #fbf9f3;  /* input dentro de card */
--vermelho:     #d8352a;  /* SÓ display ≥24px (títulos, carimbos, botão) */
--vermelho-txt: #b52a20;  /* vermelho para texto <24px */
--azul:         #1d4ed8;  /* links, chip selecionado */
--âmbar:        #e8a33d;  /* rótulo sobre fundo escuro */
--mudo:         #6b665d;  /* texto secundário sobre papel */
--mudo-2:       #8a5a12;  /* rótulos "Dia"/"Onde" */
--borda-suave:  #dcd5c4;
```

Fontes (Google Fonts):
- **Anton** — display. Números, títulos, botões. `text-transform: uppercase`.
- **Space Grotesk** 400/500/600/700 — corpo, labels, inputs.
- **DM Mono** 400/500 — rótulos técnicos, countdown, notas.

## 2. Contraste (medido, não estimado)

| Par | Ratio | Uso |
|---|---|---|
| `#14110d` sobre `#f4efe2` | 15.4:1 | corpo, títulos |
| `#6b665d` sobre `#f4efe2` | 4.99:1 | secundário ≥14px ✔ AA |
| `#8a5a12` sobre `#f4efe2` | 5.16:1 | rótulos mono 11px ✔ |
| `#b52a20` sobre `#f4efe2` | 5.55:1 | rótulos vermelhos pequenos ✔ |
| `#d8352a` sobre `#f4efe2` | 4.13:1 | ⚠ **só ≥24px bold** (AA large) |
| `#e8a33d` sobre `#14110d` | 8.8:1 | rótulo sobre bloco escuro ✔ |
| `#f4efe2` sobre `#d8352a` | 3.7:1 | ⚠ só no botão Confirmar (23px Anton) |

Regra prática: `#d8352a` nunca em texto abaixo de 24px. Use `#b52a20`.

## 3. Regras de mobile (o bug do print)

- **Nenhum `<select>` na linha do nome.** O select "Eu (responsável)" era o que vazava
  para fora da tela a 390px — ele sumiu: o papel do responsável é um rótulo fixo
  (`ADULTO`) no cabeçalho do card, não um campo.
- Todo `input`/`textarea`: `font-size: 16px` (abaixo disso o iOS dá zoom ao focar).
- Todo alvo tocável: **≥44px** de altura. Chips têm `padding: 12px 14px`.
- Página inteira: `max-width: 460px`, centralizada. No desktop vira uma coluna — é o
  comportamento desejado, o convite é peça de celular.

## 4. Estados (7) — prop `estado` no mockup

| Estado | O que aparece |
|---|---|
| `carregando` | "160" pulsando + "abrindo o convite". Tela inteira. |
| `contagem` | Padrão. Hero + countdown + fotos + RSVP aberto. |
| `e-hoje` | Countdown → carimbo vermelho torto "É HOJE!". RSVP ainda aberto. |
| `passou` | Bloco "ACABOU 🍕". RSVP fechado, texto de prazo encerrado. |
| `rsvp-encerrado` | Countdown normal, RSVP substituído por "PRAZO ENCERRADO" + botão WhatsApp. |
| `enviado` | ⚠ **novo** — tela de sucesso com resumo de quem vai + "salvar na agenda". |
| `erro` | "POXA" + botão tentar de novo. Tela inteira. |

Mapeamento para a lógica atual de `main.js`: `contagem`/`e-hoje`/`passou` saem da
comparação com a data; `rsvp-encerrado` sai do `prazo` da config; `enviado` é o
pós-submit; `carregando`/`erro` são o fetch da config.

## 5. Mudanças de UX (⚠ precisam de atenção, não são só CSS)

1. **Bebida e comida viraram uma lista só** ("Vai querer": Água · Refri · Chopp · Pizza).
   Os campos no banco continuam os mesmos (`bebe_agua`, `bebe_refri`, `bebe_chopp`,
   `come_pizza`) — muda só o agrupamento visual.
2. **Adulto/Criança só existe em acompanhante.** O responsável é sempre adulto — o
   convite não é enviado a criança. No card "Você" o tipo é rótulo fixo; nos
   acompanhantes é escolha única (`tipo`).
3. **Tela de sucesso** (`enviado`) é nova. Precisa do resumo do que foi salvo e de um
   link "mudar minha confirmação" que reabre o formulário preenchido.
4. **Contador de pessoas ao vivo** no rodapé do formulário ("3 pessoas").
5. Seção renomeada: "Momentos" → **"Fotos da festa"**, com legenda assumindo que as
   imagens são geradas por IA ("Nenhuma destas fotos aconteceu. Ainda.").
6. Local corrigido em todo lugar: **Salão Grande** (era "Salão 3").

## 6. Preview de link no WhatsApp (novo)

É por onde todo mundo vai receber o convite. Precisa no `<head>` de `index.html`:

```html
<meta property="og:title" content="Festa dos 160 anos — Bruno, Braz e Bocão" />
<meta property="og:description" content="Sáb 31/10 às 11h, Salão Grande. Confirma aí quantos vêm e o que vão querer." />
<meta property="og:image" content="https://…/og-160.png" />  <!-- 1200×630 -->
<meta property="og:url" content="https://…" />
<meta name="twitter:card" content="summary_large_image" />
```

A imagem 1200×630 deve repetir o hero: papel creme, "CENTO E SESSENTA ANOS" em Anton
(vermelho no "ANOS"), e a linha mono `40 + 50 + 70 · 31.10.2026 · 11H`. O mockup tem a
simulação da conversa no fim da página.

## 7. Ordem sugerida de implementação

1. Tokens + fontes + hero (maior ganho visual, menor risco).
2. Seção de fotos e endereço.
3. RSVP — é onde estão as mudanças de UX; rode os testes existentes.
4. Estados `enviado` e `erro`.
5. Meta tags + geração da og:image.

Ao terminar, um screenshot a 390px de cada um dos 7 estados fecha a fatia.
