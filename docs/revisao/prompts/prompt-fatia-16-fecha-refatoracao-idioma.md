# Fatia 16 — Fechar a refatoração de idioma (e consertar o que o recreate levou junto)

A refatoração para inglês veio fora do ciclo, a pedido direto do Bruno, e o grosso dela está bem
feito: API do módulo (`toCents`, `splitCents`, `settlement`, `settlementSummary`), ids de HTML,
chaves do `config.js`, colunas do schema (`wants_beer`, `invited_by`, `actual_beer_cost`,
`beer_paid_by`, `rsvp_deadline`) e classes de CSS estão em inglês, com o texto de usuário
corretamente em pt-BR. Esta fatia fecha o que sobrou e conserta um efeito colateral.

**Contexto que eu não tinha na auditoria:** o Bruno autorizou **drop e recriação** em vez de
`alter table … rename`, justamente para não deixar migração legada no repositório. Então não há
migração a registrar — o `supabase-setup.sql` continua sendo a única descrição do schema, e está
certo assim. O que segue leva isso em conta.

---

## 🔴 1. A trava do reset está morta — e agora ela é a única proteção que sobrou

As tabelas viraram `settings` e `party`, mas o bloco de reset ainda pergunta pelos nomes antigos:

```sql
if to_regclass('public.config') is not null then   -- linha 46
if to_regclass('public.festa')  is not null then   -- linha 83
```

`to_regclass` devolve **NULL** para tabela que não existe mais com aquele nome: as duas guardas
**passam em silêncio**. Sobrou só a de `rsvps`.

Isso é grave **por causa da estratégia escolhida**: como recriar do zero é o caminho normal deste
projeto, a trava não é um detalhe defensivo — é o único freio entre um `Run` e o apagamento de
preços, taxas, prazo, fechamento e conteúdo do convite. Foi ela que salvou o dado do Bruno na
Fatia 8.

**Correção:** `public.config` → `public.settings`, `public.festa` → `public.party`, e as mensagens
de `ABORTADO`, que citam os nomes antigos, junto.

**Prova que eu quero:** plantar dado em `settings` e em `party`, rodar o script com `rsvps` vazio, e
mostrar que ele **aborta** — com a saída crua. Foi assim que a trava nasceu validada na Fatia 6.

## 🔴 2. O recreate voltou `party` e `settings` para o seed — e o seed está desatualizado

```sql
venue            : 'Salão 3 — Av. Cel. Marcos, 627, …'      ← o Bruno já tinha mudado para Salão Grande
celebrant_3_name : 'Bocão'                                   ← já tinha virado JH Boca
insert into public.settings (id) values (1)                  ← preços 0, taxa de chopp 2.0, prazo NULL
```

Ou seja, depois da recriação o convite provavelmente está mostrando **o salão errado** e **o nome
errado do terceiro aniversariante**, com **preço zerado**, **taxa de chopp em 2.0** (era 2.5) e
**sem prazo** — formulário aberto sem data limite. E as três linhas de consumo dos aniversariantes
sumiram junto.

Duas coisas, e elas são diferentes:

- **Restaurar o estado operacional**, via painel ou SQL, com saída crua do antes/depois: preços
  (chopp 10 / refri 5 / água 3 / pizza 20 e 20), taxa de chopp **2,5**, prazo **01/10/2026
  23:59:59 em São Paulo**, e o cadastro de consumo dos três aniversariantes. Confirme cada valor
  com o Bruno antes de gravar — eu estou reconstruindo de memória dos `status.md` anteriores, e
  memória não é fonte.
- **Corrigir o seed do conteúdo do convite** (`party`): salão e nome do terceiro aniversariante.
  Sem isso, o próximo recreate reverte de novo. **Não** semeie preço, taxa ou prazo — isso é
  operacional, muda com o tempo, e é o que a trava existe para proteger.

## 🟡 3. Nomes de arquivo em pt-BR — o pedido do Bruno

```
js/calculo.js          → js/calc.js
tests/calculo.test.js  → tests/calc.test.js
tests/calculo.test.html→ tests/calc.test.html
```

O conteúdo já está em inglês e o módulo exporta `Calc`; só o arquivo ficou para trás. Ache **todas**
as referências antes de renomear — `<script src>` nas páginas, o `require("../js/calculo.js")` do
teste, o `verify.sh`, e o comando `jsc` documentado no cabeçalho do teste e no `FLUXO.md`. Use `git
mv` para o histórico seguir o arquivo.

**Documentos ficam como estão.** `REGRAS-NEGOCIO.md`, `ESPECIFICACAO-TECNICA.md`, `FLUXO.md` e os
`prompts/` têm conteúdo em português e nome em português — coerente. A regra é "código em inglês,
texto humano em português", e nome de documento é texto humano. Se o Bruno quiser o contrário
depois, é um commit mecânico à parte.

## 🟡 4. Nomes de policy continuam em português

```
"admin le admins" · "admin le rsvps" · "admin apaga rsvps" · "admin le people"
"admin cadastra people" · "admin edita people" · "admin apaga people"
"admin le settings" · "admin edita settings" · "party leitura publica"
"admin edita party" · "fotos leitura publica" · "admin sobe fotos" · "admin apaga fotos"
```

Nome de policy é identificador, então a regra vale. Aplicar num banco existente é `drop policy` +
`create policy` — não destrutivo, mas mexe em produção: faça num bloco só, com a RLS conferida
depois (o teste negativo do anon, que já é rotina aqui: provar pelo **estado do banco**, não pelo
código HTTP).

## 🟡 5. Comentários que citam identificadores que não existem mais

`index.html:18` e `js/main.js:23,36` falam em "tabela `festa`"; `supabase-setup.sql:354` ainda
descreve a função como `criar_rsvp`. Comentário em português é o combinado — o problema é nomear
coisa pelo nome antigo. Varra `festa`, `pessoas`, `config`, `criar_rsvp`, `status_rsvp`,
`normaliza_contato` e `convidado_por_valido` nos comentários.

## 🟢 6. O bucket `fotos` — **não** renomear

Renomear bucket no Supabase não é rename: é criar outro e mover os objetos, e há fotos reais lá.
Ganho cosmético, risco de perder imagem. Deixe como está e ponha uma linha no `config.js` dizendo
que o nome é legado e proposital — hoje parece esquecimento, e alguém vai "consertar" um dia.

---

## Regra que fica valendo

**Este foi o último recreate barato.** Enquanto o banco tinha só dado descartável, dropar e recriar
era mais limpo que acumular migração — e a decisão do Bruno estava certa. A partir do momento em
que convidados começarem a confirmar de verdade, recriar volta a ser inaceitável, e a trava
consertada no item 1 é o que garante isso. Registre no `FLUXO.md`.

## Verify
- `./verify.sh` verde, com as 63 asserções e o invariante de fuso.
- **A trava aborta** com `settings` e `party` populados (saída crua).
- **Estado operacional restaurado**, conferido por `SELECT` e confirmado com o Bruno.
- **Convite no ar** mostrando salão e nomes certos, e o formulário respeitando o prazo.
- **RSVP ponta a ponta** contra o banco, para provar que os nomes novos de tabela e RPC estão de pé
  em produção — apagar depois, pelo próprio identificador.
- **Zero ocorrências** dos identificadores antigos em `js/`, `*.html`, `*.sql` e `verify.sh`,
  incluindo comentários.
- **Nenhum arquivo de código com nome em pt-BR** e o `verify.sh` verde depois do `git mv`.
- Tabela de hashes no `status.md`.
