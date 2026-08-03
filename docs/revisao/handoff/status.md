# Status — Fatia 10: polimento visual do convite

**Fatia fechada.** Os quatro itens resolvidos, mais a higiene. O terceiro caminho do item 1 —
aprovado no review — resolveu o item 3 junto, pela causa.

| | |
|---|---|
| Branch | `chore/fatia-10-polimento-visual` → merge `--ff-only` → apagada |
| Commit da fatia | `PREENCHER` |
| `./verify.sh` | **VERDE** — 63 asserções, sem alteração |

## Item 1 — data duplicada

**Antes:** a mesma string em dois lugares (`main.js:74` e `:76`), separados por ~400px de rolagem.

**Depois:** a data vive só no pill do hero. A seção deixou de ter card de data e passou a
responder uma pergunta só — *onde* —, com o endereço em destaque e o botão do mapa.

Copy no tom do resto da página, como o review sugeriu: **"É aqui 📍 / Anota o endereço"**, em vez
do "Onde vai ser" mais seco que eu tinha proposto.

## Item 2 — carrossel

O review avisou que o teto de 420px com `aspect-ratio: 16/10` estreitaria a largura para ~672px e
o carrossel poderia parecer perdido. Segui a alternativa sugerida: **alargar a proporção no
desktop** (`aspect-ratio: 2/1` acima de 800px), mantendo os 900px de largura.

Resultado: de **562px para ~450px** de altura, mais baixo **sem** ficar menor. O mobile segue no
16/10, que estava bom.

## Item 3 — ritmo vertical

Resolvido pela causa, não por padding: o vazio vinha de **dois cards baixos** num grid de duas
colunas. Com um bloco só, centrado e com conteúdo de verdade, a seção preencheu sem apertar nada.

## Item 4 — confete sobre o texto

**Antes (mobile 390px):** partículas sobre o conteúdo — uma bolinha vermelha encostando em
"anos" no título, outra **dentro do card do Bruno**, um triângulo sobre o countdown.

Causa: as posições são **percentuais**, e num viewport estreito o "meio" é exatamente onde o
texto está.

**Depois:** abaixo de 560px, densidade reduzida (de 8 para 5 partículas no `::before`, de 4 para
2 no `::after`) e todas empurradas para as bordas (`4%`, `96%`, `3%`, `97%`, `2%`, `98%`). No
desktop nada muda.

## Item 5 — higiene

`docs/revisao/design/_to_delete/` removida (4 arquivos, **não rastreados** pelo git — bastou
`rm -rf`, sem `git rm`). Sobrou só o `mockup-convite.html`.

## Um ajuste fora da lista

O botão "Abrir no mapa" herdou o `border: 1.5px dashed` do `.btn-ghost` — que é a afordância de
"adicionar" do "+ Adicionar acompanhante", mas num link de mapa lê como inacabado. Borda sólida
só ali.

## Verificação

### Modo escuro — não regrediu
```
claro : corpo rgb(247,248,251) · input rgb(255,255,255) · texto rgb(18,22,31) · card rgb(255,255,255)
escuro: corpo rgb(247,248,251) · input rgb(255,255,255) · texto rgb(18,22,31) · card rgb(255,255,255)
```
Idêntico. O remapeamento de variáveis da Fatia 9 continua valendo.

### Fail-loud — um estado só
```json
{ "falhaDeCarga": { "erro": true, "hero": false, "secaoOnde": false,
                    "secaoFotos": false, "secaoRsvp": false, "rodape": true, "chips": 0 } }
```
A asserção que já quebrou duas vezes segue verde.

### RSVP ponta a ponta
```
RSVP gravado: (['Teste Fatia 10', '51940405050', [2]],)
pessoas: (['Teste Fatia 10', 'adulto', True, True],)
```
Apagado depois.

### Admin intacto
```
admin.html com "pagina-convite": 0
admin.html com "Fredoka": 0
```

### Base restaurada
```
rsvps: 0
festa: 'Festa dos 160 anos', atualizado_em NULL
config do Bruno: prazo 2026-10-02, preço 10.00
aniversariantes: Bruno(1), Braz(2), Bocão(3)
```

## Estado

O convite está pronto para o go-live. Falta, do seu lado:

- **rotacionar a senha do Postgres** (circulou na conversa; nada no site depende dela);
- conferir se os preços e o prazo estão como você quer antes de divulgar o link.

> Lembrete: com a `config` preenchida, a trava do `supabase-setup.sql` bloqueia recriar o schema
> — e a partir da Fatia 8 mudança de schema é aditiva, não recriação.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `PREENCHER` |
| Commit deste `status.md` | logo em seguida, na `main` |
