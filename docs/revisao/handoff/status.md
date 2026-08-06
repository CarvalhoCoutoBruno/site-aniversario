# Status — Fatia 15: Admin, aba "Contas" (as 4 fases)

**Fatia fechada. O painel está migrado por inteiro** — zero `<details>`, zero classes de CSS sem
consumidor. O backlog do admin zerou.

| | |
|---|---|
| Branch | `feat/fatia-15-admin-contas` → merge `--ff-only` → apagada |
| Commits | 2, cada um verde no `./verify.sh` |
| Commit do código | `HASH_CODIGO` |
| `origin/main` após o push | `HASH_ORIGIN` |
| `main == origin/main` | **sim** |
| `tests/calculo.test.js` | **63 asserções, inalteradas** — `calculo.js` só ganhou comentário |

## O conserto do nome, provado de ponta a ponta

Com `pessoas.nome` **NULO** nas três linhas de aniversariante:

```
banco   : [[1, None], [2, None], [3, None]]
tela    : Bruno · Braz · JH Boca          (rateio, saldos, filtros, Resumo)
WhatsApp: "Acerto das contas:\n• JH Boca → Bruno: R$ 50,00"
```

O texto do WhatsApp é o que fecha a prova: ele é montado **dentro** do `resumoAcerto()`, e chegou
com os nomes certos porque o `pessoasParaCalculo()` resolveu antes de o dado entrar. Sem o helper,
o mesmo módulo devolve:

```
Aniversariante 1 | Aniversariante 2 | Aniversariante 3
```

(medido rodando o `calculo.js` com as linhas cruas, no `jsc`).

As duas condições do review estão cumpridas: a sincronia criada na Fatia 14 **saiu**, e o cadastro
de aniversariante **parou de gravar `nome`** — as duas repopulariam a coluna por caminhos
diferentes. O contrato ficou escrito no cabeçalho do `calculo.js`.

## As 4 fases, com o estado que produziu cada uma

### `pendente` — nada lançado
```
selo : ○ "Feche o custo real primeiro: falta lançar o gasto de chopp, refrigerante ou água."
campos: placeholder "não sei", borda âmbar
```

### `nao-confere` — o caso órfão
```
plantado: chopp 700,00 · refri 100,00 (ÓRFÃO: ninguém bebe refri) · água 50,00 · pizza 30,00
selo : ! "As contas do rateio não fecham — resolva isso antes de acertar entre vocês."
Total gasto R$ 880,00  ·  Total rateado R$ 780,00
```
Os R$ 100 do refrigerante não têm dono. Segui a nota do review e **não** tentei o caminho do
`convidado_por` inválido — ele é inalcançável, a constraint impede.

### `falta-pagador`
```
plantado: refri 0,00 (ninguém bebe, então 0 é o valor certo) · só o chopp com pagador
selo : ✓ "Indique quem pagou: água, pizza."
Total gasto R$ 780,00  ·  Total rateado R$ 780,00     ← já bate
```
O selo fica azul (o rateio confere) mas o acerto segue bloqueado — as duas coisas são distintas,
e a tela mostra isso.

### `completo`
```
selo : ✓ "As contas fecham: a soma do que cada um paga bate com o gasto total, até o centavo."
saldos: Bruno   R$ 50,00 a receber   (deve 650,00 · pagou 700,00)
        Braz    R$  0,00 quite       (deve  50,00 · pagou  50,00)
        JH Boca R$ 50,00 a pagar     (deve  80,00 · pagou  30,00)
transferência: JH Boca → Bruno: R$ 50,00
```

## O ×6,5 da regra §4.2 — na tela e no módulo

A base: 5 convidados só do Bruno + 1 dividido Bruno/Braz + o próprio Bruno, todos no chopp.
A Rosaura está na base e bebe **água e pizza, não chopp**, então não perturba o `C_chopp` — mas
entra no total gasto, como o review lembrou.

```
C_chopp = 70000 centavos / 7 consumidores = 10000 centavos
unidades do Bruno = 5 + 0,5 + 1 = 6,5
esperado 6,5 × C_chopp = 65000 centavos
na conta do Bruno      = 65000 centavos   -> bate
o Braz leva os 0,5     =  5000 centavos
```

E na tela, no mesmo estado: **"Bruno R$ 650,00 — Chopp R$ 650,00"** e **"Braz R$ 50,00"**.

## Reconciliação — em centavos inteiros

```
custoRealTotal : 78000 centavos
totalRateado   : 78000 centavos
Σ das 3 contas : 78000 centavos
bate ao centavo: true
```

Comparei em inteiros e não em string formatada. A armadilha era real:

```
formatarBRL(123456) = "R$ 1.234,56"
o caractere 3 é código 160 (não-quebrável), não 32 (espaço comum)
```

## `update` estreito — a prova invertida

Plantei nos campos da **Ajustes** e salvei os **dois** formulários desta aba:

```
--- plantados na Ajustes, sobreviveram ---
preco_pizza_adulto      : 20.00
litros_chopp_por_adulto : 2.500
prazo                   : 01/10/2026 23:59:59
preco_litro_chopp/refri : 10.00 / 5.00
--- escritos por esta aba ---
custo_real chopp/refri/agua      : 700.00 / 0.00 / 50.00
pago_por chopp/refri/agua/pizza  : 1 / 2 / 2 / 3
festa                            : não tocada
```

## De onde veio cada número

Nenhuma cifra foi calculada no `admin.js`. Contas, detalhe por item, totais, o valor ao lado de
"quem pagou", saldos, transferências e o texto do acerto vêm de
`Calculo.rateio()` / `acerto()` / `resumoAcerto()` / `formatarBRL()`. O selo escolhe a fase pelos
gatilhos do módulo, e o texto do impedimento é o `motivo` — não reescrito na tela.

## Compartilhar
```
texto : "Festa dos 160 anos 🎉\n\nAcerto das contas:\n• JH Boca → Bruno: R$ 50,00"
wa.me : mesmo texto, sem número — quem compartilha escolhe o contato
clipboard negada: "Não consegui copiar sozinho — o texto está aí embaixo, selecionado."
                  (textarea visível e selecionado)
```

## Um bug meu, da fatia passada

A guarda que eu pus no `mostrarPainel()` na Fatia 14 travava o painel **inteiro** — e isso criou
um caso pior que o bug original: com uma **sessão morta em cache**, o `getSession()` monta o
painel, a trava fecha, e o login seguinte (com a senha certa) não recarrega nada. O organizador
fica olhando um painel vazio depois de entrar.

Apareceu comigo mesmo, tentando logar nesta fatia com o token do usuário da fatia anterior.
O que precisava de trava era só o `prepararUpload()`; recarregar dado é idempotente.

## Não-regressão
```
modo escuro (admin) : 6 propriedades, claro × escuro — nenhuma diferença
convite intacto     : 44 elementos × 14 propriedades — NENHUMA diferença
<details> no admin  : 0
classes de CSS órfãs: nenhuma
```

## Estado final do banco
```
config: pizza 20.00 · litros chopp 2.500 · prazo 01/10/2026 23:59:59
fechamento (custo_real_* / pago_por_*): NULL — o fechamento de verdade é depois da festa
festa  : 'Festa dos 160 anos' · Bruno · Braz · JH Boca
pessoas de aniversariante: nome NULO de propósito, consumo restaurado
Rosaura: 51995509956, convidado_por [3], 'Te amooooo' — intacta
total rsvps: 1 · pessoas órfãs: 0 · admins: 4 · usuários de teste: 0
```

Os 6 RSVPs de teste foram apagados **pelo prefixo `zz-teste-`**, nunca em bloco.

## O que sobra no projeto

O painel está migrado por inteiro. Sobra **uma fatia opcional**: lixeira + `cancelar_rsvp` +
`whatsapp_contato` — as três mexem em schema e no mesmo lugar, e o review da 13 já registrou que
elas andam juntas. **A festa funciona sem.**

Pendências suas, de sempre: rotacionar a senha do Postgres, e conferir os preços antes de
divulgar o link.
