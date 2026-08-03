# Review — Fatia 10

**Veredito: aprovado, sem ajustes.** O terceiro caminho do item 1 é melhor que as duas opções que
eu ofereci — segue com ele.

## Item 1 — o terceiro caminho, aceito
O raciocínio está certo nos dois lados: **tirar o pill** empurra a data para baixo da dobra no
celular, e "88 dias" não substitui uma data que a pessoa anota na agenda; **inventar conteúdo** pro
card seria encher linguiça pra justificar um duplicado. Manter o pill e **refocar a seção no
lugar** dá a cada bloco um trabalho só — hero responde *o quê/quando*, seção responde *onde* — e
mata a repetição sem perder informação.

E o efeito colateral é o melhor argumento: **resolve o item 3 pela causa** ("o problema não é
padding a mais, é conteúdo de menos") em vez de empurrar espaçamento até disfarçar. Diagnóstico
certo.

## Itens 2, 3, 4 — aprovados
- **Carrossel:** manter o `aspect-ratio` (que governa o mobile, bom como está) e somar o teto no
  desktop é a abordagem certa.
- **Confete:** reduzir densidade **e** empurrar pras bordas abaixo de 560px — as duas coisas, como
  proposto. Enfeite não disputa com texto.
- **Antes/depois capturado antes de mexer**: certíssimo, comparação real em vez de memória.

## Respostas às 2 perguntas
1. **Terceiro caminho:** sim, aceito (acima).
2. **Teto de 420px:** ok como ponto de partida. Só um cuidado ao olhar o "depois": com
   `aspect-ratio: 16/10` e teto de 420px, a largura fica em ~672px — bem mais estreita que os 900px
   de hoje, e o carrossel pode parecer **pequeno/perdido** no meio do desktop. Se for o caso, a
   saída melhor é **alargar a proporção no desktop** (16/9, 2/1) em vez de encolher a largura —
   assim ele fica mais baixo *sem* ficar menor. Decide olhando o screenshot; não precisa voltar pra
   review por causa disso.

## Nota leve (opcional)
Com o card de data fora, a copy da seção muda. O resto da página tem um tom brincalhão ("Anota aí",
"Bora?", "Momentos") — vale a nova manter esse tom (algo como "Anota o endereço" / "É aqui") em vez
de um "Onde vai ser" mais seco. Detalhe de voz, sem impacto estrutural.

## Verify
Cobre o que importa: antes/depois nos dois tamanhos, a não-regressão do fail-loud (**um estado
só** — a asserção que já quebrou duas vezes), o modo escuro que não pode regredir, e o admin
intacto.

Pode `executa`.
