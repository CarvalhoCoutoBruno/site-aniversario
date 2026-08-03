# Status — Fatia 9: redesign do convite

**Fatia fechada.** As três decisões do review aplicadas: título como H1 visível, idades como
constante com o 160 sendo a soma, e paleta **preto + azul + vermelho** — não a do mockup.

| | |
|---|---|
| Branch | `feat/fatia-9-redesign` → merge `--ff-only` → apagada |
| Commit da fatia | `d658a974ecfc07488ba44b8a7010db78a584c81d` |
| `./verify.sh` | **VERDE** — 63 asserções, sem alteração (nada de lógica mudou) |

## Contraste WCAG — medido, não olhado

Primeira rodada, com o azul do mockup (`#3b82f6`) no texto sobre fundo claro:

```
par                                       razao   AA(4.5)  AA-grande(3.0)
texto do hero (branco / preto)            19.55   PASSA    PASSA
eyebrow azul-claro / preto                8.93    PASSA    PASSA
rotulo do countdown / preto               8.44    PASSA    PASSA
numero da equacao azul / card escuro      8.27    PASSA    PASSA
numero total vermelho / card              7.17    PASSA    PASSA
subtitulo do hero / preto                14.12   PASSA    PASSA
tinta / fundo claro                       17.04   PASSA    PASSA
tinta suave / fundo claro                 7.46    PASSA    PASSA
kicker azul / fundo claro                 3.46    falha    PASSA
link do mapa azul / branco                3.68    falha    PASSA
rodape texto / preto                      11.79   PASSA    PASSA
```

Dois pares **reprovaram** para texto normal. Testei candidatos e troquei por `#2563eb` só onde o
azul aparece sobre claro (`--cv-azul-texto`); o `#3b82f6` segue como acento sobre o hero escuro:

```
kicker azul-texto / fundo claro : 4.87  AA PASSA
link mapa azul-texto / branco   : 5.17  AA PASSA
```

Olhando, os dois pareciam perfeitamente legíveis. Só a medição pegou.

## Quatro problemas que só apareceram na tela

### 1. Os campos do formulário ficaram pretos

O primeiro render mostrou inputs, chips e cards escuros dentro de uma seção clara. Causa: o
`:root` tem um bloco `@media (prefers-color-scheme: dark)`, o navegador está em modo escuro, e os
componentes **compartilhados** (`input`, `.chip`, `.pessoa-card`, `.carrossel`) leem as variáveis
globais — que eu não havia remapeado.

Corrigido declarando `--bg`, `--bg-soft`, `--ink`, `--ink-soft`, `--line`, `--brand` dentro de
`.pagina-convite`: a declaração no `<body>` vence o herdado do `:root` para toda a subárvore,
inclusive no modo escuro.

### 2. O countdown aparecia zerado ao lado do "É hoje!"

O atributo `hidden` é `display: none` na folha do **navegador**, e qualquer `display` de autor o
vence. Como dei `display: flex` ao `.countdown`, ele continuava visível mostrando `0 0 0 0` ao
lado da mensagem "É hoje! 🎉".

Corrigido com `.pagina-convite [hidden] { display: none !important; }`.

### 3. O fail-loud da Fatia 8 quebrou com a estrutura nova

Na falha de carga, os títulos **"Memórias / Momentos"** e **"Bora? / Confirmar presença"**
apareciam sobre o vazio — porque as seções novas têm cabeçalho próprio, e a Fatia 8 escondia só o
conteúdo interno.

Foi exatamente a incoerência que aquela fatia custou três bugs para eliminar, reintroduzida pelo
layout. Corrigido escondendo as **seções inteiras**.

### 4. Um erro meu de sincronização

Estava usando `cp -R js $S/site/` para atualizar a cópia servida. Com o destino já existente, o
`cp -R` aninha a pasta em vez de sobrescrever o conteúdo — e eu testei um arquivo velho, medindo
`secaoRsvp: true` quando o código já estava certo. Passei a copiar por conteúdo
(`cp js/*.js $S/site/js/`).

Vale registrar porque quase virou um "bug" investigado no lugar errado.

## Verificação integrada — saída crua

### Não-regressão: RSVP ponta a ponta pelo layout novo
```json
{ "regraChoppCrianca": { "desabilitado": true },
  "sucesso": true, "titulo": "Presença confirmada!", "erro": null }
```
```
GRUPO gravado pelo layout novo:
   ['Teste Redesign', '51931312020', [1, 3]]
PESSOAS:
   [0, 'Teste Redesign', 'adulto', 'principal', False, True, True]
   [1, '(sem nome)', 'crianca', 'acompanhante', True, False, False]
```
Grupo com `convidado_por [1,3]`, acompanhante sem nome preservado, chopp barrado para criança.

### Countdown nos três estados
```json
{ "eHoje": { "estado": "e-hoje", "countdownOculto": true,
             "aviso": "É hoje! 🎉", "heroVisivel": true, "formVisivel": true } }
```
```json
{ "passou": { "estado": "passou", "countdownVisivel": false,
              "aviso": "A festa já aconteceu. 💜",
              "dataGerada": "Domingo, 2 de agosto de 2026, às 20h",
              "heroVisivel": true, "formVisivel": true } }
```
No "é hoje" o `data_texto` do banco continuou mandando (override manual), e no "passou" — com o
campo limpo — a data saiu **gerada** da ISO. Os dois caminhos exercitados.

### Falha de carga: um estado só
```json
{ "falhaDeCarga": { "erro": true, "hero": false, "secaoOnde": false,
                    "secaoFotos": false, "secaoRsvp": false, "rodape": true, "chips": 0 } }
```

### O admin não herdou nada
```
admin.html sem a classe pagina-convite ✅
admin.html sem Fredoka ✅
```
A trava que o review pediu: paleta e fontes escopadas em `.pagina-convite`, e o `admin.html` não
tem a classe nem carrega as fontes novas.

### Base restaurada
```
festa: 'Festa dos 160 anos', 2026-10-31 14:00 UTC, 'Sábado, 31 de outubro de 2026, às 11h', atualizado_em NULL
config (dados do Bruno): prazo 2026-10-02, preço 10.00, taxa 2.500
pessoas: Bruno(1), Braz(2), Bocão(3)
rsvps: 0
policies festa: admin edita festa · festa leitura publica
```
Seus dados intactos; o `atualizado_em` da festa segue `NULL`, então a trava do reset continua
liberando.

## Decisões aplicadas

- **Título como H1**, em gradiente branco→azul→vermelho, com a equação logo abaixo como apoio
  gráfico. O `<title>` da aba passou a usar o título da festa — melhora o preview no WhatsApp.
- **Idades constantes** (`IDADES = [40, 50, 70]`) e o **160 como soma**. Dois literais podem
  discordar; uma soma não.
- **Confete no hero em CSS puro**, sem markup e sem JS, para o astral sobreviver à paleta
  fechada — como o review pediu. Não compete com o `#confetti`, que é a animação de sucesso.
- **Equação no mobile:** os três em cima, o total embaixo, e o `=` escondido em vez de espremido
  na borda — o defeito que apontei no mockup.

## Notas para a próxima fatia

- **`IDADES` é a única coisa do convite que ainda vive no código.** Se um dia virar produto,
  é o próximo candidato a ir para a `festa` — schema aditivo.
- A `.pagina-convite` remapeia as variáveis globais. Se o admin ganhar um restyle, o caminho já
  está aberto: mesma técnica, classe própria.
- Ainda pendente: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `d658a974ecfc07488ba44b8a7010db78a584c81d` |
| Commit deste `status.md` | logo em seguida, na `main` |
