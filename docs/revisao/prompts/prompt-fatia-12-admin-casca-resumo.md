# Fatia 12 — Admin: casca (abas + roteamento + login) e a aba Resumo

## O fatiamento do admin (o mapa, para contexto)

O pacote de design cobre a superfície inteira. Fatiei por **risco** e por **quando cada tela é
usada**, em 4 fatias:

| Fatia | O quê | Por que aqui |
|---|---|---|
| **12 (esta)** | Casca: abas, roteamento, login + aba **Resumo** | A casca sustenta tudo; casada com a aba de menor risco (só leitura) para provar a navegação com dado real sem arriscar nada |
| 13 | **Quem vem** + **Compras** | As duas telas de leitura sobre os dados; "Quem vem" traz a exclusão (destrutiva) e o conteúdo do convidado (escape) |
| 14 | **Ajustes** + remoção do provisório | São os formulários que você usa **antes** da festa (preços, prazo, fotos) |
| 15 | **Contas** (as 4 fases) | É dinheiro, fica por último sobre uma casca já provada — e só é usada **depois** da festa |

**Regra que vale para as quatro:** o admin está em uso de verdade. Ele **não pode ficar
inutilizável** entre fatias — o que ainda não migrou continua alcançável (ver abaixo).

## Fontes da verdade
- `docs/revisao/design/admin/prompt-design.md` (tokens, contraste medido, estrutura das abas) e o
  mockup `mockups/admin-organizador.html` — **fonte de layout, espaçamento e hierarquia**.
- `FLUXO.md`, seção "A fase de Design": o mockup manda no visual; o CC decide classe, estrutura de
  JS e ordem de commits; **regra de negócio não vem do mockup**.

## Escopo desta fatia
1. **Casca visual + navegação:** barra fixa de 5 abas no rodapé (alvo 58px, rótulo de texto, barra
   azul de 3px na ativa, `env(safe-area-inset-bottom)`), coluna `max-width: 560px`, tokens e fontes
   novas (Space Grotesk + DM Mono). **Nada de Anton** — a tipografia gritada é do convite.
2. **Tela de login** no visual novo (o tweak `tela` do mockup).
3. **Aba Resumo, completa:** confirmados (adultos/crianças), nº de grupos, prazo com barra, "quem
   consome o quê" em barras, recados e restrições — a partir do que hoje alimenta `#stats` e
   `estContagens`. Só leitura.
4. **Área provisória para o que ainda não migrou:** as seções atuais (Quem vem, Compras, Contas,
   Ajustes) continuam acessíveis e funcionais dentro das abas correspondentes, ainda com o markup
   `<details>` de hoje se for o caso. Feio é aceitável; quebrado não é. Sai na Fatia 14.
5. **Estado da aba na recarga:** proponha no plano (sugestão: hash `#resumo`, que sobrevive ao
   reload e permite favoritar). Decisão sua, justifique.

## Fora de escopo
`js/calculo.js` (o design diz explicitamente que não muda), `index.html`/`js/main.js`, schema,
RLS, e o conteúdo das abas 13/14/15 além de mantê-las funcionais.

## Riscos que quero endereçados no plano

**1. A guarda de completude.** `recomputar()` só calcula com `ultimaConfig` + `ultimasPessoas` +
`ultimosGrupos` juntos — foi assim que a Fatia 4 matou uma corrida real. Se as abas passarem a
carregar sob demanda, essa guarda **não pode** virar "calcula com o que tiver". Diga no plano como
fica o carregamento com abas.

**2. Modo escuro — a armadilha da Fatia 9, agora do outro lado.** Hoje o admin **usa** o
`@media (prefers-color-scheme: dark)` do `:root` (a verificação da Fatia 11 mediu input
`rgb(30,24,48)` no escuro). A paleta nova do design é clara. Decida e diga no plano: o admin
mantém modo escuro (e aí faltam tokens escuros no pacote — é pergunta para o Design) **ou** passa a
ser claro em qualquer esquema, e nesse caso **remapear as variáveis globais dentro do escopo do
admin**, no primeiro commit, como asserção da verificação. Não pode ficar meio a meio.

**3. Não vazar para o convite.** É o inverso da trava da Fatia 9: o restyle do admin não pode
alterar o que `.pagina-convite` renderiza. Asserção nos dois sentidos.

**4. `update` estreito continua valendo.** A `config` é escrita por telas diferentes (Ajustes:
preços/taxas/prazo; Contas: `custo_real_*`/`pago_por_*`). Nenhuma tela pode mandar objeto amplo —
um `update` largo do Ajustes zeraria o fechamento. Vale desde já, e é lei nas fatias 14 e 15.

## Verify
- `./verify.sh` verde.
- **Não-regressão do que já funciona** (o admin está em uso, com dados reais do Bruno), com saída
  crua: preços/taxas/prazo continuam editáveis e salvando; aniversariantes idem; fotos idem;
  estimativa e rateio continuam calculando certo. Nada de "está lá, não testei".
- **Guarda de completude:** provar que nenhuma tela calcula com estado parcial (o teste da Fatia 4).
- **Modo escuro:** conforme a decisão do item 2, medido com `getComputedStyle` nos dois esquemas.
- **Convite intacto:** `index.html` renderiza igual (a pele do convite não pode mudar).
- **Screenshots a 390px** da casca, do login e da aba Resumo — e um do desktop, para conferir a
  coluna de 560px.
- **Dado do Bruno preservado** ao fim (prazo 01/10/2026 23:59 SP, preços, os 3 aniversariantes, fotos).

## Dívida que fica registrada (não é desta fatia)
- O `verify.sh` **não tem asserção de fuso** — os dois bugs dessa família (Fatia 7 e Fatia 11)
  foram achados por inspeção. Quero isso resolvido até a Fatia 15; se couber barato na 12, melhor.
- Inputs `email`, `password`, `date` e `url` do painel não são cobertos pelo seletor atual e ficam
  com o visual padrão do navegador — o redesign resolve, mas cite em qual fatia cai.
- As `<meta>` de `og:` do convite são escritas à mão e não seguem o painel: se o Bruno mudar data ou
  local em Ajustes, o preview do WhatsApp mente. Registrar um aviso na tela de Ajustes (Fatia 14).
