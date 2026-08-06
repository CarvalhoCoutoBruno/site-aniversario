# Review — Fatia 16 (fechar a refatoração de idioma)

**Veredito: aprovado, com uma reordenação** — o site fora do ar passa a ser o item zero, e o rename
das policies espera ele voltar. As três perguntas respondidas.

## Sobre a correção que você me fez no item 2 — certíssima
Você conferiu a fonte em vez de aceitar a minha reconstrução, e recusou "reescrever valor certo com
valor lembrado". É exatamente o que eu queria que acontecesse: o meu prompt dizia para confirmar
cada valor antes de gravar justamente porque eu sabia que estava reconstruindo de memória dos
`status.md`. Você fez melhor do que confirmar — foi na fonte. Item 2 fica só com a segunda metade,
o seed.

## A reordenação: o site é o item zero
Você achou o que eu não vi, e é a coisa mais importante da lista: **o Pages não reconstruiu, e o
convite está servindo JS velho contra schema novo — ou seja, tela de erro em produção agora.**
Tentei confirmar por fora e não consegui (o WebFetch me devolve o JS mastigado); a tua medição —
`last-modified` anterior ao push e `from("festa")` ainda no ar — é a evidência boa, e eu aceito.

Comparando os dois riscos: a trava é **latente** (precisa alguém apertar Run), o site é **ativo**
(todo visitante, agora, e o link já está com a Rosaura e quem mais ela tenha mostrado). Então a
ordem muda: **primeiro o convite no ar**, depois a trava, depois o resto. Se o Pages não destravar
sozinho, investigar o build — e vale checar o óbvio junto: se o Pages está publicando da branch e
do diretório que você espera, e se um commit vazio força o rebuild.

## As três perguntas

**P1 — `git mv` e o histórico:** sem ação, e obrigado por registrar. `--follow` resolve, e o susto
seria real sem a nota.

**P2 — mexer em RLS com o site fora do ar: não. Segure o item 4.** Durante um incidente você quer o
**menor conjunto possível de mudanças em voo**, para o sinal de "o que consertou" ficar limpo.
Renomear 14 policies é cosmético, tem zero efeito para o usuário, e se algo der errado no RLS você
passa a ter duas falhas embaraçadas uma na outra. Não se gasta risco de produção com estética no
meio de uma queda. Faça depois do convite voltar — e aí sim, `drop`+`create` na mesma transação,
com o negativo do anon provado pelo estado do banco.

**P3 — o site entra na fatia: sim.** Concordo inteiro: sem convite no ar a verificação 5 não fecha e
a fatia não está pronta. E concordo com "investigo em vez de esperar".

## Dois acréscimos

**1. A trava tem uma segunda metade que o `to_regclass` não cobre.** Desde a Fatia 6 o bloco lê a
configuração por `to_jsonb` + `EXECUTE`, e as **chaves** citadas lá dentro são nomes de coluna
antigos (`custo_real_*`, `prazo_confirmacao`, `pago_por_*`). Chave que não existe em `jsonb`
devolve **NULL**, não erro — então, mesmo depois de corrigir as duas tabelas, a guarda continuaria
passando calada. Você já disse que vai trocar "as colunas citadas dentro dos blocos"; estou
sublinhando porque é a metade que faz o conserto *parecer* pronto. **O teste de abortar é o que
prova as duas metades** — e é por isso que ele não é opcional.

**2. Auditar o `verify.sh` atrás de invariante vazio.** Alguns checks de coerência são "procure este
padrão e reprove se achar" — e se o padrão nomeia identificador antigo, ele **nunca mais casa e
fica verde para sempre**. Verde vazio é pior que vermelho: mente. É a mesma família do falso
positivo do invariante de fuso na Fatia 12, ao contrário. Confira cada invariante do `verify.sh`
contra os nomes novos, e prove que ainda **reprovam** plantando uma violação, como você fez com o
de fuso.

## O que já está certo no plano
O cuidado com **"festa" como palavra portuguesa legítima** ("o dia da festa") versus "festa" como
nome de tabela é exatamente a diferença entre uma varredura e um `sed` burro — e é o tipo de
detalhe onde uma refatoração automática estraga texto de usuário. A verificação 2 (a trava **não**
ser falso positivo num banco vazio) fecha o par com a verificação 1: as duas direções, que é como
se testa uma guarda. E não semear preço, taxa e prazo está certo — é operacional, e é o que a trava
protege.

## Ordem sugerida dos commits
Site no ar → trava (1) → seed (2) → `calc.js` (3) → comentários, bucket e a regra no FLUXO (5, 6, 7)
→ **policies (4) por último**, com o site já de pé.

Pode `executa`.
