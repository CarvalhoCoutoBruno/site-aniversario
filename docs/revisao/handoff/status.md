# Status — Fatia 8: convite editável pelo admin

**Fatia fechada.** Aprovada sem ajustes; as duas notas leves do review entraram — e uma delas
apontou para três bugs de corrida que só apareceram na verificação integrada.

| | |
|---|---|
| Branch | `feat/fatia-8-convite-editavel` → merge `--ff-only` → apagada |
| Commit da fatia | `22352466bcdc93a7685fbd902db01f0fb6dca106` |
| `./verify.sh` | **VERDE** — 63 asserções, sem regressão |

## ⚠️ Esta fatia encontrou dado real seu no banco

Ao aplicar o schema, a trava do reset **abortou**:

```
ABORTADO: public.config tem dado real (prazo de confirmacao definido).
```

Não era falso positivo. Você usou o painel: prazo em 01/10/2026, preços (chopp 10,00; refri
5,00; água 3,00; pizza 20,00), taxa de chopp ajustada para 2,5 L, os **3 aniversariantes
cadastrados** e **2 fotos** no carrossel.

**O que eu fiz:** backup completo impresso na conversa, e então apliquei **só a tabela nova**,
sem derrubar nada — em vez de limpar a base para o script inteiro passar. Contornar a trava
seria usar a chave para arrombar a própria porta.

Conferido depois, contra o backup:
```
config no banco agora: [2026-10-02 02:59:59+00, 10.00, 5.00, 3.00, 20.00, 20.00, 2.500, 0.600, 0.500]
config no backup     : ['2026-10-02T02:59:59+00:00', 10.0, 5.0, 3.0, 20.0, 20.0, 2.5, 0.6, 0.5]
pessoas: (['Bruno', 1], ['Braz', 2], ['Bocão', 3])
```
Idêntico. Nada seu foi perdido, e as 2 fotos nunca foram tocadas.

> Registrei no `FLUXO.md`: **a era do recreate acabou.** Daqui em diante, mudança de schema é
> aditiva, com o `supabase-setup.sql` seguindo como descrição completa para instalação do zero.

## Verificação integrada — saída crua

### 1. Fronteira de leitura do anon
```
festa : [{"titulo":"Festa dos 160 anos","nome_aniv_1":"Bruno","nome_aniv_2":"Braz","nome_aniv_3":"Bocão"}]
config: []
```
A `festa` é a primeira tabela que o visitante lê direto — e só tem o que já aparece impresso no
convite. Preço e custo real seguem invisíveis.

### 2. Convite montado a partir do banco
```json
{ "carregandoOculto": true, "heroVisivel": true, "erroOculto": true,
  "titulo": "Festa dos 160 anos",
  "data": "Sábado, 31 de outubro de 2026, às 11h",
  "local": "Salão 3 — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS",
  "temLinkMapa": true,
  "nomesNoHero": ["Bruno", "Braz", "Bocão"],
  "chips": ["1:Bruno", "2:Braz", "3:Bocão"],
  "countdownEstado": "contagem", "dias": "88",
  "configJsAindaTemFesta": false }
```

### 3. **O risco central: falha de carga** — e três bugs que ele revelou

Simulei removendo a policy de leitura pública (falha real de RLS, não stub de rede).

**Primeira medição** — o beco sem saída foi evitado, mas o convite ficou incoerente:
```json
{ "erroVisivel": true, "formularioOculto": true, "chipsVazios": 0,
  "carrosselDisplay": "" }
```
O carrossel **reapareceu por cima do erro**: o load das fotos resolve depois do da festa e
sobrescrevia o estado de falha. Você tem 2 fotos no bucket, então isso era visível de verdade.

**Segunda medição** — corrigido o carrossel, sobrou o aviso de prazo:
```json
{ "erroVisivel": true, "carrosselDisplay": "none", "avisoPrazoVisivel": true }
```
Mesma causa, sentido oposto: o `status_rsvp` tinha resolvido **antes** da falha, então a flag não
alcançava.

A correção precisou dos dois lados: uma flag para quem chega depois **e** limpeza no
`falhaConvite` para quem já chegou.

**Terceira medição** — um estado só:
```json
{ "erroVisivel": true, "heroVisivel": false, "formularioVisivel": false,
  "carrosselVisivel": false, "avisoPrazoVisivel": false, "encerradoVisivel": false,
  "chips": 0 }
```

### 4. Mais duas corridas, no admin

Os rótulos dos aniversariantes vêm da `festa`, e `carregarAniversariantes` rodava em paralelo
com `carregarConvite` — pegava o fallback:
```json
{ "blocosAniversariantes": ["Aniversariante 1 (id 1)", "Aniversariante 2 (id 2)", "Aniversariante 3 (id 3)"],
  "colunaConvidou": ["BrunoBocão"] }
```
A coluna funcionava (mais lenta, chegava depois), os blocos não. Serializei: a `festa` carrega
**primeiro e sozinha**, e só então os dependentes.

A mesma corrida existia no salvar. Depois do `await`:
```json
{ "blocos": ["Bruninho II (id 1)", "Braz (id 2)", "Bocão (id 3)"],
  "seletorPagador": ["—", "Bruninho II", "Braz", "Bocão"],
  "colunaConvidou": ["Bruninho IIBocão"] }
```

### 5. Edição refletida no site público
Editei **todos** os campos no admin e recarreguei o convite:
```json
{ "titulo": "Aniversário dos Três",
  "subtituloVisivel": true, "subtitulo": "Vem que tem chopp!",
  "dataGerada": "Domingo, 15 de novembro de 2026, às 19h30",
  "local": "Sítio do Vô — Estrada Velha, km 4",
  "linkMapa": "https://maps.google.com/?q=teste",
  "nomesNoHero": ["Bruninho II", "Braz", "Bocão"],
  "chips": ["1:Bruninho II", "2:Braz", "3:Bocão"],
  "countdown": "contagem / 104 dias" }
```
`data_texto` estava `NULL` no banco → gerado da data, no fuso de São Paulo.

### 6. Renomear não quebra confirmação
```
rsvp: ['Convidado Teste', [1, 3]]   <- gravado quando o id 1 se chamava Bruno
nomes agora: ['Bruninho II', 'Braz', 'Bocão']
```
O `convidado_por` continua `[1,3]`; só o rótulo mudou.

### 7. Anon não grava a `festa`
```
anon UPDATE titulo: HTTP 204
titulo no banco: 'Aniversário dos Três'
-> INTACTO ✅
```
O `204` pela quarta fatia seguida.

### 8. Trava do reset protege a `festa`
```
com a festa editada: abortou -> ABORTADO: public.festa foi editada pelo painel (titulo, data, local ou nomes)
```
Isolei o gatilho limpando os da `config` antes — é a `festa` mesmo que dispara. Com
`atualizado_em` NULL o script liberaria, que é o comportamento desejado: recriar é livre até
alguém editar o convite.

### 9. Base restaurada
```
config: os seus valores, conferidos contra o backup
pessoas: Bruno(1), Braz(2), Bocão(3) — nunca tocados
festa: 'Festa dos 160 anos', atualizado_em NULL (volta ao seed)
rsvps: 0        admins: Bocão, Braz, Bruno, Rosaura
auth.users: as 4 contas reais, 0 temporários
policies da festa: admin edita festa (UPDATE) · festa leitura publica (SELECT)
```

## Uma inconsistência que corrigi de passagem

O rateio rotulava as contas com `pessoas.nome`, que é o **snapshot** de quando o aniversariante
foi cadastrado. Renomear no Convite não propagaria até alguém re-salvar a outra seção — a conta
mostraria "Bruno" enquanto o convite já dizia "Bruninho".

Agora a `festa` é a fonte única do nome em toda a UI (contas do rateio, saldos do acerto e as
transferências), com o snapshot só de reserva.

## Estado do produto

O convite é **editável pela tela**: título, subtítulo, data, local, mapa e os três nomes, sem
`git push`. O `config.js` ficou só com as chaves do Supabase.

## Notas para a próxima fatia

- **Nomes dos aniversariantes têm duas moradas** hoje: `festa.nome_aniv_*` (fonte da verdade) e
  `pessoas.nome` (snapshot, usado como reserva). Funciona, mas vale considerar tirar o `nome` da
  linha de aniversariante — ele nunca deveria divergir.
- A `festa` inaugurou a leitura pública. Se um dia entrar mais coisa lá, vale reconferir que
  continua sendo só o que o convidado já vê.
- Produtização (multi-tenant) segue como conversa à parte, não como fatia.
- Ainda pendente: rotacionar a senha do Postgres.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `22352466bcdc93a7685fbd902db01f0fb6dca106` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**.
