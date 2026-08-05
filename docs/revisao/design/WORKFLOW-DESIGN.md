# Parte C — DESIGN como fase, não como ponto do ciclo

> Complemento ao `WORKFLOW.md`. Não altera nada do que já existe: Cowork segue com
> `próxima`/`revisa`/`fechou`, Claude Code segue com `planeja`/`executa`.

---

## Por que Design não entra no ciclo

A primeira versão desta Parte C punha o Design como uma terceira ponta do loop, entregando um
`prompt-design.md` por fatia, em paralelo ao Cowork. Está errado, por dois motivos.

**O trabalho de design não é fatiável pelo mesmo critério.** O ciclo Cowork↔CC fatia por
risco técnico. Design fatia por *superfície*: uma tela, um fluxo, um sistema visual. As duas
grades não coincidem — o convite é uma fatia de design e três de execução.

**O design depende de aprovação humana, não de arquivo.** Os outros dois gatilhos são
determinísticos: `planeja` lê um arquivo e produz outro. `desenha` não: envolve perguntas,
variações lado a lado, "não gostei disso", redirecionamento. É conversa, e conversa não cabe
num slot de arquivo sobrescrito a cada rodada.

**Design é a montante.** Ele ocupa o lugar de UX + negócio: define o que o produto é, o que o
convidado responde, o que o organizador precisa ver. TI — Cowork e CC — se vira para atender.
A diferença em relação a um documento de requisitos comum é que aqui a entrega não é abstrata:
vem com mockup navegável, valores medidos e estados desenhados.

## O lugar do Design

```
   ┌─────────────────────────────────┐
   │  FASE DE DESIGN                 │   humano ↔ design, quantas
   │  perguntas → variações →        │   voltas forem necessárias
   │  aprovação → especificação      │
   └──────────────┬──────────────────┘
                  │  entrega fechada (o pacote abaixo)
                  ▼
   ┌─────────────────────────────────┐
   │  CICLO COWORK ↔ CLAUDE CODE     │   próxima → planeja → revisa
   │  (WORKFLOW.md, intacto)         │   → executa → fechou, N vezes
   └──────────────┬──────────────────┘
                  │  ao fim da superfície
                  ▼
        conferência de fidelidade (opcional)
```

A fase de design **fecha antes** de o ciclo começar. Enquanto ela está aberta, o CC trabalha
em outra coisa — backend, dados, infra. Nada de UI entra no ciclo com design em aberto.

## A entrega da fase de design

Um pacote por superfície, em `docs/revisao/design/<superfície>/`:

| Arquivo | Conteúdo |
|---|---|
| `prompt-design.md` | Tokens, contraste medido, estados, regras de mobile, ⚠ nos itens que são comportamento e não estilo. |
| `mockups/*.html` | Mockup autônomo, abre no navegador sem servidor. É a fonte de layout, espaçamento e hierarquia. |
| `assets/*` | Imagens que o código precisa e não sabe gerar (og:image, ícones, ilustrações). |

Nomes descritivos por superfície (`convite/`, `admin/`), **nunca** um slot fixo sobrescrito —
duas superfícies na fila se atropelariam. Isto é diferente do `prompt.md` do ciclo, que é
efêmero de propósito.

O pacote é entregue pelo chat e commitado pelo humano ou pelo CC. **A sessão de design não tem
git** — lê o repositório, não escreve nele.

## O que o Cowork faz com o pacote

Fatia normalmente, por risco, como sempre fez. O `prompt.md` de cada fatia de UI referencia o
pacote de design em vez de repetir seu conteúdo. O par continua sendo `prompt.md` + `plano.md`;
o pacote de design é contexto de leitura para os dois.

## O que o Claude Code decide sozinho

Nomes de classe, estrutura do JS, ordem dos commits, como quebra as funções.

**O que ele não improvisa:** espaçamento, cor, tamanho de fonte, hierarquia. Se o mockup não
cobre um caso, pergunta ao humano — que leva à sessão de design se for preciso.

## Conferência de fidelidade

Ao fim da superfície (não de cada fatia), o humano pode pedir à sessão de design que leia o
código implementado e aponte divergências. Sai como uma lista no chat; vira `prompt.md` de uma
fatia de acabamento, se valer a pena. É opcional e não bloqueia o `fechou`.

## Gatilhos da sessão de design

Conversacionais, não determinísticos — a fase termina quando o humano diz que terminou.

| Gatilho | Ação |
|---|---|
| `desenha <superfície>` | Faz perguntas, explora, entrega mockup + especificação. |
| `variações <aspecto>` | 2–3 direções lado a lado, com ids (`1a`, `1b`…) para escolher no chat. |
| `fecha <superfície>` | Consolida o pacote final para commit. |
| `confere <superfície>` | Lê o código implementado e lista divergências. |

---

## Bootstrap da sessão de DESIGN

```
Você é a sessão de DESIGN deste projeto. Ela não participa do ciclo de fatias — é a fase que
vem ANTES dele. As outras pontas são uma sessão de arquitetura/revisão (Cowork) e uma de
execução (Claude Code, que commita). Leia o WORKFLOW.md, esta Parte C e o BRIEFING.md do
repositório para se situar.

Você não tem git: lê o repositório, mas entrega arquivos pelo chat para eu commitar.

Seu papel é o de UX + negócio: definir o que o produto é, como se parece e como se comporta.
Trabalhamos por SUPERFÍCIE (uma tela ou fluxo inteiro), não por fatia de execução. A fase
fecha com um pacote em docs/revisao/design/<superfície>/: prompt-design.md (tokens, contraste
medido, estados, regras de mobile, ⚠ no que é comportamento e não estilo), mockups/*.html
autônomos e os assets que o código não sabe gerar.

Gatilhos: `desenha <superfície>`, `variações <aspecto>`, `fecha <superfície>`,
`confere <superfície>`.

Pergunte à vontade antes de desenhar — decisão de look and feel é minha, e prefiro escolher
entre opções concretas a descrever no abstrato. Confirme que se situou e me diga qual
superfície é a candidata natural.
```
