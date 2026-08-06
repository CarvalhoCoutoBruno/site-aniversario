# Fatia 13 — Admin: abas "Quem vem" e "Compras"

Segunda das quatro fatias do painel (mapa no `prompt.md` da Fatia 12). A casca e o Resumo já estão
de pé; aqui morrem a tabela de 7 colunas e as duas seções provisórias correspondentes.

## ⚠️ Regra permanente, a partir de agora
**O banco tem dado real de convidado.** A Rosaura confirmou de verdade. Toda verificação que gravar
RSVP apaga **por nome/identificador do próprio teste**, nunca em bloco: `delete from rsvps` sem
`where` deixou de ser uma operação aceitável neste projeto. Ao fim de cada fatia, provar que a
confirmação real continua intacta — linha, pessoas e recado.

## Fontes da verdade
`docs/revisao/design/admin/prompt-design.md` (§2 para a estrutura das duas abas, §3 tokens, §4
contraste) e o mockup. O mockup manda em layout, espaçamento e hierarquia; regra de negócio, não.

## Escopo

### Aba "Quem vem"
1. **A tabela de 7 colunas sai.** Cada grupo vira um **card**: nome do responsável, contato, quem
   convidou, nº de pessoas. Ao tocar, **expande**: uma linha por pessoa (tipo + o que consome), o
   recado, e as ações.
2. **Busca + filtros**, conforme o mockup.
3. **Ações do card: WhatsApp e excluir.**
4. Acompanhante sem nome continua exibido como **"Acompanhante N"** (comportamento atual, não
   regredir) — a pessoa existe no rateio mesmo sem nome.

### Aba "Compras"
5. Lista de compra (litros e unidades) + custo estimado, a partir do que hoje alimenta
   `estVolumes`, `estPizzas` e `estCusto`. **Só leitura** — `js/calculo.js` não muda.
6. **"Copiar para o fornecedor"**: texto pronto para colar no WhatsApp. Se a `navigator.clipboard`
   for negada, cair no `<textarea>` selecionado, como já fazemos no acerto — nada de erro sem saída.

### Limpeza
7. As seções provisórias de "Quem vem" e "Compras" saem. As de **Contas** e **Ajustes** continuam —
   o painel não pode ficar inutilizável.

## Riscos que quero endereçados no plano

**1. Excluir agora apaga dado real e não tem desfazer.** O `delete` leva o grupo **e** as pessoas
por cascade. Quero: confirmação **nomeando quem** vai ser apagado ("Apagar a confirmação de
Rosaura e as 2 pessoas do grupo?"), não um "Tem certeza?" genérico. Diga no plano se acha que
merece mais fricção que isso.

**2. O outro lado de "as abas não carregam nada".** Como o carregamento é único, **quem muda dado
tem de atualizar o estado compartilhado**: depois de excluir, `ultimasPessoas`/`ultimosGrupos`
precisam refletir a exclusão e `recomputar()` rodar — senão Resumo, Compras e Contas ficam com
número velho até o ↻. Era o preço da decisão da Fatia 12, e é aqui que ele vence.

**3. O link de WhatsApp e o código do país.** `contato_norm` guarda só dígitos: a Rosaura está
como `51995509956`. Um `wa.me/51995509956` **não** vai para ela — `+51` é o Peru. Precisa
compor o número completo (`55` + DDD + número) e tratar os casos: contato que é **e-mail** (não
mostra WhatsApp, ou vira `mailto:`), número com DDI já incluso, número curto/inválido. Não invente
DDD se não houver.

**4. Escape do que o convidado escreveu.** Nome, contato e recado vêm de fora e vão para markup
novo. O `esc()` cobre hoje; a troca de tabela por card é exatamente onde isso regride. Teste com
carga (`<img src=x onerror=…>`) no nome e no recado, como já foi feito na Fatia 1.

## Fora de escopo
`js/calculo.js`, `index.html`/`js/main.js`, schema, RLS, e as abas Contas e Ajustes além de
mantê-las funcionais.

## Verify
- `./verify.sh` verde, **com o invariante de fuso** (o card mostra hora de chegada — tem que sair
  no fuso da festa, não no de quem abre).
- **A confirmação real da Rosaura intacta ao fim** — linha, pessoas e recado, saída crua.
- **Exclusão:** criar um RSVP de teste, excluir **por ele**, provar por `SELECT` que o grupo e as
  pessoas sumiram (cascade) e que **nada mais** sumiu.
- **Estado compartilhado:** excluir na aba "Quem vem" e provar, **sem recarregar**, que Resumo e
  Compras atualizaram (é o risco 2).
- **WhatsApp:** o href gerado para `51995509956` tem de apontar para o número certo com DDI; e o
  caso de contato que é e-mail.
- **XSS:** nome e recado com carga; provar que não executa e que o HTML sai escapado.
- **Copiar para o fornecedor:** o texto gerado bate com os números da tela; e o caminho de
  clipboard negada.
- **Screenshots a 390px:** lista de cards, um card expandido, busca/filtro ativo, estado vazio, e a
  aba Compras. Mais um de desktop.
- **Convite intacto** e **modo escuro idêntico** (as duas asserções que já pegaram regressão).

## Observação
Se o mockup não cobrir algum caso dos filtros ou do estado vazio, pergunte no plano — não invente
hierarquia. É a fronteira do `FLUXO.md`.
