# Status — Fatia 2: config de preços, taxas e prazo

**Fatia fechada.** Aprovada sem ajustes; as 3 respostas do review foram seguidas e a nota leve
(vazio vs inválido) virou mensagem distinta para cada caso.

| | |
|---|---|
| Branch | `feat/fatia-2-config-admin` → merge `--ff-only` → apagada |
| Commit da fatia | `a2aa4ff164645ce9233d2b166712ad09a3ca8b2e` |
| `./verify.sh` | **VERDE** — 41/41, sem regressão |

## Decisões do review, aplicadas

1. **`<details>` fechado por padrão** — confirmado na tela: `configFechadaPorPadrao: true`.
2. **`calculo.js` no `admin.html`** — incluído; `calculoCarregado: true`.
3. **`atualizado_em` pelo cliente** — `new Date().toISOString()` no `update`.
4. **Nota leve:** vazio e inválido agora dão mensagens diferentes (saída abaixo). Decidi
   **recusar campo vazio** em preço e taxa, em vez de virar `0` — um campo em branco é mais
   provavelmente esquecimento do que intenção de zerar, e a mensagem diz como zerar de fato.
   O prazo é a exceção: vazio = `NULL` = sem limite, que é o comportamento documentado.

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

### 1. Config carrega com as sementes
```json
{ "painelVisivel": true,
  "configFechadaPorPadrao": true,
  "taxas":  { "chopp": "2", "refri": "0,6", "agua": "0,5" },
  "precos": { "chopp": "0,00", "pizzaAdulto": "0,00" },
  "prazo": "",
  "atualizadoEm": "Última alteração: 02/08 17:08",
  "calculoCarregado": true }
```

### 2. Validação no cliente — cinco casos, cinco mensagens distintas
```json
{ "vazio":          "Preencha \"Chopp (por litro)\". Use 0 se for zero mesmo.",
  "invalido":       "\"Chopp (por litro)\" não é um número válido.",
  "negativo":       "\"Chopp (por litro)\" não pode ser negativo.",
  "taxaEstourada":  "\"Chopp por adulto\" passou do máximo aceito para taxa (999,999).",
  "precoEstourado": "\"Chopp (por litro)\" passou do máximo aceito para preço (99.999.999,99).",
  "nenhumSalvouAinda": true }
```
Os dois últimos são as faixas de `numeric(6,3)` e `numeric(10,2)` — sem isso, o overflow
voltaria como erro cru de tipo.

### 3. Salvamento real, com `1.234,56` e prazo
Tela: `{"msg": "Configuração salva. ✅", "classe": "msg-toast ok"}`

`SELECT` cru:
```
SALVO (precos + taxas):
  [Decimal('18.50'), Decimal('1234.56'), Decimal('3.00'), Decimal('45.90'),
   Decimal('24.50'), Decimal('2.250'), Decimal('0.600'), Decimal('0.500')]
PRAZO:
  armazenado (UTC): 2026-10-21 02:59:59+00:00
  em Sao Paulo    : 2026-10-20 23:59:59
```
`1.234,56` → `1234.56`. É o caso que o `paraCentavos` transformaria em `0` silenciosamente.

### 4. Teste defensivo — campos da Fatia 5 intactos
Antes de salvar, populei `custo_real_*` e `preco_real_pizza_*` na mão. Depois de salvar a
config pela tela:
```
DEFENSIVO — campos da Fatia 5 continuam intactos?
  [Decimal('777.77'), Decimal('88.88'), Decimal('9.99'), Decimal('55.55'), Decimal('33.33')]
```
O `update` estreito faz o que prometia.

### 5. Ida e volta do fuso — o teste que pega o bug
Recarregando a tela depois de salvar:
```json
{ "prazoNaTela": "2026-10-20",
  "esperado": "2026-10-20",
  "oQueOIngenuoDaria": "2026-10-21",
  "dataVoltouIgual": true,
  "precoRefri": "1.234,56",
  "precoChopp": "18,50",
  "taxaChopp": "2,25",
  "fusoDoNavegador": "America/Sao_Paulo" }
```

O navegador estava em São Paulo, o que **não** provaria independência de fuso. Rodei a função
sob cinco fusos diferentes:

```
fuso local do runtime: America/Sao_Paulo
  2026-10-21T02:59:59+00:00 -> com fuso: 2026-10-20 (OK) | ingenuo: 2026-10-21
  2026-01-01T02:59:59+00:00 -> com fuso: 2025-12-31 (OK) | ingenuo: 2026-01-01
fuso local do runtime: America/New_York        (mesmos dois resultados OK)
fuso local do runtime: Asia/Tokyo              (mesmos dois resultados OK)
fuso local do runtime: Europe/Lisbon           (mesmos dois resultados OK)
fuso local do runtime: Pacific/Kiritimati      (mesmos dois resultados OK)
```
Kiritimati é +14; o ingênuo erra em todos, o nosso acerta em todos.

### 6. Ponta a ponta — a config dirige o formulário público
Com o prazo em 20/10/2026:
```json
{ "formAberto": true, "avisoPrazo": "⏳ Confirme até 20/10/2026.", "encerradoOculto": true }
```

### 7. Limpar o prazo → `NULL` → convite sem aviso
```
prazo apos limpar = None | preco preservado = 18.50
status_rsvp (anon): [{"aberto":true,"prazo":null}]
```
```json
{ "formAberto": true, "avisoPrazoOculto": true, "encerradoOculto": true }
```

### 8. Negativo — anon não lê nem grava `config`
```
anon SELECT em config:
  HTTP 200  body=[]
anon UPDATE em config (tentando zerar preço e abrir o prazo):
  HTTP 204
anon SELECT em admins:
  []
```

> **Atenção ao 204.** O `UPDATE` do anon devolve `204 No Content`, que **parece sucesso**: a RLS
> não rejeita, ela simplesmente não deixa nenhuma linha visível para atualizar. Só o `SELECT`
> como dono prova o que aconteceu:
> ```
> depois da tentativa do anon:
>   preco_litro_chopp = 18.50 (o anon tentou zerar)
>   prazo_confirmacao = 2026-10-21 02:59:59+00:00 (o anon tentou anular)
>   -> INTACTO ✅
> ```
> Fica registrado para as próximas fatias: em teste negativo de RLS, código HTTP não é
> evidência — só o estado do banco é.

### 9. Base restaurada
```
config (taxas, preco, prazo, custo_real): [2.000, 0.600, 0.500, 0.00, None, None]
rsvps = 0
pessoas = 0
admins = 4
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
```
Usuário temporário apagado.

## Notas para a próxima fatia

- **`calculo.js` já está carregado no `admin.html`** — a Fatia 4 não precisa mexer nisso.
- **`parseNumeroBR` e `fmtNumeroBR` estão prontos** no `admin.js` e servem para a Fatia 5, que
  também recebe dinheiro digitado (`custo_real_*`). Mesma regra: vírgula manda como decimal.
- **Fatia 3 (cadastro de aniversariantes) segue como pré-requisito da 4 e da 5.**
- Ainda pendente do Bruno: rotacionar a senha do Postgres.

## Processo — o sync do handoff

Esta rodada travou duas vezes antes do `revisa` porque `prompt.md` e `plano.md` estavam
gravados no disco mas **não commitados**, e a outra ponta lê pelo git. O Cowork recusou o
`revisa` — corretamente, pelo conteúdo que via.

Corrigido no commit `8a0eecd`, e a regra está no `FLUXO.md`: **o arquivo de handoff é commitado
e enviado no gatilho em que muda**, não só no `executa`. No `planeja` isso inclui subir o
`prompt.md` do Cowork, que não faz git de escrita.

Uma assimetria que fica: eu leio o disco, então enxergo o que o Cowork escreve mesmo sem
commit; ele não enxerga o meu. Por isso o `review.md` desta rodada estava no disco e só agora
sobe, junto deste commit.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `a2aa4ff164645ce9233d2b166712ad09a3ca8b2e` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
