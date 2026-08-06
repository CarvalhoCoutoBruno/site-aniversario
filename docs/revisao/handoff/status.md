# Status — Fatia 12: Admin, casca (abas + roteamento + login) e a aba Resumo

**Fatia fechada.** Os dois ajustes do review entraram, as três perguntas foram implementadas
conforme as respostas, e o invariante de fuso achou um bug de verdade no caminho.

| | |
|---|---|
| Branch | `feat/fatia-12-admin-casca` → merge `--ff-only` → apagada |
| Commits | 5, cada um verde no `./verify.sh` |

## O que entrou

| Commit | O quê |
|---|---|
| `feat` | escopo `.pagina-admin`, tokens, fontes, **e o prefixo nas 68 regras herdadas** |
| `feat` | casca: cabeçalho fixo, 5 abas, roteamento por hash, conteúdo de hoje redistribuído |
| `feat` | login no visual novo + seletor cobrindo `email` e `password` |
| `feat` | aba Resumo |
| `chore` | `verify.sh` ganha o invariante de fuso |

## Os dois ajustes do review

### Ajuste 1 — o invariante de fuso, com as duas correções

A regra ficou: nenhum `toLocaleDateString` / `toLocaleTimeString` / `Intl.DateTimeFormat` em
`js/` sem `timeZone`. O `toLocaleString` genérico **ficou de fora** (o `fmtNumeroBR` e o
`fmtLitros` o usam para número), e o `Intl.DateTimeFormat` **entrou** — sem ele o invariante
protegeria o caminho antigo e deixaria aberto justamente o que passamos a usar.

Precisou de uma terceira correção que só apareceu ao rodar: a primeira versão era `grep` de linha
única e **acusou nove trechos corretos**, porque o objeto de opções quase sempre quebra em várias
linhas. Virou `awk` com janela de 6 linhas.

**E achou um bug real:** o `fmtData()` mostrava a hora de chegada de cada confirmação no fuso de
**quem abre o painel**. São cinco organizadores; a resposta tem que ser a mesma para todos.
Corrigido na mesma fatia.

Testado plantando uma violação:
```
✗ formatação de data/hora sem timeZone (usa o fuso de quem abre a página):
      js/main.js:711:const x = new Date().toLocaleDateString("pt-BR");
```
e voltando a verde ao remover.

### Ajuste 2 — prefixo em vez de inventário

As 68 regras herdadas do admin foram prefixadas com `.pagina-admin`. Não muda nada visualmente e
elimina a pele órfã fora de escopo.

**Mas o prefixo sozinho não bastou**, e a tela mostrou por quê: com os dois lados escopados, o
empate de especificidade passa a ser decidido pela **ordem**, e o bloco novo estava *antes* do
herdado. O cartão antigo do login (380px, centralizado, cantos arredondados) continuava vencendo
o novo, com o seletor idêntico. Duas correções:

- removidas as regras do `.login-box` antigo, que a pele nova substitui inteiras;
- o bloco da Fatia 12 movido para **depois** das herdadas.

É o mesmo problema da Fatia 11 aparecendo pela terceira vez — agora resolvido por ordem, que é
determinística, em vez de por especificidade, que é acidente.

## As três perguntas, implementadas

**P1 — barra do prazo:** régua da primeira confirmação recebida até o prazo. Sem confirmação, sem
barra. **Com o prazo vencido trava em 100%** e o texto vira "As confirmações estão encerradas" em
vez de contar dias negativos — a borda que o review pediu.

**P2 — modo escuro:** o painel é claro nos dois esquemas. Medição abaixo.

**P3 — carimbo:** hora do último carregamento da sessão, no fuso da festa.

## Verificação integrada

### Guarda de completude — o teste da Fatia 4

Com o `GET /rest/v1/pessoas` **pendurado para sempre** (interceptado no `fetch`, que é a camada
real — a primeira tentativa, stubando o builder do supabase-js, não pegava porque
`.select().order()` devolve outro builder):

```json
{ "config_carregou": true, "festa_carregou": true, "pessoas": "GET pendurado — nunca resolve",
  "estCusto": 0, "estVolumes": 0, "fecTotais": 0, "fecContas": 0,
  "resumoConfirmados": "0", "resumoGrupos": "0" }
```

Config e festa chegaram; **nada** calculou com o estado pela metade.

### Modo escuro — idêntico
```
claro : body rgb(236,234,229) · coluna rgb(247,246,243) · card rgb(20,17,13) · input rgb(255,255,255)
escuro: body rgb(236,234,229) · coluna rgb(247,246,243) · card rgb(20,17,13) · input rgb(255,255,255)
diferenças: nenhuma
```

### Convite intacto — comparação site contra site

Servi uma cópia do estado **antes** da fatia em `/antes/` e comparei 45 elementos × 14
propriedades computadas:

```
elementosComparados: 45 · propriedadesPorElemento: 14
diferenças: 1  →  .car-dots button  (backgroundColor)
```

A única diferença é **qual dot do carrossel está ativo** — ele avança sozinho a cada 5s, então
depende do instante da medição. Confirmado lendo os três dots: o ativo é opaco, os outros a 40%,
nos dois lados. Título do convite segue em `Anton, Impact, sans-serif`.

### Não-regressão do que está em uso

Editei e salvei **pelo painel**, com o formulário de verdade:

```
antes:  preco_pizza_adulto = 20,00
salvo:  "Configuração salva. ✅"  →  banco: Decimal('23.45')
custo_real_chopp / pago_por_chopp: None / None   ← o update foi ESTREITO
restaurado: 20,00
```

O `update` não tocou em `custo_real_*` nem em `pago_por_*`. É o invariante do item 4 do prompt,
provado em vez de afirmado.

Carregamento na aba Ajustes, direto por `#ajustes`:
```
{ "convite": {"titulo":"Festa dos 160 anos","local":"Salão Grande — Av. C…","aniv3":"JH Boca"},
  "precoPizza": "20,00", "prazo": "2026-10-01", "blocosAniv": 3, "fotos": 3 }
```

**O prazo lido pela tela é 01/10/2026** — não pelo `::date`, que foi o que me enganou na Fatia 11.

### Roteamento
```
inicial (sem hash)      → resumo
clique em Contas        → #contas,  visível: contas
hash mudado por fora    → #compras, visível: compras
hash inválido           → #nao-existe, visível: resumo
botão voltar            → #compras, visível: compras
recarregar em #ajustes  → abre em Ajustes
```

### Desktop
```
larguraColuna: 560 · larguraAbas: 560 · aba aberta: contas
```

### Dado do Bruno, ao fim
```
precos: pizza 20.00 / pizza-criança 20.00 / chopp 10.00 / refri 5.00 / água 3.00
litros_chopp_por_adulto: 2.500
prazo (São Paulo): 01/10/2026 23:59:59
custo_real_chopp / pago_por_chopp: None / None
festa: 'Festa dos 160 anos' · 'Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS'
       · Bruno · Braz · JH Boca
aniversariantes: ['Bruno', 'Braz', 'JH Boca']
admins: 4  (o usuário temporário de teste foi removido; auth.users com o e-mail de teste: 0)
```

## ⚠️ A primeira confirmação de verdade chegou

Durante esta fatia entrou um RSVP real:

```
rsvp:   'Rosaura', 51995509956, convidado_por [3] (JH Boca), 'Te amooooo'
pessoa: 'Rosaura', adulto, principal, água + pizza
```

**Não encostei nela.** A partir daqui, todo teste que gravar RSVP apaga **por nome**, nunca em
bloco — `delete from rsvps` sem `where` deixou de ser seguro neste projeto.

Ela já aparece no Resumo: 4 confirmados (3 aniversariantes + Rosaura), 1 grupo, e o recado no
bloco de "Recados e restrições", classificado como recado e não restrição.

## O que fica para as próximas

- **Fatia 13** (Quem vem + Compras): a tabela de 7 colunas ainda é a de hoje, dentro da aba.
- **Fatia 14** (Ajustes): os quatro `<details>` provisórios saem; os inputs `date` e `url`
  ganham o seletor (o `email`/`password` já foi pago aqui); e o aviso na tela de Ajustes de que
  as `<meta>` `og:` do convite **não** seguem o painel.
- **Fatia 15** (Contas): as 4 fases.
- **Dívida aberta:** quando a Fatia 14 fechar, nenhuma página lerá o `:root` no escuro e o bloco
  `@media (prefers-color-scheme: dark)` pode ser removido inteiro.
