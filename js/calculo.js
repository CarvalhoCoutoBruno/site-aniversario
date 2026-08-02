/* =============================================================
   CÁLCULOS — estimativa de compra e rateio de custo
   =============================================================
   Módulo PURO: não toca no DOM, não fala com o Supabase, não lê
   window.CONFIG. Recebe dados, devolve números. É o que permite
   testá-lo sem navegador e sem banco (ver tests/calculo.test.js).

   ⚠️ DINHEIRO SEMPRE EM CENTAVOS (inteiro).
   Divisão de custo entre pessoas gera dízima; em float as contas não
   fecham com o gasto real. Aqui tudo é inteiro e a sobra é distribuída
   pelo método do maior resto (ver ratearCentavos).

   População: a LISTA DE CONFIRMADOS no prazo, e só. Presença na festa
   não filtra nada — quem confirmou paga a parte dele, tendo ido ou
   não (o custo já está comprometido; não se devolve barril).
   Estimativa e fechamento usam exatamente a mesma população.

   Entradas:
     pessoas[] — { id, rsvp_id, nome, tipo, bebe_agua, bebe_refri,
                   bebe_chopp, come_pizza, papel }
     config    — mesma forma da tabela `config` (reais, não centavos)
   ============================================================= */
(function (raiz) {
  "use strict";

  /* ---------- conversão reais <-> centavos ---------- */

  // "12,50" | "12.50" | 12.5 | null  ->  1250 | 0
  function paraCentavos(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function paraReais(centavos) {
    return (centavos || 0) / 100;
  }

  function formatarBRL(centavos) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(paraReais(centavos));
  }

  /* ---------- seleção de pessoas ---------- */

  const confirmados = (pessoas) => (pessoas || []).filter(Boolean);

  const ehAdulto = (p) => p.tipo === "adulto";
  const bebeChopp = (p) => !!p.bebe_chopp && ehAdulto(p); // criança nunca conta
  const bebeRefri = (p) => !!p.bebe_refri;
  const bebeAgua = (p) => !!p.bebe_agua;
  const comePizza = (p) => !!p.come_pizza;

  /* ---------- contagens ---------- */

  function contagens(pessoas) {
    const lista = confirmados(pessoas);
    const c = {
      totalPessoas: lista.length,
      adultos: 0,
      criancas: 0,
      chopp: 0,
      refri: 0,
      agua: 0,
      pizzaAdultos: 0,
      pizzaCriancas: 0,
    };
    for (const p of lista) {
      if (ehAdulto(p)) c.adultos++; else c.criancas++;
      if (bebeChopp(p)) c.chopp++;
      if (bebeRefri(p)) c.refri++;
      if (bebeAgua(p)) c.agua++;
      if (comePizza(p)) { if (ehAdulto(p)) c.pizzaAdultos++; else c.pizzaCriancas++; }
    }
    return c;
  }

  /* ---------- estimativa (pré-festa) ---------- */

  function estimativa(pessoas, config) {
    const c = contagens(pessoas);
    const cfg = config || {};
    const taxa = (v, padrao) => (v === null || v === undefined ? padrao : Number(v));

    const litrosChopp = c.chopp * taxa(cfg.litros_chopp_por_adulto, 2.0);
    const litrosRefri = c.refri * taxa(cfg.litros_refri_por_pessoa, 0.6);
    const litrosAgua = c.agua * taxa(cfg.litros_agua_por_pessoa, 0.5);

    // volume × preço/litro: arredonda só no fim, uma vez por bebida
    const custoEstimado =
      Math.round(litrosChopp * paraCentavos(cfg.preco_litro_chopp)) +
      Math.round(litrosRefri * paraCentavos(cfg.preco_litro_refri)) +
      Math.round(litrosAgua * paraCentavos(cfg.preco_litro_agua)) +
      c.pizzaAdultos * paraCentavos(cfg.preco_pizza_adulto) +
      c.pizzaCriancas * paraCentavos(cfg.preco_pizza_crianca);

    return {
      contagens: c,
      litrosChopp: arredonda3(litrosChopp),
      litrosRefri: arredonda3(litrosRefri),
      litrosAgua: arredonda3(litrosAgua),
      pizzaAdultos: c.pizzaAdultos,
      pizzaCriancas: c.pizzaCriancas,
      custoEstimado,
    };
  }

  function arredonda3(n) {
    return Math.round(n * 1000) / 1000;
  }

  /* ---------- rateio: o coração do arredondamento ----------
     Divide `totalCentavos` entre `ids` de forma que a soma das partes
     seja EXATAMENTE o total. Método do maior resto:
       base  = piso da divisão
       resto = o que sobrou (0 <= resto < n)
       os `resto` primeiros ids (ordenados) pagam 1 centavo a mais.
     A ordenação por id torna o resultado determinístico: recarregar a
     tela não muda quem pagou o centavo extra.
  --------------------------------------------------------- */
  function ratearCentavos(totalCentavos, ids) {
    const out = new Map();
    const n = ids.length;
    if (n === 0) return out;

    const ordenados = [...ids].sort((a, b) => String(a).localeCompare(String(b)));
    const base = Math.floor(totalCentavos / n);
    const resto = totalCentavos - base * n;

    ordenados.forEach((id, i) => out.set(id, base + (i < resto ? 1 : 0)));
    return out;
  }

  /* ---------- fechamento / rateio ---------- */

  function precoPizza(config, tipo) {
    const cfg = config || {};
    // preço real manda quando preenchido; senão cai no estimado
    const real = tipo === "adulto" ? cfg.preco_real_pizza_adulto : cfg.preco_real_pizza_crianca;
    const est = tipo === "adulto" ? cfg.preco_pizza_adulto : cfg.preco_pizza_crianca;
    return paraCentavos(real === null || real === undefined ? est : real);
  }

  function rateio(pessoas, config, grupos) {
    const cfg = config || {};
    const lista = confirmados(pessoas);

    const custos = {
      chopp: paraCentavos(cfg.custo_real_chopp),
      refri: paraCentavos(cfg.custo_real_refri),
      agua: paraCentavos(cfg.custo_real_agua),
    };
    const preenchido = (v) => v !== null && v !== undefined && v !== "";
    const fechamentoCompleto =
      preenchido(cfg.custo_real_chopp) &&
      preenchido(cfg.custo_real_refri) &&
      preenchido(cfg.custo_real_agua);

    const consumidores = {
      chopp: lista.filter(bebeChopp),
      refri: lista.filter(bebeRefri),
      agua: lista.filter(bebeAgua),
    };

    // Bebida com custo lançado mas sem nenhum confirmado consumindo:
    // pula, sem dividir por zero. Não some silenciosamente — o custo
    // continua em custoRealTotal, então Σ contas ≠ total e o selo
    // `confere` já acusa o erro de digitação sozinho.
    const partes = {};
    for (const bebida of ["chopp", "refri", "agua"]) {
      partes[bebida] = ratearCentavos(
        custos[bebida],
        consumidores[bebida].map((p) => p.id)
      );
    }

    const porPessoa = new Map();
    let totalPizza = 0;
    for (const p of lista) {
      let conta = 0;
      conta += partes.chopp.get(p.id) || 0;
      conta += partes.refri.get(p.id) || 0;
      conta += partes.agua.get(p.id) || 0;
      if (comePizza(p)) {
        const pz = precoPizza(cfg, p.tipo);
        conta += pz;
        totalPizza += pz;
      }
      porPessoa.set(p.id, conta);
    }

    // agrupa: cada rsvp_id é um grupo; aniversariante (rsvp_id null)
    // vira grupo de uma pessoa só, pagando a própria parte
    const infoGrupo = new Map((grupos || []).map((g) => [g.id, g]));
    const mapa = new Map();
    for (const p of lista) {
      const chave = p.rsvp_id || `aniv:${p.id}`;
      if (!mapa.has(chave)) {
        const g = p.rsvp_id ? infoGrupo.get(p.rsvp_id) : null;
        mapa.set(chave, {
          chave,
          rsvpId: p.rsvp_id || null,
          ehAniversariante: !p.rsvp_id,
          nomePrincipal: g ? g.nome_principal : p.nome || "Aniversariante",
          contato: g ? g.contato : null,
          pessoas: [],
          total: 0,
        });
      }
      const grupo = mapa.get(chave);
      grupo.pessoas.push({ ...p, conta: porPessoa.get(p.id) || 0 });
      grupo.total += porPessoa.get(p.id) || 0;
    }

    const porGrupo = [...mapa.values()].sort((a, b) =>
      a.nomePrincipal.localeCompare(b.nomePrincipal, "pt-BR")
    );

    const totalRateado = [...porPessoa.values()].reduce((s, v) => s + v, 0);
    const custoRealTotal = custos.chopp + custos.refri + custos.agua + totalPizza;

    return {
      porPessoa,
      porGrupo,
      totalRateado,
      custoRealTotal,
      fechamentoCompleto,
      // verde só com os três custos lançados e as contas fechando
      confere: fechamentoCompleto && totalRateado === custoRealTotal,
    };
  }

  /* ---------- export (browser + node) ---------- */
  const API = {
    paraCentavos, paraReais, formatarBRL,
    confirmados, contagens, estimativa,
    ratearCentavos, precoPizza, rateio,
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  else raiz.Calculo = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
