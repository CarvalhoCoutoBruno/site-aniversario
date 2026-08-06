# Status — Fatia 14: Admin, aba "Ajustes"

**Fatia fechada.** Os últimos `<details>` provisórios do Convite, Preços/taxas/prazo e
Aniversariantes saíram; só Contas continua provisória, e ela é a Fatia 15. O bloco escuro do
`:root` saiu com medição, e o teste do upload achou um bug de mount duplo.

| | |
|---|---|
| Branch | `feat/fatia-14-admin-ajustes` → merge `--ff-only` → apagada |
| Commits | 3, cada um verde no `./verify.sh` |
| Commit do código | `HASH_CODIGO` |
| `origin/main` após o push | `HASH_ORIGIN` |
| `main == origin/main` | **sim** |

## O bug que o teste do upload achou

Subi um arquivo pelo input e **dois** chegaram no bucket, com nomes diferentes e o toast dizendo
"1 foto(s) enviada(s)". A causa não estava no upload: **dois caminhos chamam `mostrarPainel()`** —
o `getSession()` de quem já tinha sessão e o `submit` do formulário — e sem trava o
`prepararUpload()` registrava os listeners em dobro.

Para um usuário real o caminho é estreito (com sessão, o formulário de login nem aparece), mas é
duplicação de listener esperando ocasião, e duplicava também todo o carregamento. Guarda de
idempotência no `mostrarPainel()`.

Apareceu ao testar, não ao ler o código — é a terceira fatia seguida em que isso acontece.

## O bloco `@media (prefers-color-scheme: dark)` — removido com prova

Não confiei no raciocínio. Medi nove propriedades **com o navegador no escuro**, antes e depois de
remover:

```
antes : body rgb(236,234,229) · coluna rgb(247,246,243) · bloco rgb(255,255,255)
        input rgb(255,255,255) · salvar rgb(29,78,216) · alerta rgb(253,246,236)
depois: idênticos, nas nove
mediaQueryEscuraViva: []      ← nenhuma regra escura restou na folha
```

E o convite, comparado site contra site com o navegador no escuro: **44 elementos, zero
diferenças**.

Atualizei também os comentários que descreviam o bloco: eles explicavam *por que* o remapeamento
de variáveis existe, e a razão mudou — continuar dizendo "para vencer o `@media`" seria descrever
um arquivo que não existe mais.

## `update` estreito — provado, não afirmado

Plantei valor nos campos da Fatia 15 antes da bateria e salvei cada formulário isolado:

```
plantado:  custo_real_chopp = 1234.56 | pago_por_chopp = 2

depois de salvar SÓ Preços:
  preco_pizza_adulto      21.50    <- mudou
  litros_chopp_por_adulto 2.500    <- outro formulário: intacto
  prazo                   01/10/2026  <- outro formulário: intacto
  custo_real_chopp        1234.56  <- INTACTO
  pago_por_chopp          2        <- INTACTO
  festa                   não tocada

depois de salvar Prazo (uma coluna só) e o Convite:
  prazo                   05/10/2026 23:59:59  <- mudou
  preco_pizza_adulto      21.50    <- intacto
  custo_real_chopp        1234.56  <- INTACTO
  pago_por_chopp          2        <- INTACTO
```

O corte em três formulários é o que torna isso barato: o `patch` é pequeno porque o formulário é
pequeno. O de Prazo tem **uma coluna**.

## Renomear aniversariante — as duas moradas em acordo

Renomeei "JH Boca" → "JH Bocão" pelo bloco do Convite e **não** salvei Aniversariantes:

```
filtros de "Quem vem": Todos · Com crianças · Bruno · Braz · JH Bocão
blocos de Aniversariantes: Bruno (id 1) · Braz (id 2) · JH Bocão (id 3)

festa  : ['Bruno', 'Braz', 'JH Bocão']
pessoas: [[1,'Bruno'], [2,'Braz'], [3,'JH Bocão']]     ← o snapshot acompanhou sozinho
Rosaura: convidado_por [3]                             ← amarrada pelo ID, não pelo nome
```

O `update` da sincronia é estreito como o review pediu: só a coluna `nome`, só
`papel='aniversariante'`, só para quem mudou.

## "não salvo"

```
ao abrir                    []
depois de digitar em Preços ["precos"]
depois de salvar Preços     []
depois de recarregar        []      ← não nasce sujo
```

Liga no `input` do usuário, não no preenchimento programático.

## Prazo: ida e volta

Pela tela: salvei 05/10 → recarreguei → voltou `2026-10-05`.

E a ida e volta das duas funções sob seis fusos:
```
America/Sao_Paulo  2026-10-01 -> 2026-10-01T23:59:59-03:00 -> 2026-10-01  ok
UTC                                                            2026-10-01  ok
Europe/Lisbon                                                  2026-10-01  ok
Asia/Tokyo                                                     2026-10-01  ok
Pacific/Kiritimati                                             2026-10-01  ok
Pacific/Midway                                                 2026-10-01  ok
```

## Fotos

```
confirm: "Apagar a foto 1785982574657_zz-teste-fatia14.png? Ela sai do carrossel do
          convite e isso não tem como desfazer."
toast:   "Apagada: 1785982574658_zz-teste-fatia14.png"
```

As três fotos reais do bucket seguem lá, com os nomes originais. E o banco recusou apagar
`storage.objects` direto (`Direct deletion from storage tables is not allowed`) — a limpeza teve
de passar pela API, o que é o comportamento certo.

## Dado do Bruno, ao fim

```
preços : pizza 20.00 / pizza-criança 20.00 / chopp 10.00 / refri 5.00 / água 3.00
taxas  : chopp 2.500 / refri 0.600 / água 0.500
prazo  : 01/10/2026 23:59:59 (São Paulo)
fatia 15 (custo_real_chopp / pago_por_chopp): None / None — o plantio foi limpo
festa  : 'Festa dos 160 anos' · 'Salão Grande — …' · Bruno · Braz · JH Boca
pessoas: [[1,'Bruno'], [2,'Braz'], [3,'JH Boca']]
Rosaura: 51995509956, convidado_por [3], 'Te amooooo' — intacta
total rsvps: 1 · pessoas órfãs: 0 · admins: 4 · usuário de teste: 0
fotos: as 3 originais
```

## O que fica para a Fatia 15

- **Contas** é a última aba provisória, com as 4 fases.
- **O conserto de verdade do nome**, que o review registrou: parar de guardar o nome na linha de
  aniversariante. A `festa` é a fonte e a coluna pode ficar nula nessas linhas — a constraint
  `principal_tem_nome` só exige nome para `papel='principal'`. Não foi feito agora porque exigiria
  auditar todos os leitores de `pessoas.nome`, e os principais (contas, saldos, transferências)
  **serão reescritos na 15**. Lá sai de graça.
- **A lixeira + `cancelar_rsvp`** seguem como fatia própria, juntas.
- `.btn-lg` foi a última classe de CSS sem consumidor; a folha está limpa.
