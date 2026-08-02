/* =============================================================
   SITE DE ANIVERSÁRIO — lógica da página do convidado
   ============================================================= */
(function () {
  const C = window.CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Precisa ficar AQUI, no topo: uid() é chamado durante a montagem do
  // primeiro card, que roda antes do fim do arquivo. Declarado lá
  // embaixo com `let`, cai na zona morta temporal e derruba o script.
  let _n = 0;
  const uid = (p) => p + _n++;

  // ---- Supabase (opcional: site funciona mesmo sem chaves) ----
  let sb = null;
  const temSupabase = C.supabase.url && !C.supabase.url.includes("COLE_");
  if (temSupabase && window.supabase) {
    sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
  }

  /* ================= DADOS DA FESTA ================= */
  $("#festaTitulo").textContent = C.festa.titulo;
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

  /* ================= PRAZO DE CONFIRMAÇÃO =================
     status_rsvp() é a única leitura que o visitante anônimo tem.
     Se der erro de rede, deixa o formulário aberto: o RPC rejeita de
     qualquer jeito, e é melhor errar para o lado de deixar tentar. */
  async function checarPrazo() {
    if (!sb) return;
    try {
      const { data, error } = await sb.rpc("status_rsvp");
      if (error) return console.warn("status_rsvp:", error);
      const st = Array.isArray(data) ? data[0] : data;
      if (!st) return;
      if (st.aberto === false) fecharFormulario(st.prazo);
      else if (st.prazo) avisarPrazo(st.prazo);
    } catch (e) {
      console.warn("Falha ao checar o prazo:", e);
    }
  }

  // Aberto mas com data marcada: sem isto o convidado não vê prazo
  // nenhum, e o prazo perde justamente a urgência que o justifica.
  function avisarPrazo(prazo) {
    const d = new Date(prazo);
    if (isNaN(d)) return;
    const el = $("#prazoAberto");
    el.textContent = `⏳ Confirme até ${d.toLocaleDateString("pt-BR")}.`;
    el.hidden = false;
  }

  function fecharFormulario(prazo) {
    $("#rsvpForm").hidden = true;
    const aviso = $("#rsvpEncerrado");
    if (prazo) {
      const d = new Date(prazo);
      if (!isNaN(d)) {
        $("#rsvpEncerradoTexto").textContent =
          `O prazo para confirmar presença terminou em ${d.toLocaleDateString("pt-BR")}.`;
      }
    }
    aviso.hidden = false;
  }
  checarPrazo();

  /* ================= CHIPS ANIVERSARIANTES =================
     O value é o ID (índice + 1), nunca o nome: é o que o banco grava
     em convidado_por e o que liga o convidado ao aniversariante que
     banca o consumo dele. Renomear no config não quebra registro. */
  $("#chipsAniversariantes").innerHTML = C.aniversariantes
    .map((nome, i) => `<label class="chip">
        <input type="checkbox" class="aniv-check" value="${i + 1}" />
        <span>${esc(nome)}</span>
      </label>`)
    .join("");
  ativarChips($("#chipsAniversariantes"));

  /* ================= PESSOAS (responsável + acompanhantes) ================= */
  const MAX_ACOMPANHANTES = 5;
  const lista = $("#pessoasLista");
  const tpl = $("#tplPessoa");

  function novoCard(ehResponsavel) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.papel = ehResponsavel ? "principal" : "acompanhante";

    if (ehResponsavel) {
      node.classList.add("responsavel");
      node.querySelector(".p-nome").placeholder = "Seu nome (mesmo acima)";
      node.querySelector(".p-remover").remove();
    }

    const sel = node.querySelector(".p-relacao");
    if (ehResponsavel) {
      sel.innerHTML = `<option value="Responsável">Eu (responsável)</option>`;
      sel.disabled = true;
    } else {
      sel.innerHTML = C.relacoes.map((r) => `<option>${esc(r)}</option>`).join("");
    }

    // rádios de tipo precisam de name único por card, senão viram um
    // grupo só e marcar "criança" num card desmarca o outro
    const grupo = uid("tipo");
    $$(".p-tipo input", node).forEach((r) => (r.name = grupo));

    ativarChips(node);
    ligarRegraChopp(node);

    const rem = node.querySelector(".p-remover");
    if (rem) rem.addEventListener("click", () => { node.remove(); atualizarBotaoAdd(); });
    return node;
  }

  /* Chopp é bloqueado para criança — mesma regra da constraint do
     banco. A tela desmarca e desabilita na hora, para o convidado
     entender antes de enviar em vez de tomar erro do servidor. */
  function ligarRegraChopp(card) {
    const chopp = card.querySelector('[data-bebida="bebe_chopp"]');
    const chipChopp = card.querySelector(".p-chip-chopp");
    const aviso = card.querySelector(".p-aviso-chopp");

    function aplicar() {
      const ehCrianca = card.querySelector('.p-tipo input[value="crianca"]').checked;
      chopp.disabled = ehCrianca;
      chipChopp.classList.toggle("desabilitado", ehCrianca);
      aviso.hidden = !ehCrianca;
      if (ehCrianca && chopp.checked) {
        chopp.checked = false;
        chipChopp.classList.remove("marcado");
      }
    }
    $$(".p-tipo input", card).forEach((r) => r.addEventListener("change", aplicar));
    aplicar();
  }

  function contarAcompanhantes() {
    return $$(".pessoa-card", lista).length - 1;
  }

  // Numera os cards para quem adiciona 4 ou 5 pessoas se localizar.
  // Roda de novo a cada remoção, senão sobra buraco na sequência.
  function renumerarCards() {
    $$(".pessoa-card", lista).forEach((card, i) => {
      card.querySelector(".pessoa-rotulo").textContent =
        i === 0 ? "Você" : `Acompanhante ${i}`;
    });
  }

  function atualizarBotaoAdd() {
    const cheio = contarAcompanhantes() >= MAX_ACOMPANHANTES;
    $("#addPessoa").hidden = cheio;
    $("#limiteAcompanhantes").hidden = !cheio;
    renumerarCards();
  }

  // primeiro card = responsável, com o nome espelhando o campo de cima
  const cardResp = novoCard(true);
  lista.appendChild(cardResp);
  const nomeResp = cardResp.querySelector(".p-nome");
  $("#responsavel").addEventListener("input", (e) => { nomeResp.value = e.target.value; });

  $("#addPessoa").addEventListener("click", () => {
    if (contarAcompanhantes() >= MAX_ACOMPANHANTES) return;
    lista.appendChild(novoCard(false));
    atualizarBotaoAdd();
  });
  atualizarBotaoAdd();

  /* ================= LIMITE DO RECADO =================
     A tabela tem CHECK (observacoes <= 500). Sem limite no cliente, o
     convidado só descobre ao enviar, e o erro chega como violação de
     constraint — que o mensagemDeErro degrada para o genérico. */
  const MAX_OBS = 500;
  const AVISA_OBS = 450;
  const campoMensagem = $("#mensagem");
  const contador = $("#contadorMensagem");

  campoMensagem.addEventListener("input", () => {
    const n = campoMensagem.value.length;
    contador.hidden = n < AVISA_OBS;
    contador.textContent = `${n}/${MAX_OBS} caracteres`;
    contador.classList.toggle("no-limite", n >= MAX_OBS);
  });

  /* ================= ENVIO ================= */
  function lerPessoa(card, indice) {
    const nome = card.querySelector(".p-nome").value.trim();
    const ehResponsavel = card.dataset.papel === "principal";
    const p = {
      // Nome de acompanhante é OPCIONAL e a pessoa entra mesmo sem ele.
      // Descartar quem não tem nome (como o formulário antigo fazia)
      // some com um consumidor e desequilibra o rateio.
      nome: nome || (ehResponsavel ? "" : null),
      tipo: card.querySelector('.p-tipo input[value="crianca"]').checked ? "crianca" : "adulto",
      papel: ehResponsavel ? "principal" : "acompanhante",
      bebe_agua: false, bebe_refri: false, bebe_chopp: false, come_pizza: false,
    };
    $$(".p-bebidas input:checked", card).forEach((i) => { p[i.dataset.bebida] = true; });
    $$(".p-comida input:checked", card).forEach((i) => { p[i.dataset.comida] = true; });
    if (p.tipo === "crianca") p.bebe_chopp = false; // cinto e suspensório
    return p;
  }

  $("#rsvpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#formStatus");
    const btn = $("#btnEnviar");
    status.className = "form-status";
    status.textContent = "";

    const responsavel = $("#responsavel").value.trim();
    const contato = $("#contato").value.trim();
    const mensagem = $("#mensagem").value.trim();
    const convidadoPor = $$(".aniv-check:checked", $("#chipsAniversariantes"))
      .map((i) => Number(i.value));

    if (!responsavel) return falha(status, "Por favor, coloque seu nome.");
    if (!contato) return falha(status, "Precisamos de um WhatsApp ou e-mail para falar com você.");
    if (!convidadoPor.length) return falha(status, "Escolha quem te convidou.");
    // o maxlength do textarea não impede colar por script
    if (mensagem.length > MAX_OBS) {
      return falha(status, `O recado passou de ${MAX_OBS} caracteres (tem ${mensagem.length}). Encurte um pouco.`);
    }

    const cards = $$(".pessoa-card", lista);
    const pessoas = cards.map(lerPessoa);
    pessoas[0].nome = responsavel; // o principal sempre leva o nome de cima

    if (!sb) {
      console.log("RSVP (sem Supabase configurado):", { responsavel, contato, convidadoPor, pessoas, mensagem });
      return falha(status, "O site ainda não está conectado ao banco. Avise o organizador.");
    }

    btn.disabled = true;
    btn.textContent = "Enviando...";

    const { error } = await sb.rpc("criar_rsvp", {
      p_nome_principal: responsavel,
      p_contato: contato,
      p_convidado_por: convidadoPor,
      p_observacoes: mensagem || null,
      p_pessoas: pessoas,
    });

    if (error) {
      // Erro de verdade: o formulário antigo fingia sucesso, e o
      // convidado ia embora achando que tinha confirmado.
      console.error(error);
      btn.disabled = false;
      btn.textContent = "Confirmar presença 🎉";
      return falha(status, mensagemDeErro(error));
    }

    // sucesso: o botão NÃO volta a habilitar
    btn.textContent = "Confirmado!";
    sucesso();
  });

  // As exceptions do criar_rsvp já são escritas para o convidado ler.
  function mensagemDeErro(error) {
    const m = (error && (error.message || error.hint)) || "";
    if (/confirma[çc][õo]es foram encerradas/i.test(m)) return m;
    if (/Informe|Escolha|O grupo precisa/i.test(m)) return m;
    if (/chopp_nao_para_crianca/.test(m)) return "Chopp não é liberado para criança.";
    if (/violates|constraint/i.test(m)) return "Alguma informação ficou inválida. Confira e tente de novo.";
    return "Não conseguimos salvar sua confirmação. Tente de novo em instantes.";
  }

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
  function ativarChips(root) {
    $$(".chip input", root).forEach((inp) => {
      inp.addEventListener("change", () => {
        // rádio: marcar um desmarca os irmãos do mesmo grupo
        if (inp.type === "radio" && inp.name) {
          $$(`input[name="${inp.name}"]`, root.ownerDocument || document).forEach((outro) => {
            const chip = outro.closest(".chip");
            if (chip) chip.classList.toggle("marcado", outro.checked);
          });
          return;
        }
        inp.closest(".chip").classList.toggle("marcado", inp.checked);
      });
    });
  }
  function falha(el, msg) { el.className = "form-status err"; el.textContent = msg; el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

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
