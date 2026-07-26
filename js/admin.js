/* =============================================================
   SITE DE ANIVERSÁRIO — painel do organizador
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const temSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (!temSupabase || !window.supabase) {
    $("#loginBox").innerHTML =
      '<h1>Configuração pendente</h1><p>Cole a URL e a chave do Supabase em <code>js/config.js</code> para usar o painel.</p><p style="text-align:center"><a href="index.html">← Voltar</a></p>';
    return;
  }
  const sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);

  /* ================= LOGIN ================= */
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#loginMsg");
    msg.className = "msg-toast"; msg.textContent = "Entrando...";
    const { error } = await sb.auth.signInWithPassword({
      email: $("#email").value.trim(),
      password: $("#senha").value,
    });
    if (error) { msg.className = "msg-toast err"; msg.textContent = "E-mail ou senha incorretos."; return; }
    mostrarPainel();
  });

  $("#btnSair").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  $("#btnAtualizar").addEventListener("click", () => { carregarRSVPs(); carregarFotos(); });

  // já logado?
  sb.auth.getSession().then(({ data }) => { if (data.session) mostrarPainel(); });

  function mostrarPainel() {
    $("#loginBox").hidden = true;
    $("#painel").hidden = false;
    carregarRSVPs();
    carregarFotos();
    prepararUpload();
  }

  /* ================= CONFIRMAÇÕES ================= */
  async function carregarRSVPs() {
    const { data, error } = await sb.from("rsvps").select("*").order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    render(data || []);
  }

  function render(rows) {
    // estatísticas
    let totalPessoas = 0;
    const cont = { bebidas: {}, comidas: {}, aniversariantes: {} };
    C.bebidas.forEach((b) => (cont.bebidas[b] = 0));
    C.comidas.forEach((c) => (cont.comidas[c] = 0));
    C.aniversariantes.forEach((a) => (cont.aniversariantes[a] = 0));

    rows.forEach((r) => {
      const pessoas = Array.isArray(r.pessoas) ? r.pessoas : [];
      totalPessoas += pessoas.length || r.total_pessoas || 0;
      (r.aniversariantes || []).forEach((a) => { cont.aniversariantes[a] = (cont.aniversariantes[a] || 0) + 1; });
      pessoas.forEach((p) => {
        (p.bebidas || []).forEach((b) => { cont.bebidas[b] = (cont.bebidas[b] || 0) + 1; });
        (p.comidas || []).forEach((c) => { cont.comidas[c] = (cont.comidas[c] || 0) + 1; });
      });
    });

    const stats = [
      { n: rows.length, l: "Confirmações" },
      { n: totalPessoas, l: "Total de pessoas" },
      ...Object.entries(cont.bebidas).map(([k, v]) => ({ n: v, l: k })),
      ...Object.entries(cont.comidas).map(([k, v]) => ({ n: v, l: k })),
    ];
    $("#stats").innerHTML = stats.map((s) => `<div class="stat"><b>${s.n}</b><span>${esc(s.l)}</span></div>`).join("");

    // tabela
    const body = $("#tabelaBody");
    $("#tabelaVazia").hidden = rows.length > 0;
    body.innerHTML = rows.map((r) => {
      const pessoas = Array.isArray(r.pessoas) ? r.pessoas : [];
      const pessoasHTML = pessoas.map((p) =>
        `<div><b>${esc(p.nome)}</b> <small>(${esc(p.relacao || "")})</small></div>`).join("");
      const prefsHTML = pessoas.map((p) => {
        const t = [...(p.bebidas || []), ...(p.comidas || [])];
        return `<div>${esc(p.nome)}: ${t.length ? t.map((x) => `<span class="pill">${esc(x)}</span>`).join("") : "<small>—</small>"}</div>`;
      }).join("");
      const anivHTML = (r.aniversariantes || []).map((a) => `<span class="pill">${esc(a)}</span>`).join("");
      return `<tr>
        <td>${fmtData(r.created_at)}</td>
        <td><b>${esc(r.responsavel)}</b>${r.contato ? `<br><small>${esc(r.contato)}</small>` : ""}</td>
        <td>${anivHTML}</td>
        <td>${pessoasHTML}</td>
        <td>${prefsHTML}</td>
        <td>${r.mensagem ? esc(r.mensagem) : "<small>—</small>"}</td>
        <td><button class="p-remover" data-id="${r.id}" title="Apagar">✕</button></td>
      </tr>`;
    }).join("");

    $$(".p-remover", body).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Apagar esta confirmação?")) return;
      const { error } = await sb.from("rsvps").delete().eq("id", b.dataset.id);
      if (error) alert("Erro ao apagar."); else carregarRSVPs();
    }));
  }

  /* ================= FOTOS ================= */
  async function carregarFotos() {
    const grid = $("#fotosGrid");
    const { data, error } = await sb.storage.from(C.supabase.bucketFotos).list("", { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error) { console.error(error); return; }
    const fotos = (data || []).filter((f) => f.name && !f.name.startsWith(".") && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!fotos.length) { grid.innerHTML = '<p class="vazio">Nenhuma foto ainda.</p>'; return; }
    grid.innerHTML = fotos.map((f) => {
      const url = sb.storage.from(C.supabase.bucketFotos).getPublicUrl(f.name).data.publicUrl;
      return `<div class="foto-item"><img src="${esc(url)}" alt=""><button data-nome="${esc(f.name)}" title="Apagar">✕</button></div>`;
    }).join("");
    $$(".foto-item button", grid).forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Apagar esta foto?")) return;
      const { error } = await sb.storage.from(C.supabase.bucketFotos).remove([b.dataset.nome]);
      if (error) alert("Erro ao apagar foto."); else carregarFotos();
    }));
  }

  function prepararUpload() {
    const drop = $("#uploadDrop");
    const input = $("#fileInput");
    input.addEventListener("change", () => enviarFotos(input.files));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => enviarFotos(e.dataTransfer.files));
  }

  async function enviarFotos(files) {
    const msg = $("#fotoMsg");
    const arr = [...files].filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    msg.className = "msg-toast"; msg.textContent = `Enviando ${arr.length} foto(s)...`;
    let ok = 0;
    for (const file of arr) {
      const nome = `${Date.now()}_${limparNome(file.name)}`;
      const { error } = await sb.storage.from(C.supabase.bucketFotos).upload(nome, file, { cacheControl: "3600", upsert: false });
      if (error) console.error(error); else ok++;
    }
    msg.className = "msg-toast ok"; msg.textContent = `${ok} foto(s) enviada(s)!`;
    $("#fileInput").value = "";
    carregarFotos();
  }

  /* ================= HELPERS ================= */
  function limparNome(n) {
    return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  function fmtData(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
             d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
