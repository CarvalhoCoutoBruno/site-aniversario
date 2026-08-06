# Status — Fatia 13: Admin, abas "Quem vem" e "Compras"

**Fatia fechada.** A tabela de 7 colunas morreu, as duas seções provisórias saíram, e a tabela de
casos do WhatsApp — que o review pediu — achou um bug que a leitura do código não pegou.

| | |
|---|---|
| Branch | `feat/fatia-13-admin-lista-compras` → merge `--ff-only` → apagada |
| Commits | 4, cada um verde no `./verify.sh` |

## O bug que a tabela de casos achou

A regra do WhatsApp decide por **comprimento antes de prefixo**, e o review estava certo sobre o
porquê: `55` é DDI do Brasil **e** DDD de Santa Maria. Isso funcionou de primeira.

O que **não** funcionou, e só apareceu ao escrever os 12 casos:

```
FALHA  "+34611223344"  ->  5534611223344   DDI estrangeiro: não adivinha
```

Um número espanhol tem 11 dígitos depois de tirar o `+`, cai na regra do celular brasileiro e
vira uma conversa com um desconhecido no Brasil. **O `+` é declaração explícita de DDI e tem de
vencer qualquer heurística de comprimento.** Corrigido, e a tabela fechou 12/12:

```
  ok "51995509956"        -> 5551995509956   a Rosaura
  ok "55987654321"        -> 5555987654321   DDD 55 (Santa Maria)
  ok "5187654321"         -> 555187654321    fixo, 10 dígitos
  ok "5551995509956"      -> 5551995509956   já com DDI, 13
  ok "555187654321"       -> 555187654321    já com DDI, 12
  ok "(51) 99550-9956"    -> 5551995509956   com máscara
  ok "+55 51 99550-9956"  -> 5551995509956   + com DDI brasileiro
  ok "+34611223344"       -> 34611223344     + com DDI estrangeiro: respeita
  ok "+123"               -> null            + curto demais
  ok "rosaura@email.com"  -> null            e-mail
  ok "99550"              -> null            curto
  ok ""                   -> null            vazio
```

## Verificação integrada

### O `href` de cada tipo de contato, na tela
```
Rosaura      51995509956             -> https://wa.me/5551995509956    "Chamar no WhatsApp"
e-mail       teste13@exemplo.invalid -> mailto:teste13%40exemplo.invalid  "Enviar e-mail"
inválido     5199<b>0000</b>1111     -> (sem link)  "Contato: 5199<b>0000</b>1111"
```

### XSS — nome, contato e recado com carga
```
{ "alertasDisparados": 0, "imgsInjetadas": 0, "scriptsInjetados": 0 }
nome  no card: "<img src=x onerror=alert(1)>Teste XSS"   (texto literal)
recado no card: "recado com <script>alert('xss')</script> dentro"
```
`window.alert` foi substituído por um contador antes do login; ficou em zero.

### Exclusão e o estado compartilhado — o risco 2

Filtro **Bruno** e busca **"teste"** ativos na hora de excluir:

```
              antes            depois
filtro        Bruno            Bruno       ← sobreviveu
busca         "teste"          "teste"     ← sobreviveu
cards         2                1
Resumo        7 confirmados    6           ← sem recarregar
Resumo        3 grupos         2
Compras base  7 confirmados    6
Compras       Pizza (adulto) 6 → 5 · Água 3,5 L → 3 L
```

Frase do confirm:
```
Apagar a confirmação de Teste Fatia 13 e a 1 pessoa do grupo? Isso não tem como desfazer.
```

Toast depois de apagar:
```
Apagado. O que sumiu:
Teste Fatia 13 · teste13@exemplo.invalid
convidado por: Bruno
- Solo (adulto): Água, Pizza
```

E o cascade, conferido no banco:
```
'Teste Fatia 13' ainda existe? 0
pessoas com nome 'Solo': 0
pessoas órfãs: 0
aniversariantes intactos: ['Bruno', 'Braz', 'JH Boca']
```

### Busca e filtros
```
busca "rosaura"                       -> [Rosaura]
busca "solo" (nome de ACOMPANHANTE)   -> [Teste Fatia 13]     ← o nit do review, entrou
filtro Com crianças                   -> [<img src=x onerror…]
filtro JH Boca                        -> [Rosaura]
filtro Braz (ninguém)                 -> semResultado: true, vazioBanco: false
limpar busca e filtros                -> os 3 de volta
```

Os dois vazios são distintos: `#listaVazia` só aparece com o banco vazio, `#listaSemResultado`
só quando há filtro ativo e nada casa.

### Compras
```
Calculada sobre 6 confirmados, aniversariantes incluídos.
Chopp 5 L · Refrigerante 0 L · Água 3 L · Pizza (adulto) 5 · Pizza (criança) 1
Custo estimado: R$ 179,00
```

Texto do fornecedor (bate com a tela, sem preço, litro sem arredondar para barril):
```
Festa dos 160 anos — 31/10/2026, sábado, 11h
Lista de compra

Chopp: 5 L
Refrigerante: 0 L
Água: 3 L
Pizza (adulto): 5
Pizza (criança): 1

Base: 6 confirmados
```

Clipboard negada (forcei a rejeição):
```
{ "msg": "Não consegui copiar sozinho — o texto está aí embaixo, selecionado.",
  "textareaVisivel": true, "selecionado": true }
```

### Modo escuro — idêntico
```
claro : body rgb(236,234,229) · card rgb(255,255,255) · busca rgb(255,255,255) · filtro rgb(20,17,13)
escuro: body rgb(236,234,229) · card rgb(255,255,255) · busca rgb(255,255,255) · filtro rgb(20,17,13)
diferenças: nenhuma
```

### Convite intacto
```
elementosComparados: 44 · diferenças: NENHUMA
```
Comparação site contra site (`/antes/` × atual), 44 elementos × 14 propriedades. Deixei os dots do
carrossel de fora desta vez: eles alternam sozinhos a cada 5s e foram o único falso positivo da
Fatia 12.

### A Rosaura, ao fim
```
rsvp:   'Rosaura', 51995509956, contato_norm 51995509956, convidado_por [3], 'Te amooooo',
        criado_em 2026-08-06 00:47:54 UTC
pessoa: 'Rosaura', adulto, principal, ordem 0, água + pizza
total rsvps: 1 · pessoas órfãs: 0
config: pizza 20.00 · prazo 01/10/2026 23:59:59 (São Paulo)
admins: 4 (o temporário foi removido)
```

Os RSVPs de teste foram apagados **por nome**, nunca em bloco.

## Decisões que ficam registradas

| O quê | Por quê |
|---|---|
| O `+` vence a heurística de comprimento | é declaração explícita de DDI; sem isso, número estrangeiro vira conversa com desconhecido |
| Comprimento desconhecido não vira link | melhor não ter botão do que ter botão errado |
| Recarrega em vez de remendar array | remendar é onde nasce divergência silenciosa, e aqui apareceria como número errado de pizza |
| Busca e filtro em variáveis, não no HTML | é o que os faz sobreviver à recarga que o excluir dispara |
| Litro não vira barril | quantos barris comprar é decisão do organizador com o fornecedor |
| Filtro é lente, não contabilidade | grupo com dois anfitriões aparece nos dois; nenhum total por aniversariante nesta aba |

## O que fica para as próximas

- **Fatia 14** (Ajustes): os `<details>` de Convite, Preços e Aniversariantes saem; `date` e `url`
  ganham o seletor; e o aviso de que as `<meta>` `og:` do convite não seguem o painel.
- **Fatia 15** (Contas): as 4 fases.
- **Dívida registrada pelo review:** quando o `cancelar_rsvp` (P6 da Fatia 11) virar fatia, **a
  lixeira anda junto** — "convidado cancela" e "admin apagou sem querer" são a mesma família
  (`apagado_em` + RLS), e fazer as duas de uma vez é mais barato que duas mudanças de schema no
  mesmo lugar.
- Quando a Fatia 14 fechar, nenhuma página lerá o `:root` no escuro e o bloco
  `@media (prefers-color-scheme: dark)` pode sair inteiro.
