# Plano — Fatia 1

> ⚠️ **A Fatia 1 já está entregue, mergeada e no ar.** O `prompt.md` foi escrito a partir de um
> `CONTINUIDADE.md` desatualizado (que diz "Próxima: Fatia 1" e branch por mergear).
>
> Este plano, então, não é "como fazer" — é a **conferência item a item** do que está no ar
> contra o que o prompt pediu, mais o **delta real** que sobrou. São 3 itens, dois deles
> legítimos.

## Situação

| | |
|---|---|
| Commit da Fatia 1 | `13c75c6` |
| `main` == `origin/main` | `801532c` ✅ |
| No ar | https://carvalhocoutobruno.github.io/site-aniversario/ |
| `./verify.sh` | VERDE (41/41 asserções) |

A Fatia 1 foi verificada ponta a ponta contra o Supabase real antes do push: envio com
acompanhante sem nome, prazo vencido fechando a tela, RPC recusando com mensagem legível,
e dedupe substituindo o grupo. O painel foi adaptado junto porque `admin.js` lia
`C.bebidas`/`C.comidas` (removidos) e o rodapé do convite linka `admin.html` publicamente —
publicar quebraria a página.

## Conferência do escopo

| # | Item do prompt | Estado | Onde |
|---|---|---|---|
| 1 | Cards de pessoa, tipo + 4 checkboxes | ✅ | `index.html` template, `main.js:novoCard` |
| 2 | Chopp × criança desmarca/desabilita/reabilita | ✅ | `main.js:ligarRegraChopp` |
| 3 | `convidado_por` envia ids 1/2/3 | ✅ | `main.js` — `value="${i + 1}"` |
| 4 | Teto 5; nome opcional entra no payload | ⚠️ parcial | payload ✅; rótulo — ver A3 |
| 5 | Contato e nome obrigatórios; **`observacoes` ≤ 500 no cliente** | ❌ | ver **A1** |
| 6 | Botão desabilita, não reabilita no sucesso | ✅ | `main.js` submit |
| 7 | Envio só por `sb.rpc('criar_rsvp')` | ✅ | invariante travado no `verify.sh` |
| 8 | Erro real, sem fingir sucesso | ✅ | `main.js:mensagemDeErro` |
| 9 | Prazo: fecha se `aberto=false`; **"confirme até DD/MM" se aberto** | ❌ metade | ver **A2** |
| 10 | Aviso de que reenvio substitui | ✅ | `index.html` campo-dica |
| 11 | Limpeza de bebidas/comidas por config e do "modo teste" | ✅ | `config.js`, `main.js` |

Também saíram nesta fatia dois bugs que o prompt pedia (o `.filter(p => p.nome)`) ou não
previa: `uid()` era chamado antes do `let _n = 0` no fim do arquivo — zona morta temporal
que **derrubava o script inteiro**, de modo que nenhum card de pessoa era criado e o submit
nunca era registrado. Pré-existente; o formulário no ar nunca funcionou de verdade.

## Delta a executar

### A1 — limitar `observacoes` a 500 caracteres no cliente *(real)*
`index.html:107` — o `<textarea>` não tem `maxlength`, e o submit não valida. Passar de 500
bate no `CHECK` da tabela e devolve erro cru de constraint, que o `mensagemDeErro` traduz
para o genérico "Alguma informação ficou inválida" — mensagem ruim para um caso previsível.

- `maxlength="500"` no textarea (corta na digitação);
- contador discreto "N/500" a partir de ~450, para não ser corte silencioso;
- guarda no submit com mensagem própria, já que `maxlength` não impede colar via script.

### A2 — avisar o prazo quando o formulário está **aberto** *(real)*
`main.js:checarPrazo` só trata `aberto === false`. Com prazo definido e ainda aberto, o
convidado não vê data nenhuma — perde a urgência, que é justamente o ponto de ter prazo.

- quando `aberto === true` **e** `prazo != null`, exibir "Confirme até DD/MM" perto do botão;
- reaproveitar o `.campo-dica`; sem prazo, nada muda.

### A3 — rótulo "Acompanhante N" no próprio formulário *(discutível)*
Hoje o fallback existe no painel (`admin.js:107,112`), não no convite: o card sem nome fica
com o placeholder "Nome (opcional)". Dá para ler o prompt das duas formas — "exibir" pode
ser no admin, que é onde o organizador lê.

Proponho **numerar o card no formulário** ("Acompanhante 2" no topo), que ajuda quem
adiciona 4 ou 5 pessoas a se localizar. Baixo risco. **Se o Cowork achar fora de escopo,
deixo de fora** — não muda payload nem cálculo.

### A4 — higiene
- apagar a branch `fatia-0-rateio-por-aniversariante`, já mergeada (o protocolo pede).

## Estado real (o `CONTINUIDADE.md` foi removido)

O `CONTINUIDADE.md` não estava na tabela de arquivos do handoff, então não tinha dono: foi
sobrescrito pelas duas pontas e perdeu conteúdo. **Decisão do Bruno: cai fora.** O estado da
fatia passa a vir pelo `status.md`; o que é durável (gotchas, receita de verificação,
convenções) ficou no [FLUXO.md](FLUXO.md), que não roda a cada fatia.

Para o Cowork se situar, o que o arquivo dizia e o que de fato vale:

| Dizia | Realidade |
|---|---|
| "Próxima: Fatia 1" | Fatia 1 fechada e no ar (`13c75c6`) |
| Branch `fatia-0-...` "mergear na main + push" | já mergeada; `main == origin/main == 801532c` |
| "`admins` só tem o Bruno" | os 4 já inseridos (Bruno, Braz, Bocão, Rosaura), `is_admin()` conferido para cada |
| "`js/main.js` ainda manda o payload antigo → não publicar" | resolvido na Fatia 1 |
| "Sign-up público: desligado" | **correto** — refiz o teste, voltou `signup_disabled` |

Nesse último ponto o arquivo estava certo e eu desatualizado: eu havia medido o sign-up
ligado duas vezes, e ele foi fechado no intervalo.

Backlog vigente (fatias 2 a 6) segue com o Cowork, materializado a cada `prompt.md`.

## Verify desta rodada

1. `./verify.sh` verde (nenhuma das mudanças toca em cálculo — espera-se 41/41 sem alteração).
2. Integrada, com saída crua no `status.md`:
   - observação com 600 caracteres → **barrada no cliente**, sem erro cru de constraint;
   - `prazo_confirmacao` no futuro → "Confirme até DD/MM" visível com o formulário aberto;
   - `prazo_confirmacao` no passado → formulário escondido (não regrediu);
   - um envio completo gravando no banco, conferido por SELECT e **apagado** depois.
3. Base restaurada: `rsvps = 0`, `pessoas = 0`, `prazo_confirmacao = NULL`.

Branch: `fix/fatia-1-ajustes-prazo-e-limite`.

## Aguardando

Parado, sem implementar. Preciso do `review.md` para saber:

1. se A1 e A2 entram (minha recomendação: **sim**, os dois são falhas reais de UX previsível);
2. se A3 entra ou fica fora de escopo.
