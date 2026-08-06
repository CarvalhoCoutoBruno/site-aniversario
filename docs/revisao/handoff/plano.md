# Plano — Fatia 18: a lixeira, e fechar a porta do apagar

Conferi cada afirmação do prompt antes de planejar. **Todas se sustentam** — e uma delas se
sustenta mais forte do que o prompt supôs, o que me faz propor um acréscimo. Está na §5.

## O que confirmei no banco e no código

```
políticas de DELETE vivas:  public.rsvps   "admin deletes rsvps"
                            public.people  "admin deletes people"
                            storage.objects "admin deletes photos"   ← fica, é outro assunto

delete de verdade nas RPCs: create_rsvp 0 · cancel_rsvp 0 · admin_remove_rsvp 0
                            (os três fazem `set deleted_at`)

.delete() no js/:           nenhum — a única ocorrência é o comentário que explica por que não

rsvps hoje:                 8 colunas, deleted_at presente, ZERO linhas canceladas
```

Um detalhe da primeira medição que quase me enganou e vale registrar: procurar `delete` no corpo
das funções dá **verdadeiro nas três**, porque casa com `deleted_at`. Só olhando `delete from` como
palavra é que a resposta aparece. Mesma família do erro que a Fatia 17 cometeu no `verify.sh`, onde
o padrão casava com o comentário que citava a chamada.

## §1 — Schema

`rsvps.deleted_by text null check (deleted_by in ('guest','admin'))`, aditivo, e o
`supabase-setup.sql` junto. `cancel_rsvp` grava `'guest'`, `admin_remove_rsvp` grava `'admin'`,
`restore_rsvp` limpa os dois.

`null` fica sendo "não registrado" e a tela diz isso — não vou inventar procedência para linha
antiga. Hoje não há nenhuma, mas a coluna sobrevive à minha memória.

Uma consequência que o prompt não menciona e eu quero explícita: **o `check` também protege contra
a terceira porta que não existe**. Se um dia alguém acrescentar um caminho de cancelamento e
esquecer de gravar procedência, o insert falha alto em vez de gravar `null` silencioso.

## §2 — A lixeira sai da mesma leitura, e onde fica a cerca

O `loadRSVPs()` já traz tudo; as canceladas são hoje **descartadas** no filtro. A lixeira se
alimenta desse descarte, no mesmo bloco:

```js
const activeGroups  = (g.data||[]).filter(r => r.deleted_at == null);
const deletedGroups = (g.data||[]).filter(r => r.deleted_at != null);   // ← o complemento
```

Nenhuma consulta nova. A invariante que eu mesmo escrevi na 17 (`sb.from("rsvps")` == 1) continua
valendo, e ela está certa.

**Risco 1 — por que o complemento não consegue vazar.** A cerca não é disciplina, é topologia:

- `recompute()`, `peopleForCalc()`, `Calc.split()` e `Calc.settlement()` leem **só**
  `lastPeople`/`lastGroups`. Conferi as 9 referências no arquivo: linhas 667, 679, 875, 882, 883 —
  todas leem, só 1142 e 1143 escrevem.
- `lastDeleted` será uma variável **separada**, escrita no mesmo ponto e lida **só** pelo
  `renderTrash()`. Não entra em `recompute()`, não entra em `render()`.
- A atribuição continua sendo `lastPeople = activePeople` — o filtro que já existe. Para vazar,
  alguém teria de trocar essa linha, que é justamente a linha coberta pela invariante
  `deleted_at == null` do `verify.sh`.

As pessoas dos grupos cancelados vão num **segundo mapa** (`deletedByGroup`), não no `byGroup` que
o `render()` recebe. Dois mapas, duas telas, sem interseção.

E a leitura de `role='celebrant'` da aba Ajustes fica como está: ela nunca vê linha de convidado.
Concordo com o prompt, não vou "consertar".

## §3 — `restore_rsvp`, e a colisão

`security definer`, `search_path` fixo, `revoke from public, anon`, `grant to authenticated`,
`is_admin()` obrigatório, gate único de custo lançado com a saída de emergência dentro da mensagem
— igual ao `admin_remove_rsvp`. A regra vira uma só para as três portas: **lançar custo congela a
lista.**

### A pergunta que o prompt me fez: a mensagem basta, ou aponto a atual?

**Aponto a atual.** Duas razões:

1. A pergunta seguinte do organizador é sempre "então qual é a que vale?". Se a mensagem não
   responde, ele vai caçar na lista — e a lista pode ter 40 grupos.
2. **Não custa consulta nenhuma.** `contact_norm` é coluna gerada e vem no `select("*")`; a linha
   ativa concorrente já está em `lastGroups`, na memória. É um `find` num array que eu já tenho.

E vou além, porque dá para fazer melhor do que traduzir erro: **detecto a colisão antes de chamar a
RPC**, e aí a frase sai completa e sem round-trip:

> "**Fulano** já confirmou de novo em 12/09, depois de cancelar. Restaurar esta criaria duas
> confirmações para o mesmo contato — a que vale é a de 12/09."

**E ainda assim capturo o `23505`.** Não é redundância: o estado do cliente pode estar velho (outra
aba, outro organizador, ou um convidado reconfirmando entre o meu carregar e o meu clicar). A
checagem no cliente é para a **boa mensagem**; o `23505` é para a **correção**. Se eu só fizesse a
primeira, uma corrida devolveria despejo de Postgres na tela.

O `23505` traduzido dá a mesma frase sem o nome e sem a data — é o que dá para dizer sem consultar.

## §4 — A tela

Fim da aba "Quem vem", depois do `#listNoResult`, bloco recolhido, título "Fora da lista (N)", e
**só existe no DOM quando N > 0** — nada de bloco vazio ocupando o fim da aba o ano inteiro.

Cada item traz o que faz decidir: responsável, contato, quem convidou, as pessoas com o consumo, o
recado, quando saiu e **por qual porta**:

| `deleted_by` | o que a tela diz |
|---|---|
| `guest` | "cancelou pelo link" |
| `admin` | "você tirou da lista" |
| `null` | "saiu da lista" (sem inventar procedência) |

Mais recente primeiro. Fora da busca e dos filtros — eles são lente sobre quem vem; aqui é tudo,
sempre. A contagem do título é a única contagem, e ela não passa por `recompute()`.

"Trazer de volta" com `confirm` nomeando quem volta, e `loadRSVPs()` depois — a mesma recarga que o
excluir já faz, que é o que garante Resumo, Compras e Contas mudando junto.

## §5 — Fechar a porta, e o acréscimo que eu quero propor

O prompt manda derrubar as duas políticas. Faço isso. **Mas descobri que só isso deixa a porta
encostada, não trancada** — e a diferença é grande o bastante para eu não decidir sozinho.

O grant de tabela está lá, herdado do padrão do Supabase:

```
rsvps   anon DELETE · authenticated DELETE · service_role DELETE
people  anon DELETE · authenticated DELETE · service_role DELETE
```

Com o grant presente e a política ausente, o `DELETE` **não dá erro**: a RLS torna as linhas
invisíveis para o comando, ele apaga zero e devolve **sucesso**. O prompt já viu isso e por isso
mandou provar por `select` antes/depois, o que está certo.

Só que "sucesso silencioso" é um jeito ruim de uma porta ficar fechada. Proponho **também**:

```sql
revoke delete on public.rsvps, public.people from anon, authenticated;
```

O que muda: a mesma tentativa passa a devolver **`42501 permission denied`** — alto, achável no
log, impossível de confundir com "apagou". E fecha o `anon`, que hoje tem grant de DELETE e é
barrado **só** pela RLS: uma política mal escrita no futuro (um `using (true)` distraído) reabriria
para o mundo. Com o revoke, não reabre.

Verifiquei o que isso **não** quebra:

- as três RPCs são `security definer` e rodam como dono — grant de `anon`/`authenticated` não as
  toca;
- nada no `js/` apaga (grep confirma);
- a trava do reset é DDL, passa por cima de RLS e de grant;
- a cascata do FK `people.rsvp_id … on delete cascade` é ação de integridade referencial, executada
  internamente e não sujeita ao grant do chamador — e, de todo modo, **nada dispara delete** hoje;
- `service_role` mantém tudo, e ele nunca entra no repositório.

**Não vou aplicar o revoke sem tua palavra**, porque ele mexe em permissão de papel e não é o que o
prompt pediu. Se preferires ficar só com o drop das políticas, faço só isso e a fatia fecha igual —
some a garantia contra política futura mal escrita, e a prova continua sendo `select` antes/depois.

## §6 — A nona invariante

Estática sobre o `supabase-setup.sql`: nenhum `create policy … for delete` em `rsvps` ou `people`.
Provada nos dois sentidos, plantando a política de volta — como fiz com as três da 17.

O padrão vai exigir a tabela junto, não só `for delete`, senão ele derruba a política de fotos, que
tem de continuar existindo. E vou testar exatamente isso: plantar a de fotos e o script ficar
**verde**.

## Riscos 2, 3 e 4 — como provo

| risco | prova |
|---|---|
| restaurar com custo lançado | planto `actual_beer_cost`, `restore_rsvp` recusa com saída crua; limpo, passa; `select` mostrando `deleted_at` antes e depois |
| colisão do índice | cancelo, reconfirmo o mesmo contato, tento restaurar → frase humana na tela + `23505` cru no `status.md`, e as duas linhas provadas: a antiga **ainda cancelada**, a atual **ainda ativa** |
| porta fechada | `select` antes/depois com JWT de admin de verdade, em `rsvps` **e** em `people` — nunca "não deu erro, logo fechou" |
| `anon` no `restore_rsvp` | `42501`, linha intacta |

## O que fica de fora

`js/calc.js`, o convite, apagar definitivo (**não construo esse botão**), e lixeira para o
convidado. Do lado dele o cancelar é final por decisão, não por esquecimento.

## Ordem dos commits

1. schema: `deleted_by`, `restore_rsvp`, procedência nas duas RPCs que cancelam
2. painel: o complemento, a lixeira, o restaurar com a colisão tratada
3. fechar a porta: drop das políticas (+ revoke, se autorizado) e a nona invariante
4. `status.md`

## Duas coisas fora do plano, que continuam de pé

**O deploy.** O `main` está em `86a40b6` e **não publicou**: o GitHub abriu incidente crítico de
Actions e Pages às 15:22 UTC de 06/08, e o build falhou por `Failed to resolve action download
info`. Git está operacional — o commit chegou. O convite no ar ainda é o da Fatia 16, então **o
cancelamento da 17 não está em produção**. Vou reconferir antes de mexer em qualquer coisa, e se o
incidente tiver fechado, um push reenfileira.

**O painel logado eu continuo sem conseguir dirigir** — ele pede a senha do Bruno. Vale para esta
fatia inteira: vou provar a lixeira pelo banco e pelo bloco de código executado com linhas reais,
como fiz na 17, mas o olho na tela renderizada logada é dele.

## Pendência do Bruno, que não é fatia

Rotacionar a senha do Postgres. Ela circulou no chat.
