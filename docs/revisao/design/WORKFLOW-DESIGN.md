# Parte C — DESIGN (adaptação do fluxo de handoff)

> Complemento ao `WORKFLOW.md`. Não substitui nada: Cowork segue com `próxima`/`revisa`/`fechou`,
> Claude Code segue com `planeja`/`executa`. Isto acrescenta a terceira ponta.

---

## A diferença que muda o fluxo

**A sessão de Design não tem git.** Ela lê o repositório (GitHub, somente leitura) e produz
mockups e prompts, mas **não escreve em `docs/`**. Os arquivos saem da sessão e o humano os
leva para o repo — ou pede ao Claude Code que os grave.

Consequência prática: onde o Cowork *grava* `prompt.md`, o Design *entrega* o conteúdo e o
humano cola. Um passo manual a mais, uma vez por fatia.

## Papéis, agora três

- **Cowork** — arquitetura, risco, fatiamento, revisão de plano. Não commita.
- **Claude Code** — planeja, implementa, testa, commita. É quem faz git.
- **Design** — direção visual, mockups navegáveis, especificação de UI, revisão de fidelidade.
  Não commita, não decide arquitetura.

Fronteira entre Cowork e Design: **o Cowork decide o que construir e em que ordem; o Design
decide como aquilo se parece e se comporta.** Quando os dois têm opinião sobre a mesma coisa
(ex.: quebrar uma tela em duas), quem decide é o Cowork — o Design argumenta, não veta.

## Arquivos

Em `docs/revisao/design/`:

| Arquivo | Direção | Conteúdo |
|---|---|---|
| `prompt-design.md` | Design → Claude Code | Especificação visual da fatia: tokens, contraste medido, estados, regras de mobile, o que é ⚠ mudança de comportamento. |
| `review-design.md` | Design → Claude Code | Revisão de fidelidade depois do `executa`. |
| `BRIEFING.md` | Claude Code → Design | O contexto do projeto para uma sessão de design nova. Escrito uma vez, atualizado quando o produto muda. |

Mockups navegáveis ficam na sessão de design (não no repo). Quando um mockup precisa ser
lido pelo Claude Code, o Design exporta uma versão HTML autônoma e o humano commita em
`docs/revisao/design/mockups/`.

O `prompt-design.md` **não substitui** o `prompt.md` do Cowork: um diz o que fazer e com que
risco, o outro diz como deve ficar. Numa fatia de UI, o `planeja` lê os dois.

## Gatilhos do Design

| Gatilho | Ação |
|---|---|
| `desenha <fatia>` | Explora e entrega o mockup + o conteúdo de `prompt-design.md`. Se a fatia for ambígua, faz perguntas antes. |
| `variações <aspecto>` | 2–3 direções lado a lado, com ids (`1a`, `1b`, `1c`) para você escolher no chat. |
| `revisa design` | Depois do `executa`: lê o código no repo, compara com o mockup, entrega `review-design.md` com as divergências. |
| `fechou` | Registra a fatia como encerrada e diz qual é a próxima peça de UI. |

## Ciclo de uma fatia de UI

1. Humano → Design: `desenha <fatia>` → escolhe direção, recebe `prompt-design.md`
2. Humano commita `prompt-design.md` (ou pede ao Claude Code)
3. Humano → Cowork: `próxima` → `prompt.md` (referenciando o design)
4. Humano → Claude Code: `planeja`
5. Humano → Cowork: `revisa`
6. Humano → Claude Code: `executa`
7. Humano → Design: `revisa design` → `review-design.md`
8. Ajustes entram na fatia seguinte, ou viram um `executa` curto
9. Humano → Cowork: `fechou`

Fatia sem UI pula 1, 2 e 7 — o fluxo original, intacto.

## O que o Design decide sozinho

Espaçamento, escala tipográfica, cor, hierarquia, microcópia, estados de vazio/erro/carregando,
comportamento de toque e o que cabe em cada tela.

## O que volta para o humano

Mudança de escopo, campo novo no banco, alteração de regra de negócio, qualquer coisa que
mude o que o convidado precisa responder.

## O que o Claude Code decide sozinho

Nomes de classe, estrutura do JS, como quebra as funções, ordem dos commits.

**O que ele NÃO improvisa:** espaçamento, cor, tamanho de fonte, hierarquia. Se o mockup não
cobre um caso, pergunta — não inventa. Divergência sem pergunta vira item no `review-design.md`.

---

## Bootstrap da sessão de DESIGN

```
Você é a sessão de DESIGN deste fluxo de handoff. As outras pontas são uma sessão de
arquitetura/revisão (Cowork) e uma de execução (Claude Code, que commita). Leia o
WORKFLOW.md, esta Parte C e o BRIEFING.md do repositório para se situar.

Você não tem git: lê o repositório, mas entrega arquivos pelo chat para eu commitar.

Seu papel: direção visual, mockups navegáveis, especificação de UI e revisão de fidelidade.
Você responde a estes gatilhos:

- `desenha <fatia>` → explorar e entregar o mockup + o conteúdo de `prompt-design.md`
  (tokens, contraste medido, estados, regras de mobile, ⚠ nas mudanças de comportamento).
  Se a fatia for ambígua, pergunte antes de desenhar.
- `variações <aspecto>` → 2–3 direções lado a lado, com ids para eu escolher.
- `revisa design` → ler o código implementado no repo, comparar com o mockup e entregar
  `review-design.md` com as divergências.
- `fechou` → registrar a fatia e apontar a próxima peça de UI.

Não decida arquitetura (é do Cowork) e não invente valores fora do mockup. Confirme que se
situou e me diga qual é a próxima peça de UI candidata.
```
