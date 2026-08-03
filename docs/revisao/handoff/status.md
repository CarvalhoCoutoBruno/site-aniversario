# Status — Fatia 7: polimento (fechar o projeto)

**Fatia fechada. O backlog zerou.** Aprovada sem ajustes; a nota leve do review (título no
resumo compartilhado) entrou.

| | |
|---|---|
| Branch | `chore/fatia-7-polimento` → merge `--ff-only` → apagada |
| Commit da fatia | `e3f3543da24bf2d3491489de98d005f9b2a871ff` |
| `./verify.sh` | **VERDE** — **63** asserções (eram 57) |

## `./verify.sh`

```
Sintaxe
  ✓ js/admin.js   ✓ js/calculo.js   ✓ js/config.js   ✓ js/main.js   ✓ tests/calculo.test.js
Testes de cálculo
  ✓ ✓ 63 passaram, 0 falharam
Higiene
  ✓ sem connection string, service_role ou senha rastreada
  ✓ js/config.js preenchido
Coerência
  ✓ supabase-setup.sql sem placeholder
  ✓ js/main.js escreve só pelo RPC

VERDE — verificação estática ok. Falta a integrada (navegador + banco).
```

6 asserções novas do `resumoAcerto`. Mutação: fazer o resumo sair mesmo com acerto incompleto
derruba a asserção que cobre isso (`62 passaram, 1 falharam`).

## Verificação integrada — saída crua

### 1. Countdown: os três estados

**Futuro** (data real da festa, 31/10/2026):
```json
{ "estadoHoje": { "countdownVisivel": true, "dataset": "contagem", "dias": "88", "avisoOculto": true } }
```

**O caso que o ingênuo erra** — festa hoje (03/08), às 8h, com o relógio em 15h44:
```json
{ "festa": "2026-08-03T08:00:00-03:00",
  "diffEmHoras": "-7.8",
  "oQueOIngenuoDiria": "passou",
  "estadoReal": "e-hoje",
  "countdownEscondido": true,
  "avisoVisivel": true,
  "textoDoAviso": "É hoje! 🎉" }
```
`diff` de **−7,8 horas** e a tela diz "É hoje!". Um `diff <= 0 → passou` teria anunciado o fim da
festa quase 8 horas antes dela terminar.

**Passado** (festa ontem):
```json
{ "festa": "2026-08-02T20:00:00-03:00",
  "estadoReal": "passou",
  "countdownEscondido": true,
  "textoDoAviso": "A festa já aconteceu. 💜",
  "formularioAindaFunciona": true }
```

### 2. Compartilhar o acerto
Base do ×6,5 com Bruno como pagador do chopp:
```json
{ "seloAcerto": "selo verde",
  "transferenciasNaTela": ["Braz → Bruno: R$ 50,00"],
  "compartilharVisivel": true,
  "textoGerado": "Festa dos 160 anos 🎉\n\nAcerto das contas:\n• Braz → Bruno: R$ 50,00",
  "linkWhats": "https://wa.me/?text=Festa%20dos%20160%20anos%20%F0%9F%8E%89%0A%0AAcerto%20das%20contas%3A%0A%E2%80%A2%20Braz%2..." }
```
O texto bate com o que está na tela, e o `wa.me` vai **sem número** — o organizador escolhe o
contato ou o grupo.

### 3. **Um bug que só a verificação integrada pegou**

Removendo o pagador (acerto volta a incompleto), o botão de compartilhar **continuava visível
com o texto anterior**:

```json
{ "acertoIncompleto": { "selo": "selo cinza", "motivo": "Indique quem pagou: chopp.",
    "compartilharVisivel": true,
    "textoGerado": "Festa dos 160 anos 🎉\n\nAcerto das contas:\n• Braz → Bruno: R$ 50,00" } }
```

Causa: o `prepararCompartilhar` estava **depois do `return` antecipado** do estado incompleto —
nunca rodava nesse caminho. O `resumoAcerto` devolvia `""` corretamente (o teste unitário passa),
mas a UI não chegava a perguntar.

O risco era concreto: mandar no grupo um acerto que não vale mais.

Corrigido movendo a chamada para antes do `return`. Reverificado nos dois sentidos:
```json
{ "incompleto":        { "selo": "selo cinza", "compartilharVisivel": false, "textoGerado": "" },
  "voltouACompletar":  { "selo": "selo verde", "compartilharVisivel": true,
                         "textoGerado": "Festa dos 160 anos 🎉\n\nAcerto das contas:\n• Braz → Bruno: R$ 50,00" } }
```

> Vale como lição do fluxo: teste unitário verde não prova que a tela **usa** a função. Foi a
> quarta vez que a verificação integrada pegou algo que a estática não pegaria.

### 4. Docs conferidas por `grep`, não por memória
```
README ainda cita Netlify?     0 ocorrências ✅
README cita GitHub Pages?      2
REGRAS: versão                 "> Versão 6 — inclui o **acerto** (quem deve a quem)..."
REGRAS: seção do acerto        1
HANDOFF: última atualização    2026-08-03, ao fim da Fatia 7
HANDOFF: "modo teste"          removido ✅
```

### 5. Base restaurada
```
rsvps = 0
pessoas = 0
admins = ['Bocão', 'Braz', 'Bruno', 'Rosaura']
auth.users = ['bruno.carvalho@gmail.com','brazrs@gmail.com','rscouto47@hotmail.com','jhboca@hotmail.com']
config.js com a data real: 2026-10-31T11:00:00-03:00
```

## Uma divergência corrigida fora do escopo listado

O `supabase-setup.sql` semeava **só o Bruno** em `admins`, com os outros três como comentário —
mas o banco real tem os quatro. Como o arquivo é a fonte da verdade do schema, uma recriação
reproduziria um estado que não é o atual, e Braz, Bocão e Rosaura perderiam o acesso ao painel.

Os quatro UIDs agora estão no `insert`. É o mesmo princípio que a fatia aplica às docs — corrigir
o que diverge da realidade — estendido ao arquivo que descreve o schema.

## Estado do projeto

**Completo.** As sete fatias fecharam e não há backlog de desenvolvimento.

Convite → RSVP → cadastro dos aniversariantes → config → estimativa → fechamento e rateio →
acerto → compartilhar.

## Pendências (todas fora do repositório)

- **Rotacionar a senha do Postgres** — circulou em conversa durante o desenvolvimento. Nada no
  site depende dela; o site usa só a chave anon.
- Subir as fotos do carrossel pelo painel.
- Preencher os preços e taxas reais antes de divulgar o link.

> Depois de preencher preços ou definir prazo, a trava do `supabase-setup.sql` passa a bloquear
> a recriação do schema — que é exatamente o que ela existe para fazer.

---

## Hashes

| | |
|---|---|
| Commit da fatia (o código) | `e3f3543da24bf2d3491489de98d005f9b2a871ff` |
| Commit deste `status.md` | logo em seguida, na `main` |

> Gravar o hash pós-push dentro de um arquivo versionado muda o hash — por isso os dois são
> distintos. O `fechou` deve conferir **`origin/main == main`**, não a igualdade com um hash
> literal escrito aqui.
