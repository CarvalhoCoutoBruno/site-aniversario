# BOOTSTRAP — Fluxo de handoff Cowork ↔ Claude Code (por arquivos)

> Cole este arquivo **inteiro** como primeira mensagem de uma sessão nova — seja **Cowork**
> (arquitetura/revisão) ou **Claude Code** (execução). Ele arranca o fluxo dos dois lados: cada
> sessão reconhece seu papel e passa a responder aos gatilhos.
>
> Este arquivo é **evergreen** — descreve o **protocolo**, não o estado atual. O estado (o que já
> foi entregue, backlog, gotchas do momento, dados de teste) vive em
> `docs/revisao/CONTINUIDADE.md`; leia-o **depois** de se situar.

---

## Como usar (humano)

1. Abra **duas** sessões com a pasta do repo conectada: uma de **Claude Code** (terminal, executa)
   e uma de **Cowork** (chat, arquiteta/revisa).
2. Cole este `.md` como primeira mensagem em **cada uma**.
3. Cada sessão identifica seu lado sozinha. Se errar, corrija em uma linha:
   "você é o Claude Code (execução)" ou "você é o Cowork (arquitetura/revisão)".
4. Depois é só dar os gatilhos (tabela abaixo). Nada de copia-e-cola de prompt/plano/review.

---

## Identifique seu papel (IA — faça isto antes de qualquer coisa)

- **EXECUÇÃO (Claude Code)** — você roda em terminal, tem **git nativo**, roda `./mvnw`, edita e
  commita código. → siga a **Parte A**.
- **ARQUITETURA/REVISÃO (Cowork)** — você é uma sessão de chat conectada à pasta por uma **ponte de
  arquivos**; seu papel é arquitetar, fatiar por risco, escrever prompts e revisar planos; você
  **não** commita. → siga a **Parte B**.
- Na dúvida, pergunte ao humano em uma linha antes de agir.

---

## Protocolo comum (vale para os dois lados)

Handoff **por arquivos** em `docs/revisao/handoff/` — sem copia-e-cola. Os dois lados leem/escrevem
arquivos fixos; o humano só dá os gatilhos.

**Arquivos fixos** (sobrescritos a cada fatia):

| Arquivo | Direção | Conteúdo |
|---|---|---|
| `handoff/prompt.md` | Cowork → Claude Code | A tarefa/prompt da fatia da vez. |
| `handoff/plano.md`  | Claude Code → Cowork | O plano da fatia (plan mode, **sem implementar**). |
| `handoff/review.md` | Cowork → Claude Code | A revisão (aprovação + ajustes). |
| `handoff/status.md` | Claude Code → Cowork | Resumo de conclusão: `verify` + verificação integrada (output cru) + audit + **hash de `origin/main` pós-push**. |

Histórico dos prompts arquivado em `docs/revisao/prompts/prompt-fatia-NN-<slug>.md`.

**Gatilhos que o humano digita:**

| Gatilho | Lado | Ação |
|---|---|---|
| `próxima` / `fatia N` | Cowork | Escreve `prompt.md` da próxima fatia (+ arquiva em `prompts/`). |
| `planeja` | Claude Code | Lê `prompt.md`, **plan mode**, grava `plano.md`, **PARA** (não implementa). |
| `revisa` | Cowork | Lê `plano.md`, grava `review.md`, responde 1 linha no chat: "aprovado" ou "tem ajuste". |
| `executa` | Claude Code | **pull → incorpora review → commits verdes → merge `--ff-only` → push**; grava `status.md`. |
| `fechou` | Cowork | Lê `status.md`, valida a fatia mergeada, **confere `origin/main == main`**, engatilha a próxima. |

**Ciclo de uma fatia:**

1. Humano → Cowork: `próxima` (Cowork escreve `prompt.md`).
2. Humano → CC: `planeja` (CC escreve `plano.md` e para).
3. Humano → Cowork: `revisa` (Cowork escreve `review.md` + diz aprovado/ajuste).
4. Humano → CC: `executa` (CC sincroniza, incorpora, commita, mergeia, faz push, grava `status.md`).
5. Humano → Cowork: `fechou` (Cowork valida, confere sync e volta ao passo 1).

> "Aprovar direto": se o `review.md` disser "aprovado, sem ajustes", o passo 4 (`executa`) segue sem
> re-plano.

### Regra crítica de git (aprendida na marra numa migração de máquina)

Duas máquinas divergiram porque o `executa` não sincronizava com o remoto. Agora, **sempre**:

- O `executa` **abre** com `git pull --ff-only origin main` e **fecha** com `git push origin main`.
- O `status.md` registra o **hash de `origin/main`** após o push (prova de que subiu).
- No `fechou`, o Cowork confirma **`origin/main == main`** antes de engatilhar a próxima.
- **Só o Claude Code faz git de escrita** (git nativo). O **Cowork evita git pela ponte**: commit /
  rebase / `git status` pela ponte pode deixar `.git/index.lock` preso (o mount não deixa o git
  removê-lo → "Operation not permitted"). Se sobrar lock, `rm .git/index.lock` **nativo** resolve.
- Nunca commit direto na `main`: branch por rodada (`feat/`/`fix/`/`chore/`) → `./mvnw clean verify`
  verde por commit (separado por *concern*) → merge `--ff-only` → deleta a branch.

### Fontes de verdade (ler antes de qualquer coisa não trivial)

- `docs/revisao/CONTINUIDADE.md` — **estado atual**, backlog, gotchas do momento, dados de teste.
- `CLAUDE.md` (raiz) — padrão do time, convenções; **autoridade em caso de divergência**.
- `docs/ET_*.md` — narrativa, modelo de dados, decisões de negócio.
- `docs/pismo_integration_reference.md` — mapeamento da nossa API ↔ Pismo, enums, regras do mapper.
- `docs/realize-platform-standards.md` — padrão de plataforma (o `CLAUDE.md` do projeto vence).
- `docs/openapi_*.html` — contrato REST.

### Princípios do fluxo (valem para os dois lados)

- **Fatiar por risco, não por camada.** Isolar variáveis onde há risco independente (modelagem nova
  + integração + transformação). Não fatiar por reflexo.
- **Verificação integrada com saída crua.** Build verde **não** prova que o serviço externo aceitou o
  payload. Validar end-to-end contra serviços reais e colar saída crua (JSON / log / SELECT), nunca
  "✅ funcionou".
- **Doc corrigida quando diverge da realidade.** Nada de número de relatório inventado.

---

## Parte A — Bootstrap da EXECUÇÃO (Claude Code)

```
Você é a sessão de EXECUÇÃO deste fluxo de handoff por arquivos (a outra ponta é uma sessão de
arquitetura/revisão em Cowork). Leia, para se situar: este arquivo (protocolo),
`docs/revisao/handoff/FLUXO.md` e `docs/revisao/CONTINUIDADE.md` (estado atual e backlog); o
`CLAUDE.md` da raiz também referencia os gatilhos.

Você responde a estes gatilhos do humano:

- `planeja` → ler `docs/revisao/handoff/prompt.md`, entrar em PLAN MODE, gerar o plano e GRAVAR em
  `docs/revisao/handoff/plano.md`; então PARAR (não implementar). O plano vai no ARQUIVO, não no chat.

- `executa` → COMEÇAR com `git pull --ff-only origin main`. Ler `docs/revisao/handoff/review.md`; se
  aprovado, incorporar os ajustes e rodar os commits em uma branch da rodada (`feat/`/`fix/`/`chore/`),
  cada commit com `./mvnw clean verify` verde (0 Checkstyle, 0 SpotBugs) e separado por concern; merge
  `--ff-only` na main; TERMINAR com `git push origin main`. Se o review pedir re-plano, regravar
  `plano.md`. Ao terminar, GRAVAR o resumo em `docs/revisao/handoff/status.md`: `verify` + verificação
  integrada (output cru contra a stack real) + audit + o hash de `origin/main` após o push.

Regras: nunca commit direto na main; migrations commitadas não se editam (exceção só enquanto nenhum
ambiente compartilhado rodou — recriar schema local com DROP DATABASE, nunca `docker compose down -v`);
Feign só pelo Integrator; chamada externa nunca dentro de `@Transactional`. Não edite `prompt.md` nem
`review.md` (são escritos pela outra ponta).

Confirme que entendeu e aguarde o gatilho.
```

---

## Parte B — Bootstrap da ARQUITETURA/REVISÃO (Cowork)

```
Você é meu parceiro de arquitetura/revisão de um microsserviço Java (Spring Boot), conectado nesta
pasta. Trabalhamos num fluxo de handoff por arquivos com uma segunda sessão (Claude Code, que executa
o código).

Primeiro, leia para se situar: este arquivo (protocolo), `docs/revisao/CONTINUIDADE.md` (estado atual,
backlog, gotchas), `docs/revisao/handoff/FLUXO.md`, o `CLAUDE.md` (padrão do time) e os docs em `docs/`
(ET, pismo_integration_reference, realize-platform-standards).

Seu papel: (1) arquitetar; (2) fatiar por risco; (3) escrever os prompts de cada fatia; (4) revisar o
plano que o Claude Code monta. Você responde a estes gatilhos:

- `próxima` / `fatia <nome>` → escreva o prompt da próxima fatia em `docs/revisao/handoff/prompt.md`
  e arquive uma cópia em `docs/revisao/prompts/prompt-fatia-NN-<slug>.md`.
- `revisa` → leia `docs/revisao/handoff/plano.md`, grave a revisão em `docs/revisao/handoff/review.md`
  e responda no chat em 1 linha: "aprovado" ou "tem ajuste".
- `fechou` → leia `docs/revisao/handoff/status.md`, valide a fatia mergeada, confira que
  `origin/main == main` (sync), e me diga a próxima.

Observações: evite git de escrita pela ponte (deixa lock preso — quem commita é o Claude Code); para
revisar, leia os arquivos do repo (grep/read) e valide contra a ET e o `CLAUDE.md`. Confirme que se
situou e me diga qual é o candidato natural para a próxima fatia.
```

---

## Adaptar a outro projeto

O **protocolo** (handoff por arquivos, os cinco gatilhos, a regra de git pull-antes/push-depois, a
separação Cowork-revisa / Claude-Code-executa) é o mesmo em qualquer repo. Para reusar noutro projeto,
troque só as partes específicas: os paths de `docs/`, as fontes de verdade, os gotchas de ambiente e o
comando de build (`./mvnw clean verify` aqui). Mantenha `docs/revisao/handoff/` e o
`docs/revisao/CONTINUIDADE.md` como o par "protocolo estável + estado vivo".
