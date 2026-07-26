/* =============================================================
   SITE DE ANIVERSÁRIO — lógica da página do convidado
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Supabase (opcional: site funciona mesmo sem chaves) ----
  let sb = null;
  const temSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (temSupabase && window.supabase) {
    sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
  }

  /* ================= DADOS DA FESTA ================= */
  $("#festaTitulo").textContent = C.festa.titulo;
  $("#festaSubtitulo").textContent = C.festa.subtitulo;
  $("#festaData").textContent = C.festa.dataTexto;
  const localEl = $("#festaLocal");
  localEl.textContent = C.festa.local;
  if (C.festa.localMapa) localEl.href = C.festa.localMapa;
  else localEl.removeAttribute("href");

  $("#heroNomes").innerHTML = C.aniversariantes.map((n) => `<li>${esc(n)}</li>`).join("");

  /* ================= COUNTDOWN ================= */
  const alvo = new Date(C.festa.data).getTime();
  function tick() {
    const diff = alvo - Date.now();
    if (isNaN(alvo)) { $("#countdown").style.display = "none"; return; }
    const d = Math.max(0, diff);
    const dias = Math.floor(d / 864e5);
    const horas = Math.floor((d % 864e5) / 36e5);
    const min = Math.floor((d % 36e5) / 6e4);
    const seg = Math.floor((d % 6e4) / 1e3);
    $("#cdDias").textContent = dias;
    $("#cdHoras").textContent = horas;
    $("#cdMin").textContent = min;
    $("#cdSeg").textContent = seg;
  }
  tick(); setInterval(tick, 1000);

  /* ================= CARROSSEL ================= */
  const track = $("#carrosselTrack");
  const dotsWrap = $("#carDots");
  let slides = [];
  let idx = 0;
  let auto = null;

  async function carregarFotos() {
    let urls = [];
    if (sb) {
      try {
        const { data, error } = await sb.storage.from(C.supabase.bucketFotos).list("", {
          limit: 100, sortBy: { column: "name", order: "asc" },
        });
        if (!error && data) {
          urls = data
            .filter((f) => f.name && !f.name.startsWith(".") && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))
            .map((f) => sb.storage.from(C.supabase.bucketFotos).getPublicUrl(f.name).data.publicUrl);
        }
      } catch (e) { console.warn("Falha ao carregar fotos:", e); }
    }
    montarCarrossel(urls);
  }

  function montarCarrossel(urls) {
    if (!urls.length) {
      $("#carrossel").style.display = "none";
      $("#carrosselVazio").hidden = false;
      return;
    }
    $("#carrossel").style.display = "";
    $("#carrosselVazio").hidden = true;
    track.innerHTML = urls.map((u) => `<div class="slide"><img src="${esc(u)}" alt="Foto da festa" loading="lazy"></div>`).join("");
    dotsWrap.innerHTML = urls.map((_, i) => `<button aria-label="Foto ${i + 1}"></button>`).join("");
    slides = $$(".slide", track);
    idx = 0;
    atualizar();
    $$("button", dotsWrap).forEach((b, i) => b.addEventListener("click", () => { ir(i); reiniciarAuto(); }));
    reiniciarAuto();
  }

  function atualizar() {
    track.style.transform = `translateX(-${idx * 100}%)`;
    $$("button", dotsWrap).forEach((b, i) => b.classList.toggle("ativo", i === idx));
  }
  function ir(i) { idx = (i + slides.length) % slides.length; atualizar(); }
  function reiniciarAuto() {
    clearInterval(auto);
    if (slides.length > 1) auto = setInterval(() => ir(idx + 1), 4000);
  }
  $("#carPrev").addEventListener("click", () => { ir(idx - 1); reiniciarAuto(); });
  $("#carNext").addEventListener("click", () => { ir(idx + 1); reiniciarAuto(); });
  carregarFotos();

  /* ================= CHIPS ANIVERSARIANTES ================= */
  $("#chipsAniversariantes").innerHTML = C.aniversariantes
    .map((n, i) => chipHTML("aniv", `aniv_${i}`, n))
    .join("");
  ativarChips($("#chipsAniversariantes"));

  /* ================= PESSOAS (responsável + acompanhantes) ================= */
  const lista = $("#pessoasLista");
  const tpl = $("#tplPessoa");

  function novoCard(ehResponsavel) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    if (ehResponsavel) {
      node.classList.add("responsavel");
      node.querySelector(".p-nome").placeholder = "Seu nome (mesmo acima)";
      node.querySelector(".p-remover").remove();
    }
    // relação
    const sel = node.querySelector(".p-relacao");
    if (ehResponsavel) {
      sel.innerHTML = `<option value="Responsável">Eu (responsável)</option>`;
      sel.disabled = true;
    } else {
      sel.innerHTML = C.relacoes.map((r) => `<option>${esc(r)}</option>`).join("");
    }
    // bebidas + comidas
    node.querySelector(".p-bebidas").innerHTML = C.bebidas.map((b, i) => chipHTML("beb", uid("b"), b)).join("");
    node.querySelector(".p-comidas").innerHTML = C.comidas.map((c, i) => chipHTML("com", uid("c"), c)).join("");
    ativarChips(node);
    const rem = node.querySelector(".p-remover");
    if (rem) rem.addEventListener("click", () => node.remove());
    return node;
  }

  // primeiro card = responsável, sincroniza nome com o campo de cima
  const cardResp = novoCard(true);
  lista.appendChild(cardResp);
  const nomeResp = cardResp.querySelector(".p-nome");
  $("#responsavel").addEventListener("input", (e) => { nomeResp.value = e.target.value; });

  $("#addPessoa").addEventListener("click", () => {
    lista.appendChild(novoCard(false));
  });

  /* ================= ENVIO ================= */
  $("#rsvpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#formStatus");
    status.className = "form-status";
    status.textContent = "";

    const responsavel = $("#responsavel").value.trim();
    const contato = $("#contato").value.trim();
    const mensagem = $("#mensagem").value.trim();
    const aniversariantes = valoresMarcados($("#chipsAniversariantes"));

    if (!responsavel) return falha(status, "Por favor, coloque seu nome.");
    if (!aniversariantes.length) return falha(status, "Escolha quem te convidou.");

    // monta pessoas
    const pessoas = $$(".pessoa-card", lista).map((card) => {
      const nome = card.querySelector(".p-nome").value.trim();
      const relacao = card.querySelector(".p-relacao").value;
      const bebidas = valoresMarcados(card.querySelector(".p-bebidas"));
      const comidas = valoresMarcados(card.querySelector(".p-comidas"));
      return { nome, relacao, bebidas, comidas };
    }).filter((p) => p.nome);

    if (!pessoas.length) return falha(status, "Confirme ao menos uma pessoa (você).");

    const registro = {
      responsavel, contato, aniversariantes, pessoas, mensagem,
      total_pessoas: pessoas.length,
    };

    if (!sb) {
      console.log("RSVP (sem Supabase configurado):", registro);
      return sucesso("Confirmação registrada! (modo teste — configure o Supabase para salvar de verdade)");
    }

    const btn = $("#btnEnviar");
    btn.disabled = true; btn.textContent = "Enviando...";
    const { error } = await sb.from("rsvps").insert(registro);
    btn.disabled = false; btn.textContent = "Confirmar presença 🎉";

    if (error) { console.error(error); return falha(status, "Ops, algo deu errado. Tente de novo."); }
    sucesso();
  });

  function sucesso(msg) {
    dispararConfete();
    const sec = $("#confirmar");
    sec.innerHTML = `
      <div class="rsvp-inner sucesso">
        <div class="big">🎉</div>
        <h2>Presença confirmada!</h2>
        <p>${esc(msg || "Obrigado! Já anotamos tudo. Nos vemos na festa. 🥳")}</p>
      </div>`;
    sec.scrollIntoView({ behavior: "smooth" });
  }

  /* ================= HELPERS ================= */
  function chipHTML(grupo, id, valor) {
    return `<label class="chip"><input type="checkbox" data-grupo="${grupo}" value="${esc(valor)}"><span>${esc(valor)}</span></label>`;
  }
  function ativarChips(root) {
    $$(".chip input", root).forEach((inp) => {
      inp.addEventListener("change", () => inp.closest(".chip").classList.toggle("marcado", inp.checked));
    });
  }
  function valoresMarcados(root) {
    return $$(".chip input:checked", root).map((i) => i.value);
  }
  function falha(el, msg) { el.className = "form-status err"; el.textContent = msg; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  let _n = 0; function uid(p) { return p + _n++; }

  function dispararConfete() {
    const wrap = $("#confetti");
    const cores = ["#8b3ffb", "#ff4d8d", "#ffb020", "#17b26a", "#3b82f6"];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("i");
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = cores[i % cores.length];
      c.style.animationDuration = 2 + Math.random() * 2 + "s";
      c.style.animationDelay = Math.random() * 0.5 + "s";
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (Math.random() > 0.5) c.style.borderRadius = "50%";
      wrap.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }
})();
