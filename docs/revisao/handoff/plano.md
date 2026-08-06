# Plano — Fatia 14: Admin, aba "Ajustes"

Branch: `feat/fatia-14-admin-ajustes`

Entradas: `prompt.md` (Cowork) + `docs/revisao/design/admin/prompt-design.md` §2/§3/§4 e o mockup.

---

## Os quatro riscos

### 1. `update` estreito — e a boa notícia é que o mockup ajuda

Esta é a aba que mais escreve, e o mockup **quebra o `configForm` de hoje em três acordeões com
um Salvar cada** (Preços de referência · Consumo por pessoa · Prazo). Isso não é só layout: cada
`update` passa a carregar naturalmente só as colunas do seu bloco, em vez de um objeto com
preços + taxas + prazo juntos.

Os arrays já existem separados no código (`CAMPOS_PRECO`, `CAMPOS_TAXA`), então o corte cai
exatamente onde a estrutura já estava. Ver **P1** — mudar o número de "Salvar" é comportamento,
não layout, e por isso pergunto.

O que vale em qualquer cenário: **nenhum formulário monta objeto por varredura**. Cada `patch`
lista as colunas dele, escritas à mão. `custo_real_*` e `pago_por_*` não aparecem em `patch`
nenhum desta fatia, e isso vira asserção por `SELECT` depois de cada salvamento.

### 2. Renomear aniversariante e as duas moradas

O nome vive em `festa.nome_aniv_*` (fonte da verdade) e em `pessoas.nome` (snapshot de quando o
aniversariante foi cadastrado). O `nomeDoAniversariante()` já lê da `festa`, então a UI inteira
segue o nome novo **sem** re-salvar Aniversariantes — foi o que eu confirmei à mão quando o
"Bocão" virou "JH Boca".

Nesta fatia isso vira **teste**, não confiança: renomear pelo Convite e provar que Resumo, cards
de "Quem vem", filtros e o bloco de Aniversariantes mostram o nome novo, e que a Rosaura continua
com `convidado_por [3]` — o id não se mexe.

⚠️ O snapshot continua podendo divergir. **Proponho fechar isso aqui**, já que estou no
formulário que renomeia: ao salvar o Convite, atualizar também `pessoas.nome` das linhas
`papel='aniversariante'` cujo nome mudou. É a mesma coisa que fiz à mão, agora automática. Não
muda schema e não mexe em `convidado_por`.

### 3. Prazo e fuso

Já foi corrigido duas vezes nesta base. O invariante do `verify.sh` cobre a formatação; a **ida e
volta** é teste de tela: salvar 01/10 → recarregar → continuar 01/10, sob pelo menos dois fusos de
navegador. `dataDoPrazo`/`prazoDaData` não mudam — só mudam de lugar.

### 4. Fotos

Upload e exclusão mexem no Storage, não no Postgres, e também não têm desfazer. A confirmação
nomeia o arquivo e diz onde ele aparece: *"Apagar a foto IMG_1234.jpg? Ela sai do carrossel do
convite e isso não tem como desfazer."*

Diferente do RSVP, aqui **não dá para mostrar o conteúdo apagado em texto** — é uma imagem. Então
o toast diz o nome do arquivo, que é o que permite reenviar o original se a pessoa ainda o tiver.

### 5. O bloco `@media (prefers-color-scheme: dark)` — pode sair, e já podia

Fui verificar em vez de supor. Existem 14 seletores globais que leem `var(--*)` (`body`, `a`,
`.btn-primary`, `.chip`, `input`…), mas **os dois `<body>` já carregam classe de escopo**:

```
index.html:29  <body class="pagina-convite">
admin.html:16  <body class="pagina-admin">
```

Uma variável declarada em `.pagina-*` vence a de `:root` para toda a subárvore, inclusive no modo
escuro. Ou seja, o bloco **já está morto desde a Fatia 12** — a aba Contas ser provisória não muda
nada, porque ela também mora dentro de `.pagina-admin`. As medições das Fatias 12 e 13 (claro e
escuro idênticos nas duas páginas) são a prova empírica disso.

**Removo nesta fatia**, com uma medição antes e depois para não confiar só no raciocínio.

---

## Como a aba fica

Seis blocos, na ordem do mockup — cinco acordeões e as fotos sempre abertas:

| Bloco | Descrição | Escreve em |
|---|---|---|
| **O convite** | título, subtítulo, data e hora, local, mapa, os 3 nomes | `festa` |
| **Preços de referência** | os 5 preços | `config` |
| **Consumo por pessoa** | as 3 taxas de litros | `config` |
| **Prazo** | quando o formulário fecha | `config` |
| **Aniversariantes** | o que cada um consome | `pessoas` |
| **Fotos do convite** | enviar, listar, excluir | Storage |

O acordeão nasce fechado, como no mockup. Não guardo qual estava aberto: diferente da aba, isso
não é lugar onde se volta — e um `#ajustes` que reabre um acordeão específico seria estado demais
para o ganho.

**O aviso das `<meta>` `og:`** entra **dentro do acordeão "O convite"**, colado nos campos de
data e local — que são exatamente os que ficam mentindo no preview. Não em rodapé: quem edita a
data tem que ler ali.

---

## Commits

1. `feat`: a casca da aba — os seis blocos, acordeão, e os formulários existentes remontados
2. `feat`: os `Salvar` por bloco, com `patch` explícito por formulário
3. `feat`: sincronizar `pessoas.nome` ao renomear pelo Convite + o aviso das `<meta>` `og:`
4. `feat`: fotos no visual novo, com confirmação nomeada
5. `chore`: remoção do `@media prefers-color-scheme` do `:root`, das seções provisórias e do CSS órfão

---

## Verificação

`./verify.sh` verde em cada commit, com o invariante de fuso. Depois:

1. **`update` estreito, formulário por formulário**, por `SELECT`: salvar Convite não toca
   `config`; salvar Preços não toca taxas, prazo, `custo_real_*`, `pago_por_*` nem `festa`; e
   assim por diante. Vou **plantar valor** em `custo_real_chopp` e `pago_por_chopp` antes da
   bateria e provar que sobrevivem a todos os salvamentos — depois limpo.
2. **Ida e volta do prazo**: salvar 01/10 → recarregar → 01/10, em dois fusos de navegador.
3. **Renomear aniversariante**: nome novo em Resumo, cards, filtros e no bloco de Aniversariantes;
   `convidado_por` da Rosaura segue `[3]`; e `pessoas.nome` acompanha.
4. **Fotos**: subir uma de teste, listar, excluir **essa**; provar por listagem que as fotos reais
   do bucket não foram tocadas.
5. **Modo escuro idêntico** antes **e depois** de remover o bloco do `:root`.
6. **Convite intacto** (site contra site, como nas duas últimas).
7. **Confirmações reais intactas** ao fim, saída crua.
8. **Screenshots a 390px** de cada bloco aberto, mais um de desktop.
9. **Tabela de hashes no `status.md`** — Branch, commit e `origin/main` pós-push. A da Fatia 13
   saiu sem ela; é o que o `fechou` confere, e a falha foi minha.

---

## Perguntas

**P1 — três "Salvar" no lugar de um.** O mockup quebra preços, taxas e prazo em três acordeões,
cada um com seu botão. Hoje é um formulário e um salvamento. **Sou a favor de seguir o mockup**:
cada `update` fica naturalmente estreito, e o toast passa a dizer exatamente o que mudou. O risco
é editar dois blocos e salvar um só — **proponho marcar o cabeçalho do acordeão com "não salvo"**
enquanto houver alteração pendente. Confirma? (Mudar o número de salvamentos é comportamento, por
isso não decidi sozinho.)

**P2 — o mockup não cobre o editor de Aniversariantes.** Ele mostra `["Bruno", "chopp · pizza"]`
como campo de texto, o que é claramente placeholder: o editor real são três blocos com chips de
consumo por pessoa, e a regra do chopp para criança vale ali também. **Proponho** manter a
estrutura de blocos + chips que já existe, só revestida com os tokens novos e dentro do acordeão.
É hierarquia, então pergunto em vez de decidir — mas não vejo outra leitura possível.

**P3 — sincronizar `pessoas.nome` ao renomear (o risco 2).** Isso resolve a divergência de vez,
mas é uma escrita a mais que o formulário do Convite não fazia. Entra nesta fatia, ou é fatia
própria junto com a lixeira/`cancelar_rsvp`, que também mexe em `pessoas`?

Os commits 1, 4 e 5 não dependem de nenhuma das três.
