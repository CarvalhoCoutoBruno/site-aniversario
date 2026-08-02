# FLUXO — o que o protocolo deixa em aberto neste repositório

> O protocolo está em [WORKFLOW.md](../WORKFLOW.md) e é **estável**: vale em qualquer repo.
> Aqui ficam só as decisões que ele delega ao projeto — o que é "commit verde", o que
> é fonte da verdade, e o que o push provoca.
>
> O estado da vez (entregue, backlog, gotchas) está em [CONTINUIDADE.md](../CONTINUIDADE.md).

## O que é "commit verde": `./verify.sh`

O protocolo pede que cada commit passe "na verificação do projeto". Aqui isso é:

```bash
./verify.sh
```

Cobre sintaxe dos 4 arquivos JS, as 41 asserções de `tests/calculo.test.js`, credencial vazada, e dois invariantes de coerência: placeholder por preencher (`COLE_A_*`, `<UID_DO_ADMIN>`) e `main.js` voltar a inserir direto na tabela em vez de usar o RPC.

### O que ele NÃO prova

Que o formulário grava no Supabase, que a RLS barra o anon, que o painel renderiza. **Verde no `verify.sh` não é entrega verificada** — é só a parte que roda sem navegador e sem banco.

Toda fatia que mexe em tela ou em dado precisa da verificação integrada: dirigir a página de verdade e conferir o resultado **no banco**, com saída crua no `status.md`. Nada de "✅ funcionou".

### Como rodar a verificação integrada

O sandbox **impede servir de `~/Documents`** (`EPERM` no `getcwd`/`open`, tanto Python quanto Ruby). O caminho que funciona:

1. `cp -R index.html admin.html css js "$SCRATCHPAD/site/"`
2. `.claude/launch.json` apontando o `ruby -run -e httpd` para **essa** cópia
3. `preview_start` → dirigir a página → conferir o resultado **no banco**

Para a área autenticada, sem tocar na senha do organizador: criar usuário temporário em `auth.users` (com `crypt(...)`), inserir em `admins`, testar e **apagar os dois**. O GoTrue recusa o login se `confirmation_token`, `recovery_token`, `email_change_token_new` ou `email_change` estiverem `NULL` — precisam ser `''`.

Acesso ao banco: `pg8000` num venv descartável no scratchpad (não há `psql` nem Docker rodando). A senha do Postgres **nunca** vai para arquivo — só variável de ambiente por comando.

## Schema: recriar, não migrar

Decisão registrada na ET: **não há migrations de errata**. Quando o modelo muda, corrige-se o `supabase-setup.sql` e recria-se do zero. O arquivo é a fonte da verdade, não um histórico.

O que torna isso seguro é o bloco de RESET no topo, que **aborta se `rsvps` tiver qualquer linha**. `admins` e `is_admin()` sobrevivem ao reset de propósito.

> Vale enquanto o projeto é pré-lançamento. Depois que o link for divulgado e chegarem confirmações reais, a trava vira a única coisa entre um `Run` distraído e a perda dos dados — e mudança de schema volta a exigir cuidado manual.

## Push publica

GitHub Pages atualiza o site em 1-2 min a cada push na `main`. O `executa` termina em push, então **não se publica com o site quebrado**: se a fatia deixar o convite ou o painel sem funcionar, termina-se antes, ou avisa-se e a decisão é do Bruno.

Já aconteceu entre a Fatia 0 e a 1: o schema novo estava no ar mas o `main.js` ainda mandava o payload antigo, e publicar naquele momento teria quebrado o RSVP para todo convidado.

## Convenções deste repo

- Branch por rodada: `feat/`, `fix/` ou `chore/` + a fatia (ex.: `feat/fatia-2-config`), apagada após o merge.
- Nada de framework nem passo de build — todo JS novo entra por `<script>`, na ordem certa.
- Dinheiro em centavos, sempre; o rateio roda em aritmética inteira.

## Fontes da verdade

| Arquivo | O quê |
|---|---|
| [CONTINUIDADE.md](../CONTINUIDADE.md) | estado atual, backlog, gotchas |
| [REGRAS-NEGOCIO.md](../../REGRAS-NEGOCIO.md) | o "o quê" — regra de negócio, versionada (v5) |
| [ESPECIFICACAO-TECNICA.md](../../ESPECIFICACAO-TECNICA.md) | o "como" — schema, RPCs, RLS, cálculo |
| `supabase-setup.sql` | o schema real |

Divergiu? **A regra de negócio vence** e a ET é corrigida. Não existe `CLAUDE.md` neste repo; se um dia existir, passa a ser a autoridade sobre convenção.
