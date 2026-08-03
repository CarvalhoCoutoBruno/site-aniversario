# Status — Fatia 6: acerto (quem deve a quem)

**Fatia fechada.** Aprovada com a inclusão da trava estendida do reset, que entrou nesta rodada.
O acerto do ×6,5 fecha pela tela: **Braz → Bruno R$ 50,00**.

| | |
|---|---|
| Branch | `feat/fatia-6-acerto` → merge `--ff-only` → apagada |
| Commit da fatia | `986973511b159c48e0b87947b3497f6f8d51b5f5` |
| `./verify.sh` | **VERDE** — **57** asserções (eram 41) |

## `./verify.sh`

```
Sintaxe
  ✓ js/admin.js   ✓ js/calculo.js   ✓ js/config.js   ✓ js/main.js   ✓ tests/calculo.test.js
Testes de cálculo
  ✓ ✓ 57 passaram, 0 falharam
Higiene
  ✓ sem connection string, service_role ou senha rastreada
  ✓ js/config.js preenchido
Coerência
  ✓ supabase-setup.sql sem placeholder
  ✓ js/main.js escreve só pelo RPC

VERDE — verificação estática ok. Falta a integrada (navegador + banco).
```

16 asserções novas do `acerto`. Verificadas por **mutação em três pontos**, cada uma pega pelo
teste certo:

```
### mutação 1: remover o gate do confere
  ✗ rateio que não confere barra o acerto                     -> 56 passaram, 1 falharam
### mutação 2: transferir o saldo cheio em vez do mínimo
  ✗ 20.000 acertos aleatórios: Σ saldo = 0 e as transferências zeram tudo
### mutação 3: ignorar quem pagou sem linha no rateio
  ✗ pagador sem linha no rateio entra como credor
```

## A trava estendida do reset — cada gatilho isolado

```
TRAVA ESTENDIDA:
  custo_real preenchido               abortou -> ABORTADO: public.config tem dado real (custo real de fechamento lancado)
  prazo definido                      abortou -> ABORTADO: public.config tem dado real (prazo de confirmacao definido)
  precos de referencia preenchidos    abortou -> ABORTADO: public.config tem dado real (precos de referencia preenchidos)
  config nas sementes (deve rodar)    RODOU
  trava com pago_por marcado          abortou -> ABORTADO: public.config tem dado real (pagadores do acerto marcados)
```

Os quatro gatilhos disparam e a base nas sementes passa — que é o que permitiu esta fatia
recriar o schema. A partir de agora, `config` com dado real bloqueia o recreate, como a `rsvps`
já bloqueava.

> Detalhe de implementação: a trava lê a config por `to_jsonb` + `EXECUTE`. Referenciar
> `pago_por_*` direto quebraria o script **no parse**, na primeira execução em que as colunas
> ainda não existem — o script precisa rodar contra o schema velho para criar o novo.

## Schema

```
colunas novas:
   ['pago_por_agua', 'smallint', 'YES']
   ['pago_por_chopp', 'smallint', 'YES']
   ['pago_por_pizza', 'smallint', 'YES']
   ['pago_por_refri', 'smallint', 'YES']

CHECK do dominio:
  pago_por_chopp = 1      ACEITOU
  pago_por_chopp = 2      ACEITOU
  pago_por_chopp = 3      ACEITOU
  pago_por_chopp = 4      rejeitou -> violates check constraint
  pago_por_chopp = 0      rejeitou -> violates check constraint
  pago_por_chopp = -1     rejeitou -> violates check constraint
  pago_por_chopp = NULL   ACEITOU
```

O `CHECK` simples (`x is null or x between 1 and 3`) basta aqui, ao contrário do `CASE` que
`aniversariante_id_coerente` precisou: `x is null or ...` nunca avalia para `NULL`. Testei 4, 0 e
-1 mesmo assim.

## Verificação integrada — saída crua

### 1. Falta pagador → nomeia o item, sem acerto falso
```json
{ "semPagador": { "selo": "selo cinza", "motivo": "Indique quem pagou: chopp.", "transferencias": "" },
  "valoresNosSeletores": ["Chopp R$ 700,00", "Refrigerante R$ 0,00", "Água R$ 0,00", "Pizza R$ 0,00"],
  "rateio": ["Bruno = R$ 650,00", "Braz = R$ 50,00", "Bocão = R$ 0,00"] }
```
Os valores ao lado de cada seletor vêm do `custosPorItem` do rateio — o organizador não digita
valor, só marca quem pagou. Itens de custo zero não pedem pagador.

### 2. **O acerto do ×6,5** — marcando Bruno como pagador do chopp
```json
{ "msg": "Pagadores salvos. ✅",
  "saldos": [
   { "nome": "Bruno", "saldo": "R$ 50,00 a receber", "detalhe": ["deve: R$ 650,00", "pagou: R$ 700,00"] },
   { "nome": "Braz",  "saldo": "R$ 50,00 a pagar",   "detalhe": ["deve: R$ 50,00",  "pagou: R$ 0,00"] },
   { "nome": "Bocão", "saldo": "R$ 0,00 quite",      "detalhe": ["deve: R$ 0,00",   "pagou: R$ 0,00"] } ],
  "selo": { "classe": "selo verde", "texto": "✓ Acerto fechado: os saldos somam zero." },
  "transferencias": ["Braz → Bruno: R$ 50,00"] }
```
Conferido na mão: Bruno deve 650 e desembolsou 700 → 50 a receber; Braz deve 50 e não pagou nada
→ 50 a pagar; Σ saldo = 0; uma transferência só.

### 3. **O gate do `confere` no caminho real**
Lancei `custo_real_refri = 120,00` numa base onde ninguém bebe refri e **marquei pagador em
todos os quatro itens**, de propósito:

```json
{ "seloDoRateio": "selo vermelho",
  "casoOrfao_todosPagadoresMarcados": {
    "seloDoAcerto": "selo cinza",
    "motivo": "As contas do rateio não fecham — resolva isso antes de acertar entre vocês.",
    "transferencias": [] } }
```

Sem o gate, todos os pagadores marcados bastariam para o acerto sair — e as transferências não
quitariam nada, porque `Σ deve = totalRateado` enquanto `Σ pagou = custoRealTotal`. Foi o achado
do plano, agora confirmado pela tela.

### 4. Update estreito
```
UPDATE ESTREITO — depois de salvar so os pago_por:
  Fatia 2 (precos/taxas): 0.00 0.00 2.000
  Fatia 5 (custo real)  : 700.00 0.00 0.00
  Fatia 6 (pago_por)    : 1
  -> FATIAS 2 e 5 INTACTAS ✅
```

### 5. Negativo (RLS) — pelo estado do banco
```
anon SELECT config: []
anon UPDATE pago_por (tentando se colocar como pagador): HTTP 204
  pago_por_chopp = 1 (o anon tentou trocar para 3)
  -> INTACTO ✅
```

### 6. Base restaurada
```
rsvps = 0
pessoas = 0
admins = 4
config = [2.000, 0.00, None, None, None]
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
```

## Decisões da implementação

- **`custosPorItem` no retorno do `rateio`** — o `acerto` recebe só o resultado do rateio e os
  `pago_por_*`. Os dois lados não têm como divergir sobre quanto custou o chopp.
- **Guloso para as transferências** — ótimo para 3 pessoas: com soma zero, três saldos não-nulos
  exigem no mínimo 2 transferências, e o guloso dá exatamente 2.
- **Pagador sem linha no rateio** entra como credor. Um aniversariante que pagou um item mas não
  foi cadastrado como consumidor não pode simplesmente sumir com o dinheiro dele.

## Estado do produto

Ciclo do dinheiro completo: convite → RSVP → cadastro dos aniversariantes → config → estimativa
→ fechamento e rateio → **acerto entre os três**.

## Notas para a Fatia 7 (polimento)

- **Countdown no passado:** hoje trava em zero; combinar "É hoje!" no dia e esconder depois.
- **README:** ainda manda publicar arrastando a pasta no Netlify.
- **HANDOFF.md:** descreve o estado de julho, antes de todo o modelo de rateio.
- **Link `wa.me`:** com o acerto pronto, a mensagem natural mudou — não é mais cobrar convidado,
  é avisar "você transfere R$ X para fulano".
- **REGRAS-NEGOCIO.md** está na v5 e não descreve o acerto; o prompt desta fatia falava em v6.
- Ainda pendente do Bruno: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `986973511b159c48e0b87947b3497f6f8d51b5f5` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
