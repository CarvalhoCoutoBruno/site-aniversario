# Status — Fatia 3: cadastro dos aniversariantes

**Fatia fechada.** Aprovada sem ajustes; as 3 decisões do plano confirmadas pelo review e
aplicadas. O achado do `.upsert()` se confirmou em runtime — o caminho `update`/`insert`
funciona onde o upsert teria falhado.

| | |
|---|---|
| Branch | `feat/fatia-3-aniversariantes` → merge `--ff-only` → apagada |
| Commit da fatia | `adcb024f622a2b3d1b6fd825836039cba26920f0` |
| `./verify.sh` | **VERDE** — 41/41, sem regressão |

## `./verify.sh`

```
Sintaxe
  ✓ js/admin.js   ✓ js/calculo.js   ✓ js/config.js   ✓ js/main.js   ✓ tests/calculo.test.js
Testes de cálculo
  ✓ ✓ 41 passaram, 0 falharam
Higiene
  ✓ sem connection string, service_role ou senha rastreada
  ✓ js/config.js preenchido
Coerência
  ✓ supabase-setup.sql sem placeholder
  ✓ js/main.js escreve só pelo RPC

VERDE — verificação estática ok. Falta a integrada (navegador + banco).
```

## Verificação integrada — saída crua

### 1. Tela carrega os 3 do `config.js`
```json
{ "painelVisivel": true,
  "secaoFechada": true,
  "blocos": [
   { "id": "1", "legenda": "Bruno (id 1)",  "tipoMarcado": "adulto", "bebidasMarcadas": 0, "pizzaMarcada": false },
   { "id": "2", "legenda": "Braz (id 2)",   "tipoMarcado": "adulto", "bebidasMarcadas": 0, "pizzaMarcada": false },
   { "id": "3", "legenda": "Bocão (id 3)",  "tipoMarcado": "adulto", "bebidasMarcadas": 0, "pizzaMarcada": false } ],
  "statAniv": "Aniversariantes cadastrados=0/3" }
```

### 2. Primeiro save — `SELECT` cru
Tela: `{"msg": "Aniversariantes salvos. ✅", "statAniv": "Aniversariantes cadastrados=3/3"}`

```
LINHAS (aniv_id, nome, tipo, papel, rsvp_id, agua, refri, chopp, pizza):
   [1, 'Bruno', 'adulto', 'aniversariante', None, False, False, True, True]
   [2, 'Braz',  'adulto', 'aniversariante', None, False, True,  False, False]
   [3, 'Bocão', 'adulto', 'aniversariante', None, True,  False, False, False]
  total = 3
```
`rsvp_id = None` nos três, `papel` e `aniversariante_id` corretos, `nome` batendo com o
`config.js`.

### 3. Recarregar — os valores persistem
```json
{ "persistiuAposReload": {
   "bruno": { "tipo": "adulto", "agua": false, "refri": false, "chopp": true, "pizza": true },
   "braz":  { "tipo": "adulto", "agua": false, "refri": true,  "chopp": false, "pizza": false },
   "bocao": { "tipo": "adulto", "agua": true,  "refri": false, "chopp": false, "pizza": false } } }
```
É o teste que pegaria erro no casamento por `aniversariante_id`.

### 4. Chopp × criança na tela
Marcando Braz como criança:
```json
{ "regraChoppCrianca": { "desabilitado": true, "riscado": true, "avisoVisivel": true } }
```

### 5. **A prova do upsert** — segundo save com valores diferentes
Bruno perdeu o chopp e ganhou água; Braz virou criança.

```
PROVA DO UPSERT — apos o SEGUNDO save:
  total de linhas = 3 (esperado 3; com .upsert() quebrado seriam 6 ou erro)
   [1, 'Bruno', 'adulto',  True, False, False, True]
   [2, 'Braz',  'crianca', False, True, False, False]
   [3, 'Bocão', 'adulto',  True, False, False, False]
  ids distintos = 3
```

Confirma em runtime o que o plano tinha medido em SQL: `ON CONFLICT (aniversariante_id)` — a
única forma que o supabase-js sabe emitir — falha contra o índice **parcial**
(`WHERE papel='aniversariante'`), porque a inferência de índice parcial exige repetir o
predicado. Ler as linhas e decidir `update`/`insert` resolve e deixa o código mais explícito.

### 6. Backstop do banco
```
  update Braz (crianca) para bebe_chopp=true     rejeitou -> violates check constraint
  insert aniversariante_id=1 duplicado           rejeitou -> violates unique constraint
```
A regra do chopp na tela é espelho de UX; a fonte da verdade é a constraint.

### 7. Negativo (RLS) — provado pelo estado do banco
```
  anon SELECT pessoas: []
  anon INSERT aniversariante: {"code":"42501","message":"new row violates row-level security policy for table \"pessoas\""}
  anon UPDATE aniversariante 1: HTTP 204
  anon DELETE aniversariantes: HTTP 204
```

> Os dois `204` de novo — como na Fatia 2, **parecem sucesso**. O `DELETE` do anon pediu para
> apagar os três aniversariantes e voltou `204 No Content`. Só o `SELECT` como dono resolve:
> ```
> depois das tentativas do anon (UPDATE bebe_chopp=true e DELETE de todos):
>   total de linhas = 3 (o anon tentou APAGAR os 3)
>    [1, 'Bruno', 'adulto',  True, False, False, True]
>    [2, 'Braz',  'crianca', False, True, False, False]
>    [3, 'Bocão', 'adulto',  True, False, False, False]
>   -> INTACTO ✅ (nao apagou, nao alterou o chopp do Bruno)
> ```
> Só o `INSERT` devolve `42501` explícito, porque a policy de insert avalia o `WITH CHECK` na
> linha nova. `UPDATE` e `DELETE` filtram por `USING`: sem linha visível, não há o que
> rejeitar — a operação "sucede" sobre zero linhas.

### 8. Base restaurada
```
rsvps = 0
pessoas = 0
admins = 4
config (taxas, prazo, custo_real) = [2.000, 0.600, 0.500, None, None]
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
```
Usuário temporário apagado.

## Decisões aplicadas (confirmadas no review)

1. **Save cria linha para os 3**, mesmo sem nada marcado — linha com booleanos `false` é "está
   na festa, não consome", diferente de "não cadastrado".
2. **Sem "remover cadastro"** — zerar é desmarcar.
3. **Regra do chopp duplicada** entre `main.js` e `admin.js`, com a constraint como fonte única.

## Notas para a próxima fatia (4 — estimativa)

- **Os 3 aniversariantes agora têm linha** quando o organizador salvar a tela; até lá a base
  fica sem eles, e a estimativa sairia sem o consumo dos três. A tela mostra "cadastrados: N/3",
  o que dá para usar como aviso na Fatia 4 se `N < 3`.
- **`calculo.js` já está no `admin.html`** desde a Fatia 2 — `estimativa(pessoas, config)` está
  pronta e testada, faltando só a tela.
- A estimativa precisa de **todas** as pessoas: as de grupos (`rsvp_id` preenchido) e as três de
  `papel='aniversariante'`. O `carregarRSVPs` já faz esse join e separa os aniversariantes.
- Ainda pendente do Bruno: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `adcb024f622a2b3d1b6fd825836039cba26920f0` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
