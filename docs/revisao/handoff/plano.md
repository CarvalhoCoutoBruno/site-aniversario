# Plano — Fatia 4: estimativa de compra

Branch: `feat/fatia-4-estimativa`

## Ponto de partida

`calculo.estimativa(pessoas, config)` está pronto, testado (41/41) e já carregado no
`admin.html` desde a Fatia 2. Esta fatia é essencialmente tela: **nenhuma escrita no banco**.

## O que verifiquei antes de planejar

### A costura entre os tipos do banco e o módulo puro funciona

`numeric` volta do Supabase como **string** (`"18.50"`, `"2.000"`), não número. Se o módulo
tratasse isso mal, o custo sairia zerado ou `NaN` — e em silêncio. Rodei `estimativa` com dados
exatamente na forma que o banco devolve:

```
contagens : {"totalPessoas":4,"adultos":3,"criancas":1,"chopp":2,"refri":2,"agua":2,
             "pizzaAdultos":2,"pizzaCriancas":1}
litros    : chopp=4 refri=1.2 agua=1
custo     : 20050 centavos = R$ 200,50

conferindo na mao:
  chopp: 2 adultos x 2,0 = 4 L        -> OK
  refri: 2 pessoas x 0,6 = 1,2 L      -> OK
  agua : 2 pessoas x 0,5 = 1,0 L      -> OK
  custo: 7400+720+300+9180+2450       -> OK
```

`paraCentavos` e a conversão de taxa dão conta da string. Sem surpresa aqui.

### O problema real é de coordenação, não de cálculo

Os três carregadores rodam **em paralelo** no `mostrarPainel()`:

```js
carregarConfig();          // busca config
carregarAniversariantes(); // busca pessoas (aniversariante)
carregarRSVPs();           // busca rsvps + pessoas
```

A estimativa precisa de **config + pessoas juntas**, e hoje nenhum dos dois guarda o que
carregou: `carregarConfig` popula os inputs e descarta a linha; `carregarRSVPs` monta
`porGrupo`/`aniversariantes` e passa direto para o `render`.

Se eu recalculasse a estimativa dentro de um deles, ela rodaria com metade do estado —
intermitentemente, dependendo de qual promessa resolvesse primeiro. É o tipo de bug que passa no
teste e falha na máquina do usuário.

**Solução:** guardar `ultimaConfig` e `ultimasPessoas` em variáveis do módulo; cada carregador
preenche a sua parte e chama `atualizarEstimativa()`, que **não faz nada** enquanto faltar
alguma. Quem chegar por último dispara o cálculo.

### A config da estimativa é a **salva**, não a do formulário

Ler os inputs seria mais fácil, mas mostraria estimativa baseada em edição não salva. Uso a
linha que veio do banco (atualizada também depois de cada save bem-sucedido).

### A contagem N/3 sai das próprias pessoas

O `linhaDoAniversariante` do `carregarAniversariantes` teria a informação, mas é preenchido por
outro carregador em paralelo — mesma corrida. Conto direto na lista:
`pessoas.filter(p => p.papel === "aniversariante").length`. Auto-contido, sem corrida.

## Implementação

### `admin.html`
Seção em `<details>` fechado, depois de aniversariantes (ordem da ET §7.2). Três blocos:
volumes (chopp / refri / água), pizzas (adulto / criança) e custo aproximado. Mais um
detalhamento curto das contagens e a faixa de aviso do N/3. **Sem botão de salvar.**

### `js/admin.js`
- `ultimaConfig` / `ultimasPessoas` — o estado compartilhado.
- `atualizarEstimativa()` — guarda de completude, chama `calculo.estimativa`, pinta a tela.
- `carregarConfig` e `carregarRSVPs` passam a guardar o que carregam e a chamar a atualização.
- Formatação: litros com até 3 casas em pt-BR; custo por `Calculo.formatarBRL`.

O "↻ Atualizar" já chama os dois carregadores, então recalcula de graça.

### Rótulos
"Custo aproximado" vem com **preços de referência** ao lado, e a seção diz que é estimativa —
para ninguém confundir com o fechamento da Fatia 5.

## Fora de escopo
Fechamento e `custo_real_*` (Fatia 5), edição de config, cadastro de aniversariantes,
formulário público. **Nenhuma escrita no banco nesta fatia.**

## Verify

`./verify.sh` verde (o `calculo.js` não muda; 41/41).

Integrada, com saída crua no `status.md`:

1. montar base conhecida — 2 grupos com consumo definido + os 3 aniversariantes cadastrados —
   e conferir os números da tela **contra a conta na mão** (nº que bebe × taxa);
2. **prova de que conta os aniversariantes:** apagar as 3 linhas de aniversariante, recarregar,
   e mostrar os volumes caindo exatamente o que eles consumiam; recadastrar e voltar ao valor;
3. **aviso N/3:** com 2 de 3 cadastrados o aviso aparece; com 3, some;
4. o custo usa os **preços de referência** — provo populando `custo_real_*` com valores bem
   diferentes e mostrando que a estimativa não se move;
5. **nenhuma escrita:** comparar o estado do banco antes e depois de abrir e recarregar a
   estimativa — tem de ser idêntico;
6. restaurar a base ao fim.

O item 2 é o que importa: se a estimativa esquecer os aniversariantes, os números ficam
plausíveis e errados — o organizador compra chopp a menos e ninguém percebe até a festa.

## Para o review

Uma decisão que tomei sozinho e vale confirmar: **a estimativa aparece mesmo com zero
confirmações**, mostrando tudo zerado, em vez de esconder a seção. Prefiro assim — some a dúvida
"será que a tela quebrou?" — mas se preferir esconder até haver gente, é trivial.

Parado, sem implementar, aguardando `review.md`.
