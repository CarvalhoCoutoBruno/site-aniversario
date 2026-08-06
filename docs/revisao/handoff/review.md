# Review — Fatia 13 (admin: "Quem vem" + "Compras")

**Veredito: aprovado**, com dois acréscimos pequenos e as três perguntas respondidas.

## Os quatro riscos — bem resolvidos

**1. Exclusão.** Concordo com a confirmação nomeada e **concordo em não somar fricção**: o
argumento está certo — fricção alta em ação frequente ensina a passar por ela no automático, e o
botão já está atrás de dois toques deliberados. O **toast com o conteúdo apagado em texto** é a
ideia boa da fatia: não é desfazer, mas é o que permite refazer à mão, e custa uma linha.

Registro a dívida no lugar certo: quando o `cancelar_rsvp` (P6 da Fatia 11) virar fatia, **a
lixeira anda junto** — "convidado cancela" e "admin apagou sem querer" são a mesma família
(`apagado_em` + ajuste de RLS), e fazer as duas de uma vez é mais barato que duas mudanças de
schema no mesmo lugar.

**2. Recarregar em vez de remendar os arrays.** Certo, e pelo motivo certo: remendar array à mão é
onde nasce divergência silenciosa, e aqui ela apareceria como número errado de pizza. Uma ida a
mais ao banco numa festa de 30 grupos não é custo.

**3. WhatsApp.** A tabela está certa, e uma coisa que você acertou sem citar merece ficar
explícita: **decidir por comprimento antes de olhar o prefixo** é o que salva o caso mais provável
aqui. `55` é DDI do Brasil **e** é o DDD de Santa Maria/RS — um convidado de lá com 11 dígitos
(`55987654321`) precisa virar `5555987654321`. Uma regra que checasse "começa com 55 → já tem DDI"
mandaria a mensagem para o lugar errado, e vocês são de Porto Alegre: DDDs 51/54/55 vão aparecer
de verdade nessa lista.

**Acréscimo:** ponha esse caso no verify, ao lado do da Rosaura. É o teste que a regra ingênua
reprova.

E "melhor não ter botão do que ter botão que abre conversa com desconhecido" é a política certa
para o caso inválido.

**4. Escape.** Certo, incluindo o ponto de que `esc()` não basta no `href` — `encodeURIComponent`
onde entra em URL.

## Acréscimo 2 — o estado da lista depois da recarga
Consequência de recarregar tudo no `delete`: a lista re-renderiza, e **busca, filtro ativo e quais
cards estão expandidos** podem voltar ao zero. Excluir um grupo e ver a busca sumir é irritante
justamente na hora em que o organizador está limpando várias coisas. Preserve pelo menos **busca e
filtro** (o card expandido é aceitável perder). Não bloqueia, mas quero na verificação.

## As três perguntas

**P1 — dois estados vazios: aprovado.** "Nenhuma confirmação ainda" e "nenhum resultado" pedem
coisas diferentes, e o botão de limpar no segundo é o certo.

**P2 — formato do texto do fornecedor: aprovado, com uma linha a mais.** Inclua a **data da
festa** no cabeçalho — quem recebe a lista precisa saber para quando é, e é a primeira pergunta
que o fornecedor faz:

```
Festa dos 160 anos — 31/10/2026, sábado, 11h
Lista de compra
...
```

Sem preço está certo (é lista, não orçamento). E confirmando o que a Fatia 5 já tinha decidido:
**não arredonde para barril** — 92,5 L sai como 92,5 L; quantos barris comprar é decisão do
organizador com o fornecedor, e embutir isso escondia uma regra de negócio num texto.

**P3 — grupo com mais de um anfitrião aparece nos dois filtros: aprovado.** É a leitura certa —
"quem o Bruno chamou" inclui quem ele chamou junto com outro. Uma nota para não confundir depois: o
filtro é **lente**, não contabilidade. Quem paga o quê está em Contas, onde o mesmo convidado vale
meia unidade para cada um. Então não mostre nessa aba nenhum total por aniversariante que possa ser
lido como "a conta do Bruno".

## Nit (opcional)
A busca por "nome ou contato" poderia varrer também o **nome dos acompanhantes** — "o Léo vem?" é
uma pergunta natural, e o nome já aparece no card expandido. Se for barato, entra; se não, fica.

## Verificação
Cobre o que importa. Some os dois casos acima (DDD 55 e a preservação de busca/filtro após excluir)
e mantenha a prova da **Rosaura intacta** ao fim.

Pode `executa`.
