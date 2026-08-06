# Review — Fatia 17 (exclusão reversível e cancelamento)

**Veredito: aprovado, com um ajuste, uma correção de fato e a P1 respondida.** Não precisa
re-planejar — os três cabem no `executa`.

## Antes de tudo: o `prompt.md` mudou depois que você planejou
Você planejou sobre a versão anterior, onde o gate do cancelar era só o prazo. O Bruno decidiu
**gate duplo**: cancelar exige **prazo aberto E nenhum `actual_*_cost` lançado**. Basta uma falhar
para recusar.

O motivo é o cenário que ele levantou e que a sua premissa não cobria: você escreveu que o cancelar
e o fechamento "nunca se encontram" porque o prazo é 01/10 e a festa é 31/10. Só que **a compra pode
acontecer antes do prazo** — fornecedor pede antecedência. Se o Braz paga a pizza no dia 15/09 e
alguém cancela no 20/09, ainda dentro do prazo, o dinheiro já saiu e passa a ser dividido entre menos
gente. Por isso lançar custo congela a lista.

Consequências no que você já planejou: a RPC lê `settings` para os dois gates; mensagem própria para
cada caso ("prazo encerrado" ≠ "as compras já começaram"); e a aba Contas precisa avisar, onde o
organizador digita, que lançar o gasto impede cancelamentos — senão ele congela sem saber.

## P1 — o excluir do organizador: **opção 2**, e repare que é a mesma regra
Você chegou pelo lado do painel exatamente onde o Bruno chegou pelo lado do convidado. Fica assim:

> **Lançar custo congela a lista — para as duas portas.**
> O convidado tem, além disso, o prazo. O organizador não tem.

E a assimetria é proposital: o organizador **precisa** poder corrigir engano depois do prazo — grupo
duplicado, teste esquecido, alguém que confirmou duas vezes por caminhos diferentes. Travá-lo no
prazo (opção 1) tiraria isso sem ganho, porque entre o prazo e a compra ainda não há dinheiro
comprometido. A opção 3 (só aviso) é fraca: aviso não impede, e aqui o efeito é redistribuir conta
de gente que já pagou.

**A saída de emergência já existe e não precisa de código:** se aparecer um duplicado depois do
fechamento começar, o organizador limpa o campo de custo, exclui, e lança o custo de novo. Vale
escrever isso no `status.md` — é a resposta para "e se eu precisar mesmo?".

## Correção de fato — o índice **não** é único
Você escreveu que `rsvps_contact_norm_idx` "hoje garante um contato por linha" e que "sem o
`where deleted_at is null` o segundo envio esbarra no índice". Não esbarra:

```sql
create index rsvps_contact_norm_idx on public.rsvps (contact_norm);   -- linha 204, sem UNIQUE
```

É índice comum, só de busca. Não há restrição para tropeçar, e o dedupe sempre dependeu só do
`delete` dentro do `create_rsvp`.

**Mas a ação que você propôs é boa — por outro motivo, e melhor.** Torne-o **`unique` parcial**:

```sql
create unique index rsvps_contact_norm_active_idx
  on public.rsvps (contact_norm) where deleted_at is null;
```

Hoje, dois envios simultâneos com o mesmo contato podem gerar **duas linhas ativas** e ninguém
descobre — é uma corrida silenciosa que existe desde a Fatia 0 e que eu aceitei na época por ser
festa. Agora que estamos mexendo no modelo, ela vira **erro alto** em vez de duplicata invisível, de
graça. E não atrapalha o fluxo novo: dentro da transação o `update` tira a linha antiga do predicado
antes do `insert` entrar.

Se ao aplicar aparecer duplicata ativa preexistente, o índice falha na criação — **isso é
diagnóstico, não obstáculo**: quer dizer que a corrida já aconteceu, e você quer saber.

## O que está muito bom no plano
- **O filtro entra num ponto só**, e você explicou por que: tudo deriva de `lastGroups`/`lastPeople`.
  Marcar isso com comentário é o que impede alguém destruir a propriedade adicionando uma consulta.
- **O pulo do gato** — `deleted_at` mora em `rsvps`, não em `people`, então filtrar só os grupos
  deixaria as pessoas do grupo cancelado contando em estimativa e rateio. É *exatamente* o modo de
  falha do risco 1, e você o encontrou sozinho. A escolha de filtrar no cliente em vez de `!inner`
  (que derrubaria os aniversariantes) está certa.
- **A trava contando cancelados de propósito** — cancelada é dado real de convidado, é o conteúdo da
  futura lixeira; ignorá-los faria um recreate apagar a lixeira em silêncio. Sutil e certo.
- **Sem oráculo**, com as três respostas idênticas.
- **A limitação assumida e escrita na tela** (o navegador não consegue verificar o que guardou, e
  criar leitura para o anon seria o oráculo que acabamos de evitar) — é o tipo de honestidade que
  evita alguém "consertar" isso depois abrindo um buraco.

## Verificação
Some três coisas: o **segundo gate** (custo lançado recusa o cancelar, com saída crua), o
**excluir do painel travado** depois do custo lançado — e destravado ao limpar o campo —, e a
criação do **índice único parcial** com a prova de que o reenvio ainda passa.

Pode `executa`.
