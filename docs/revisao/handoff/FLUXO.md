# FLUXO — adaptação do protocolo a este repositório

> O protocolo geral está em [WORKFLOW.md](../WORKFLOW.md) e é **evergreen**.
> Este arquivo registra só o que muda **neste projeto**, porque o WORKFLOW original
> foi escrito para um microsserviço Java/Maven.
> O estado vivo (o que já foi entregue, backlog, gotchas) está em
> [CONTINUIDADE.md](../CONTINUIDADE.md).

## O que substitui o quê

| No protocolo (Java) | Aqui |
|---|---|
| `./mvnw clean verify` | **`./verify.sh`** |
| 0 Checkstyle, 0 SpotBugs | 0 erro de sintaxe, suite de cálculo verde, higiene de credencial |
| Migrations commitadas não se editam | **`supabase-setup.sql` é fonte da verdade e se reescreve** (ver abaixo) |
| Feign só pelo Integrator | escrita anônima **só** via RPC `criar_rsvp` |
| Chamada externa fora de `@Transactional` | insert de grupo + pessoas **atômico** dentro do RPC |

## `./verify.sh` — e o que ele NÃO prova

Cobre sintaxe dos 4 arquivos JS, as 41 asserções de `tests/calculo.test.js`, credencial vazada e dois invariantes de coerência (placeholder no config/SQL, e `main.js` não voltar a inserir direto na tabela).

**Não** cobre: formulário gravando no Supabase, RLS barrando o anon, painel renderizando. Isso é a *verificação integrada* do protocolo — navegador + banco real, com **saída crua** colada no `status.md`. Verde no `verify.sh` não dispensa.

### Como rodar a verificação integrada

O sandbox **impede servir de `~/Documents`** (`EPERM` no `getcwd`/`open`, tanto Python quanto Ruby). O jeito que funciona:

1. `cp -R index.html admin.html css js "$SCRATCHPAD/site/"`
2. `.claude/launch.json` apontando o `ruby -run -e httpd` para **essa** cópia
3. `preview_start` → dirigir a página → conferir o resultado **no banco**, não na tela

Para verificar a área autenticada sem tocar na senha do organizador: criar um usuário temporário direto em `auth.users` (com `crypt(...)`), inserir em `admins`, testar e **apagar os dois**. Atenção: o GoTrue recusa login se `confirmation_token`, `recovery_token`, `email_change_token_new` ou `email_change` estiverem `NULL` — precisam ser `''`.

Sem `psql` e sem daemon do Docker nesta máquina: o acesso ao banco é via `pg8000` num venv descartável no scratchpad. A senha do Postgres **nunca** vai para arquivo — só variável de ambiente por comando.

## Regra de schema — diferente do protocolo

O WORKFLOW diz "migrations commitadas não se editam". **Aqui é o contrário**, por decisão registrada na ET: não há migrations de errata. Quando o modelo muda, corrige-se o `supabase-setup.sql` e **recria-se do zero**.

O que torna isso seguro é o bloco de RESET no topo do arquivo, que **aborta se `rsvps` tiver qualquer linha**. `admins` e `is_admin()` sobrevivem ao reset de propósito.

> Isso vale enquanto o projeto é pré-lançamento. Depois que o link for divulgado e chegarem confirmações reais, a trava passa a ser a única coisa entre um `Run` distraído e a perda dos dados — e mudança de schema volta a exigir cuidado manual.

## Git

Igual ao protocolo, e já era o combinado antes dele: branch por fatia → commits verdes → `merge --ff-only` → push. O protocolo **acrescenta** duas coisas que passam a valer:

- `executa` **abre** com `git pull --ff-only origin main`
- o `status.md` registra o **hash de `origin/main` depois do push**

O push publica: GitHub Pages atualiza em 1-2 min a cada push na `main`. Então **não se faz push com o site quebrado** — se a fatia deixar o convite ou o painel sem funcionar, termina-se antes de publicar.

## Fontes de verdade

| Arquivo | O quê |
|---|---|
| [CONTINUIDADE.md](../CONTINUIDADE.md) | estado atual, backlog, gotchas |
| [REGRAS-NEGOCIO.md](../REGRAS-NEGOCIO.md) | o "o quê" — regra de negócio, versionada (v5) |
| [ESPECIFICACAO-TECNICA.md](../ESPECIFICACAO-TECNICA.md) | o "como" — schema, RPCs, RLS, cálculo |
| `supabase-setup.sql` | o schema real, fonte da verdade |

Em caso de divergência entre a ET e as regras de negócio, **a regra de negócio vence** e a ET é corrigida.

Não existe `CLAUDE.md` neste repo. Se um dia existir, ele passa a ser a autoridade sobre convenção, como no protocolo.
