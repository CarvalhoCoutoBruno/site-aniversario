# FLUXO — o que o protocolo deixa em aberto neste repositório

> O protocolo está em [WORKFLOW.md](../WORKFLOW.md) e é **estável**: vale em qualquer repo.
> Aqui ficam só as decisões que ele delega ao projeto — o que é "commit verde", o que
> é fonte da verdade, e o que o push provoca.
>
> O estado da vez vai no `status.md` a cada fatia — não há doc de estado separado
> (ver *Onde mora cada coisa*, no fim).

## O que é "commit verde": `./verify.sh`

O protocolo pede que cada commit passe "na verificação do projeto". Aqui isso é:

```bash
./verify.sh
```

Cobre sintaxe dos 4 arquivos JS, as 63 asserções de `tests/calculo.test.js`, credencial vazada, e dois invariantes de coerência: placeholder por preencher (`COLE_A_*`, `<UID_DO_ADMIN>`) e `main.js` voltar a inserir direto na tabela em vez de usar o RPC.

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

### Gotchas do ambiente (cada um já custou uma tentativa falha)

- **Sem Node e sem `psql`; daemon do Docker parado.** Testes rodam no `jsc`, que já vem no macOS:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc js/calculo.js tests/calculo.test.js`
- **O sandbox impede servir de `~/Documents`** — daí a cópia no scratchpad descrita acima.
- **Injeção de script no site publicado é bloqueada** pelo classificador. Verificação em produção é read-only (`get_page_text`); o teste que dirige a página roda contra a cópia local.
- **Screenshot sai preto** com o painel do navegador oculto — inspecionar o DOM em vez de tirar print.
- **GoTrue recusa login** com `confirmation_token`, `recovery_token`, `email_change_token_new` ou `email_change` em `NULL`; precisam ser `''`.

Esta seção é **durável** e mora aqui de propósito: o `status.md` é sobrescrito a cada fatia e perderia isso toda rodada.

## Schema: recriar, não migrar

Decisão registrada na ET: **não há migrations de errata**. Quando o modelo muda, corrige-se o `supabase-setup.sql` e recria-se do zero. O arquivo é a fonte da verdade, não um histórico.

O que torna isso seguro é o bloco de RESET no topo, que **aborta se `rsvps` tiver qualquer linha**. `admins` e `is_admin()` sobrevivem ao reset de propósito.

### A era do recreate acabou (Fatia 8)

Aconteceu: a trava disparou sobre trabalho real do organizador — preços, prazo e os três
aniversariantes cadastrados pelo painel. Não foi falso positivo; foi a trava fazendo o que existe
para fazer.

**A partir daqui, mudança de schema é aditiva.** Criar tabela ou coluna nova com
`create table if not exists` / `add column if not exists`, aplicado à parte, e o
`supabase-setup.sql` atualizado para continuar descrevendo o schema inteiro — de modo que uma
instalação do zero produza o mesmo resultado.

O que **não** se faz mais: rodar o arquivo inteiro contra a base do Bruno. A trava impede, e
contorná-la (limpar para o script passar) seria usar a chave para arrombar a própria porta.

Antes de aplicar qualquer coisa à mão: **backup do que a trava protege**, impresso na conversa
para ficar recuperável, e conferência contra ele depois. Foi assim na Fatia 8.

## Push publica

GitHub Pages atualiza o site em 1-2 min a cada push na `main`. O `executa` termina em push, então **não se publica com o site quebrado**: se a fatia deixar o convite ou o painel sem funcionar, termina-se antes, ou avisa-se e a decisão é do Bruno.

Já aconteceu entre a Fatia 0 e a 1: o schema novo estava no ar mas o `main.js` ainda mandava o payload antigo, e publicar naquele momento teria quebrado o RSVP para todo convidado.

## Os arquivos de handoff sobem a cada gatilho, não só no `executa`

O protocolo só prevê git no `executa` (pull no início, push no fim). Isso deixa `prompt.md`, `plano.md` e `review.md` **não commitados** entre um gatilho e outro — e a ponta que lê pelo git continua vendo a fatia anterior.

Aconteceu na Fatia 2: o `plano.md` no disco já era da Fatia 2, mas `origin/main` ainda tinha o da Fatia 1, e o Cowork recusou o `revisa` por estar lendo um plano velho. Recusou **certo** — o conteúdo que ele via era mesmo o antigo.

Portanto, **o Claude Code commita e faz push do arquivo de handoff assim que ele muda**:

| Gatilho | O que sobe |
|---|---|
| `planeja` | `plano.md`, mais o `prompt.md` do Cowork se ainda não estiver commitado |
| `executa` | código, `status.md` e o `review.md` |

Como só o Claude Code faz git de escrita, subir o arquivo escrito pelo Cowork faz parte — não é invadir a caneta dele, é publicar o que ele escreveu.

**Antes de revisar, confira de que fatia é o arquivo** — a primeira linha diz. `prompt.md` e `plano.md` são sobrescritos a cada rodada, então ler o arquivo errado é uma falha silenciosa.

## A fase de Design

Existe uma terceira sessão, **Design**, e ela **não é uma ponta do ciclo** — é uma fase que roda
**antes** dele. O protocolo em [WORKFLOW.md](../WORKFLOW.md) não mudou: `próxima`, `planeja`,
`revisa`, `executa` e `fechou` seguem idênticos, entre Cowork e Claude Code.

A primeira tentativa foi outra: pôr o Design como terceira ponta, entregando um `prompt-design.md`
por fatia em paralelo ao `prompt.md`. Foi revertida porque trabalho de design não fecha por
gatilho determinístico — fecha por aprovação humana, com variações lado a lado e "não gostei
disso". Isso não cabe num slot de arquivo sobrescrito a cada rodada. O detalhe está em
[../design/WORKFLOW-DESIGN.md](../design/WORKFLOW-DESIGN.md).

**O que a fase entrega**, por superfície, em `docs/revisao/design/<superfície>/`:

| Arquivo | O quê |
|---|---|
| `prompt-design.md` | Tokens, contraste medido, estados, regras de mobile, ⚠ no que é comportamento e não estilo. |
| `mockups/*.html` | Mockup autônomo. É a **fonte de layout, espaçamento e hierarquia**. |
| `assets/*` | Imagens que o código não sabe gerar (og:image, ícones). |

Nome descritivo por superfície (`convite/`, `admin/`), nunca slot fixo — duas superfícies na fila
se atropelariam. Isso é o oposto do `prompt.md`, que é efêmero de propósito.

**A sessão de Design não tem git.** O pacote chega por chat ou por zip e é o Claude Code que
commita. Deixar o pacote fora do repo recria o buraco de sincronia da Fatia 2, com a diferença de
que aqui o arquivo perdido é a especificação inteira de uma tela.

### Ler o mockup sem abrir o navegador

Os mockups vêm como bundle autoextraível com React, e o HTML+CSS original — com os valores
exatos — está numa string JSON na penúltima linha do arquivo:

```bash
python3 -c "import json,sys;print(json.loads(open(sys.argv[1]).read().split(chr(10))[381]))" \
  docs/revisao/design/convite/mockups/convite-boteco.html
```

Isso evita estimar espaçamento a olho, que é exatamente o que o Claude Code **não** pode fazer.

### A fronteira, na prática

O Claude Code decide nome de classe, estrutura do JS, como quebra as funções e a ordem dos
commits. Ele **não** decide espaçamento, cor, tamanho de fonte nem hierarquia: se o mockup não
cobre um caso, a pergunta vai para o `plano.md` e o trabalho para naquele ponto — inventar vira
divergência silenciosa, que só aparece na conferência de fidelidade, tarde demais.

## Idioma: código em inglês, texto em português

Nome de tabela, coluna, função, constraint, índice, valor de enum, classe de CSS, id de HTML e
identificador de JS: **inglês**.

Tudo que o usuário lê — rótulo, mensagem de erro (inclusive as que o Postgres levanta), título,
copy — e **todo comentário**: **português**. O time escreve em pt-BR; comentário é para o time.

A fronteira que dá trabalho é a string: às vezes ela é texto (`"Confirme até…"`), às vezes é
código (`"celebrant"`, `"#partyTitle"`, `"wants_beer"`). Quem for renomear em massa precisa de um
scanner que classifique região do fonte, não de um `grep`/`sed` — o histórico deste repo tem três
acidentes de regex, incluindo um que trocou palavra dentro de frase que o convidado lê.

## A era do recreate acabou — com uma exceção registrada

A regra da Fatia 8 continua: mudança de schema é aditiva.

**Exceção, autorizada pelo Bruno na tradução para inglês:** o schema foi derrubado e recriado do
zero, porque renomear 35 colunas, 4 tabelas e 4 funções por `ALTER` deixaria uma trilha de
migrations sem valor histórico. O que tornou isso aceitável foi o dado: a única confirmação da
base era um teste dos próprios organizadores. **Backup impresso na conversa antes**, e conteúdo
real (festa, preços, prazo, consumo dos aniversariantes) restaurado depois, campo a campo.

Se houver confirmação de convidado de verdade, isso não se repete.

## Convenções deste repo

- Branch por rodada: `feat/`, `fix/` ou `chore/` + a fatia (ex.: `feat/fatia-2-config`), apagada após o merge.
- Nada de framework nem passo de build — todo JS novo entra por `<script>`, na ordem certa.
- Dinheiro em centavos, sempre; o rateio roda em aritmética inteira.

## Fontes da verdade

| Arquivo | O quê |
|---|---|
| [REGRAS-NEGOCIO.md](../../REGRAS-NEGOCIO.md) | o "o quê" — regra de negócio, versionada (v5) |
| [ESPECIFICACAO-TECNICA.md](../../ESPECIFICACAO-TECNICA.md) | o "como" — schema, RPCs, RLS, cálculo |
| `supabase-setup.sql` | o schema real |

Divergiu? **A regra de negócio vence** e a ET é corrigida. Não existe `CLAUDE.md` neste repo; se um dia existir, passa a ser a autoridade sobre convenção.

## Onde mora cada coisa

Não há doc de estado separado. Existia um `CONTINUIDADE.md`, mas sem dono definido na tabela do protocolo ele foi sobrescrito pelas duas pontas e perdeu conteúdo. Removido. No lugar:

| O quê | Onde | Por quê |
|---|---|---|
| Estado da fatia: o que entregou, evidência crua, hash pós-push, o que sobrou | `status.md` | é o canal Claude Code → Cowork que o protocolo já define |
| Backlog e fatiamento | com o Cowork, materializado no `prompt.md` | é ele quem fatia por risco |
| Gotchas de ambiente, receita de verificação, convenções | **este arquivo** | durável; sobreviver à rotação do `status.md` |
| Especificação visual de uma tela | `docs/revisao/design/<superfície>/` | entregue pela fase de Design, por superfície e não por fatia |
| Modelo de dados e decisões de negócio | ET e regras de negócio | já versionados |

Regra prática: se vale para **esta** fatia, vai no `status.md`; se vale para **todas**, vem para cá.
