# Plano — Fatia 9: redesign do convite

Branch: `feat/fatia-9-redesign`

## Viabilidade primeiro: os screenshots funcionam

A evidência que esta fatia pede são imagens, e o `FLUXO.md` registra que **screenshot sai preto**
com o painel do navegador oculto. Testei antes de planejar, servindo o mockup: funcionou em
desktop e em mobile (375×812). A fatia é verificável como o prompt quer.

O mockup também está bonito — a direção está certa, e ele resolve o problema de "como fazer um
convite de três aniversariantes não virar uma lista".

## Três conflitos entre o mockup e o que a Fatia 8 acabou de construir

O mockup é uma página estática com tudo escrito à mão. O convite real virou dinâmico na fatia
passada. Onde os dois se encontram, há decisões a tomar:

### 1. O título editável não tem lugar no hero novo

A Fatia 8 tornou `festa.titulo` editável, e o convite hoje mostra "Festa dos 160 anos" como `<h1>`.
No mockup o hero é: *"VOCÊ ESTÁ CONVIDADO PARA A"* → **160** → *"anos de festa"*. O título não
aparece em lugar nenhum.

Se eu simplesmente adotar o mockup, **o campo Título do painel deixa de ter efeito visível** —
uma fatia desfazendo a anterior em silêncio.

**Proposta:** o `<h1>` passa a ser o próprio bloco "160 / anos de festa", e o `titulo` da `festa`
vira a linha de contexto — no rodapé ("Festa dos 160 anos · Bruno, Braz & Bocão") e no
`<title>` da aba, que hoje é o literal "Convite de Aniversário". Assim o campo continua servindo
para alguma coisa, sem competir com o 160.

### 2. O "160" e a equação são dado, e não existem

Os números 40/50/70 não estão em lugar nenhum — nem no `config.js` antigo, nem na `festa`. O
prompt recomenda fixá-los no layout, e **concordo**: esta festa é esta festa, e transformar idade
em schema é fatia à parte.

**Como vou fixar, com um cuidado:** as idades ficam num array de constante no `main.js`, ao lado
de onde os nomes são renderizados, e **o 160 do hero é a soma delas** — não um literal. Assim a
equação e o número gigante não têm como discordar. Se alguém mexer numa idade, o hero acompanha.

O acoplamento que sobra: idade[i] tem de casar com nome[i]. Renomear é seguro; **reordenar os
nomes no painel desalinha as idades** — o mesmo risco que a ordem já carrega para o rateio, agora
visível no convite. Vou deixar isso escrito no comentário e no aviso da tela de admin.

### 3. O mockup não tem os estados que a Fatia 8 construiu

Ele cobre a página feliz. Faltam, e **todos precisam sobreviver**: carregando, erro de carga
(fail-loud, que custou três bugs para acertar), countdown "é hoje" / "passou", "confirmações
encerradas", carrossel vazio e o sucesso do RSVP.

Vou desenhar cada um na pele nova. O erro de carga em especial: hoje ele esconde hero, carrossel
e formulário e mostra um bloco só — essa coerência não pode se perder num layout mais complexo.

## Um detalhe do mockup a corrigir

No mobile a equação quebra feio: `70 Bocão` e o `=` dividem uma linha, e o `160` cai sozinho
embaixo. Vou reorganizar para empilhar como 3 + resultado, sem operador órfão.

## Implementação

- **`index.html`:** remarcação do convite mantendo **todos os ids** que o `main.js` escreve
  (`#festaTitulo`, `#festaSubtitulo`, `#festaData`, `#festaLocal`, `#heroNomes`, `#countdown`,
  `#cdDias/Horas/Min/Seg`, `#festaEstado`, `#conviteCarregando`, `#hero-conteudo`, `#conviteErro`,
  `#carrossel*`, `#rsvp*`, `#chipsAniversariantes`, `#pessoasLista`, `#tplPessoa`...).
- **`css/style.css`:** reescrita da parte do convite. O `admin.html` usa o mesmo arquivo, então
  as classes compartilhadas (`.chip`, `.btn`, `.campo`, `.msg-toast`, `.stat`, `.selo`,
  `.conta-aniv`…) **ficam intactas** — restyle só do que é exclusivo do convite.
- **`js/main.js`:** o mínimo. As idades, a soma para o hero, e os nomes na equação. Nenhuma
  mudança de comportamento.
- Fontes Fredoka + Nunito por `<link>`, como o site já faz com Fraunces + Inter.

## Fora de escopo
`admin.html`, lógica, dados, schema, produtização.

## Verify

`./verify.sh` verde — 63 asserções, sem alteração (nada de cálculo muda).

**Não-regressão funcional**, com saída crua no `status.md`:
1. RSVP real ponta a ponta pelo layout novo (`criar_rsvp` grava; apago depois);
2. countdown nos 3 estados, incluindo o dia da festa com `diff` negativo;
3. carrossel com foto e vazio;
4. falha de carga: **um estado só visível** — a mesma asserção da Fatia 8;
5. "confirmações encerradas".

**Visual**, em desktop e mobile: normal, é-hoje, encerrado, erro-de-carga, sem-fotos.

**Acessibilidade:** contraste medido, não olhado. Vou calcular a razão WCAG dos pares
texto/fundo do hero escuro e das seções claras, e reportar os números — "parece legível" não é
evidência.

## Para o review

1. **O título editável** (conflito 1): concorda com ele virar rodapé + `<title>` da aba, ou
   prefere um lugar mais visível no hero?
2. **Idades como constante no `main.js`, com o 160 sendo a soma** — ok? A alternativa é literal
   no HTML, que aceita divergir da equação.
3. As cores do mockup entram como estão, ou quer afinar algo? Só peço definir antes: mexer em
   paleta depois de pronto é refazer os screenshots todos.

Parado, sem implementar, aguardando `review.md`.
