# Status — Fatia 5: fechamento e rateio

**Fatia fechada.** Aprovada sem ajustes, com a diferença em R$ no selo vermelho confirmada pelo
review. O caso do ×6,5 da regra de negócio fecha ponta a ponta pela tela.

| | |
|---|---|
| Branch | `feat/fatia-5-fechamento` → merge `--ff-only` → apagada |
| Commit da fatia | `81961c802f0fe60a668efa2b3290cadee754dbd4` |
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

## Base de teste — o padrão do ×6,5

Grupo `G5` com `convidado_por=[1]` e 5 pessoas no chopp; grupo `Compartilhado` com
`convidado_por=[1,2]` e 1 pessoa no chopp; os 3 aniversariantes, com Bruno no chopp.

```
consumidores de chopp = 7 (esperado 7)
grupos: (['Compartilhado', [1, 2]], ['G5', [1]])
```

Preços de referência da Fatia 2 preenchidos (18,50 / 6,00 / 3,00 / 45,90 / 24,50) e prazo
definido — para provar depois que o fechamento não os toca.

## Verificação integrada — saída crua

### 1. Estado inicial: sem custo lançado → selo cinza
```json
{ "seloAntesDeLancar": { "classe": "selo cinza",
    "texto": "Fechamento incompleto — lance o custo real de chopp, refrigerante e água para fechar as contas." },
  "contas": [ {"nome":"Bruno","total":"R$ 0,00"}, {"nome":"Braz","total":"R$ 0,00"}, {"nome":"Bocão","total":"R$ 0,00"} ],
  "camposVazios": ["", "", "", "", ""] }
```

### 2. **O ×6,5 pela tela** — lançando `custo_real_chopp = 700,00`
```json
{ "msg": "Fechamento salvo. ✅",
  "contas": [
   { "nome": "Bruno", "total": "R$ 650,00", "itens": ["Chopp: R$ 650,00"] },
   { "nome": "Braz",  "total": "R$ 50,00",  "itens": ["Chopp: R$ 50,00"] },
   { "nome": "Bocão", "total": "R$ 0,00",   "itens": [] } ],
  "totais": ["Total gasto = R$ 700,00", "Total rateado = R$ 700,00"],
  "selo": { "classe": "selo verde", "texto": "✓ As contas fecham: a soma das 3 é exatamente o total gasto." } }
```

7 consumidores → C = R$ 100,00. Bruno = 5 + 0,5 + 1 = **6,5 unidades** = R$ 650,00. Braz leva a
meia unidade do convidado compartilhado = R$ 50,00. É o número da regra de negócio §4.2, ao
centavo, agora pelo caminho real (tela → RPC → banco → cálculo → tela).

### 3. **Update estreito** — campos da Fatia 2 intactos
```
CAMPOS DA FATIA 2, apos salvar o fechamento:
  precos referencia: 18.50 6.00 3.00 45.90 24.50
  taxas            : 2.000 0.600 0.500
  prazo            : 2026-10-21 02:59:59+00:00
  -> INTACTOS ✅

CAMPOS DA FATIA 5 (gravados agora): [Decimal('700.00'), Decimal('0.00'), Decimal('0.00'), None]
```

### 4. Caso órfão → selo vermelho **com a diferença**
Lançando `custo_real_refri = 120,00` numa base onde ninguém bebe refri:
```json
{ "selo": "selo vermelho",
  "texto": "✗ A soma das contas não bate com o total gasto — diferença de R$ 120,00. Sobrou custo sem ninguém para ratear: confira se lançou algo que ninguém consumiu.",
  "totais": ["Total gasto = R$ 820,00", "Total rateado = R$ 700,00"],
  "contas": ["Bruno = R$ 650,00", "Braz = R$ 50,00", "Bocão = R$ 0,00"] }
```
A diferença (R$ 120,00) é **exatamente** o valor órfão — aponta direto para o item digitado
errado, que era o argumento para mostrá-la.

### 5. Fechamento incompleto → cinza **mesmo com as somas coincidindo**
Apagando refri e água, sobra só o chopp lançado:
```json
{ "selo": "selo cinza",
  "texto": "Fechamento incompleto — lance o custo real de chopp, refrigerante e água para fechar as contas.",
  "totais": ["Total gasto = R$ 700,00", "Total rateado = R$ 700,00"] }
```
**700 = 700 e o selo continua cinza.** Se o selo comparasse só os totais, este caso passaria por
verde estando incompleto. Verde exige as duas condições.

### 6. Pizza real x referência
Com Bruno comendo pizza:
```json
{ "comPrecoReal_60": { "total": "R$ 710,00", "itens": ["Chopp: R$ 650,00", "Pizza: R$ 60,00"] },
  "totais": ["Total gasto = R$ 760,00", "Total rateado = R$ 760,00"],
  "semPrecoReal_referencia": { "total": "R$ 695,90", "itens": ["Chopp: R$ 650,00", "Pizza: R$ 45,90"] },
  "selo": "selo verde" }
```
Com `preco_real_pizza_adulto = 60,00` entra o real; em branco cai na referência de 45,90 — como
o `precoPizza` já fazia.

> **Um tropeço meu no método de teste:** na primeira tentativa a pizza não aparecia. Eu tinha
> ligado o `come_pizza` do Bruno direto no banco, mas a tela guarda `ultimasPessoas` em memória e
> o save do fechamento só recarrega a `config` — o que está certo, porque salvar o fechamento não
> muda as pessoas. Bastou o "↻ Atualizar". Erro do meu procedimento, não do código.

### 7. Negativo (RLS) — provado pelo estado do banco
```
anon SELECT config:  []
anon UPDATE custo_real (tentando zerar): HTTP 204
--- prova pelo estado do banco (nao pelo HTTP) ---
  custo_real_chopp        = 700.00 (o anon tentou zerar)
  preco_real_pizza_adulto = None (o anon tentou zerar)
  -> INTACTO ✅
```
O `204` de novo. Terceira fatia seguida em que o `UPDATE` anônimo "sucede" sobre zero linhas.

### 8. Base restaurada
```
rsvps = 0
pessoas = 0
admins = 4
config = [2.000, 0.600, 0.500, 0.00, None, None, None]
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
```
Usuário temporário apagado.

## O que a implementação fez

- **`ultimosGrupos`** guardado ao lado de `ultimasPessoas`; `recomputar()` estende a guarda de
  completude da Fatia 4 para exigir os três (config + pessoas + grupos) e dispara estimativa e
  rateio juntos.
- **Update estreito** dos 5 campos de fechamento + `atualizado_em`. Nunca um objeto amplo.
- **Vazio = `NULL`** aqui, invertido em relação à Fatia 2 — de propósito: lá vazio era
  esquecimento, aqui é "ainda não fechei".
- **Selo em três estados**, com a razão escrita e, no vermelho, a diferença em reais.

## Estado do produto

Com esta fatia, o ciclo completo do modelo está no ar: convite → RSVP → cadastro dos
aniversariantes → config → estimativa de compra → fechamento e rateio.

## Notas para a Fatia 6 (polimento)

- **Countdown no passado:** hoje trava em zero; combinar "É hoje!" no dia e esconder depois.
- **README:** ainda manda publicar arrastando a pasta no Netlify — obsoleto desde o começo.
- **HANDOFF.md:** descreve o estado de julho, antes de todo o modelo de rateio.
- **"Quem deve a quem"** e o link `wa.me`: continuam em aberto na §9 da ET. O rateio produz 3
  contas, mas quem pagou o fornecedor foi provavelmente uma pessoa só — falta decidir se o
  painel mostra o acerto entre eles ou se isso se resolve fora do sistema.
- **Dedup por contato** já está no schema desde a Fatia 0; nada a fazer.
- Ainda pendente do Bruno: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `81961c802f0fe60a668efa2b3290cadee754dbd4` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
