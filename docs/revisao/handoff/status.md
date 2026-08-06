# Status — Fatia 18: a lixeira, e a porta do apagar fechada

**Fatia fechada.** Nada evapora mais, e agora dá para ver e trazer de volta o que saiu. A última
porta por onde ainda se apagava de verdade está trancada — não encostada.

| | |
|---|---|
| Branch | `feat/fatia-18-lixeira` → merge `--ff-only` → apagada |
| Commits | 3, os dois de código verdes no `./verify.sh` |
| Schema, RPCs e a porta | *(hash abaixo)* |
| Lixeira no painel | *(hash abaixo)* |
| `tests/calc.test.js` | 63 asserções, inalteradas — `js/calc.js` não foi tocado |
| Invariantes no `verify.sh` | 8 → **9** |

## ⚠️ LEIA ISTO PRIMEIRO — o botão de excluir do painel no ar vai dar erro

Produção serve a **Fatia 16**. Aquele painel apaga com `.from("rsvps").delete()` direto; a RPC só
chegou na 17, que **não publicou** (ver o fim deste documento).

Como a porta foi fechada agora no banco, no intervalo até o deploy sair:

> **O botão "Excluir" do painel que está no ar vai falhar, com erro.** Isso é o desejado.

E é melhor assim do que a alternativa. Até hoje, aquele botão fazia exclusão **dura**, por cima da
trava do custo lançado, com o dado evaporando. Fechar já e deixar o botão errar é preferível a
esperar o Pages voltar com a porta aberta.

Graças ao `revoke` (§ abaixo), o erro é **alto** — `42501`, com toast na tela. Se só tivéssemos
derrubado a política, o botão diria "apagado" e não apagaria nada, que é bem pior.

## O achado do review: são TRÊS portas, não duas

Nem o prompt nem o meu plano olharam para a terceira coisa que grava `deleted_at` — o dedupe do
`create_rsvp`:

```sql
update public.rsvps set deleted_at = now()
 where contact_norm = public.normalize_contact(p_contact) and deleted_at is null;
```

Toda vez que alguém reenvia o formulário — troca de ideia sobre refrigerante, corrige o nome do
filho, acrescenta um acompanhante — a confirmação anterior vira cancelada. Sem tratar isso, a
lixeira **mentiria**: empilharia fantasmas dos próprios convidados ao lado de quem de fato
desistiu, cada um com um botão de restaurar que só poderia dar errado, porque a linha nova já ocupa
o contato.

Conserto: um terceiro valor, `'resend'`, que na tela aparece **sem** botão.

```
guest   cancelou pelo link           + Trazer de volta
admin   você tirou da lista          + Trazer de volta
resend  substituída por um reenvio   sem botão
```

Ganho colateral, e ele importa: o `23505` volta a ser a rede para a corrida rara em vez do caminho
comum. Defesa exercitada toda semana vira ruído, e alguém acaba "simplificando" ela fora.

## A correção de fato: o `check` não fazia o que eu disse que fazia

Escrevi no plano que `check (deleted_by in ('guest','admin'))` protegeria contra um caminho novo
esquecer a procedência. **Não protege** — `CHECK` sobre `NULL` avalia `NULL`, e `NULL` não é falso:
a restrição passa. Quem faz esse trabalho é a restrição de par.

Provei que cada uma pega uma classe diferente, e nenhuma cobre a outra:

```
cancelar SEM procedência       RECUSOU — rsvps_deleted_pair
deleted_by = 'organizer'       RECUSOU — rsvps_deleted_by_check
deleted_at + deleted_by admin  PASSOU
restaurar (limpa os dois)      PASSOU
```

## A porta, e por que o `revoke` não era luxo

As duas políticas de `delete` eram capacidade morta — nenhum código as usava desde a 17 — mas a API
seguia expondo: um admin logado montando a chamada REST na mão apagava a linha por cima da trava do
custo, sem deixar nada na lixeira.

Derrubá-las sozinhas deixaria a porta **encostada**. O grant de tabela continuava, herdado do
default do Supabase, e com grant presente e política ausente o `DELETE` não dá erro: apaga zero
linhas e devolve **sucesso**. Com o `revoke` autorizado:

```
=== rsvps ===
  DELETE como authenticated  -> 42501 permission denied for table rsvps
  DELETE como anon           -> 42501 permission denied for table rsvps
  select antes: 1  ·  select depois: 1  INTACTA

=== people ===
  DELETE como authenticated  -> 42501 permission denied for table people
  DELETE como anon           -> 42501 permission denied for table people
  select antes: 1  ·  select depois: 1  INTACTA
```

A prova é o `select` antes e depois, não o código de erro — foi o review que insistiu nisso, e com
razão: "não deu erro" nunca prova que fechou.

O `revoke` está **no arquivo**, não só no banco. Sem a linha, uma instalação do zero nasceria com o
grant de volta pelo default do Supabase, e o banco novo divergiria de produção em silêncio.

A política de fotos fica: apagar foto é apagar mesmo.

## A cerca da lixeira — topologia, não disciplina

A lixeira sai do **complemento** da leitura que já existia. As canceladas já vinham e eram
descartadas; agora são guardadas. Nenhuma consulta nova — um `.not("deleted_at","is",null)` teria
quebrado a invariante de leitura única que a 17 deixou, e a invariante está certa.

`lastGroups`/`lastPeople` continuam recebendo **só o ativo**, e são eles que alimentam estimativa,
rateio e acerto. O cancelado mora em `lastDeleted`/`lastDeletedPeople`, lidos só pelo
`renderTrash()`. Dois mapas, duas telas, sem interseção.

Executando o bloco que está no `js/admin.js` contra as linhas reais:

```
na lixeira: 3 · grupos ativos: 3 · VAZAMENTO: 0
portas: cancelou pelo link · você tirou da lista · substituída por um reenvio
botões "Trazer de volta": 2   (o reenvio não tem, de propósito)
```

## A colisão, nos dois níveis — e os dois são necessários

Cenário provável, não exótico: cancelou, mudou de ideia, confirmou de novo. Restaurar a antiga
esbarra no índice único parcial.

**No cliente, antes da RPC**, para a frase sair com nome e data — e não custa consulta nenhuma,
porque `contact_norm` é coluna gerada que já vem no `select("*")` e a linha ativa já está em
`lastGroups`:

```
tentando zz18-colisao   (guest)  -> BLOQUEADO: zz18-colisao-nova já confirmou de novo em 06/08, 16:00
tentando zz18-admin     (admin)  -> segue para a RPC
```

**E a captura do `23505`**, porque o estado do cliente pode estar velho — outra aba, outro
organizador, ou o convidado reconfirmando entre o carregar e o clicar. Saída crua da tentativa:

```
código : 23505
msg    : duplicate key value violates unique constraint "rsvps_contact_norm_active_idx"
detalhe: Key (contact_norm)=(51911110009) already exists.

zz18-colisao         guest    fora da lista     ← continua fora
zz18-colisao-nova    -        ATIVA             ← continua ativa
```

## O gate do restaurar

Uma regra só, agora para as **três** portas: lançar custo congela a lista. Restaurar mexe no
dinheiro tanto quanto excluir, só que pelo outro lado — devolve um consumidor à conta.

```
=== restaurar COM custo lançado ===
  antes : fora
  P0001 As compras já começaram: trazer alguém de volta agora mudaria o rateio de quem já
        pagou. Para corrigir mesmo assim, limpe o custo lançado na aba Contas, traga de
        volta, e lance o valor de novo.
  depois: fora

=== limpo o campo (a saída de emergência) ===
  PASSOU, como deve
  depois: ATIVA
```

`anon` chamando `restore_rsvp` → `42501 permission denied for function restore_rsvp`.

## A nona invariante, provada nas quatro direções

Ela vigia as **duas** metades da mesma propriedade, porque uma invariante que cobre metade dá falsa
sensação:

```
política replantada em rsvps   → VERMELHO
política replantada em people  → VERMELHO
revoke sumindo do arquivo      → VERMELHO
política de FOTOS presente     → VERDE   (é outro assunto, tem de continuar passando)
```

## O que NÃO fiz

**Não dirigi o painel logado** — ele pede a senha do Bruno, e digitar senha não é coisa que eu faça.
Provei o que dava sem ela: a lixeira renderizada executando as funções que estão no arquivo com as
linhas reais do banco, as travas por SQL com o JWT de um admin de verdade, e as invariantes
estáticas. Falta o olho dele na tela logada.

**Não construí apagar definitivo nem "esvaziar lixeira"**, como o prompt determinou. Se um dia
alguém pedir para sumir de verdade com o próprio dado, é SQL, na mão, com intenção.

## Higiene

As 6 linhas de teste foram apagadas **cada uma pelo nome que eu dei** (`zz18-%`), nunca por data ou
intervalo — e como `postgres`, dono da tabela, porque `anon` e `authenticated` não conseguem mais,
que é justamente o ponto desta fatia. O campo de custo, plantado para testar o gate, voltou ao
original.

```
grupos ativos     : 0
fora da lista     : 0
aniversariantes   : 3
custo lançado?    : False
prazo             : 01/10/2026 23:59:59
fotos             : 3
```

## O deploy — **parado**, e não é nosso

Reconferi agora, antes de fechar:

```
GitHub Actions  major_outage
GitHub Pages    major_outage
incidente aberto desde 06/08 15:22 UTC
  "Workflow runs are failing or delayed in starting"

Pages serve: 28.755 bytes   (Fatia 16)
local:       36.482 bytes   (Fatias 17 + 18)
```

Não digo "publicado" porque não publicou. O `git` está operacional e os commits chegaram; quem caiu
foi quem publica. Quando o incidente fechar, um push reenfileira — e aí as Fatias 17 e 18 sobem
juntas, e o aviso do topo deste documento deixa de valer.

## Pendência do Bruno, que não é fatia

Rotacionar a senha do Postgres. Ela circulou no chat.
