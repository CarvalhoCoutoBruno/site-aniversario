# Review — Fatia 9

**Veredito: aprovado, com as decisões de design definidas abaixo.** Plano forte — a pré-checagem
de que screenshot funciona, o **contraste WCAG medido** (não "parece legível"), o fix do mobile na
equação e os 3 conflitos que você surfou são exatamente o que essa fatia precisava.

## Decisões (as suas 3 perguntas)
1. **Título — VISÍVEL no hero.** O Bruno quer o título no topo. Então: o `festa.titulo` é o
   **headline (H1)** do hero, e o "160 / equação 40+50+70" fica como o **elemento gráfico de apoio**
   logo abaixo/junto — os dois se complementam (nome + destaque visual), não competem. Cuidar pra
   não virar repetição desajeitada de "160" (o título como headline e o 160 como número-arte grande,
   não dois textos iguais empilhados). O `<title>` da aba passa a usar o `festa.titulo` (hoje é o
   literal "Convite de Aniversário") — melhora o preview do link no WhatsApp.
2. **Idades como constante no `main.js`, com o 160 = soma delas:** aprovado. Consistência garantida;
   documenta o acoplamento idade[i]↔nome[i] (reordenar desalinha).
3. **Cores — NÃO é a paleta do mockup: vai preto + azul + vermelho.** Hero escuro (preto), azul e
   vermelho como acentos. **Manter o clima de festa** com essa paleta (confete, energia) pra não
   virar cara de site corporativo/sério — o astral de aniversário tem que sobreviver às cores mais
   fechadas. Definido antes de começar (mudar depois = refazer os screenshots).

## Uma trava técnica pra não vazar escopo
O `css/style.css` é **compartilhado** com o `admin.html` (fora de escopo). As fontes novas (Fredoka)
e a paleta nova **não podem vazar** pro admin — escopar o restyle ao convite (uma classe de
página/`body`, ou seletores sob o container do convite), deixando as classes compartilhadas
(`.btn`, `.chip`, `.stat`, `.selo`, `.conta-aniv`, `.msg-toast`) e o visual do admin **intactos**.
Você já disse que ia manter as compartilhadas — só reforço que a **fonte/cor global** também não
pode escorregar pro admin.

## O resto, aprovado
Preservar todos os estados da Fatia 8 (carregando, erro fail-loud coerente, countdown nos 3 estados,
encerrado, carrossel vazio, sucesso), manter todos os ids que o `main.js` escreve, `main.js` no
mínimo, e as fontes por `<link>`. O verify com screenshots + não-regressão funcional + contraste
medido é o padrão certo pra uma fatia de design.

Pode `executa`.
