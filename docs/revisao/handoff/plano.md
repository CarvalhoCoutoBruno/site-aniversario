# Plano — Fatia 15: Admin, aba "Contas" (as 4 fases)

Branch: `feat/fatia-15-admin-contas`

Entradas: `prompt.md` (Cowork), `design/admin/prompt-design.md` §5/§3/§4, o mockup, e
`docs/REGRAS-NEGOCIO.md` v6 §4.2/§4.3.

---

## Achado que precisa de decisão antes de qualquer código

**O item 6 (nome nulo na linha de aniversariante) colide com o item 5 (compartilhar), e a colisão
é dentro do `calculo.js`, que não pode mudar.**

O módulo monta o mapa de nomes a partir do que recebe:

```js
// calculo.js:261-263
const nomes = new Map();
if (ehAniversariante(p) && p.aniversariante_id) nomes.set(p.aniversariante_id, p.nome || null);
```

e o texto de compartilhar sai daí, já pronto:

```js
// calculo.js — resumoAcerto()
`• ${t.deNome} → ${t.paraNome}: ${formatarBRL(t.valor)}`
```

Com `pessoas.nome` nulo, `rateio()` devolve `nome: "Aniversariante 1"` e o **texto que vai para o
WhatsApp** vira *"Aniversariante 1 → Aniversariante 3: R$ 240,00"*. A tela eu conserto com o
`nomeDoAniversariante()` que já existe; o texto do módulo, não — e reescrevê-lo no `admin.js`
seria exatamente o "derive na tela" que o risco 2 proíbe.

**Proposta: fazer o item 6, corrigindo na ENTRADA em vez de na saída.** O módulo é puro e recebe
`pessoas`; quem chama decide o que entregar. Antes de `Calculo.rateio()`, o `admin.js` passa a
mandar uma cópia de `ultimasPessoas` com o `nome` das linhas de aniversariante preenchido a partir
da `festa`:

```js
const pessoasComNome = ultimasPessoas.map((p) =>
  p.papel === "aniversariante" && p.aniversariante_id
    ? { ...p, nome: nomeDoAniversariante(p.aniversariante_id, p.nome) }
    : p);
```

`calculo.js` não muda, as 63 asserções não mudam, o snapshot pode ficar nulo, e a `festa` vira a
fonte **no ponto em que o dado entra na conta** — que é onde ela deveria ter sido desde sempre.

Ver **P1**: quero isso confirmado antes de escrever, porque muda o contrato de quem alimenta o
módulo, e o Cowork pediu para eu parar e perguntar nesse caso exato.

---

## Os quatro riscos

### 1. `update` estreito, com o dinheiro do Bruno do outro lado

Contas escreve `custo_real_chopp/refri/agua`, `preco_real_pizza_adulto/crianca` e
`pago_por_chopp/refri/agua/pizza`. Nada mais.

Dois formulários, dois `patch` escritos à mão — o mesmo corte que funcionou na 14. **Prova
invertida**: planto valor em `preco_pizza_adulto`, `litros_chopp_por_adulto` e
`prazo_confirmacao` (campos da Ajustes, hoje com os valores reais do Bruno), salvo os dois
formulários desta aba, e mostro por `SELECT` que sobreviveram.

⚠️ E o inverso do vazio: em Ajustes, campo vazio é **erro**; aqui, campo vazio é **"ainda não
sei"** e grava `NULL`. Placeholder `não sei`, borda âmbar, e nunca `0,00` cinza — é a semântica
que a Fatia 5 fixou, e trocá-la faria o `fechamentoCompleto` virar verdadeiro sem ninguém ter
lançado nada.

### 2. De onde vem cada número da tela

Nenhuma cifra é calculada no `admin.js`. A tabela completa:

| O que a tela mostra | De onde vem |
|---|---|
| conta de cada aniversariante | `rateio().porAniversariante[].total` |
| detalhe por item de cada um | `rateio().porAniversariante[].detalhe.{chopp,refri,agua,pizza}` |
| nome de cada um | `rateio().porAniversariante[].nome` (com a correção de entrada acima) |
| total rateado | `rateio().totalRateado` |
| custo real total | `rateio().custoRealTotal` |
| valor ao lado de "quem pagou" | `rateio().custosPorItem[item]` |
| fase do selo | `fechamentoCompleto`, `confere`, `acerto().faltaPagador`, `acerto().status` |
| texto do impedimento | `acerto().motivo` — **não reescrito na tela** |
| saldos | `acerto().saldos[]` |
| transferências | `acerto().transferencias[]` |
| texto de compartilhar | `Calculo.resumoAcerto()` |
| toda formatação de moeda | `Calculo.formatarBRL()` |

Se a tela precisar de algo fora dessa lista, eu paro e pergunto em vez de derivar.

### 3. Espaço não-quebrável na moeda

O `formatarBRL` usa `Intl` e separa `R$` do número com **U+00A0**, não com espaço comum. Já deu
falso negativo na Fatia 4. Toda comparação da verificação normaliza com
`.replace(/ /g, " ")` antes de comparar — e vou provar que a armadilha existe imprimindo o
código do caractere.

### 4. Alcançar as 4 fases de verdade

Planto o estado de cada uma no banco, mostro a tela, e limpo:

| Fase | Como planto |
|---|---|
| `pendente` | `custo_real_agua = NULL` (falta lançar um) |
| `nao-confere` | os três lançados, mas um grupo sem `convidado_por` válido → dinheiro sem dono |
| `falta-pagador` | tudo fechando, `pago_por_refri = NULL` |
| `completo` | tudo lançado e todo item com pagador |

O **caso órfão** (custo lançado para item que ninguém consome) entra no `nao-confere`: é
justamente o que faz `totalRateado ≠ custoRealTotal` sem que nenhum item fique sem pagador.

---

## Como a aba fica

Quatro blocos, na ordem do mockup:

1. **Custo real** — os 5 campos, vazio = "não sei", com o aviso de que o que está em Compras é
   estimativa e isto é gasto.
2. **Rateio** — as 3 contas, cada uma com o detalhe por item; o total gasto e o total rateado lado
   a lado; e a nota **"convidado não paga — quem chamou banca"** dentro do card, não em rodapé.
3. **O selo** — âmbar `○`, vermelho `!` ou azul `✓`, com o texto do `motivo` do módulo.
4. **Acerto** — quem pagou cada item (seletor de nome, com o valor calculado ao lado, ninguém
   digita valor), e, só na fase completa, as transferências e o botão de compartilhar.

---

## Commits

1. `feat`: custo real e rateio, no visual novo
2. `feat`: o selo nas 4 fases + acerto e quem pagou
3. `feat`: compartilhar (`wa.me` + queda para `<textarea>`)
4. `feat`: o conserto do nome — correção na entrada do módulo e `pessoas.nome` nulo
5. `chore`: sai a última seção provisória, o CSS órfão, e acaba a era do `<details>`

---

## Verificação

`./verify.sh` verde, **com as 63 asserções inalteradas** — se o número mudar, `calculo.js` mudou.

1. **As 4 fases**, screenshot a 390px de cada, com a saída crua do estado que a produziu.
2. **Reconciliação**: com fechamento completo, `Σ das 3 contas === custoRealTotal`, ao centavo,
   comparado em **centavos inteiros**, não em string formatada.
3. **O caso do ×6,5** (§4.2): monto a base — convidados só do Bruno, um dividido Bruno/Braz, e o
   próprio Bruno, todos no chopp — e confiro na tela que a conta do Bruno é `6,5 × C_chopp`.
4. **`update` estreito** com plantio nos campos da Ajustes.
5. **O conserto do nome**: com `pessoas.nome` **nulo** nas três linhas, provar que contas, saldos,
   transferências, o texto de compartilhar, os filtros de "Quem vem" e o Resumo mostram os nomes
   certos.
6. **Compartilhar**: o texto bate com as transferências da tela; e o caminho de clipboard negada.
7. **Confirmações reais intactas** ao fim; `custo_real_*` e `pago_por_*` de volta a `NULL`.
8. **Convite intacto** e **modo escuro idêntico**.
9. **Tabela de hashes** no `status.md`.

---

## Perguntas

**P1 — corrigir o nome na entrada do módulo.** É a proposta do topo. Ela mantém `calculo.js`
intocado e resolve o item 6 sem quebrar o item 5, mas **muda o contrato de quem chama**: a partir
daí, quem alimenta o módulo é responsável por entregar os nomes resolvidos. Acho isso mais correto
do que o estado atual (o módulo depende de um snapshot que pode envelhecer), mas é decisão de
arquitetura e não minha. Confirma?

**P2 — se o P1 for não, o item 6 sai da fatia?** Sem a correção na entrada, nulificar
`pessoas.nome` faz o texto compartilhado dizer "Aniversariante 1 → Aniversariante 3". Nesse
cenário eu **não** faço o item 6 e ele volta para a fila junto da lixeira — a sincronia automática
da Fatia 14 já resolve a divergência prática, que era o problema real.

**P3 — a base de teste do ×6,5.** Montá-lo exige criar convidados de teste (5 só do Bruno, 1
dividido Bruno/Braz). Hoje o banco tem uma confirmação real. **Proponho** criar os grupos de teste
com prefixo `zz-teste-`, conferir, e apagar por prefixo — sem tocar na Rosaura. Se preferir que eu
não escreva RSVP nenhum no banco real, faço o ×6,5 pelo `jsc` contra o `calculo.js` e digo
claramente que a conferência **não** foi na tela. Qual?

Os commits 1, 2, 3 e 5 não dependem de nenhuma das três.
