# Auditoria da refatoração para inglês

Revisão fora do ciclo, a pedido do Bruno. O grosso da refatoração está **muito bem feito**:
API do módulo de cálculo (`toCents`, `splitCents`, `settlement`, `settlementSummary`), ids de HTML,
chaves do `config.js`, colunas do schema (`wants_beer`, `invited_by`, `actual_beer_cost`,
`beer_paid_by`, `rsvp_deadline`…) e classes de CSS estão em inglês, com o texto de usuário
corretamente em pt-BR.

Os achados abaixo estão em ordem de risco, não de esforço.

---

## 🔴 1. A trava do reset morreu com a renomeação — e ninguém vai perceber

As tabelas viraram `settings` e `party`, mas o bloco de reset ainda pergunta pelos nomes antigos:

```sql
if to_regclass('public.config') is not null then   -- linha 46
if to_regclass('public.festa')  is not null then   -- linha 83
```

`to_regclass` devolve **NULL** para uma tabela que não existe mais com aquele nome. Ou seja: as
duas guardas **passam em silêncio**. Sobrou só a de `rsvps`, que manteve o nome.

**Consequência concreta:** rodar o `supabase-setup.sql` com `rsvps` vazio (depois da festa, ou
antes da próxima confirmação) hoje **dropa e recria `settings` e `party`** — apagando preços,
taxas, prazo, o fechamento e o conteúdo do convite. É exatamente o desastre que a trava da Fatia 6
foi criada para impedir, desligado por um `rename`.

**Correção:**
```sql
if to_regclass('public.settings') is not null then   -- era public.config
if to_regclass('public.party')    is not null then   -- era public.festa
```
E as mensagens de `ABORTADO` citam `public.config` / `public.festa` — atualizar junto, senão
apontam para tabelas que não existem.

**Verificação que eu quero:** plantar dado em `settings` e em `party`, rodar o script com `rsvps`
vazio, e provar que ele **aborta**. Foi assim que a trava foi validada na Fatia 6 e é a única prova
que vale.

---

## 🔴 2. O banco de produção foi migrado? Não há registro disso no repo

O cliente já chama `party`, `people`, `settings`, `create_rsvp` e `rsvp_status`. O
`supabase-setup.sql` cria com os nomes novos. Mas:

- não existe **nenhum script de migração** no repositório (`grep` por `alter table … rename` = nada
  além dos `enable row level security`);
- nenhum commit menciona migração;
- não há `status.md` desta refatoração — ela veio fora do ciclo.

Se o banco **não** foi renomeado, o site está **quebrado agora**: o convite cai no fail-loud
("POXA") e o painel não carrega. Se **foi**, ótimo — mas o `ALTER TABLE … RENAME` que rodou não
está registrado em lugar nenhum, e daqui a um mês ninguém vai saber o que foi feito.

**O que pedir ao Claude Code:**
1. Confirmar o estado real do banco (`select … from information_schema.tables` ou um `select` em
   `party`/`people`/`settings`), com saída crua.
2. Se ainda não foi migrado: rodar os `rename` e provar o antes/depois, com backup impresso.
3. Em qualquer caso: **registrar** a migração no repo — um `docs/migrations/2026-08-06-rename-en.sql`
   com os `alter table … rename to` e `alter function … rename to` executados. O
   `supabase-setup.sql` descreve a instalação do zero; ele **não** descreve como um banco existente
   chegou aqui, e essa diferença passou a importar quando a era do recreate acabou (Fatia 8).

---

## 🟡 3. Nomes de arquivo ainda em pt-BR

```
js/calculo.js
tests/calculo.test.js
tests/calculo.test.html
```

O conteúdo está em inglês e o módulo exporta `Calc`; só o arquivo ficou. Renomear para
`js/calc.js` / `tests/calc.test.js` / `tests/calc.test.html` exige acertar as três referências de
`<script>` (`index.html`, `admin.html`, `tests/calc.test.html`), o `require("../js/calc.js")` do
teste, o `verify.sh` e o comando `jsc` documentado. É mecânico, mas toca o gate — vale um commit só
para isso, com o `verify.sh` verde antes e depois.

---

## 🟡 4. Nomes de policy continuam em português

```
"admin le admins" · "admin le rsvps" · "admin apaga rsvps" · "admin le people"
"admin cadastra people" · "admin edita people" · "admin apaga people"
"admin le settings" · "admin edita settings" · "party leitura publica"
"admin edita party" · "fotos leitura publica" · "admin sobe fotos" · "admin apaga fotos"
```

Nome de policy é identificador, não texto de usuário — a regra da refatoração se aplica. Mas
**atenção**: renomear policy num banco já migrado é `drop policy` + `create policy`, ou seja, mais
mudança no banco de produção. Se for fazer, faça **junto** com o item 2, no mesmo script registrado,
e não em separado. Se preferir não mexer, é uma inconsistência assumida — mas então registre a
decisão, porque hoje ela parece esquecimento.

---

## 🟢 5. O bucket `fotos` — minha recomendação é **não** renomear

O bucket se chama `fotos` (e `config.js` tem `photosBucket: "fotos"`). Renomear bucket no Supabase
não é `rename`: é criar outro e **mover os objetos** — e há 3 fotos reais lá dentro. O ganho é
cosmético e o risco é perder imagem. Deixe como está, e ponha um comentário de uma linha no
`config.js` dizendo que o nome do bucket é legado e proposital.

---

## 🟢 6. Comentários que citam tabelas que não existem mais

`index.html:18` e `js/main.js:23,36` falam em "tabela `festa`". Comentário em pt-BR é combinado e
está certo — o problema é que ele **nomeia uma tabela pelo nome antigo**. Trocar `festa` por `party`
nesses pontos. (`grep -n "tabela .festa" index.html js/main.js` acha todos.)

---

## O que eu faria, nesta ordem

1. Confirmar o estado do banco (item 2) — antes de qualquer outra coisa; se estiver quebrado, é
   incidente, não refatoração.
2. Consertar a trava (item 1) e provar com o teste de abortar.
3. Registrar a migração no repo (item 2.3), incluindo as policies se elas forem renomeadas.
4. Os itens 3, 4 e 6, que são higiene e podem ir num commit só.
5. Item 5: decidir e documentar, sem mexer.
