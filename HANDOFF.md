# 🎉 Handoff — Site de Aniversário

> Documento para retomar o projeto em outra máquina.
> Última atualização: 2026-07-25.

## O que é este projeto

Site de **convite de aniversário** para **3 aniversariantes**, com:
- Carrossel de fotos (o organizador sobe pelo painel)
- Contagem regressiva para a festa
- **RSVP (confirmação de presença)**: o convidado marca qual(is) aniversariante(s) o
  convidou (múltipla escolha), adiciona acompanhantes (esposa/marido/filhos) e informa,
  por pessoa, as **bebidas** (Água, Refrigerante, Chopp) e **comidas** (Pizza, Sobremesa)
- **Painel do organizador** protegido por senha: totais, lista de confirmações e gestão de fotos

Site **estático** (HTML/CSS/JS puro, sem build). Sem framework, sem passo de compilação.

## Stack

| Parte | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JS puro (fontes Google: Fraunces + Inter) |
| Banco de dados | Supabase (Postgres) |
| Upload de fotos | Supabase Storage (bucket `fotos`, público) |
| Login do admin | Supabase Auth (e-mail/senha) |
| Hospedagem | **GitHub Pages** (deploy automático a cada push na `main`) |

## Estado atual

- ✅ Código completo e commitado.
- ✅ Repositório público: https://github.com/CarvalhoCoutoBruno/site-aniversario
- ✅ **Site no ar** (deploy automático): https://carvalhocoutobruno.github.io/site-aniversario/
  - Toda alteração enviada com `git push` na `main` atualiza o site sozinho (1-2 min).
- ✅ Verificado ao vivo: hero, contagem regressiva, aniversariantes, carrossel (estado vazio) e formulário renderizando corretamente.
- ⏳ **Rodando em "modo teste"**: como o Supabase ainda não foi configurado, o carrossel
  mostra o estado vazio e o formulário exibe sucesso **sem salvar de verdade**.

## O que falta fazer (próximos passos)

### 1) Preencher os dados reais da festa — `js/config.js`
Editar (ainda estão com placeholders):
- `festa.titulo`, `festa.subtitulo`
- `festa.data` (formato `AAAA-MM-DDTHH:MM:SS`) e `festa.dataTexto`
- `festa.local` e `festa.localMapa` (link do Google Maps)
- `aniversariantes` → os **3 nomes reais**

### 2) Criar o projeto Supabase (só o dono pode — envolve login)
1. https://supabase.com → **New project** (região South America / São Paulo).
2. **SQL Editor** → colar o conteúdo de `supabase-setup.sql` → **Run**
   (cria a tabela `rsvps`, as regras RLS e o bucket `fotos`).
3. **Authentication → Users → Add user** → criar e-mail/senha do admin (marcar *Auto Confirm*).
4. **Project Settings → API** → copiar **Project URL** e **chave anon public**.

### 3) Conectar o site ao Supabase — `js/config.js`
Preencher em `supabase`:
```js
supabase: {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "eyJ...chave-anon...",
  bucketFotos: "fotos",
}
```
> A chave `anon` é feita para ser pública (a segurança real está nas regras RLS).
> Pode ficar no repositório público sem problema.

### 4) `git push` → o site atualiza sozinho. Depois:
- Abrir `.../admin.html`, logar e **subir as fotos** do carrossel.
- Testar uma confirmação de ponta a ponta (deve aparecer no painel).

## Mapa dos arquivos

```
site-aniversario/
├── index.html          → convite (carrossel + contagem + formulário RSVP)
├── admin.html          → painel do organizador (login por senha)
├── css/style.css       → visual (tema claro/escuro)
├── js/config.js        → ⚙️ EDITAR AQUI: dados da festa + chaves do Supabase
├── js/main.js          → lógica do convite (carrossel, RSVP, confete)
├── js/admin.js         → lógica do painel (auth, totais, tabela, upload)
├── supabase-setup.sql  → cria banco + RLS + bucket (rodar 1x no Supabase)
├── README.md           → passo a passo completo
└── HANDOFF.md          → este documento
```

## Notas úteis

- **Não** existe backend próprio: o frontend fala direto com o Supabase (client `anon`).
- Segurança das confirmações: RLS permite `insert` para qualquer visitante, mas `select`/`delete`
  só para o admin autenticado (ver `supabase-setup.sql`).
- O PAN/dados sensíveis não se aplicam aqui — é só um convite de festa.
- `.claude/` está no `.gitignore` (config local de preview, não versionar).
