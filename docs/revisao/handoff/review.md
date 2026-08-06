# Review — Fatia 12 (admin: casca + Resumo)

**Veredito: aprovado, com dois ajustes** (a asserção de fuso tem um falso positivo garantido, e o
CSS antigo do admin precisa de destino). As três perguntas respondidas no fim.

## "As abas não carregam nada" — a melhor decisão do plano
Eu tinha levantado a guarda de completude como risco número um, e você resolveu **não criando o
problema**: as abas trocam visibilidade, o carregamento segue uma vez só no `mostrarPainel()` com a
serialização de hoje. O argumento fecha — a guarda não sobrevive a carregamento sob demanda, e não
há o que otimizar em ~30 grupos. Reintroduzir uma corrida para depois defendê-la seria trabalho
para piorar. Aprovado sem ressalva.

## Ajuste 1 — a asserção de fuso vai dar falso positivo no dia um
A ideia (invariante estático em vez de teste de execução) é certa e pega a família inteira,
inclusive em arquivo que ainda não existe. Mas a regra como escrita — *nenhum `toLocaleString` sem
`timeZone`* — **quebra em código legítimo que já está no repo**: `fmtNumeroBR` no `admin.js` e
`fmtLitros` no `main.js` usam `Number(x).toLocaleString("pt-BR", …)`, que é formatação de **número**
e não tem nada a ver com fuso. Vermelho no primeiro `verify.sh` convida a afrouxar a regra, e aí ela
morre.

Duas correções, as duas necessárias:
- **Tire `toLocaleString` genérico da regra** (ou exija allowlist explícita), e mantenha
  `toLocaleDateString` e `toLocaleTimeString`, que são inequivocamente data/hora.
- **Inclua `Intl.DateTimeFormat`** — é justamente a API que a gente passou a usar nas correções, e
  um `Intl.DateTimeFormat("pt-BR")` sem `timeZone` tem exatamente o mesmo bug e escaparia da regra
  atual. Sem isso, o invariante protege o caminho antigo e deixa o novo aberto.

## Ajuste 2 — o CSS antigo do admin precisa de destino, não de sorte
Você identificou o risco certo ("nada de regra nova sem prefixo"), mas o perigo da Fatia 11 não
veio de regra nova: veio da regra **velha** que ficou fora de escopo e **venceu por
especificidade** (`.pessoa-card.responsavel .pessoa-rotulo` 0,3,0 batendo `.pagina-convite
.pessoa-rotulo` 0,2,0). Aqui o CSS atual do admin é global e **vai conviver** com o novo durante as
fatias 12–14, por causa das seções provisórias. É o mesmo cenário, com os papéis trocados.

**Proponho resolver mecanicamente no commit 1: prefixar as regras existentes do admin com
`.pagina-admin`.** Não muda nada visualmente (o `<body>` ganha a classe de qualquer forma), elimina
a possibilidade de pele órfã não-escopada, e faz a ordem de cascata decidir em vez da
especificidade acidental. Se preferir não mexer, então quero no `status.md` o **inventário** dos
seletores antigos com especificidade ≥ (0,2,0) que possam ganhar dos novos, e a conferência deles no
fecho da Fatia 14 — mas o prefixo é mais barato que o inventário.

## As três perguntas

**P1 — a régua da barra do prazo: aprovado**, com uma borda. `min(rsvps.criado_em)` como origem é
dado real, já está carregado (nada de consulta nova) e responde à pergunta certa. Sem confirmação
ainda → sem barra, só a data e o "faltam N dias": correto. **Falta o outro extremo:** com o prazo
**vencido**, a barra tem que ler 100% e o texto virar "encerrado" — não pode passar de 100% nem
mostrar dias negativos. Cubra esse caso.

**P2 — modo escuro: claro nos dois esquemas.** (Decisão do Bruno, confirmada.) O pacote de design é
claro e a tabela de contraste foi medida em fundo claro; um segundo conjunto de tokens que não
existe não vai ser inventado aqui. Remap das globais dentro de `.pagina-admin`, no primeiro commit,
como asserção — exatamente como você planejou. E anotada a dívida: quando a Fatia 14 fechar,
nenhuma página lerá o `:root` no escuro e o bloco `@media` pode sair.

**P3 — "atualizado às HH:MM": último carregamento da sessão.** Aprovado, e pelo motivo que você
deu: a pergunta de quem olha é "esse número na minha tela está velho?", não "quando o convite foi
editado". `festa.atualizado_em` responderia outra coisa.

## O resto, aprovado
Hash para o estado da aba (sobrevive ao reload, é compartilhável, degrada sozinho, e
`replaceState` para não empilhar histórico) — certo, e melhor que `localStorage` aqui. Atualizar
`render()` no **mesmo commit** que aposenta `#stats` — certo, e a lembrança da Fatia 11 é
pertinente. Pagar a dívida dos seletores `email`/`password` agora, porque é a tela de login, e
deixar `date`/`url` para a 14 com os formulários — bom recorte.

## Verificação
Cobre o que importa. Dois reforços: o item 4 (**convite intacto**) é o que me deixa dormir —
compare `getComputedStyle` antes/depois de verdade, não só o `grep` de `Anton`. E no item 1, ao
restaurar os dados do Bruno, confirme também que o **prazo continua 01/10/2026 23:59 SP** lido pela
tela (não pelo `::date`, que foi o que enganou na Fatia 11).

Pode `executa`.
