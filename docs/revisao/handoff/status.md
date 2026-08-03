# Status — Fatia 4: estimativa de compra

**Fatia fechada.** Aprovada sem ajustes. Todos os números conferidos contra a conta na mão, e a
prova de que a estimativa conta os aniversariantes feita nos dois sentidos (tirar e recolocar).

| | |
|---|---|
| Branch | `feat/fatia-4-estimativa` → merge `--ff-only` → apagada |
| Commit da fatia | `f4b2fab7fda3b539959532acab9b031381e19e42` |
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

## Base de teste

6 pessoas: 2 grupos (Ana + filha criança; Beto) e os 3 aniversariantes.

```
BASE MONTADA (tipo, papel, agua, refri, chopp, pizza):
   ['crianca', 'acompanhante',   True,  True,  False, True ]
   ['adulto',  'aniversariante', False, True,  True,  True ]   Bocão
   ['adulto',  'aniversariante', True,  False, False, False]   Braz
   ['adulto',  'aniversariante', False, False, True,  True ]   Bruno
   ['adulto',  'principal',      True,  False, True,  True ]   Ana
   ['adulto',  'principal',      False, True,  True,  False]   Beto
```

Taxas 2,0 / 0,6 / 0,5. Preços de referência 18,50 / 6,00 / 3,00 / 45,90 / 24,50.
**`custo_real_*` populados de propósito com valores absurdos** (9999,99 / 8888,88 / 7777,77)
para o teste #4.

## Verificação integrada — saída crua

### 1. Números conferidos contra a conta na mão
```json
{ "volumes": ["Chopp = 8 L", "Refrigerante = 1,8 L", "Água = 1,5 L"],
  "pizzas": ["Pizzas de adulto = 3", "Pizzas de criança = 1"],
  "custo": ["Custo aproximado = R$ 325,50"],
  "contagens": ["Pessoas = 6", "Adultos = 5", "Crianças = 1",
                "Bebem chopp = 4", "Bebem refri = 3", "Bebem água = 3"],
  "avisoAnivOculto": true, "avisoPrecosOculto": true }
```

Conferência manual:
- chopp: 4 adultos × 2,0 = **8 L** ✓
- refri: 3 pessoas × 0,6 = **1,8 L** ✓
- água: 3 pessoas × 0,5 = **1,5 L** ✓
- custo: 8×18,50 + 1,8×6 + 1,5×3 + 3×45,90 + 1×24,50 = **R$ 325,50** ✓

### 2. **A prova de que conta os aniversariantes** — nos dois sentidos

Removendo só o Bocão (chopp + refri + pizza, adulto):
```json
{ "volumes": ["Chopp = 6 L", "Refrigerante = 1,2 L", "Água = 1,5 L"],
  "pizzas": ["Pizzas de adulto = 2", "Pizzas de criança = 1"],
  "custo": "Custo aproximado = R$ 239,00",
  "avisoAniv": "Só 2 de 3 aniversariantes cadastrados — falta o consumo de 1 deles nesta conta." }
```
Chopp 8 → 6 L e refri 1,8 → 1,2 L: exatamente o que ele consumia. **A água ficou em 1,5 L**,
porque o Bocão não bebia água — o número não caiu "por cair".

Removendo os três:
```json
{ "volumes": ["Chopp = 4 L", "Refrigerante = 1,2 L", "Água = 1 L"],
  "pizzas": ["Pizzas de adulto = 1", "Pizzas de criança = 1"],
  "custo": "Custo aproximado = R$ 154,60",
  "contagens": ["Pessoas = 3", "Adultos = 2", "Crianças = 1",
                "Bebem chopp = 2", "Bebem refri = 2", "Bebem água = 2"],
  "aviso": "Só 0 de 3 aniversariantes cadastrados — falta o consumo de 3 deles nesta conta." }
```

Recadastrando os três:
```json
{ "voltouAoOriginal": { "volumes": ["Chopp = 8 L", "Refrigerante = 1,8 L", "Água = 1,5 L"],
                        "pizzas": ["Pizzas de adulto = 3", "Pizzas de criança = 1"],
                        "custo": "Custo aproximado = R$ 325,50" },
  "avisoAnivOculto": true }
```

Sem isso a estimativa ficaria **plausível e errada** — o organizador compraria 4 L de chopp em
vez de 8 e só descobriria na festa.

### 3. Aviso N/3
Aparece com 2 de 3 e com 0 de 3 (textos acima), some com 3 de 3 (`avisoAnivOculto: true`).

### 4. Usa os **preços de referência**, não o custo real
Com os preços zerados e `custo_real_chopp = 9999,99` no banco:
```json
{ "comPrecosZerados": {
    "volumes": ["Chopp = 8 L", "Refrigerante = 1,8 L", "Água = 1,5 L"],
    "custo": "Custo aproximado = R$ 0,00",
    "avisoPrecos": "Os preços de referência ainda estão zerados na configuração — por isso o
                    custo dá R$ 0,00. Os volumes acima já valem." } }
```
Se a estimativa usasse `custo_real_*`, jamais daria zero. Os volumes seguem corretos, que é o
que importa para o fornecedor — como o review antecipou na nota leve.

> Um falso negativo do meu próprio script: a asserção `=== "R$ 0,00"` deu `false` mesmo com a
> tela mostrando `R$ 0,00`. O `Intl.NumberFormat` usa **espaço não-quebrável** (código 160)
> entre o símbolo e o número:
> ```json
> { "custoBruto": "R$ 0,00", "codigosDosCaracteres": [82, 36, 160, 48],
>   "normalizado": "R$ 0,00", "ehZero": true }
> ```
> Fica o registro: comparar string de moeda formatada exige normalizar o espaço.

### 5. Nenhuma escrita no banco
Hash do estado de `pessoas` antes de abrir a estimativa e depois de abrir + recarregar duas
vezes:
```
hash do estado de pessoas ANTES:  d6ced08390d3bae9995c625a0955eb8e
hash do estado de pessoas DEPOIS: d6ced08390d3bae9995c625a0955eb8e
  -> IDENTICO ✅ (a estimativa nao escreveu nada)
  custo_real_chopp intacto: 9999.99
```

### 6. Base restaurada
```
rsvps = 0
pessoas = 0
admins = 4
config = [2.000, 0.600, 0.500, 0.00, None, None]
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
```
Usuário temporário apagado.

## O que a implementação resolveu

**A corrida.** Os carregadores rodam em paralelo e nenhum guardava o que carregava. Agora
`carregarConfig` e `carregarRSVPs` guardam a sua parte e chamam `atualizarEstimativa()`, que
retorna cedo enquanto faltar alguma — quem chega por último dispara o cálculo. O "↻ Atualizar"
recalcula de graça, porque já chama os dois.

**Um ajuste durante a verificação:** o aviso do N/3 dizia "o consumo dos outros 1 não está nesta
conta". Corrigido para tratar singular e plural.

## Notas para a próxima fatia (5 — fechamento e rateio)

- `Calculo.rateio(pessoas, config, grupos)` está pronto e testado; devolve `porAniversariante`
  com detalhe por item, `totalRateado`, `custoRealTotal`, `fechamentoCompleto` e `confere`.
- **A Fatia 5 precisa dos `grupos`** (`rsvps` com `convidado_por`), não só das pessoas — é o elo
  que define quem banca quem. O `carregarRSVPs` já busca `g.data`; hoje guardo só as pessoas em
  `ultimasPessoas`, então vai precisar guardar os grupos também.
- `parseNumeroBR` e `fmtNumeroBR` do `admin.js` servem para os `custo_real_*` digitados.
- O selo `confere` fica verde só com os três `custo_real_*` preenchidos **e** a soma batendo.
- Ainda pendente do Bruno: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `f4b2fab7fda3b539959532acab9b031381e19e42` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
