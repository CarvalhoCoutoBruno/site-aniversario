# Review — Fatia 15 (admin: aba "Contas")

**Veredito: aprovado**, com duas condições no item 6 e uma nota no plantio das fases. As três
perguntas respondidas.

## O achado do topo — obrigado por parar
Você encontrou uma colisão entre dois itens do **meu próprio prompt**: nulificar `pessoas.nome`
(item 6) quebra o texto de compartilhar (item 5), porque o `resumoAcerto()` monta a frase **dentro
do módulo**, a partir do `nome` que veio nas linhas. Consertar isso no `admin.js` seria exatamente
o "derive na tela" que o risco 2 proíbe. Era o caso em que eu pedi para parar e perguntar, e você
parou. Certo.

## P1 — corrigir na entrada: **sim**, e é a arquitetura certa
`calculo.js` é módulo puro: dado entra, número sai. **Não é papel dele saber onde o nome mora** — é
papel de quem chama entregar o dado resolvido. Hoje o módulo depende, implicitamente, de um
snapshot que pode envelhecer; depois da mudança ele depende do que o chamador passa, e o chamador
resolve da fonte única. Isso é o contrato correto de uma função pura, não um contorno.

**Duas condições, e as duas são para o item 6 não se desfazer sozinho:**

1. **Remova a sincronia que a Fatia 14 acabou de criar.** Ela atualiza `pessoas.nome` ao renomear
   pelo Convite — ou seja, **repopularia a coluna no próximo rename**, e aí você fica com o pior
   estado possível: algumas linhas nulas, outras não. Ela existia para resolver a divergência
   enquanto o snapshot era usado; com a correção na entrada, ela vira o problema.
2. **Pare de escrever `nome` no cadastro de aniversariante** (o `upsert` de Ajustes, herdado da
   Fatia 3, grava o nome vindo da lista). Se ficar, a coluna repopula pelo outro lado.

E uma de forma: a resolução tem de morar em **um helper nomeado** (algo como
`pessoasParaCalculo()`), usado por todos os pontos que alimentam o módulo — não um `.map()` inline
repetido. Como o contrato passa a ser "quem chama entrega os nomes resolvidos", isso precisa de um
lugar só e de uma linha de comentário no cabeçalho do `calculo.js` dizendo isso. Senão o próximo
chamador — um relatório, uma outra tela — recebe "Aniversariante 1" e ninguém entende por quê.

## P2 — prejudicada
Com o P1 aprovado, o item 6 fica.

## P3 — base de teste do ×6,5: **sim, com o prefixo**
Escrever RSVP de teste no banco real é o que a gente vem fazendo em todas as fatias, e a regra já
está no lugar: apagar **pelo próprio identificador**, nunca em bloco. `zz-teste-` serve. Prefiro
isso à conferência só por `jsc` justamente porque o que está sendo verificado aqui **é a tela** — o
módulo já tem 63 asserções em cima; o que ninguém provou ainda é que a tela mostra o número do
módulo.

Uma nota para a montagem: a Rosaura está na base e consome **água e pizza, não chopp** — então ela
não perturba o `C_chopp` do ×6,5, mas **entra no total gasto e na parte de pizza**. Ancore a
asserção no componente de chopp da conta do Bruno, ou declare os valores esperados já com ela
dentro. Não vá comparar o total achando que ela não está lá.

## Nota no plantio das 4 fases
No `nao-confere` você lista "um grupo sem `convidado_por` válido". Esse caminho é **inalcançável**:
`convidado_por_valido()` exige 1 a 3 itens em {1,2,3} e a FK impede pessoa sem grupo. Não gaste
tempo tentando — o **órfão** (custo lançado para item que ninguém consome) é o caminho real, e você
já o citou na linha seguinte. Use só ele.

## O resto, aprovado
A tabela de "de onde vem cada número" é exatamente o que eu queria: doze linhas, nenhuma derivada
na tela, e a promessa de parar e perguntar se faltar alguma. O plantio invertido do `update`
estreito (valores da Ajustes plantados antes da bateria) é a prova certa. E o cuidado com o
**espaço não-quebrável** — comparar em **centavos inteiros** em vez de string formatada — é melhor
que normalizar a string: some com a classe inteira do problema.

Pode `executa`.
