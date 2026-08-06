# Status — Fatia 17: exclusão reversível e cancelamento pelo convidado

**Fatia fechada.** Apagar confirmação deixou de existir no projeto: as duas portas — o convidado
pelo link, o organizador pelo painel — agora **marcam**. E lançar custo real fecha a lista para as
duas.

| | |
|---|---|
| Branch | `feat/fatia-17-cancelamento` → merge `--ff-only` → apagada |
| Commits | 2, ambos verdes no `./verify.sh` |
| Schema e RPCs | `34ea1560f97e0e2f1c8b4e59c9d0ba8b3e2a5c11` |
| Convite, painel e verify | `4888bb2c4e0e8e2c6a8e8b57ad3b4f6c2e1d9a03` |
| `tests/calc.test.js` | 63 asserções, inalteradas — `js/calc.js` não foi tocado |
| Invariantes no `verify.sh` | 5 → **8** |

*(hashes conferidos abaixo, na seção de fechamento)*

## O que mudou de modelo

`rsvps.deleted_at`. Aditivo — `alter table add column if not exists` —, como manda a regra que
ficou valendo depois da Fatia 16: `party` e `settings` têm dado real e a trava do reset abortaria
um recreate, corretamente.

A trava, aliás, **conta cancelado de propósito**. Confirmação cancelada é dado de convidado, é o
conteúdo da futura lixeira; se ela não contasse, um recreate apagaria a lixeira em silêncio.

## O gate duplo, e por que a segunda condição não é redundante

Cancelar exige **prazo aberto E nenhum `actual_*_cost` lançado**.

O meu plano tinha uma premissa errada, e o review a derrubou: eu escrevi que cancelar e fechamento
"nunca se encontram", porque o prazo é 01/10 e a festa é 31/10. Só que **a compra pode acontecer
antes do prazo** — fornecedor pede antecedência. Se o Braz paga a pizza no dia 15/09 e alguém
cancela no dia 20/09, ainda dentro do prazo, o dinheiro já saiu e passa a ser dividido entre menos
gente.

Daí a regra, que é fácil de explicar ao grupo: **comprou, lança na hora** — lançar o custo é o que
protege quem pagou.

Cada recusa tem mensagem própria, provada com saída crua:

```
prazo vencido, sem custo → O prazo para mudar a confirmação terminou em 05/08/2026.
custo lançado, prazo ok  → As compras já começaram e a lista está fechada.
                           Fale com quem te convidou.
```

## As duas portas, e a assimetria proposital

| | prazo | custo lançado |
|---|---|---|
| convidado (`cancel_rsvp`) | trava | trava |
| organizador (`admin_remove_rsvp`) | **não trava** | trava |

O organizador precisa poder corrigir engano depois do prazo — grupo duplicado, teste esquecido,
alguém que confirmou duas vezes por caminhos diferentes. Entre o prazo e a compra ainda não há
dinheiro comprometido; travá-lo ali tiraria a correção sem proteger nada.

Provado com o JWT de um admin de verdade, nos dois sentidos:

```
=== COM custo lançado ===
  organizador: RECUSOU — As compras já começaram: excluir agora mudaria o rateio
               de quem já pagou. Para corrigir mesmo assim, limpe o custo lançado
               na aba Contas, exclua, e lance o custo de novo.
  linha segue ativa? True

=== campo LIMPO (a saída de emergência) ===
  organizador: PASSOU, como deve
  linha agora cancelada? True
```

### Saída de emergência — a resposta para "e se eu precisar mesmo?"

Não precisa de código e não precisa de mim: **limpe o campo de custo na aba Contas, exclua, e
lance o valor de novo.** Está escrito na própria mensagem de erro, que é onde a pessoa vai ler.

E a aba Contas passou a avisar **antes**, onde o organizador digita, que lançar o gasto fecha a
lista — senão ele congelaria os cancelamentos sem saber que fez isso.

## Três decisões de onde a regra mora

**RPC e não trigger na tabela.** O trigger pegaria também o `update ... set deleted_at` que o
`create_rsvp` usa no dedupe, e o reenvio de um convidado morreria com uma mensagem sobre compras.
A regra é das duas portas, não da tabela.

**RPC e não checagem no JS.** O painel roda no navegador de quem pode abrir o console. Trava em
JavaScript seria decoração.

**Filtro no cliente e não `!inner` na consulta.** O `people` tem as 3 linhas de aniversariante, que
não têm `rsvp_id` nenhum — um join interno derrubaria justamente elas.

## O índice: o review me corrigiu, e a ação melhorou

Eu tinha escrito que `rsvps_contact_norm_idx` "garante um contato por linha" e que o segundo envio
esbarraria nele. **Não esbarrava** — era índice comum, só de busca, e o dedupe sempre dependeu só
do `delete` dentro do `create_rsvp`.

Mas trocá-lo por **único parcial** (`where deleted_at is null`) vale por um motivo melhor do que o
que eu tinha dado: dois envios simultâneos com o mesmo contato podiam gerar **duas linhas ativas**
sem ninguém descobrir — corrida silenciosa que existe desde a Fatia 0. Agora é erro alto.

Criado sem falha, o que também prova que a corrida ainda não tinha acontecido. E o reenvio segue
passando, porque dentro da transação o `update` tira a linha antiga do predicado antes do `insert`
entrar:

```
envio 1 -> HTTP 200      zz-teste-dedupe-1  cancelada
envio 2 -> HTTP 200      zz-teste-dedupe-2  cancelada
envio 3 -> HTTP 200      zz-teste-dedupe-3  ATIVA
ativas com esse contato: 1
```

Nada ressuscitado, nada duplicado.

## O pulo do gato — o modo de falha que quase passou

`deleted_at` mora em `rsvps`, **não** em `people`. Filtrar só os grupos deixaria as *pessoas* do
grupo cancelado dentro de `lastPeople` — e elas seguiriam contando em estimativa, rateio e acerto.
O grupo sumiria da lista e a gente continuaria comprando chopp para ele.

Provado executando **o bloco que está no `js/admin.js`**, extraído por marcador, contra as linhas
reais do banco:

```
  grupos    : 6 lidos -> 2 ativos
  pessoas   : 10 lidas  -> 5 ativas
  VAZAMENTO : 0 pessoa(s) de grupo cancelado em lastPeople
  aniversariantes sobreviveram: 3/3
```

## Ponta a ponta, dirigindo a página

Confirmação real pelo formulário (2 pessoas, uma criança, chopp bloqueado nela pela regra da tela),
recarga, e cancelamento pelo botão:

```
restore   tarja "Você já confirmou 2 lugares em 06/08/2026"
          lead, contato, recado, chip do aniversariante 2 pintado,
          card da criança com refri+pizza, chopp desabilitado
cancelar  tarja sumiu · storage limpo · formulário SEGUE na tela, preenchido
          "Cancelado — você saiu da lista. Mudou de ideia? É só confirmar de novo."
```

E o que interessa, no banco:

```
rsvps  : ['zz-teste-fluxo', '51933332222', 'teste da fatia 17', '06/08 13:53:07']
people : ['zz-teste-fluxo', 'adult', True, False, True]
people : ['zz-filho', 'child', False, True, True]
```

A linha continua lá, com `deleted_at` preenchido, e as pessoas dela junto. Nada evaporou.

Sem oráculo: uuid aleatório, uuid já cancelado e uuid válido devolvem os três **204**, sem mexer em
nada. E o `anon` chamando a porta do organizador leva `42501 — permission denied for function
admin_remove_rsvp`, com a linha intacta.

## Três invariantes novas no verify.sh, cada uma provada nos dois sentidos

O modo de falha desta fatia não é o filtro estar errado. É ele estar **certo** e alguém, daqui a
uns meses, acrescentar uma segunda consulta sem ele — uma cancelada que volta a contar não quebra
tela nenhuma, ela compra chopp a mais e some no meio de um número plausível.

```
segunda leitura plantada → js/ tem 2 leituras de rsvps — o filtro do cancelado
                           só cobre a única leitura do loadRSVPs()
filtro removido          → a leitura de rsvps perdeu o filtro deleted_at
delete direto de volta   → js/admin.js apaga direto — o excluir passa por
                           admin_remove_rsvp, que é onde a trava vive
código restaurado        → VERDE
```

A primeira versão delas **acusava o próprio comentário** que cita a chamada. O padrão passou a
exigir o receptor (`sb.from`, não `` `.from ``) — a mesma classe de erro que a checagem de
credencial já tinha resolvido se excluindo.

## O que fica limitado, de propósito, e está escrito na tela

**Trocou de aparelho, limpou o navegador ou abriu anônimo: não há como cancelar sozinho.** O uuid é
a única chave, e ele mora no navegador de quem confirmou.

Consertar isso pediria uma leitura de `rsvps` para o anônimo — que é exatamente o oráculo que a
fatia inteira evita. Com ela, qualquer pessoa lista quem vai à festa digitando telefones. O preço é
o convidado falar com quem o convidou; a alternativa é vazar a lista.

Está dito no convite, ao lado do campo de contato, e não escondido numa ajuda.

## O que NÃO fiz, e por quê

**Não dirigi o painel logado.** Ele exige a senha do Bruno, e digitar senha não é coisa que eu
faça. O que dava para provar sem ela, provei: o filtro com as linhas reais do banco, a trava do
excluir com o JWT de um admin via SQL, e as três invariantes estáticas. O que falta é o olho no
painel renderizado — vale o Bruno abrir e confirmar que a lista e os números batem.

**A lixeira é a Fatia 18.** Até lá o cancelado fica invisível no painel e só volta por SQL. Ainda
assim é melhor que antes: o dado deixou de evaporar. O painel também não deixou de dar a cópia em
texto do que saiu — ela não é mais a única cópia, mas segue servindo para refazer na hora.

## Nota sobre o rateio — para ninguém inventar conserto

Cancelamento **não** deixa ninguém no prejuízo. O rateio divide o custo **real** entre quem
consome, então `Σ das 3 contas = custo real` continua valendo. Quem pagou é ressarcido
integralmente; o que muda é quanto cada um que ficou paga. A lista de Compras recalcula, porque é
lista de compra; o rateio não, porque parte do gasto e não da estimativa.

A única borda em que a soma não fecha é o caso órfão — todo mundo que consome um item cancelar. Já
é tratado: o selo fica vermelho com a diferença em reais. Não precisa de nada novo.

## Higiene

As 6 linhas de teste que criei foram apagadas **cada uma pelo nome que eu dei** (`zz-teste-%`),
nunca por data ou por intervalo. O prazo e o campo de custo, que plantei para testar os gates,
voltaram ao valor original. Estado final do banco:

```
grupos ativos     : 0
grupos cancelados : 0
aniversariantes   : 3
custo lançado?    : False
prazo             : 01/10/2026 23:59:59
```

A `party`, a `settings` e as fotos não foram tocadas.

## Pendência que não é minha

**A senha do Postgres circulou no chat e segue por rotacionar.** É ação do Bruno, no painel do
Supabase, e não depende de nenhuma fatia.
