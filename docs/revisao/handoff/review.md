# Review — Fatia 14 (admin: aba "Ajustes")

**Veredito: aprovado.** As três perguntas respondidas abaixo; nada a mudar no plano.

## O que está certo e vale registrar

**O corte em três `Salvar` deixa o `update` estreito de graça.** A observação é boa: o mockup
quebrou `configForm` exatamente onde a estrutura do código já estava separada (`CAMPOS_PRECO`,
`CAMPOS_TAXA`). Em vez de disciplina, vira arquitetura — o `patch` fica pequeno porque o
formulário é pequeno. E a regra que você manteve é a que importa: **nenhum `patch` montado por
varredura**, cada um lista as colunas à mão.

**"Fui verificar em vez de supor" no bloco do modo escuro.** Os dois `<body>` já carregam classe de
escopo, então o `@media (prefers-color-scheme: dark)` do `:root` está morto desde a Fatia 12 — e a
aba Contas ainda ser provisória não muda nada, porque ela também mora dentro de `.pagina-admin`. Com
medição antes e depois, pode sair.

**Fotos:** a confirmação nomeando o arquivo e dizendo *onde ele aparece* ("sai do carrossel do
convite") é melhor que a genérica, e reconhecer que aqui não dá para ecoar o conteúdo — é imagem —
com o nome do arquivo servindo de pista para reenviar, resolve bem o que dava para resolver.

## As três perguntas

**P1 — três `Salvar`: sim, siga o mockup**, com o marcador de "não salvo" no cabeçalho do acordeão.
O ganho (cada `update` nasce estreito) vale mais que o risco, e o marcador cobre o risco.

Uma tranquilidade a mais sobre o cenário que te preocupou: como as abas são só troca de
visibilidade, **trocar de aba e voltar não perde edição pendente** — o input continua no DOM com o
valor digitado. A perda só acontece em recarga ou logout, que é exatamente onde o marcador aparece.
Detalhe de implementação: o marcador tem de ligar no `input` do usuário e **não** no preenchimento
programático do `carregarConfig()`, senão nasce sujo; e limpar após salvar.

**P2 — editor de Aniversariantes: sim, mantenha blocos + chips.** O `["Bruno", "chopp · pizza"]` do
mockup é placeholder, e a regra do chopp para criança vive ali — regra não vem do mockup. Revestir
com os tokens novos dentro do acordeão é a leitura certa, e concordo que não há outra.

**P3 — sincronizar `pessoas.nome` ao renomear: sim, entra nesta fatia** — e a razão de eu não
mandar para outra é que aqui é o único lugar onde a informação existe (você está no formulário que
renomeia). São poucas linhas, mata a divergência prática de hoje e não mexe em `convidado_por`.

Duas condições: o `update` tem de ser **estreito também aqui** (só a coluna `nome`, só linhas com
`papel='aniversariante'`, só quando o nome mudou), e **no-op** quando o aniversariante ainda não
foi cadastrado como consumidor.

**E fica registrado o conserto de verdade, para a Fatia 15:** o certo não é manter duas cópias em
acordo, é **parar de guardar o nome na linha de aniversariante** — a `festa` é a fonte, e a coluna
pode ficar nula nessas linhas (a constraint `principal_tem_nome` só exige nome para
`papel='principal'`). Não faço agora porque exigiria auditar todos os leitores de `pessoas.nome`, e
os principais — contas, saldos, transferências — **estão prestes a ser reescritos na Fatia 15**.
Auditar tela que vai ser refeita é trabalho jogado fora. Na 15 sai de graça.

## Nota de copy
O aviso das `<meta>` `og:` está no lugar certo (dentro do acordeão do Convite, colado em data e
local). Diga também **o que fazer** — que o preview só muda quando alguém editar o `index.html` —
senão o organizador lê que está errado e não sabe a quem recorrer.

## Verificação
Cobre o que importa, e **plantar valor em `custo_real_chopp` e `pago_por_chopp` antes da bateria**
para provar que sobrevivem a todos os salvamentos é a forma certa de testar o invariante: prova, em
vez de afirmação. Some no item 3 a conferência de que o nome novo aparece **sem** re-salvar o bloco
de Aniversariantes.

Pode `executa`.
