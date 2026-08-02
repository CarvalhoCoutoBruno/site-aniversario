# Plano — Fatia 3: cadastro dos aniversariantes

Branch: `feat/fatia-3-aniversariantes`

## O risco que medi antes de planejar: o `.upsert()` **não** funciona aqui

O prompt pede "upsert por `aniversariante_id`". O índice que garante a unicidade é **parcial**:

```sql
CREATE UNIQUE INDEX pessoas_aniversariante_id_unico
  ON public.pessoas USING btree (aniversariante_id)
  WHERE (papel = 'aniversariante'::text)
```

`ON CONFLICT` precisa inferir o índice, e para índice parcial a inferência tem de repetir o
predicado. Testei as duas formas contra o banco:

```
on conflict (aniversariante_id)                    ERRO -> there is no unique or exclusion
                                                            constraint matching the ON CONFLICT
                                                            specification
on conflict (aniversariante_id) where papel='aniversariante'   OK
```

O `.upsert({ onConflict: 'aniversariante_id' })` do supabase-js emite exatamente a **primeira**
forma — PostgREST não tem como expressar o `WHERE` do índice parcial. Então o caminho do prompt
falharia em runtime, no primeiro save.

**Solução:** não usar `.upsert()`. A tela já precisa ler as linhas existentes para popular o
formulário, então já sei quais existem. No save, por aniversariante:

- tem `id` → `update().eq("id", id)` (policy `admin edita pessoas`)
- não tem → `insert()` (policy `admin cadastra pessoas`)

Mais explícito, e nem toca no ponto onde o índice parcial atrapalha.

> **Corrida:** dois admins salvando ao mesmo tempo poderiam inserir os dois. Aí o índice parcial
> barra o segundo com erro de constraint — o banco protege. Basta a UI traduzir isso para
> "alguém acabou de cadastrar, recarregue a tela" em vez de mostrar erro cru.

## Implementação

### `admin.html`
Seção nova em `<details>` — mesmo padrão da config, fechado por padrão — logo **depois** da
config e antes das estatísticas (ordem da ET §7.2). Um bloco por aniversariante, montado pelo
JS a partir de `C.aniversariantes`.

Por aniversariante: nome (texto fixo, não editável), `tipo` (adulto/criança, default adulto) e
os 4 checkboxes (água, refri, chopp, pizza). Botão salvar único para os três + `.msg-toast`.

### `js/admin.js`
- `carregarAniversariantes()` — `select` em `pessoas` com `papel='aniversariante'`, casa por
  `aniversariante_id` e popula. Quem não tem linha fica vazio (adulto, nada marcado).
- `salvarAniversariantes()` — percorre os 3, monta o registro e decide `update` ou `insert`.
- `ligarRegraChoppAdmin(bloco)` — criança desmarca e desabilita o chopp.

O registro enviado nunca inclui `rsvp_id` nem `convidado_por`: a constraint
`aniversariante_sem_grupo` barraria, e `convidado_por` nem existe em `pessoas`.

`nome` vem sempre do `config.js`, a cada save — assim renomear lá propaga aqui, mantendo a
fonte única da identidade (a ordem no `config.js` continua sendo o id).

### `css/style.css`
Grade dos blocos. Reaproveita `.config-secao`, `.config-bloco` e os chips existentes.

## Decisões que quero confirmar no review

1. **Salvar cria linha para os 3, mesmo sem nada marcado.** Um aniversariante com tudo
   desmarcado é uma linha com 4 booleanos `false` — semanticamente "está na festa e não consome
   nada", o que é diferente de "não cadastrado". Acho isso mais previsível do que criar só quem
   tem consumo, mas é decisão de negócio: **se preferir só quem consome, digo como muda.**
2. **Não há "remover cadastro".** Para zerar, desmarca tudo. Incluir um delete daria ao admin
   uma forma de sumir com um pagante do rateio sem perceber. Se quiser, entra.
3. **A regra do chopp fica duplicada** entre `main.js` e `admin.js`. Não dá para levar ao
   `calculo.js`, que é puro e não pode tocar no DOM. São ~10 linhas; extrair para um quarto
   arquivo compartilhado me parece pior do que a duplicação. Aceita?

## Fora de escopo (não encosto)
Estimativa (Fatia 4), fechamento e `custo_real_*` (Fatia 5), formulário público, config
(Fatia 2, pronta), listagem de confirmações.

## Verify

`./verify.sh` verde (o cálculo não muda; espero 41/41).

Integrada, com saída crua no `status.md`:

1. logar como admin → tela mostra Bruno / Braz / Bocão com os ids 1 / 2 / 3 vindos do `config.js`;
2. definir consumo dos três → salvar → `SELECT` cru provando 3 linhas com
   `papel='aniversariante'`, `rsvp_id=NULL`, `aniversariante_id` 1/2/3, `nome` batendo com o
   `config.js` e as bebidas corretas;
3. **recarregar** → os valores persistem (é o teste que pega erro de casamento por id);
4. marcar um como criança → chopp desmarca e desabilita na tela;
5. **o ponto do upsert:** salvar de novo com valores diferentes → continua com **3 linhas**, não
   6, e os valores mudaram. É o que prova que o caminho `update`/`insert` funciona onde o
   `.upsert()` teria falhado;
6. **criança com chopp pelo banco** → a constraint `chopp_nao_para_crianca` barra (backstop);
7. **negativo (RLS):** anon tenta `select` e `insert` de aniversariante → provar pelo **estado do
   banco**, não pelo HTTP (o `204` da Fatia 2 mostrou que código de status não é evidência);
8. a contagem "Aniversariantes cadastrados: N/3" do painel reflete o cadastro;
9. restaurar a base ao fim (`pessoas = 0`).

Parado, sem implementar, aguardando `review.md`.
