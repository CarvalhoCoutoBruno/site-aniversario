# Plano — Fatia 5: fechamento e rateio

Branch: `feat/fatia-5-fechamento`

## O que verifiquei antes de planejar

### 1. O caso do ×6,5 da spec bate com o módulo

Montei o cenário exato da regra de negócio §4.2 — 5 convidados só do Bruno + 1 compartilhado
Bruno/Braz + o próprio Bruno, todos no chopp, `custo_real_chopp = 700,00`:

```
COM grupos:
  Bruno (id 1) = R$ 650,00
  Braz  (id 2) = R$ 50,00
  Bocão (id 3) = R$ 0,00
  totalRateado=70000 custoRealTotal=70000 confere=true
```

7 consumidores → C = R$ 100,00. Bruno = 5 + 0,5 + 1 = **6,5 unidades** = R$ 650,00; Braz leva a
meia unidade do compartilhado. É o número da spec, ao centavo.

### 2. Esquecer os `grupos` falha **alto**, não em silêncio

O item 1 do escopo (guardar `ultimosGrupos`) é o coração da fatia. Testei o que acontece se eu
não passar os grupos:

```
SEM passar grupos:
  Bruno = R$ 100,00
  Braz  = R$ 0,00
  Bocão = R$ 0,00
  totalRateado=10000 custoRealTotal=70000 confere=false
```

Sem os grupos, todo convidado vira "consumo sem dono" e é **descartado** em vez de
redistribuído — exatamente o que o `calculo.js` foi desenhado para fazer. Resultado: R$ 100 de
R$ 700 rateados e **selo vermelho**. O erro se denuncia.

Isso me deixa mais tranquilo: se eu errar o wiring, a tela grita. Ainda assim vou provar o
caminho certo no verify, porque "grita" só ajuda quem olha.

### 3. Os três estados do selo

```
  so chopp lancado (refri/agua NULL)   -> CINZA (incompleto)       rateado=10000 total=10000
  os tres lancados, tudo consumido     -> VERDE                    rateado=15000 total=15000
  orfao: refri lancado, ninguem bebe   -> VERMELHO (soma != total) rateado=15000 total=23000
  os tres em zero                      -> VERDE                    rateado=0     total=0
```

Repare no primeiro: as somas **coincidem** (10000 = 10000) e mesmo assim o selo é cinza, porque
`fechamentoCompleto` é falso. Verde exige as duas condições, como o prompt pede — não basta a
soma bater.

### 4. Pizza real x referência
```
  so referencia (45,90)    -> Bruno paga R$ 45,90
  real preenchido (60,00)  -> Bruno paga R$ 60,00
```

## Implementação

### `js/admin.js`
- `ultimosGrupos` ao lado de `ultimasPessoas`; `carregarRSVPs` guarda `g.data`.
- `recomputar()` substitui a chamada direta a `atualizarEstimativa()`: mesma guarda de
  completude, agora exigindo também os grupos, e dispara estimativa **e** rateio. Os dois
  carregadores passam a chamar `recomputar()`.
- `carregarFechamento()` popula os 5 inputs a partir da `config` já carregada.
- `salvarFechamento()` — **update estreito**, só os 5 campos + `atualizado_em`.
- `atualizarRateio()` — chama `Calculo.rateio(ultimasPessoas, ultimaConfig, ultimosGrupos)` e
  pinta as 3 contas, os totais e o selo.

### Validação — **vazio é válido aqui**

Invertida em relação à Fatia 2, e de propósito: lá vazio era esquecimento, aqui vazio significa
"ainda não fechei" e vira `NULL`. O `parseNumeroBR` já distingue `vazio` de `invalido`, então é
só trocar o ramo:

| Entrada | Fatia 2 (config) | Fatia 5 (fechamento) |
|---|---|---|
| vazio | recusa | **`NULL`** |
| inválido | recusa | recusa |
| negativo | recusa | recusa |
| acima da faixa | recusa | recusa |

### `admin.html`
Seção em `<details>`, depois da estimativa. Um bloco de inputs (3 custos + 2 preços reais de
pizza, estes marcados como opcionais), o botão salvar, e abaixo o resultado: as 3 contas com
detalhe por item, os totais e o selo.

### Selo
Três estados visuais, com a razão escrita ao lado:
- **cinza** — "fechamento incompleto: faltam custos"
- **verde** — "as contas fecham"
- **vermelho** — "a soma das contas não bate com o total gasto", com a diferença em reais

O vermelho é o caso órfão (custo lançado para item que ninguém consome). Mostrar a **diferença**
ajuda a achar o erro de digitação — é a informação que falta para agir.

## Fora de escopo
Estimativa, config de preços/taxas/prazo (não edito esses campos aqui), formulário público, e o
polimento da Fatia 6 — incluindo o "quem deve a quem" e o link `wa.me`, que continuam em aberto
na §9 da ET.

## Verify

`./verify.sh` verde (o `calculo.js` não muda; 41/41).

Integrada, com saída crua no `status.md`:

1. base com o padrão do ×6,5 (5 convidados de [1], 1 compartilhado [1,2], os 3 aniversariantes)
   → lançar `custo_real_chopp = 700,00` → **Bruno R$ 650,00 / Braz R$ 50,00 / Bocão R$ 0,00**,
   conferido na mão, `Σ = custoRealTotal`, selo **verde**;
2. o convidado compartilhado dividido **50/50** — visível no detalhe por item;
3. **pizza real x referência:** com `preco_real_pizza_adulto` preenchido, entra; vazio, cai no
   de referência;
4. **caso órfão:** lançar custo de item que ninguém consome → selo **vermelho** com a diferença,
   sem quebrar;
5. **fechamento incompleto:** com 2 dos 3 custos → selo **cinza**, mesmo se as somas coincidirem;
6. **update estreito:** preços de referência, taxas e prazo **intactos** após salvar o
   fechamento — provado por `SELECT`;
7. **negativo (RLS):** anon não lê nem grava `config` — provado pelo **estado do banco**, não
   pelo HTTP (a lição dos `204`);
8. restaurar a base ao fim.

## Para o review

Uma decisão que tomei: **mostrar a diferença em reais no selo vermelho**, não só o aviso. Sem
ela o organizador sabe que algo está errado mas não por quanto — e o valor da diferença
costuma apontar direto para o item digitado errado. Se achar ruído, tiro.

Parado, sem implementar, aguardando `review.md`.
