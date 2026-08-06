# Fatia 18 — A lixeira: ver, restaurar, e fechar a porta do apagar

Segunda de duas. A 17 mudou o **modelo** (nada mais evapora); esta entrega a **tela** que torna o
modelo útil e **fecha a última porta** por onde ainda dá para apagar de verdade.

**Por que agora:** hoje o cancelado só volta por SQL, e isso está escrito na própria mensagem do
painel ("ainda não há tela para trazer de volta"). Enquanto for assim, o organizador que errar
depende de mim ou de você — que é exatamente o que a exclusão reversível existia para evitar.

## O que eu encontrei e que fecha junto

A política de RLS `"admin deletes rsvps"` **continua viva** no schema:

```sql
create policy "admin deletes rsvps" on public.rsvps
  for delete to authenticated using (public.is_admin());
```

Nenhum código a usa mais — o painel passa pelo `admin_remove_rsvp` e o `create_rsvp` deixou de
apagar. Mas ela segue exposta na API: um admin logado que monte a chamada REST na mão apaga a linha
de verdade, **por cima da trava do custo lançado** e sem deixar nada na lixeira. É resto do modelo
antigo, não erro da 17. E o `verify.sh` só vigia o `js/` — essa porta não é vigiada por ninguém.

Mesma coisa em `"admin deletes people"`. Conferi as chamadas: não existe `.delete()` sobre `rsvps`
nem sobre `people` em lugar nenhum do `js/`. As duas políticas são capacidade morta.

## Decisões de escopo já tomadas — não precisa perguntar

**A lixeira NÃO é uma sexta aba.** Ela vive no fim da aba "Quem vem", num bloco recolhido, e **só
aparece quando há algo dentro**. Aba é a navegação do painel: acrescentar uma cobra atenção de todo
mundo, para sempre, por uma tela que se usa duas vezes no ano. E a lixeira só faz sentido ao lado da
lista de onde as linhas saíram.

**Não existe apagar definitivo, nem "esvaziar lixeira".** Seria recriar o apagar duro que acabamos
de abolir, e num site de festa não há volume que justifique. Se um dia alguém pedir para sumir de
verdade com o próprio dado, é SQL, na mão, com intenção. **Não construa esse botão.**

## Escopo

### 1. Schema — aditivo, como manda a regra desde a Fatia 16

`rsvps.deleted_by text null`, com `check (deleted_by in ('guest','admin'))`. O `cancel_rsvp` grava
`'guest'`; o `admin_remove_rsvp` grava `'admin'`; o restaurar limpa os dois campos.

**Por que a coluna vale o custo:** olhando a lixeira, "ela desistiu" e "eu apaguei sem querer" levam
a decisões opostas, e `deleted_at` sozinho não distingue. Sem isso a tela mostra uma lista de nomes
que não ajuda a decidir nada.

Não há retrocompatibilidade a resolver: o banco está hoje com **zero linhas canceladas** (higiene do
seu próprio `status.md`). Ainda assim trate `null` como "não registrado" — não invente que é um ou
outro.

`alter table ... add column`, e o `supabase-setup.sql` atualizado. Os dois têm de concordar.

### 2. A lixeira sai da MESMA leitura — isto não é detalhe, é a invariante da 17

O `loadRSVPs()` já traz **tudo**: o filtro do cancelado é no cliente, não na consulta. Ou seja, as
linhas canceladas e as pessoas delas **já estão na memória** e são hoje descartadas. A lixeira se
alimenta desse descarte.

**Não acrescente uma segunda consulta** (`.not("deleted_at","is",null)` ou parecida). Ela quebraria
a invariante que você mesmo escreveu no `verify.sh` na fatia passada — e a invariante estaria certa.
Guarde o complemento (`lastDeleted` + o mapa de pessoas dos grupos cancelados) no mesmo ponto onde
hoje se calcula `activeGroups`.

**E `lastPeople`/`lastGroups` não mudam.** Eles alimentam estimativa, rateio e acerto; pessoa de
grupo cancelado entrar ali é o modo de falha da 17 voltando pela porta dos fundos.

(De passagem: a leitura de `people` com `role='celebrant'` da aba Ajustes é outra consulta e está
certa — ela nunca vê linha de convidado. Não "conserte" ela.)

### 3. `restore_rsvp(p_id uuid)` — e a colisão que vai acontecer

- `security definer`, `search_path` fixo, `revoke from public, anon`, `grant execute to authenticated`.
- Exige `is_admin()`. **É porta de organizador**, como o `admin_remove_rsvp`.
- Limpa `deleted_at` e `deleted_by`.
- **Um gate só: custo real lançado recusa.** Sem gate de prazo — mesma assimetria já decidida, e
  pelo mesmo motivo: o organizador precisa poder corrigir engano depois do prazo.

  Restaurar **também** mexe no rateio de quem já pagou: devolve um consumidor à conta e muda quanto
  cada um paga. A regra continua sendo uma só, agora para as três portas: **lançar custo congela a
  lista.** A saída de emergência é a mesma e não precisa de código — limpar o campo na aba Contas,
  restaurar, lançar de novo —, e ela tem de estar **dentro da mensagem de erro**, como já está na do
  excluir.

- **A colisão com o índice único parcial.** Cenário provável, não exótico: alguém cancela, muda de
  ideia e confirma de novo com o mesmo contato. Agora existe linha ativa com aquele `contact_norm`.
  Se o organizador for na lixeira e restaurar a antiga, o `rsvps_contact_norm_active_idx` levanta
  `23505` — e o painel mostraria um despejo de Postgres.

  **Capture e traduza.** Algo como: *"Esse contato já confirmou de novo, depois de cancelar. A
  confirmação atual é a mais recente — restaurar esta criaria duas para a mesma pessoa."* O índice
  está fazendo o trabalho dele; o que falta é a frase.

  Decida no plano e diga: a mensagem basta, ou vale apontar qual é a confirmação atual?

### 4. A tela

No fim de "Quem vem", bloco recolhido, título com a contagem ("Fora da lista (2)"). Cada item
mostra o suficiente para **decidir**: nome do responsável, contato, quem convidou, as pessoas do
grupo com o que consomem, o recado, **quando saiu** e **por qual porta** ("cancelou pelo link" ×
"você tirou da lista"). Ordem: mais recente primeiro.

Botão **Trazer de volta**, com `confirm` que nomeia quem volta — mesmo padrão da frase do excluir.
Depois de restaurar, `loadRSVPs()` de novo: a lista, o Resumo, as Compras e as Contas mudam junto.

A lixeira **não** participa da busca nem dos filtros da aba: aqueles são lente sobre quem vem. Aqui
é tudo, sempre.

Nenhum número da lixeira pode vazar para contagem nenhuma de aba nenhuma. Ela tem a contagem do
próprio título, e só.

### 5. Fechar a porta

`drop policy if exists "admin deletes rsvps" on public.rsvps;` e o mesmo para
`"admin deletes people"`, no banco **e** no `supabase-setup.sql` (apague o `create policy`, não
deixe órfão). A de fotos (`"admin deletes photos"`, em `storage.objects`) **fica** — apagar foto é
apagar mesmo, é outro assunto.

Depois disso, `deleted_at` passa a ser a única saída da lista, garantida pelo banco em vez de por
convenção mais uma checagem no `js/`.

### 6. Uma invariante nova no `verify.sh` (a nona)

Estática, sobre o `supabase-setup.sql`: **não pode existir política de `delete` em `rsvps` nem em
`people`**. Prove nos dois sentidos, como você fez com as três da 17 — planta a política de volta,
o script fica vermelho; tira, fica verde.

É ela que impede alguém recriar a porta daqui a seis meses "para o painel poder limpar teste".

## Fora de escopo

`js/calc.js` (nada de cálculo muda), o convite, apagar definitivo, e qualquer coisa de lixeira para
o convidado — do lado dele o cancelar já é final, e ressuscitar sem passar pelo organizador seria
dar ao anônimo uma porta de escrita a mais sem necessidade.

## Riscos que quero endereçados no plano

1. **Vazamento pelo complemento.** Agora existe, na memória do painel, um array com linhas
   canceladas. Mostre por que ele não consegue entrar em `lastPeople`/`lastGroups`, e onde está a
   fronteira.
2. **Restaurar com custo lançado** é o mesmo dinheiro da 17 visto pelo outro lado. Prove pelo estado
   do banco, não pela tela.
3. **A colisão do índice**: diga o que o usuário vê, e prove que a linha antiga continua cancelada
   e a atual continua ativa depois da tentativa frustrada.
4. **Derrubar as políticas não pode quebrar nada.** Liste o que hoje depende (ou não) delas — o
   `create_rsvp`, a trava do reset (que é DDL e passa por cima de RLS), a cascata do FK.

## Verify

- `./verify.sh` verde, 63 asserções, **9 invariantes**.
- **Ponta a ponta, as duas procedências**: cancelar pelo link e excluir pelo painel; os dois aparecem
  na lixeira com a origem certa; restaurar cada um e provar que voltou à lista **e a todos os
  números**.
- **Colisão**: cancelar, reconfirmar com o mesmo contato, tentar restaurar a antiga → mensagem
  humana, saída crua do erro original no `status.md`, e as duas linhas no estado certo.
- **Custo lançado**: restaurar recusa; limpar o campo, restaurar passa. Saída crua.
- **`anon` chamando `restore_rsvp`** → `42501`, com a linha intacta.
- **A porta fechada, e cuidado com a prova:** sem política casando, o `DELETE` do PostgREST **não dá
  erro — ele apaga zero linhas e devolve sucesso**. Então a prova não é "deu erro": é
  `select` antes e depois, com a linha ainda lá, usando o JWT de um admin de verdade. Prove também
  em `people`.
- **A leitura continua única**: `grep` de `sb.from("rsvps")` no `js/` dando 1.
- **Contagens**: cancelada não conta em lugar nenhum; restaurada volta a contar em todos.
- **Nada de recreate** — `alter table`, com `party`/`settings`/fotos intactas ao fim.
- Tabela de hashes no `status.md`.

## Observação

Se em algum ponto o restaurar colidir com o rateio de um jeito que este prompt não previu, **pare e
pergunte no plano** em vez de decidir sozinho — ali é dinheiro de gente que já pagou.
