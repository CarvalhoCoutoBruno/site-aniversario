# Fatia 9 — Redesign do convite (visual)

## Objetivo
Trocar a "pele" do convite público por um design bonito, na direção **divertido/temático** que a
gente escolheu: o conceito dos **160 (40 + 50 + 70)** como identidade visual. Só apresentação —
**nenhuma** mudança de lógica, dados ou schema. O miolo (RSVP, countdown, carrossel, load da
`festa` com fail-loud) continua igual; muda o CSS/HTML.

## Direção de design (o alvo)
Referência visual: **`docs/revisao/design/mockup-convite.html`** (abre no navegador). O conceito:
- **Hero:** o "160" gigante como herói, e a **equação 40 + 50 + 70 = 160** amarrando cada número a
  um dos três (Bruno/Braz/Bocão). Copy que brinca com a conta ("a conta é simples", "três motivos
  pra brindar").
- **Vibe:** festivo com bom gosto — fonte arredondada/simpática (ex.: Fredoka) nos números e
  títulos, corpo limpo (ex.: Nunito/Inter); paleta festiva (roxo + pink + âmbar) com confete. Hero
  escuro e vibrante contrastando com seções claras.
- **Fontes:** via `<link>` do Google Fonts (sem build), como o site já faz.
- Detalhes finos (cores exatas, nível de confete) a gente **afina no `revisa`** — o mockup é ponto
  de partida, não lei.

## Escopo (o que entra)
1. **`css/style.css` + `index.html`** do convite público, restyle completo na direção acima: hero
   (160/equação), countdown, "quando & onde" (data + local + mapa), carrossel, e a CTA/área de RSVP.
   **Responsivo** (a maioria confirma no celular) e com **contraste acessível**.
2. **Reaproveitar os dados dinâmicos** que a Fatia 8 traz da `festa` (título, subtítulo, os 3 nomes,
   data, local, mapa) — nada de voltar a hardcodar.
3. **Preservar todos os estados** existentes: carregando, erro de carga (fail-loud), countdown nos
   3 estados (futuro/é-hoje/passou), "confirmações encerradas", carrossel vazio, sucesso do RSVP (o
   confete já existe).
4. **Não tocar na lógica** (`main.js` wiring, `calculo.js`, RPCs, RLS). Só classes/markup/estilo. Se
   precisar de um gancho de classe no `main.js`, que seja mínimo e sem mudar comportamento.

## Decisão a resolver no plano/review: as idades (40/50/70)
A equação mostra as idades, mas elas **não existem no dado** hoje (nem no `config.js` antigo, nem na
`festa`) — só o nome. Como esta fatia é **só design** (sem schema), recomendo **fixar as idades no
layout** (é esta festa específica), ciente de que não seriam editáveis; a alternativa (idades como
dado editável) é schema aditivo e fica pra uma fatia à parte se a gente for produtizar. Confirmar no review.

## Fora de escopo
`admin.html` (é interno; segue funcional como está), qualquer lógica/dado/schema, e a produtização.

## Verify (é design — o "cru" são screenshots)
- `./verify.sh` verde (nada de lógica muda; 63 asserções sem alteração).
- **Não-regressão funcional** (o reskin não pode quebrar o que funciona), com saída crua no
  `status.md`: um envio de RSVP real ponta a ponta (`criar_rsvp` grava; apagar depois), o countdown
  nos 3 estados, o carrossel, e a falha de carga (fail-loud) ainda coerentes.
- **Visual:** screenshots do convite redesenhado em **desktop e mobile**, nos estados: normal,
  é-hoje, encerrado, erro-de-carga, sem-fotos. As imagens são a evidência.
- **Acessibilidade:** conferir contraste do texto sobre os fundos (hero escuro/texto claro, e as
  seções claras).

## Observações
- É uma "pele" sobre a estrutura da Fatia 8 — mexe em `css/style.css` e no markup do `index.html`,
  não na lógica.
- Schema é aditivo agora (Fatia 8): esta fatia não tem schema, então nem se aplica — fica o princípio.
