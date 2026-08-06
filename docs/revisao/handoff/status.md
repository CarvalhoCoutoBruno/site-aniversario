# Status — Fatia 11: redesign do convite ("cartaz de boteco")

**Fatia fechada,** com o recorte que o review pediu: o `localStorage` (commit 6) saiu e nasce
junto com o P6. Depois do fechamento entraram o `UPDATE` do salão e a correção de um bug de
fuso — as duas últimas seções.

| | |
|---|---|
| Branch | `feat/fatia-11-convite-boteco` → merge `--ff-only` → apagada |
| Commits | 9, cada um verde no `./verify.sh` |
| `origin/main` após o push | `9111e6f320c4461c37ede3d0bb51e02020763535` |
| `main == origin/main` | **sim** |

## O que entrou

| Commit | O quê |
|---|---|
| `d6943a6` | fontes (Anton + Space Grotesk + DM Mono), tokens e a coluna de 460px |
| `fc70e33` | hero do cartaz, com a ficha `Dia / Onde` migrando para dentro dele |
| `49c6611` | seção de fotos no bloco escuro, sem setas |
| `56ef835` | RSVP: "Vai querer" numa lista só, sem `<select>`, sem nome duplicado, contador ao vivo |
| `b58deb2` | `carregando`, `erro`, tela de sucesso, `.ics`, e `passou` fechando o formulário |
| `a74fad9` | `og:image` + meta tags |
| `2ad5209` | limpeza do CSS órfão + BRIEFING atualizado |
| `563ad65` | **o achado da verificação integrada** (abaixo) |
| `9111e6f` | botão Confirmar a 24px, por causa do contraste medido |

## O achado que só a tela pegou

O `verify.sh` ficou verde o tempo todo e a página estava errada: título com gradiente roxo,
cantos arredondados no countdown e no carrossel, rótulo "VOCÊ" azul e **200px de vazio** dentro
do card de pessoa.

Uma causa só: **a pele PRÉ-Fatia 9 do convite morava fora de `.pagina-convite`**. Quando a Fatia
9 escopou a pele nova, ninguém removeu a velha — e ela ficou dormente porque as duas usavam as
mesmas classes e a nova vinha depois. Trocar a pele reacordou a antiga, e em alguns casos ela
ganhava por especificidade:

```
.pessoa-card.responsavel .pessoa-rotulo   (0,3,0)  ← a velha, vencia
.pagina-convite .pessoa-rotulo            (0,2,0)  ← a nova
```

Os 200px de vazio eram o `.pref-grupo { flex: 1 1 200px }`: no admin ele é coluna de 200px num
flex horizontal; no card novo o contêiner é vertical, e `flex-basis` virou **altura**. Essa
regra o admin usa, então ela ficou — o convite só sobrescreve com `flex: none`.

**Nota de processo:** a primeira tentativa de limpeza foi por regex e comeu os blocos `@media` e
`@keyframes`, o que teria içado o `:root` do modo escuro para o topo e quebrado o admin. Revertido
e refeito à mão. Regex não entende chave aninhada.

## Verificação integrada

Cópia servida do scratchpad, a 390px, dirigida de verdade.

### Fail-loud — um estado só
```json
{ "falhaDeCarga": { "erro": true, "hero": false, "secaoOnde": false, "secaoFotos": false,
                    "secaoRsvp": false, "sucesso": false, "rodape": true, "chips": 0 } }
```
A asserção que já quebrou três vezes segue verde, agora com `#rsvpSucesso` na conta.

### Modo escuro — idêntico
```
claro : folha rgb(244,239,226) · input rgb(255,255,255) · texto rgb(20,17,13) · card rgb(255,255,255)
escuro: folha rgb(244,239,226) · input rgb(255,255,255) · texto rgb(20,17,13) · card rgb(255,255,255)
```

### Os 7 estados
```
carregando       "160" pulsando, tela cheia
contagem         countdown 86/13/45/30, CTA e formulário abertos
e-hoje           {"tipo":"hoje","texto":"É hoje!11h, Salão 3. Corre.","countdown":false,"form":true}
passou           {"tipo":"passou","cta":false,"form":false,"encerrado":true,"prazoAberto":false}
rsvp-encerrado   {"form":false,"encerrado":true,"countdown":true,"cta":true,
                  "texto":"As confirmações fecharam em 02/10/2026 — a pizza já foi encomendada."}
enviado          {"sucessoVisivel":true,"heroEscondido":true,"formNoDom":true}
erro             "POXA" + rodapé, e mais nada
```

O `prazoAberto: false` no `passou` é a guarda de corrida funcionando: o `status_rsvp` respondeu
"aberto" **depois** de o `tick()` já ter fechado o formulário, e o aviso não apareceu por cima.

### RSVP ponta a ponta
```
rsvps:   [UUID('e747aee7-…'), 'Teste Fatia 11', '51940404011', '51940404011', [2], 'sem cebola']
pessoas: ['Teste Fatia 11', 'adulto', 'principal', 0, True,  False, False, True,  None]
         ['Léo Teste',      'crianca','acompanhante',1, False, True,  False, False, None]
```
O payload não mudou de forma. `bebe_chopp` False na criança (a regra ficou, divergindo do
mockup de propósito), `aniversariante_id` NULL nos dois. Apagado depois:
```
rsvps: 0 | pessoas órfãs: 0 | config: prazo 2026-10-02, pizza 20.00
aniversariantes: ['Bruno', 'Braz', 'Bocão']
```

### "Mudar minha confirmação"
```json
{ "sucessoEscondido": true, "heroDeVolta": true, "formDeVolta": true,
  "nomePreservado": "Teste Fatia 11", "acompanhantePreservado": ["Léo Teste"],
  "botao": "Confirmar", "botaoHabilitado": true }
```

### O `.ics`
```
DTSTART:20261031T140000Z
LOCATION:Salão 3 — Av. Cel. Marcos\, 627\, Pedra Redonda\, Porto Alegre/RS
```
14:00 UTC = **11h em São Paulo**. Vírgulas escapadas. Servido por Blob URL, como o review pediu.

### Admin intacto
```
fonteCorpo: Inter · fonteTitulo: Fraunces · temAnton: false · bodyClasse: (nenhuma)
input[type=text]: bg rgb(30,24,48) / texto rgb(243,236,255)   (modo escuro preservado)
```

### Contraste — medido no CSS final, não no mockup
24 pares lidos do DOM renderizado. **Todos passam.** Os apertados:

| Par | Ratio | Mínimo | |
|---|---|---|---|
| título vermelho 66px | 4,10:1 | 3 | ✔ |
| botão Confirmar (creme sobre vermelho) | 4,10:1 | 3 | ✔ **depois do ajuste** |
| dica mono 11px | 4,97:1 | 4,5 | ✔ |
| rótulo Dia/Onde 11px | 5,15:1 | 4,5 | ✔ |
| selo e kicker vermelhos 11px | 5,51:1 | 4,5 | ✔ |

**O botão reprovava.** O mockup pedia 23px, e o corte de "texto grande" no WCAG é 24px para peso
400 — então 4,10:1 era medido contra 4,5, não contra 3. Subi para 24px. Não é improviso: o
próprio `prompt-design.md` manda não usar `#d8352a` abaixo de 24px, então os 23px eram uma
contradição interna da especificação, e o ajuste vai na direção que ela mesma escreve.

## Divergências conscientes do mockup

| O quê | Por quê |
|---|---|
| **Chopp bloqueado para criança** | a constraint do banco é a fonte da verdade; o design não manda em regra de negócio (P4, aprovado) |
| **Carrossel com dots, sem setas** | o mockup tem 3 slides fixos; a vida real tem N do Storage (P1, aprovado). Dots com alvo de 30px e arrasto com limiar de 40px |
| **Sem botão "Falar com o Bruno"** | não existe telefone em `festa` nem em `config`. A coluna vem na fatia do admin (P2, decisão do Bruno) |
| **Botão Confirmar a 24px** | contraste medido (acima) |
| **"É hoje!" só com o nome do salão** | `local` guarda o endereço inteiro e ele não cabe na frase |
| **Rodapé visível no erro** | o mockup mostra o erro sozinho; o rodapé é a única pista de que a página é a certa |

## Contrato de ids — mudou

Saem `#carPrev` e `#carNext` (as setas). Entram `#ctaTopo`, `#totalPessoas`, `#rsvpSucesso`,
`#sucessoResumo`, `#sucessoLista`, `#btnAgenda`, `#btnMudar`. `#secaoOnde` continua existindo,
agora **dentro** do hero. O `BRIEFING.md` já está atualizado.

## O que sobrou

**Nada pendente do lado do Bruno.**

**Para saber, não para fazer:**

- **O WhatsApp cacheia preview de link com força.** Depois do push, o preview antigo pode
  persistir por um tempo — não é bug, é cache. E as quatro `<meta>` de `og:` são o **único**
  conteúdo escrito à mão do convite: o WhatsApp não executa JavaScript, então mudar data ou local
  no painel exige mexer nelas junto. Está registrado no próprio `index.html`.
- **Pendências antigas seguem:** rotacionar a senha do Postgres, e conferir preços antes de
  divulgar o link. O prazo é **01/10/2026, 23:59:59 em São Paulo** — a saída bruta do bloco de
  verificação diz `2026-10-02` porque `::date` casta o timestamp em UTC; o valor certo é o de
  cima (ver *Depois do fechamento*).

**Para a fatia do admin (Cowork):**

- Os inputs de `email`, `password`, `date` e `url` do painel não são cobertos pelo seletor
  `input[type=text], input[type=tel], textarea, select` e ficam com o visual padrão do navegador.
  É anterior a esta fatia e o redesign do admin resolve de uma vez.
- Se `whatsapp_contato` entrar na `festa` (P2), lembrar que essa tabela é **lida por qualquer
  visitante** — o telefone ali é publicamente legível.

## Depois do fechamento

### O `UPDATE` do salão — feito

Confirmado pelo Bruno. Backup da linha inteira impresso antes, conferência depois:

```
antes:  local = 'Salão 3 — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS'
depois: local = 'Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS'
        local_mapa, titulo, data_texto, data: inalterados · rsvps: 0 · festa: 1 linha
```

`replace()` no campo, não reescrita: endereço, bairro e cidade continuam byte a byte. O
`local_mapa` não menciona o salão, então não precisou mudar. No ar:
`ONDE  Salão Grande — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS`.

### Um bug achado ao conferir o site publicado (`49e9f76`)

O rodapé do formulário dizia "confirme até 01/10/2026" e eu tinha escrito neste arquivo que o
prazo era 02/10. **A tela estava certa e eu estava errado**: li `prazo_confirmacao::date`, que
casta o timestamp em UTC. O prazo é `2026-10-01 23:59:59` em São Paulo.

Mas a conferência destapou um defeito real: o `main.js` formatava o prazo com
`toLocaleDateString("pt-BR")` **sem fixar o fuso**, então usava o do navegador. Como o instante
gravado é 23:59:59-03:00, qualquer fuso a leste de São Paulo já está no dia seguinte:

```
America/Sao_Paulo   01/10/2026   certo — por coincidência
UTC                 02/10/2026   errado
Europe/Lisbon       02/10/2026   errado
Asia/Tokyo          02/10/2026   errado
Pacific/Kiritimati  02/10/2026   errado
```

É a mesma armadilha da Fatia 7, que foi corrigida no `admin.js` e **nunca** no `main.js` — lá o
problema estava no cálculo da data, aqui na formatação dela. Corrigido com
`Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })` nos dois pontos (o aviso de
prazo aberto e o texto de prazo encerrado). Verificado nos cinco fusos acima.

**Lição para o `verify.sh`:** ele não tem asserção de fuso. Os dois bugs desta família foram
achados por inspeção, não por teste. Vale uma asserção que rode o formatador sob `TZ` diferente
— fica anotado para quem pegar a próxima fatia.

### Renomear aniversariante — feito à mão, e o que isso revelou

Um aniversariante pediu para trocar o nome; o Bruno não achou onde fazer isso no painel. Rodei:

```
antes:  festa   = ['Bruno', 'Braz', 'Bocão']      pessoas(id=3).nome = 'Bocão'
depois: festa   = ['Bruno', 'Braz', 'JH Boca']    pessoas(id=3).nome = 'JH Boca'
        rsvps: 0 · pessoas: 3 · titulo e local inalterados
```

**Dois achados para a fatia do admin, e nenhum deles é "falta a funcionalidade":**

1. **O campo existe** — `nome_aniv_1/2/3` estão no formulário **Convite** (`admin.js:112-136`),
   não na seção **Aniversariantes**, que só edita consumo. Quem procura "onde renomeio o
   aniversariante" procura no lugar com o nome dele. É problema de lugar, não de recurso, e o
   mockup do admin já resolve ao juntar tudo em **Ajustes**.

2. **O nome mora em dois lugares e o painel só grava um.** `festa.nome_aniv_N` é a fonte única;
   `pessoas.nome` é o snapshot de quando o aniversariante foi cadastrado. Salvar pelo Convite
   atualiza a `festa` e **deixa o snapshot velho** — o próprio código reconhece isso
   (`admin.js:165-171`) e mitiga fazendo `nomeDoAniversariante()` preferir a `festa`, então nada
   quebra na tela. Mas a divergência fica no banco. Eu gravei os dois à mão; a fatia do admin
   decide se o Convite passa a gravar os dois, ou se o snapshot morre.

## Próxima

O P6 (desconfirmar + `localStorage`) e a superfície do **admin**, que é sua. O pacote de design
do admin já está commitado em `docs/revisao/design/admin/`.
