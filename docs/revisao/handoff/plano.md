# Plano — Fatia 13: Admin, abas "Quem vem" e "Compras"

Branch: `feat/fatia-13-admin-lista-compras`

Entradas: `prompt.md` (Cowork) + `docs/revisao/design/admin/prompt-design.md` §2/§3/§4 e o mockup.

---

## Os quatro riscos

### 1. Excluir apaga dado real e não tem desfazer

**Concordo com a confirmação nomeada**, e acho que ela basta como fricção — mas quero somar uma
coisa que não é fricção e vale mais.

A frase: *"Apagar a confirmação de Rosaura e as 2 pessoas do grupo? Isso não tem como desfazer."*
Nome, contagem e a consequência, nas palavras de quem vai clicar.

Não proponho fricção maior (digitar o nome, segurar o botão) por dois motivos: o botão já mora
**dentro do card expandido**, então são dois toques deliberados até chegar nele; e fricção alta em
ação frequente ensina a passar por ela no automático, o que piora em vez de melhorar.

**O que eu somo:** depois de excluir, o toast mostra **o conteúdo apagado em texto** — nome,
contato, pessoas e recado. Não é desfazer, mas é o que permite refazer à mão se foi engano, e
custa uma linha. Sem isso o dado simplesmente evapora.

⚠️ Registro para o Bruno: **não existe lixeira**. Se você quiser desfazer de verdade, isso é uma
coluna `apagado_em` e mudança de RLS — fatia própria, não esta.

### 2. Quem muda dado tem de atualizar o estado compartilhado

É o preço da decisão da Fatia 12 e é aqui que ele vence. **Não vou remendar os arrays na mão.**
Depois de um `delete` bem-sucedido, chamo `carregarRSVPs()` de novo: ele refaz as duas consultas,
reescreve `ultimasPessoas` e `ultimosGrupos`, chama `recomputar()` (que remonta Resumo, Estimativa
e Rateio) e re-renderiza a lista.

Custa uma ida a mais ao banco. Ganha a garantia de que o estado da tela é o estado do banco —
remendar array à mão é onde nasce divergência silenciosa, e aqui a divergência apareceria como
número errado de pizza.

### 3. WhatsApp e o código do país

O `contato_norm` guarda só dígitos. A Rosaura está como `51995509956`; `wa.me/51995509956`
mandaria para o **Peru**. Regras, sem inventar DDD nenhum:

| Caso | O que faço |
|---|---|
| tem `@` | **não** mostra WhatsApp; mostra "Enviar e-mail" com `mailto:` |
| 10 ou 11 dígitos | celular ou fixo brasileiro com DDD → prefixo `55` |
| 12 ou 13 dígitos começando com `55` | já tem DDI → uso como está |
| qualquer outro tamanho | **sem link.** Mostro o contato como texto e uma nota de que não dá para montar o link |

O último caso é o importante: número curto, DDI estrangeiro ou lixo digitado não vira link
adivinhado. Melhor não ter botão do que ter botão que abre conversa com desconhecido.

### 4. Escape

Nome, contato e recado vão para markup novo. `esc()` em todo texto, e `encodeURIComponent` no que
entra em URL — o `href` do WhatsApp é o ponto onde escapar texto não basta. Teste com
`<img src=x onerror=...>` no nome e no recado, como na Fatia 1.

---

## O que muda na tela

### Aba "Quem vem"

- Busca (`type=search`, 16px) por nome ou contato.
- Fila de filtros roláveis: **Todos**, **Com crianças**, e um por aniversariante — os nomes saem
  de `festa`, não são literais.
- Um **card por grupo**: nome do responsável, linha mono com `contato · convidado por X`, pílula
  com a contagem e a seta. Ao tocar, expande com uma linha por pessoa (nome, tipo, itens), o
  recado e as duas ações.
- Acompanhante sem nome continua **"Acompanhante N"** — a pessoa existe no rateio mesmo sem nome,
  e sumir com ela foi bug uma vez.
- A hora de chegada usa o `fmtData()` já corrigido na Fatia 12 (fuso da festa).

### Aba "Compras"

- Bloco "Lista de compra" com uma linha por item (chopp/refri/água em litros, pizzas em unidades),
  sobre a mesma `Calculo.estimativa()` de hoje. **Só leitura.**
- Sub: "Calculada sobre N confirmados, aniversariantes incluídos."
- Bloco "Custo estimado" com a nota de que usa preço de referência, não gasto real.
- Botão **copiar para o fornecedor**, com o mesmo padrão de queda do acerto
  (`navigator.clipboard` → `<textarea>` visível e selecionado).
- O aviso de "preços ainda zerados" que hoje existe na estimativa **continua**.

### Limpeza

Saem as seções provisórias `estSecao` e o bloco da tabela. Contas e Ajustes seguem provisórias.

---

## Commits

1. `feat`: aba "Quem vem" — cards, expandir, busca e filtros (sem ações ainda)
2. `feat`: ações do card — WhatsApp com DDI e exclusão com confirmação nomeada + recarga do estado
3. `feat`: aba "Compras" + copiar para o fornecedor
4. `chore`: remoção das duas seções provisórias e do CSS órfão

---

## Verificação

`./verify.sh` verde em cada commit, **incluindo o invariante de fuso**. Depois:

1. **Rosaura intacta ao fim** — linha, pessoas e recado, saída crua. Nenhum `delete` sem `where`.
2. **Exclusão**: crio um RSVP de teste, excluo **por ele**, provo por `SELECT` que o grupo e as
   pessoas sumiram (cascade) e que a contagem geral caiu exatamente o esperado.
3. **Estado compartilhado**: excluir na aba "Quem vem" e provar, **sem recarregar**, que Resumo e
   Compras mudaram de número.
4. **WhatsApp**: o `href` gerado para `51995509956` tem que ser `wa.me/5551995509956`; mais os
   casos de e-mail, DDI já incluso e número inválido.
5. **XSS**: nome e recado com carga; provo que não executa e que o HTML saiu escapado.
6. **Copiar**: o texto bate com os números da tela, e o caminho de clipboard negada.
7. **Screenshots a 390px**: lista, card expandido, busca/filtro ativo, estado vazio, aba Compras.
   Mais um de desktop.
8. **Convite intacto** (comparação site contra site, como na Fatia 12) e **modo escuro idêntico**.

---

## Perguntas

**P1 — o mockup não cobre estado vazio, e existem dois.** "Nenhuma confirmação ainda" (banco
vazio) e "nenhum resultado" (busca ou filtro que não casa) são situações diferentes: a primeira
pede paciência, a segunda pede limpar o filtro. **Proponho** duas mensagens distintas, a segunda
com um botão "limpar busca e filtros". Confirma, ou o Design tem desenho para isso?

**P2 — o texto do "copiar para o fornecedor" não está no mockup.** Proponho:

```
Festa dos 160 anos — lista de compra
Chopp: 92,5 L
Refrigerante: 21,6 L
Água: 18 L
Pizza (adulto): 34
Pizza (criança): 9
Base: 63 confirmados
```

Sem preço: é lista para o fornecedor, não orçamento. Confirma o formato?

**P3 — o filtro por aniversariante e quem tem mais de um.** Um grupo pode ter
`convidado_por = [1,3]`. **Proponho** que ele apareça no filtro do Bruno **e** no do JH Boca —
"quem o Bruno chamou" inclui quem ele chamou junto com outro. É leitura de negócio, não de
layout, por isso pergunto em vez de decidir.

Os commits 1 e 4 não dependem de nenhuma das três; P1 trava o fim do commit 1 e P2 o commit 3.
