# Plano — Fatia 17: modelo de exclusão e cancelamento pelo convidado

Branch: `feat/fatia-17-cancelamento`

Entrada: `prompt.md` (Cowork).

---

## Risco 1 — onde o filtro entra: **um lugar só**

Levantei todas as leituras. São menos do que parece, e isso é consequência direta da decisão da
Fatia 12 ("as abas não carregam nada"):

| Onde | O quê | Filtro |
|---|---|---|
| `admin.js:1107` `loadRSVPs()` | `from("rsvps").select("*")` | **sim** — `.is("deleted_at", null)` |
| `admin.js:1108` `loadRSVPs()` | `from("people").select("*")` | **sim** — ver abaixo, é o pulo do gato |
| `admin.js:555` `loadCelebrants()` | `from("people").eq("role","celebrant")` | **não** — aniversariante não tem `rsvp_id`, cancelamento não o alcança |
| `admin.js:610/611` | update/insert de aniversariante | escrita, não leitura |
| `supabase-setup.sql:31` | `count(*) from rsvps` na trava do reset | **não** — ver abaixo |
| `supabase-setup.sql:419` | o dedupe do `create_rsvp` | **sim** — vira update, risco 4 |

**Todo o resto do painel deriva de `lastGroups` e `lastPeople`**, que só o `loadRSVPs()` escreve.
Resumo, Quem vem, Compras e Contas não tocam no banco: leem essas duas variáveis. Então o filtro
entra em **um ponto** e cobre a aba inteira. Vou marcar isso com comentário no lugar, porque é a
propriedade que torna o risco 1 tratável — e que alguém pode destruir sem perceber ao adicionar
uma consulta nova.

⚠️ **O pulo do gato:** `deleted_at` mora em `rsvps`, não em `people`. Filtrar só os grupos deixaria
as *pessoas* do grupo cancelado dentro de `lastPeople` — e elas continuariam contando em
estimativa, rateio e acerto. **É exatamente o modo de falha do risco 1**: chopp comprado a mais.

Filtro as pessoas **no cliente**, logo depois do fetch, contra o conjunto de grupos sobreviventes:
mantenho a linha se `rsvp_id` é null (aniversariante) ou se o grupo dela sobreviveu. Fazer isso no
PostgREST exigiria um `!inner` que derrubaria os aniversariantes junto — mais frágil que a linha
de código.

**A trava do reset conta cancelados de propósito.** Uma confirmação cancelada continua sendo dado
real de convidado — é justamente o conteúdo da futura lixeira. Se a trava passasse a ignorá-los, um
recreate apagaria a lixeira em silêncio. Registro isso em comentário lá.

## Risco 2 — o uuid no navegador

| Situação | O que acontece |
|---|---|
| uuid válido, linha ativa | cancela; a tela mostra cancelado e o formulário volta limpo |
| uuid de linha **já cancelada** | no-op silencioso — o `update` casa zero linhas e a RPC não reclama |
| uuid **inexistente** (recreate, admin apagou de verdade) | idêntico: zero linhas, mesma resposta |
| uuid aleatório | idêntico. **Sem oráculo**: as três respondem igual |

A RPC não devolve conteúdo nem distingue os casos — é o que o prompt pede, e é o que impede usar o
endpoint para descobrir se um uuid existe.

⚠️ **Limitação que assumo e escrevo na tela:** o navegador não consegue *verificar* o que guardou.
Não existe leitura de RSVP para o anônimo (e criar uma seria o oráculo que acabamos de evitar).
Então, se o organizador apagar a confirmação pelo painel, o convidado continua vendo "você
confirmou em DD/MM" até tentar cancelar ou reenviar. Reenviar resolve sozinho; cancelar vira no-op.
Nenhum dos dois causa dano — só uma tarja desatualizada.

## Risco 3 — RLS

`cancel_rsvp` é anônima e **muta**. `security definer`, `search_path` fixo, `revoke from public`,
`grant execute to anon, authenticated`. A prova é a de sempre neste repo: **pelo estado do banco**.

Vou provar quatro coisas: o uuid certo marca `deleted_at`; um uuid aleatório não mexe em nada
(contagem de `deleted_at is not null` inalterada); o anon continua sem `UPDATE` direto em `rsvps`;
e o cancelamento não apaga a linha.

## Risco 4 — o dedupe

Hoje: `delete from rsvps where contact_norm = …`. Vira:

```sql
update public.rsvps
   set deleted_at = now()
 where contact_norm = public.normalize_contact(p_contact)
   and deleted_at is null;
```

Duas mudanças no comportamento, as duas necessárias:
- a busca por duplicata passa a considerar **só as ativas** — senão uma cancelada antiga bloquearia
  ou ressuscitaria;
- o substituído fica **cancelado**, não some. Reenviar três vezes deixa duas canceladas e uma ativa,
  e o histórico existe.

O índice único parcial `rsvps_contact_norm_idx` precisa acompanhar: hoje ele garante um contato por
linha; com exclusão reversível, ele tem de garantir **um contato entre as ativas**. Vira
`where deleted_at is null`. Sem isso, o segundo envio esbarra no índice antes de chegar no update.

## Schema — aditivo

```sql
alter table public.rsvps add column if not exists deleted_at timestamptz;
```

Aplicado **à parte** no banco, e o `supabase-setup.sql` atualizado para descrever o schema inteiro.
Nada de recreate: `party` e `settings` têm dado real e a trava — que acabei de ressuscitar — vai
abortar, corretamente.

## Convite

Retomo o commit 6 que saiu da Fatia 11, agora com o cancelar que faltava:

- no sucesso, guardo `{ rsvpId, payload, quando }`;
- no load, com registro **e prazo aberto**, preencho e mostro a tarja;
- **"Mudar minha confirmação"** reabre o formulário preenchido (já existe, da Fatia 11);
- **"Não vou mais poder ir"** → confirmação nomeando quem sai → `cancel_rsvp` → tela de cancelado,
  com o formulário disponível de novo;
- sem registro no navegador: sem cancelar, com o texto "fale com quem te convidou".

## Painel

O excluir do card passa a marcar `deleted_at`. Mantenho a confirmação nomeada e o toast com o
conteúdo — que agora é **rede redundante**, não a única: o dado deixou de evaporar.

O `status.md` vai dizer, com todas as letras, que **restaurar é a Fatia 18** e que até lá o
cancelado só volta por SQL. Sem isso parece esquecimento.

---

## Commits

1. `feat`: schema (`deleted_at` + índice parcial) e o `cancel_rsvp`
2. `feat`: dedupe do `create_rsvp` sob o modelo novo
3. `feat`: o filtro nas leituras do painel + excluir reversível
4. `feat`: convite — lembrar, mudar e cancelar

## Verificação

`./verify.sh` verde, 63 asserções.

1. **Cancelar ponta a ponta em produção**: confirmar pelo formulário, cancelar pelo botão,
   `SELECT` mostrando a linha viva com `deleted_at` preenchido, e sumida de lista, Resumo, Compras
   e Contas.
2. **Prazo**: com o prazo vencido, `cancel_rsvp` recusa — saída crua.
3. **Sem oráculo**: uuid aleatório, uuid já cancelado e uuid inexistente dão a mesma resposta e
   não mexem em nada.
4. **Dedupe**: reenviar com o mesmo contato deixa o anterior cancelado, não duplicado nem
   ressuscitado; e o índice parcial aceita o segundo envio.
5. **`localStorage`**: confirmar → recarregar → tarja; cancelar → recarregar → limpo; limpar
   storage → limpo.
6. **Contagens**: uma cancelada não aparece em número nenhum de aba nenhuma — incluindo as
   **pessoas** dela, que é o modo de falha do risco 1.
7. **Nada de recreate**: provar que foi `alter table`, e que `party`, `settings` e as fotos seguem.
8. **Convite intacto** e **modo escuro idêntico**.
9. Tabela de hashes.

---

## Pergunta

**P1 — o excluir do organizador precisa de trava de prazo, como o cancelar do convidado?**

O prompt manda parar e perguntar se o modelo colidir com o rateio. Colide, e num lugar só:

- **O cancelar do convidado está protegido**: obedece o prazo (01/10), e o fechamento acontece
  depois da festa (31/10). Nunca se encontram.
- **O excluir do organizador não tem trava nenhuma.** Se ele apagar um grupo depois de lançar
  `actual_beer_cost`, o rateio recalcula na hora: **o mesmo dinheiro dividido entre menos gente**,
  mudando quanto cada aniversariante paga, com a compra já feita.

E isso contradiz a regra §4.2, que é a razão de no-show não mexer no rateio: **o custo é
comprometido na confirmação**. Quem confirmou e não foi continua na conta. Apagar a confirmação
depois do prazo faz por outro caminho o que a regra proíbe.

Três saídas, em ordem de força:

1. **Mesma trava do convidado** — depois do prazo, o painel não exclui. Simples e coerente, mas
   tira do organizador o poder de corrigir um engano (grupo duplicado, teste esquecido).
2. **Trava só depois do fechamento começar** (`actual_*_cost` preenchido) — o organizador corrige
   à vontade entre o prazo e a compra, e trava quando o dinheiro entra na conta. **É a que eu
   recomendo.**
3. **Aviso, sem trava** — o confirm passa a dizer que isso altera contas já fechadas. Mais fraco,
   mas preserva o controle.

Não decido sozinho porque é regra de negócio e é dinheiro. Os commits 1, 2 e 4 não dependem da
resposta; só o 3 (excluir do painel) depende.
