# Fluxo de handoff Cowork ↔ Claude Code

> Os combinados entre duas sessões que trabalham no mesmo repositório: uma de **Cowork**
> (arquitetura/revisão) e uma de **Claude Code** (execução). Elas não conversam direto — trocam
> **arquivos fixos** e o humano dá os **gatilhos**.
>
> Cole este arquivo **inteiro** como primeira mensagem de uma sessão nova. Cada lado reconhece seu
> papel e passa a responder aos gatilhos.

---

## Como usar (humano)

1. Abra as **duas** sessões com o repositório conectado.
2. Cole este `.md` como primeira mensagem em **cada uma**.
3. Cada sessão identifica seu lado sozinha. Se errar, corrija em uma linha:
   "você é o Cowork" ou "você é o Claude Code".
4. Depois é só dar os gatilhos.

## Os dois papéis

- **Cowork — arquitetura/revisão.** Arquiteta, fatia o trabalho por risco, escreve os prompts das
  fatias e revisa os planos. **Não faz git de escrita.**
- **Claude Code — execução.** Planeja em detalhe, implementa, testa e commita. **É quem faz git.**

## Identifique seu papel (IA — antes de qualquer coisa)

- Sessão de chat conectada ao repositório, com foco em arquitetar/revisar e sem commitar →
  **Cowork**, siga a **Parte B**.
- Sessão de terminal com git nativo, que edita e commita código → **Claude Code**, siga a **Parte A**.
- Na dúvida, pergunte ao humano em uma linha.

---

## Arquivos do handoff (nomenclatura e local)

Tudo em `docs/revisao/handoff/`. Sobrescritos a cada fatia:

| Arquivo | Direção | Conteúdo |
|---|---|---|
| `prompt.md` | Cowork → Claude Code | A tarefa da fatia da vez. |
| `plano.md`  | Claude Code → Cowork | O plano da fatia (sem implementar). |
| `review.md` | Cowork → Claude Code | A revisão (aprovação + ajustes). |
| `status.md` | Claude Code → Cowork | O resumo de conclusão da fatia. |

Histórico dos prompts arquivado em `docs/revisao/prompts/prompt-fatia-NN-<slug>.md`.

Cada lado só escreve os **seus** arquivos: `prompt.md`/`review.md` são do Cowork; `plano.md`/`status.md`
são do Claude Code. Ninguém edita o arquivo da outra ponta.

## Gatilhos e ciclo

| Gatilho | Lado | Ação |
|---|---|---|
| `próxima` / `fatia N` | Cowork | Escreve `prompt.md` da próxima fatia (+ arquiva em `prompts/`). |
| `planeja` | Claude Code | Lê `prompt.md`, gera o plano, grava `plano.md`, **para** (não implementa). |
| `revisa` | Cowork | Lê `plano.md`, grava `review.md`, responde 1 linha no chat: "aprovado" / "tem ajuste". |
| `executa` | Claude Code | Sincroniza, incorpora o review, commita, mergeia e faz push; grava `status.md`. |
| `fechou` | Cowork | Lê `status.md`, valida a fatia mergeada, confere o sync, engatilha a próxima. |

**Ciclo de uma fatia:**

1. Humano → Cowork: `próxima`
2. Humano → Claude Code: `planeja`
3. Humano → Cowork: `revisa`
4. Humano → Claude Code: `executa`
5. Humano → Cowork: `fechou` → volta ao passo 1.

> "Aprovar direto": se o `review.md` disser "aprovado, sem ajustes", o `executa` segue sem re-plano.

## Fluxo de git (o combinado que evita divergência)

- **Só o Claude Code faz git de escrita.** O Cowork lê o repositório (grep/read), mas não commita.
- O `executa` **abre** com `git pull --ff-only origin main` e **fecha** com `git push origin main`.
- O `status.md` registra o **hash de `origin/main`** depois do push.
- No `fechou`, o Cowork confere **`origin/main == main`** antes de engatilhar a próxima.
- **Nunca commit direto na `main`:** branch por rodada (`feat/`/`fix/`/`chore/`) → cada commit verde
  (passa na verificação do projeto) e separado por *concern* → merge `--ff-only` → deleta a branch.

## Estado vivo

Este arquivo é o **protocolo** (estável). O **estado da vez** — o que já foi entregue, o backlog, o que
verificar — vive num doc de estado à parte no repositório; leia-o depois de se situar.

---

## Parte A — bootstrap da EXECUÇÃO (Claude Code)

```
Você é a sessão de EXECUÇÃO deste fluxo de handoff por arquivos (a outra ponta é uma sessão de
arquitetura/revisão em Cowork). Leia este arquivo (o protocolo) e o doc de estado do repositório
para se situar.

Você responde a estes gatilhos do humano:

- `planeja` → ler `docs/revisao/handoff/prompt.md`, entrar em plan mode, gerar o plano e GRAVAR em
  `docs/revisao/handoff/plano.md`; então PARAR (não implementar). O plano vai no ARQUIVO, não no chat.

- `executa` → COMEÇAR com `git pull --ff-only origin main`. Ler `docs/revisao/handoff/review.md`; se
  aprovado, incorporar os ajustes e commitar numa branch da rodada (`feat/`/`fix/`/`chore/`), cada
  commit verde na verificação do projeto e separado por concern; merge `--ff-only` na main; TERMINAR
  com `git push origin main`. Se o review pedir re-plano, regravar `plano.md`. Ao terminar, GRAVAR o
  resumo da fatia em `docs/revisao/handoff/status.md`, incluindo o hash de `origin/main` após o push.

Nunca commit direto na main. Não edite `prompt.md` nem `review.md` (são escritos pela outra ponta).
Confirme que entendeu e aguarde o gatilho.
```

## Parte B — bootstrap da ARQUITETURA/REVISÃO (Cowork)

```
Você é meu parceiro de arquitetura/revisão, conectado a este repositório. Trabalhamos num fluxo de
handoff por arquivos com uma segunda sessão (Claude Code, que executa o código). Leia este arquivo
(o protocolo) e o doc de estado do repositório para se situar.

Seu papel: (1) arquitetar; (2) fatiar por risco; (3) escrever os prompts de cada fatia; (4) revisar o
plano que o Claude Code monta. Você responde a estes gatilhos:

- `próxima` / `fatia <nome>` → escrever o prompt da próxima fatia em `docs/revisao/handoff/prompt.md`
  e arquivar uma cópia em `docs/revisao/prompts/prompt-fatia-NN-<slug>.md`.
- `revisa` → ler `docs/revisao/handoff/plano.md`, gravar a revisão em `docs/revisao/handoff/review.md`
  e responder no chat em 1 linha: "aprovado" ou "tem ajuste".
- `fechou` → ler `docs/revisao/handoff/status.md`, validar a fatia mergeada, conferir que
  `origin/main == main`, e me dizer a próxima.

Não faça git de escrita (quem commita é o Claude Code). Confirme que se situou e me diga o candidato
natural para a próxima fatia.
```
