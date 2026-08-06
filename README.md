# 🎉 Site de Aniversário

Convite de festa para **3 aniversariantes**, com carrossel de fotos, contagem regressiva,
confirmação de presença (RSVP) e um painel de organizador que fecha o ciclo do dinheiro:
estimativa de compra, rateio do custo real e o acerto entre os três.

**Site estático** — HTML, CSS e JS puro. Sem framework, sem passo de build.

| Parte | Onde |
|---|---|
| Hospedagem | **GitHub Pages** — deploy automático a cada `git push` na `main` (1-2 min) |
| Banco, fotos e login | **Supabase** (Postgres + Storage + Auth) |

---

## 📁 Estrutura

```
site-aniversario/
├── index.html          → o convite (página do convidado)
├── admin.html          → painel do organizador (login por senha)
├── css/style.css       → visual (tema claro/escuro)
├── js/
│   ├── config.js       → ⚙️ dados da festa + chaves do Supabase
│   ├── calc.js      → cálculos puros: estimativa, rateio e acerto
│   ├── main.js         → lógica do convite
│   └── admin.js        → lógica do painel
├── tests/              → testes do cálculo (sem framework)
├── supabase-setup.sql  → cria todo o schema (fonte da verdade)
├── verify.sh           → a verificação do projeto
└── docs/               → regras de negócio e especificação técnica
```

---

## 🚀 Do zero ao ar

### 1) Criar o banco no Supabase

1. **https://supabase.com** → *New project*, região **South America (São Paulo)**.
2. **Authentication → Users → Add user** para cada organizador (marque *Auto Confirm User*).
   Copie o **UID** de cada um.
3. Abra o `supabase-setup.sql` e ajuste o `insert into public.admins` com esses UIDs
   (os quatro atuais já estão lá; o template para incluir mais está logo abaixo).
4. **SQL Editor → New query** → cole o arquivo inteiro → **Run**.
5. **Authentication → Sign In / Providers → Email** → desligue *Allow new users to sign up*.

> O `supabase-setup.sql` **recria** o schema, e traz uma trava: ele se recusa a rodar se já
> houver confirmações ou se a `config` tiver dado real (preços, prazo, custo lançado).

### 2) Conectar o site

Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**, e cole em
`js/config.js`. A chave anon é pública por natureza — pode ficar no repositório, porque a
segurança está nas regras de acesso (RLS) do banco.

No mesmo arquivo ficam os dados da festa: título, data, local, link do mapa e os 3 nomes.

> ⚠️ A **ordem** dos nomes em `aniversariantes` é o identificador deles no banco. Renomear é
> seguro; **reordenar ou remover** depois que houver confirmação salva troca o dono dos registros.

### 3) Publicar

```bash
git push origin main
```

O GitHub Pages atualiza sozinho em 1-2 minutos. Não há upload manual.

### 4) Subir as fotos

Abra `.../admin.html`, entre com o e-mail e senha do passo 1, e arraste as fotos na seção
**Fotos do carrossel**. Elas aparecem no convite na hora.

---

## ✅ Como funciona para o convidado

1. Abre o link, vê o convite, a contagem regressiva e as fotos.
2. Informa nome e contato, e marca **quem o convidou** (um ou mais aniversariantes).
3. Adiciona acompanhantes — até 5 — dizendo, para cada pessoa, se é adulto ou criança e o que
   consome: água, refrigerante, chopp e pizza. *(Chopp não é liberado para criança.)*
4. Envia. Se confirmar de novo com o mesmo contato, a confirmação anterior é **substituída**.

Se o organizador definir um prazo, o convite mostra a data e, depois dela, fecha o formulário.

---

## 🧮 Como funciona para o organizador

O painel tem cinco seções, na ordem em que se usam:

| Seção | Para quê |
|---|---|
| **Preços, taxas e prazo** | quanto custa cada item, quanto se estima que cada pessoa consome, e até quando dá para confirmar |
| **Aniversariantes** | o que cada um dos 3 consome — eles entram nas contas como qualquer pessoa |
| **Estimativa de compra** | litros de chopp/refri/água e quantas pizzas, para passar ao fornecedor |
| **Fechamento e rateio** | lançar o custo real gasto → as 3 contas, uma por aniversariante |
| **Confirmações** | a lista de quem vem, com as preferências de cada um |

**Quem paga são os 3 aniversariantes.** Convidado não paga nada: o consumo dele é bancado por
quem o convidou, dividido igualmente quando foi mais de um. Depois de lançar o custo real e
marcar quem pagou cada item, o painel calcula o **acerto** — quem transfere quanto para quem — e
gera um resumo para mandar no grupo.

Os detalhes do modelo estão em [docs/REGRAS-NEGOCIO.md](docs/REGRAS-NEGOCIO.md).

---

## 🔒 Sobre segurança

- Qualquer visitante **pode confirmar** presença, mas só pela função `criar_rsvp`, que valida
  tudo antes de gravar. Não há escrita direta nas tabelas.
- **Ler** confirmações, preços e contas é só para quem está na tabela `admins`.
- O cadastro público no Supabase Auth fica **desligado**: contas de organizador são criadas à mão.
- A chave `service_role` **nunca** entra no repositório.

---

## 🧪 Verificar antes de publicar

```bash
./verify.sh
```

Confere a sintaxe dos arquivos JS, roda os testes de cálculo e procura credencial vazada. É uma
verificação **estática**: não prova que o formulário grava nem que o painel funciona — para isso
é preciso abrir o site e conferir o resultado no banco.
