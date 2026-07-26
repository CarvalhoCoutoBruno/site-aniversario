# 🎉 Site de Aniversário

Convite de festa com carrossel de fotos, confirmação de presença (RSVP) com
acompanhantes e preferências (bebidas e comidas), escolha de qual dos 3
aniversariantes convidou, e um **painel de administração** protegido por senha
para ver todas as confirmações, os totais e gerenciar as fotos.

Tudo **grátis** e **sem cartão de crédito**: Supabase (banco + fotos) + Netlify (hospedagem).

---

## 📁 O que tem aqui

```
site-aniversario/
├── index.html          → o convite (página do convidado)
├── admin.html          → painel do organizador (login por senha)
├── css/style.css       → visual
├── js/config.js        → ⚙️ VOCÊ EDITA AQUI (nomes, data, chaves)
├── js/main.js          → lógica do convite
├── js/admin.js         → lógica do painel
└── supabase-setup.sql  → cria o banco (rodar 1 vez)
```

---

## 🚀 Passo a passo (uns 15 min)

### 1) Criar o banco no Supabase (grátis)

1. Acesse **https://supabase.com** e crie uma conta (pode entrar com o GitHub/Google).
2. Clique em **New project**. Dê um nome, crie uma senha do banco e escolha a região
   **South America (São Paulo)**. Aguarde ~2 min.
3. No menu lateral, vá em **SQL Editor → New query**.
4. Abra o arquivo `supabase-setup.sql`, **copie tudo**, cole ali e clique em **Run**.
   Isso cria a tabela de confirmações e o espaço para as fotos.

### 2) Pegar as chaves

1. No Supabase, vá em **Project Settings (engrenagem) → API**.
2. Copie o **Project URL** e a chave **anon public**.
3. Abra `js/config.js` e cole nos campos:
   ```js
   supabase: {
     url: "https://SEU-PROJETO.supabase.co",
     anonKey: "eyJ...sua-chave-anon...",
     bucketFotos: "fotos",
   }
   ```

### 3) Criar o seu login de organizador

1. No Supabase, vá em **Authentication → Users → Add user → Create new user**.
2. Coloque seu **e-mail** e uma **senha** e marque **Auto Confirm User**.
3. Esse e-mail/senha é o que você vai usar em `admin.html` para entrar no painel.

### 4) Personalizar a festa

Ainda no `js/config.js`, edite:

- `festa` → título, subtítulo, **data/hora**, texto da data, local e link do mapa.
- `aniversariantes` → os **3 nomes**.
- `bebidas` / `comidas` → as opções (já vem com Água, Refrigerante, Chopp, Pizza, Sobremesa).

### 5) Publicar no Netlify (grátis)

1. Acesse **https://app.netlify.com/drop**.
2. **Arraste a pasta `site-aniversario` inteira** para a área indicada.
3. Pronto! O Netlify te dá um link (ex: `https://seu-site.netlify.app`).
   Esse é o link que você manda para os convidados.

> Para trocar algo depois, edite os arquivos e arraste a pasta de novo
> (ou conecte um repositório do GitHub para atualizar automático).

### 6) Subir as fotos

1. Abra `https://seu-site.netlify.app/admin.html`.
2. Entre com o e-mail/senha do passo 3.
3. Na seção **Fotos do carrossel**, arraste as fotos. Elas aparecem no convite na hora. 📸

---

## ✅ Como funciona para o convidado

1. Abre o link, vê o convite, a contagem regressiva e o carrossel de fotos.
2. Clica em **Confirmar presença**.
3. Coloca o nome, marca **quem o convidou** (um ou mais aniversariantes).
4. Marca as próprias preferências e clica em **+ Adicionar acompanhante**
   para incluir esposa/marido/filhos, cada um com bebidas e comidas.
5. Envia → cai direto no seu painel.

---

## 🧪 Testar antes de configurar

Você pode abrir o `index.html` no navegador **antes** de configurar o Supabase.
Ele funciona em "modo teste": o formulário mostra a confirmação de sucesso, mas
os dados só ficam salvos de verdade depois que você colar as chaves do Supabase.

---

## 🔒 Sobre segurança

- Qualquer visitante **pode confirmar** presença, mas **só você** (logado no admin)
  consegue **ver, apagar** confirmações e **subir/apagar** fotos.
- Isso é garantido pelas regras (RLS) criadas pelo `supabase-setup.sql`.
