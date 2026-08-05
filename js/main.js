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

  /* ================= DADOS DO CONVITE =================
     Vêm da tabela `festa` (leitura pública), não mais do config.js.

     ⚠️ Isto passou a ser ASSÍNCRONO. Os chips de "quem te convidou"
     nascem vazios no HTML e são montados aqui; se a festa não carregar,
     eles ficam vazios e o envio é barrado por um campo que o convidado
     não vê na tela — ele preencheria tudo e não conseguiria enviar.
     Por isso a falha esconde o convite inteiro e mostra um aviso, em
     vez de deixar meia tela funcionando.                            */

  let alvo = NaN;          // instante da festa; só existe depois do load
  let cronometro = null;
  let conviteFalhou = false;
  let rsvpFechado = false;
  let festa = null;        // a linha da tabela `festa`, para quem precisa dela depois

  async function carregarFesta() {
    if (!sb) return falhaConvite();
    try {
      const { data, error } = await sb.from("festa").select("*").eq("id", 1).single();
      if (error || !data) {
        console.error("festa:", error);
        return falhaConvite();
      }
      montarConvite(data);
    } catch (e) {
      console.error("festa:", e);
      falhaConvite();
    }
  }

  /* As idades não existem em dado nenhum — nem no config.js antigo, nem
     na tabela festa. Ficam aqui porque esta festa é esta festa; virar
     schema seria fatia à parte.

     ⚠️ A posição amarra idade e nome: IDADES[i] é a idade de
     nomes[i]. Renomear no painel é seguro; REORDENAR desalinha — o
     mesmo risco que a ordem já carrega para o rateio, agora visível no
     convite.

     O total do hero é a SOMA, não um literal: dois números escritos à
     mão podem discordar; uma soma não. */
  const IDADES = [40, 50, 70];

  function montarConvite(f) {
    festa = f;

    // A última palavra do título sai em vermelho. Feito por script e não
    // com <br> fixo porque o título vem do banco e é editável — um corte
    // escrito à mão no HTML quebraria no primeiro título diferente.
    const titulo = String(f.titulo || "");
    const corte = titulo.lastIndexOf(" ");
    $("#festaTitulo").innerHTML = corte > 0
      ? `${esc(titulo.slice(0, corte))} <span class="fim">${esc(titulo.slice(corte + 1))}</span>`
      : esc(titulo);
    document.title = f.titulo;   // melhora o preview do link no WhatsApp

    const sub = $("#festaSubtitulo");
    sub.textContent = f.subtitulo || "";
    sub.hidden = !f.subtitulo;

    // data_texto em branco: gera a partir da data, no fuso de São Paulo
    const dataTexto = f.data_texto || textoDaData(f.data);
    $("#festaData").textContent = dataTexto;

    // a data NÃO é repetida aqui: ela vive no pill do hero
    $("#cardLocal").textContent = f.local;

    const localEl = $("#festaLocal");
    if (f.local_mapa) {
      localEl.href = f.local_mapa;
      localEl.hidden = false;
    } else {
      localEl.removeAttribute("href");
      localEl.hidden = true;   // sem link, o botão do mapa não aparece
    }
    $("#secaoOnde").hidden = false;

    const nomes = [f.nome_aniv_1, f.nome_aniv_2, f.nome_aniv_3];
    const total = IDADES.reduce((a, b) => a + b, 0);
    $("#heroNomes").innerHTML =
      nomes.map((n, i) => `
        <div class="eq-item">
          <b class="eq-num">${IDADES[i]}</b>
          <span class="eq-nome">${esc(n)}</span>
        </div>`).join('<span class="eq-op" aria-hidden="true">+</span>') +
      `<span class="eq-op eq-igual" aria-hidden="true">=</span>
       <div class="eq-item eq-total">
         <b class="eq-num">${total}</b>
         <span class="eq-nome">de festa</span>
       </div>`;

    $("#rodapeFesta").textContent =
      `${f.titulo} · ${nomes.join(", ")} · ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(f.data))}`;

    // O value é o ID (posição), nunca o nome: é o que o banco grava em
    // convidado_por e o que liga o convidado ao aniversariante que
    // banca o consumo dele. Renomear não quebra registro nenhum.
    $("#chipsAniversariantes").innerHTML = nomes
      .map((nome, i) => `<label class="chip">
          <input type="checkbox" class="aniv-check" value="${i + 1}" />
          <span>${esc(nome)}</span>
        </label>`)
      .join("");
    ativarChips($("#chipsAniversariantes"));

    alvo = new Date(f.data).getTime();
    $("#conviteCarregando").hidden = true;
    $("#hero-conteudo").hidden = false;
    tick();
    cronometro = setInterval(tick, 1000);
  }

  // Um estado só para o convite inteiro: sem hero pela metade ao lado
  // de um formulário escondido.
  function falhaConvite() {
    conviteFalhou = true;
    $("#conviteCarregando").hidden = true;
    $("#hero-conteudo").hidden = true;
    // Esconde as SEÇÕES inteiras, não só o conteúdo: com o layout novo
    // cada uma tem título próprio ("Momentos", "Confirmar presença"),
    // que apareceriam sobre o vazio — a mesma incoerência que o
    // fail-loud existe para evitar.
    $("#secaoOnde").hidden = true;
    $("#secaoFotos").hidden = true;
    $("#confirmar").hidden = true;
    $("#carrossel").style.display = "none";
    $("#carrosselVazio").hidden = true;
    $("#rsvpForm").hidden = true;
    $("#rsvpEncerrado").hidden = true;
    // o aviso de prazo pode ter chegado ANTES desta falha: a flag cobre
    // quem resolve depois, e esta limpeza cobre quem já resolveu.
    $("#prazoAberto").hidden = true;
    $("#conviteErro").hidden = false;
  }

  function textoDaData(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const f = (o) => new Intl.DateTimeFormat("pt-BR",
      Object.assign({ timeZone: "America/Sao_Paulo" }, o)).format(d);
    const hora = f({ hour: "2-digit", minute: "2-digit", hour12: false })
      .replace(":00", "h").replace(":", "h");
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    return `${cap(f({ weekday: "long" }))}, ${f({ day: "numeric" })} de ${f({ month: "long" })} de ${f({ year: "numeric" })}, às ${hora}`;
  }

  /* ================= COUNTDOWN =================
     Três estados, decididos pela DATA em São Paulo — nunca pelo sinal
     do diff. A festa tem hora marcada: depois dela, e ainda no mesmo
     dia, o diff já é negativo, e um "diff <= 0 => acabou" diria que a
     festa passou com ela acontecendo.

     O dia sai do fuso de São Paulo, não do navegador: o convidado pode
     estar viajando.                                                */
  function diaEmSaoPaulo(ms) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date(ms));
    const parte = (t) => partes.find((x) => x.type === t).value;
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
  }

  // "contagem" | "e-hoje" | "passou"
  function estadoDaFesta(agora) {
    const hoje = diaEmSaoPaulo(agora);
    const dia = diaEmSaoPaulo(alvo);
    return hoje < dia ? "contagem" : hoje === dia ? "e-hoje" : "passou";
  }

  // "11h, Salão Grande. Corre." — hora e local saem do banco, não do
  // texto do mockup: os dois são editáveis pelo painel.
  function chamadaDeHoje() {
    if (!festa) return "Corre!";
    const hora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(festa.data)).replace(":00", "h").replace(":", "h");
    return festa.local ? `${hora}, ${festa.local}. Corre.` : `${hora}. Corre.`;
  }

  function tick() {
    const cd = $("#countdown");
    if (isNaN(alvo)) { cd.hidden = true; return; }

    const estado = estadoDaFesta(Date.now());
    cd.dataset.estado = estado;

    if (estado !== "contagem") {
      clearInterval(cronometro);
      cd.hidden = true;
      const aviso = $("#festaEstado");
      aviso.hidden = false;

      if (estado === "e-hoje") {
        aviso.dataset.tipo = "hoje";
        aviso.innerHTML = `<b>É hoje!</b><p>${esc(chamadaDeHoje())}</p>`;
      } else {
        aviso.dataset.tipo = "passou";
        aviso.innerHTML = `<b>Acabou 🍕</b>
          <p>A festa já rolou e foi boa demais. Em breve as fotos reais entram
             aqui no lugar das inventadas.</p>`;
        // Com a festa passada o CTA "Tô dentro" não leva a lugar nenhum,
        // e confirmar presença para um sábado que já foi também não.
        $("#ctaTopo").hidden = true;
        fecharFormulario("A festa<br>já rolou",
          "Não dá mais para confirmar — mas em breve as fotos reais entram no lugar das inventadas.");
      }
      return;
    }

    const d = alvo - Date.now();
    $("#cdDias").textContent = Math.floor(d / 864e5);
    $("#cdHoras").textContent = Math.floor((d % 864e5) / 36e5);
    $("#cdMin").textContent = Math.floor((d % 36e5) / 6e4);
    $("#cdSeg").textContent = Math.floor((d % 6e4) / 1e3);
  }

  carregarFesta();

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
    // O load das fotos resolve depois do da festa. Sem esta guarda ele
    // reexibiria o carrossel por cima do estado de erro, deixando o
    // convite meio quebrado — que é o que a falha existe para evitar.
    if (conviteFalhou) return;
    $("#secaoFotos").hidden = false;
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
    if (slides.length > 1) auto = setInterval(() => ir(idx + 1), 5000);
  }

  /* As setas laterais saíram com a pele nova, então os dots são a única
     navegação por clique. O arrasto cobre o gesto que o dedo já espera
     numa faixa de foto. 40px de limiar para não confundir com a rolagem
     vertical da página. */
  (function ligarArrasto() {
    const alvoCar = $("#carrossel");
    let x0 = null;
    alvoCar.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    alvoCar.addEventListener("touchend", (e) => {
      if (x0 === null || slides.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      ir(dx < 0 ? idx + 1 : idx - 1);
      reiniciarAuto();
    }, { passive: true });
  })();

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
      if (conviteFalhou) return; // não mexer na tela de erro
      if (st.aberto === false) fecharFormulario("Prazo<br>encerrado", textoDoPrazo(st.prazo));
      else if (st.prazo) avisarPrazo(st.prazo);
    } catch (e) {
      console.warn("Falha ao checar o prazo:", e);
    }
  }

  // Aberto mas com data marcada: sem isto o convidado não vê prazo
  // nenhum, e o prazo perde justamente a urgência que o justifica.
  function avisarPrazo(prazo) {
    if (rsvpFechado) return;   // a festa pode já ter passado antes desta resposta chegar
    const d = new Date(prazo);
    if (isNaN(d)) return;
    const el = $("#prazoAberto");
    el.textContent = `Confirme até ${d.toLocaleDateString("pt-BR")}`;
    el.hidden = false;
  }

  /* Duas coisas fecham o formulário: o prazo e a festa já ter acontecido.
     O primeiro a fechar escreve o texto — e como o tick() roda síncrono
     e o status_rsvp() é assíncrono, "a festa já rolou" ganha do prazo,
     que é a precedência certa: não adianta falar de prazo depois da
     festa. */
  function fecharFormulario(titulo, texto) {
    if (rsvpFechado) return;
    rsvpFechado = true;
    $("#rsvpForm").hidden = true;
    $("#rsvpEncerrado").querySelector("h3").innerHTML = titulo;
    $("#rsvpEncerradoTexto").textContent = texto;
    $("#rsvpEncerrado").hidden = false;
    $("#prazoAberto").hidden = true;
  }

  function textoDoPrazo(prazo) {
    const d = new Date(prazo);
    return isNaN(d)
      ? "O prazo para confirmar presença já passou."
      : `As confirmações fecharam em ${d.toLocaleDateString("pt-BR")} — a pizza já foi encomendada.`;
  }
  checarPrazo();

  /* ================= PESSOAS (responsável + acompanhantes) ================= */
  const MAX_ACOMPANHANTES = 5;
  const lista = $("#pessoasLista");
  const tpl = $("#tplPessoa");

  function novoCard(ehResponsavel) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.papel = ehResponsavel ? "principal" : "acompanhante";

    if (ehResponsavel) {
      node.classList.add("responsavel");
      // O responsável não digita o nome duas vezes: o campo de cima já é
      // o que o envio usa. E ele é sempre adulto — o convite não é
      // mandado para criança —, então o tipo vira rótulo fixo em vez de
      // escolha. O payload continua saindo com tipo "adulto".
      node.querySelector(".p-nome").remove();
      node.querySelector(".p-grupo-tipo").remove();
      node.querySelector(".p-remover").remove();
    } else {
      node.querySelector(".pessoa-tag").remove();
      // rádios de tipo precisam de name único por card, senão viram um
      // grupo só e marcar "criança" num card desmarca o outro
      const grupo = uid("tipo");
      $$(".p-tipo input", node).forEach((r) => (r.name = grupo));
    }

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
    const radioCrianca = card.querySelector('.p-tipo input[value="crianca"]');

    // O card do responsável não tem escolha de tipo: ele é sempre adulto,
    // e o chopp está liberado. Sem esta saída, o querySelector nulo
    // derrubaria a IIFE inteira na construção do primeiro card.
    if (!radioCrianca) return;

    function aplicar() {
      const ehCrianca = radioCrianca.checked;
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

  // Quem adiciona quatro pessoas perde a conta de quantas somou.
  function atualizarTotal() {
    const n = $$(".pessoa-card", lista).length;
    $("#totalPessoas").textContent = n === 1 ? "1 pessoa" : `${n} pessoas`;
  }

  function atualizarBotaoAdd() {
    const cheio = contarAcompanhantes() >= MAX_ACOMPANHANTES;
    $("#addPessoa").hidden = cheio;
    $("#limiteAcompanhantes").hidden = !cheio;
    renumerarCards();
    atualizarTotal();
  }

  // primeiro card = responsável. O nome dele não é digitado aqui: vem do
  // campo de cima, que é o que o envio já usava.
  lista.appendChild(novoCard(true));

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
    const campoNome = card.querySelector(".p-nome");
    const nome = campoNome ? campoNome.value.trim() : "";
    const ehResponsavel = card.dataset.papel === "principal";
    // O card do responsável não tem rádio de tipo: ele é sempre adulto.
    const radioCrianca = card.querySelector('.p-tipo input[value="crianca"]');
    const p = {
      // Nome de acompanhante é OPCIONAL e a pessoa entra mesmo sem ele.
      // Descartar quem não tem nome (como o formulário antigo fazia)
      // some com um consumidor e desequilibra o rateio.
      nome: nome || (ehResponsavel ? "" : null),
      tipo: radioCrianca && radioCrianca.checked ? "crianca" : "adulto",
      papel: ehResponsavel ? "principal" : "acompanhante",
      bebe_agua: false, bebe_refri: false, bebe_chopp: false, come_pizza: false,
    };
    // Bebida e comida moram no mesmo contêiner agora; a leitura passou a
    // ser pelos data-*, que não mudaram, e não pelo grupo em que estavam.
    $$("[data-bebida]:checked", card).forEach((i) => { p[i.dataset.bebida] = true; });
    $$("[data-comida]:checked", card).forEach((i) => { p[i.dataset.comida] = true; });
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
      btn.textContent = "Confirmar";
      return falha(status, mensagemDeErro(error));
    }

    // sucesso: o botão NÃO volta a habilitar
    btn.textContent = "Confirmado!";
    sucesso(pessoas);
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

  /* A tela de sucesso substitui o convite, mas o formulário continua no
     DOM: "mudar minha confirmação" precisa dele de volta com tudo que
     foi preenchido. Por isso escondemos as seções em vez de trocar o
     innerHTML — o que a versão anterior fazia e tornava a volta
     impossível. */
  function sucesso(pessoas) {
    const nomes = pessoas.map((p, i) => ({
      papel: i === 0 ? "Você" : "Acompanhante",
      nome: p.nome || "sem nome",
      tipo: p.tipo === "crianca" ? "criança" : "adulto",
    }));

    const dia = festa && festa.data
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric" })
          .format(new Date(festa.data))
      : null;
    const quantos = pessoas.length === 1 ? "1 lugar" : `${pessoas.length} lugares`;
    $("#sucessoResumo").innerHTML =
      `Guardamos <b>${esc(quantos)}</b>${dia ? ` no dia ${esc(dia)}` : ""}. Já estamos contando as pizzas.`;

    $("#sucessoLista").innerHTML = nomes.map((n) => `
      <div class="linha-ok">
        <span>${esc(n.papel)}</span>
        <b>${esc(n.nome)} · ${esc(n.tipo)}</b>
      </div>`).join("");

    prepararAgenda();

    $(".hero").hidden = true;
    $("#secaoFotos").hidden = true;
    $("#confirmar").hidden = true;
    $("#rsvpSucesso").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    dispararConfete();
  }

  $("#btnMudar").addEventListener("click", () => {
    $("#rsvpSucesso").hidden = true;
    $(".hero").hidden = false;
    $("#secaoFotos").hidden = false;
    $("#confirmar").hidden = false;
    // o envio anterior desabilitou o botão de propósito; reabrindo, ele volta
    const btn = $("#btnEnviar");
    btn.disabled = false;
    btn.textContent = "Confirmar";
    $("#formStatus").textContent = "";
    $("#confirmar").scrollIntoView({ behavior: "smooth" });
  });

  /* .ics gerado na hora. Dois cuidados que o review pediu:
     - o carimbo sai em UTC com o sufixo Z, então o horário é inequívoco
       e não depende do fuso de quem abre o arquivo. Esta é a mesma
       armadilha que já nos custou um dia inteiro de diferença no prazo;
     - Blob URL em vez de data: URI, que o Safari do iPhone trata mal. */
  function prepararAgenda() {
    const botao = $("#btnAgenda");
    if (!festa || !festa.data) return;
    const ini = new Date(festa.data);
    if (isNaN(ini)) return;

    const fim = new Date(ini.getTime() + 4 * 3600e3);   // 4h é o palpite; o convidado ajusta
    const carimbo = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapa = (s) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//site-aniversario//PT-BR",
      "BEGIN:VEVENT",
      `UID:festa-${ini.getTime()}@site-aniversario`,
      `DTSTAMP:${carimbo(new Date())}`,
      `DTSTART:${carimbo(ini)}`,
      `DTEND:${carimbo(fim)}`,
      `SUMMARY:${escapa(festa.titulo || "Festa")}`,
      festa.local ? `LOCATION:${escapa(festa.local)}` : null,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n") + "\r\n";

    botao.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    botao.hidden = false;
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
    const cores = ["#d8352a", "#1d4ed8", "#e8a33d", "#14110d"];
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
