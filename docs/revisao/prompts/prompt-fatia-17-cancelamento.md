# Fatia 17 — Modelo de exclusão e cancelamento pelo convidado

Primeira de duas. Esta resolve o **modelo** (exclusão reversível) e entrega o valor pro convidado
(lembrar que já confirmou, mudar, cancelar). A **lixeira no painel** — ver e restaurar o que foi
cancelado — fica para a Fatia 18.

**Por que nesta ordem:** construir o cancelar em cima de delete duro e depois trocar por lixeira é
construir duas vezes. A semântica de exclusão se decide uma vez, agora, e as duas pontas
(convidado cancela / organizador apaga) passam a usar a mesma.

**Por que agora:** o "você já confirmou" só serve para quem confirmar **depois** de isto estar no
ar. Se o link for divulgado antes, a fatia nasce metade inútil.

## Decisão de escopo já tomada
`whatsapp_contato` (o P2 da Fatia 11) **sai do backlog**. O botão "Falar com o Bruno" seria a única
coisa que a coluna serviria, e ela tornaria um telefone pessoal publicamente legível — a `party` é
lida por qualquer visitante. No lugar, texto: "fale com quem te convidou". Um item a menos, uma
exposição a menos.

## Escopo

### 1. Schema — aditivo, nunca recreate
`rsvps.deleted_at timestamptz null`. **`alter table … add column`** no banco; e o
`supabase-setup.sql` atualizado para quem instala do zero. Os dois têm de concordar.

É a primeira mudança de schema sob a regra que ficou valendo depois da Fatia 16: **aditiva**. Não
recrie — a `party` e a `settings` têm dado real e a trava vai (corretamente) abortar.

### 2. Toda leitura passa a filtrar
Listas, contagens, estimativa, rateio e acerto só enxergam `deleted_at is null`. Uma confirmação
cancelada **sai dos números** — some da lista, do Resumo, das Compras e das Contas.

### 3. `cancel_rsvp(p_id uuid)`
- `security definer`, `search_path` fixo, `revoke from public`, `grant execute to anon, authenticated`.
- **Marca `deleted_at`, não apaga.**
- O `uuid` **é** a credencial: 128 bits, não se adivinha, mesmo padrão de link de descadastro.
- **Não devolva conteúdo da linha** nem diferencie "não existe" de "não é sua" — sem oráculo.
- **Gate de prazo: cancelar obedece o mesmo prazo que confirmar.** Depois do prazo, não cancela.
  Isso não é detalhe de UI, é a regra de negócio do projeto: o custo é **comprometido na
  confirmação** (é por isso que no-show não muda o rateio, §4.2). Deixar cancelar depois do prazo
  seria deixar alguém sair da conta com a pizza já encomendada.

### 4. O dedupe do `create_rsvp` tem de aprender o modelo novo
Hoje o reenvio apaga o grupo anterior de mesmo `contact_norm`. Com exclusão reversível isso muda:
a busca por duplicata precisa considerar **só as não-canceladas**, e o que for substituído deve
virar cancelado (não sumir). Senão o reenvio ressuscita linha antiga ou cria duplicata invisível.
Diga no plano como fica.

### 5. Convite: lembrar, mudar, cancelar
- No sucesso, guardar no navegador `{ rsvpId, e o que foi enviado, quando }`.
- No load, havendo registro **e prazo aberto**: preencher o formulário e mostrar uma tarja discreta
  — "você confirmou em DD/MM; enviar de novo substitui a confirmação anterior".
- **"Mudar minha confirmação"** reabre o formulário preenchido, sem recarregar.
- **"Não vou mais poder ir"** chama o `cancel_rsvp`, com confirmação nomeando o que sai, e depois
  mostra que foi cancelado — com o formulário disponível de novo, porque plano muda duas vezes.
- Sem registro no navegador (limpou, trocou de aparelho), não há cancelar: mostre o texto de falar
  com quem convidou. É limitação assumida, não bug.

### 6. Painel: o excluir passa a ser reversível
O botão de excluir do card marca `deleted_at` em vez de apagar. **A tela de restaurar é a Fatia
18** — até lá, o cancelado fica invisível no painel e só volta por SQL. Ainda assim é melhor que
hoje: o dado deixa de evaporar. Diga isso no `status.md` para não parecer esquecimento.

## Fora de escopo
`js/calc.js` (nada de cálculo muda — o que muda é **quem entra** na conta), o visual das telas, a
lixeira do painel (Fatia 18), e `whatsapp_contato`, que saiu.

## Riscos que quero endereçados no plano
1. **Filtro esquecido em alguma leitura** é o modo de falha desta fatia: uma cancelada que continua
   contando em Compras faz você comprar chopp a mais. Liste **todas** as leituras de `rsvps` e
   `people` e mostre onde o filtro entra em cada uma.
2. **O uuid no navegador é a única chave.** Descreva o que acontece se ele apontar para uma linha já
   cancelada, ou para uma que não existe mais.
3. **RLS**: a nova RPC é anônima e **muta**. Prove pelo estado do banco, como sempre — inclusive que
   um uuid aleatório não cancela nada.

## Verify
- `./verify.sh` verde, 63 asserções.
- **Cancelar ponta a ponta** em produção: confirmar pelo formulário, cancelar pelo botão, e provar
  por `SELECT` que a linha continua lá com `deleted_at` preenchido — e que sumiu de lista, Resumo,
  Compras e Contas.
- **Prazo**: com o prazo vencido, o `cancel_rsvp` **recusa** (saída crua do erro).
- **Uuid aleatório não cancela nada**; uuid de linha já cancelada é no-op silencioso.
- **Reenvio (dedupe)** ainda funciona sob o modelo novo: reenviar com o mesmo contato substitui, e o
  anterior fica cancelado, não duplicado nem ressuscitado.
- **localStorage**: confirmar → recarregar → volta preenchido com a tarja; cancelar → recarregar →
  formulário limpo; limpar o storage → formulário limpo.
- **Contagens**: uma cancelada não aparece em nenhum número de nenhuma aba.
- **Nada de recreate** — provar que a mudança foi `alter table`, e que `party`/`settings`/fotos
  seguem intactas.
- Tabela de hashes no `status.md`.

## Observação
Se em algum ponto o modelo reversível colidir com o rateio (por exemplo, cancelar depois do
fechamento lançado), **pare e pergunte no plano** em vez de decidir sozinho — ali é dinheiro.
