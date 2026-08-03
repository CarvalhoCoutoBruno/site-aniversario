/* =============================================================
   CÁLCULOS — estimativa de compra e rateio de custo
   =============================================================
   Módulo PURO: não toca no DOM, não fala com o Supabase, não lê
   window.CONFIG. Recebe dados, devolve números. É o que permite
   testá-lo sem navegador e sem banco (ver tests/calculo.test.js).

   QUEM PAGA: só os 3 aniversariantes. Convidado não paga nada — o
   consumo dele é bancado por quem o convidou (convidado_por do grupo),
   dividido igualmente quando há mais de um. Cada aniversariante paga
   100% do próprio consumo. No fim existem só 3 contas.

   ⚠️ DINHEIRO SEMPRE EM CENTAVOS (inteiro).
   Divisão de custo gera dízima; em float as contas não fecham com o
   gasto real. Aqui tudo é inteiro e a sobra é distribuída pelo método
   do maior resto (ver ratearCentavos).

   Entradas:
     pessoas[] — { id, rsvp_id, nome, tipo, bebe_agua, bebe_refri,
                   bebe_chopp, come_pizza, papel, aniversariante_id }
     grupos[]  — { id, convidado_por: [1..3], nome_principal, contato }
     config    — mesma forma da tabela `config` (reais, não centavos)
   ============================================================= */
(function (raiz) {
  "use strict";

  // Peso interno em SEXTOS de pessoa. |convidado_por| ∈ {1,2,3}, então
  // 6/n é sempre inteiro (6, 3 ou 2) — o rateio roda em aritmética
  // inteira do começo ao fim, sem erro de ponto flutuante.
  const SEXTOS = 6;

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

  /* ---------- predicados ---------- */

  const confirmados = (pessoas) => (pessoas || []).filter(Boolean);

  const ehAdulto = (p) => p.tipo === "adulto";
  const ehAniversariante = (p) => p.papel === "aniversariante";
  const bebeChopp = (p) => !!p.bebe_chopp && ehAdulto(p); // criança nunca conta
  const bebeRefri = (p) => !!p.bebe_refri;
  const bebeAgua = (p) => !!p.bebe_agua;
  const comePizza = (p) => !!p.come_pizza;

  const CONSOME = { chopp: bebeChopp, refri: bebeRefri, agua: bebeAgua };

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

  /* ---------- estimativa (pré-festa) ----------
     NÃO muda com o modelo de rateio: conta todas as pessoas
     confirmadas, aniversariantes inclusive. Serve para saber quanto
     comprar, não quem paga. */

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

  /* ---------- rateio ponderado: o coração do arredondamento ----------
     Divide `totalCentavos` entre itens com PESOS (inteiros), de forma
     que a soma das partes seja EXATAMENTE o total. Maior resto:
       exato_i = total × peso_i / somaPesos
       base_i  = piso(exato_i)
       sobra   = total - Σ base_i
       os `sobra` itens com maior resto fracionário pagam 1 centavo a mais
     Empate e ordenação resolvidos por `id` crescente, então o resultado
     é determinístico: recarregar a tela não muda quem levou o centavo.

     Tudo em inteiros: `num` cabe folgado em Number (total ≤ ~1e8
     centavos × peso ≤ ~1e5 = 1e13 < 2^53), então piso e resto são
     exatos, sem depender de tolerância de float.
  --------------------------------------------------------- */
  function ratearCentavos(totalCentavos, itens) {
    const out = new Map();
    const lista = (itens || []).filter((i) => i.peso > 0);
    const somaPesos = lista.reduce((s, i) => s + i.peso, 0);
    if (somaPesos <= 0 || totalCentavos === 0) return out;

    const calc = lista.map((i) => {
      const num = totalCentavos * i.peso;
      let base = Math.floor(num / somaPesos);
      // correção de borda: garante piso exato mesmo se a divisão em
      // ponto flutuante cair do lado errado de um inteiro
      while (base * somaPesos > num) base--;
      while ((base + 1) * somaPesos <= num) base++;
      return { id: i.id, base, resto: num - base * somaPesos };
    });

    let sobra = totalCentavos - calc.reduce((s, x) => s + x.base, 0);

    // maior resto primeiro; empate pelo id, para ser determinístico
    const ordem = [...calc].sort(
      (a, b) => b.resto - a.resto || String(a.id).localeCompare(String(b.id))
    );
    for (let i = 0; i < ordem.length; i++) {
      out.set(ordem[i].id, ordem[i].base + (i < sobra ? 1 : 0));
    }
    return out;
  }

  /* ---------- atribuição: quem banca o consumo de quem ---------- */

  // Devolve [{ id: aniversariante_id, peso }] em sextos de pessoa.
  // Aniversariante: 6 sextos (1 pessoa inteira) para si mesmo.
  // Convidado/acompanhante: 6/n para cada um dos n do convidado_por.
  // A chave `null` acumula consumo sem dono (grupo sem convidado_por
  // válido) — não deveria existir, mas se existir é preciso que o
  // dinheiro NÃO seja redistribuído: ele some do rateio e derruba o selo.
  function pesosDaPessoa(p, grupos) {
    if (ehAniversariante(p)) {
      return p.aniversariante_id ? [{ id: p.aniversariante_id, peso: SEXTOS }] : [{ id: null, peso: SEXTOS }];
    }
    const g = grupos.get(p.rsvp_id);
    const donos = g && Array.isArray(g.convidado_por) ? g.convidado_por : [];
    if (!donos.length) return [{ id: null, peso: SEXTOS }];
    const fatia = SEXTOS / donos.length; // 6, 3 ou 2 — sempre inteiro
    return donos.map((k) => ({ id: k, peso: fatia }));
  }

  function acumular(mapa, pesos) {
    for (const { id, peso } of pesos) {
      const chave = id === null ? "__sem_dono__" : id;
      mapa.set(chave, (mapa.get(chave) || 0) + peso);
    }
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
    const mapaGrupos = new Map((grupos || []).map((g) => [g.id, g]));

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

    // conta de cada aniversariante, por item
    const contas = new Map(); // aniversariante_id -> { chopp, refri, agua, pizza }
    const zera = (k) => {
      if (!contas.has(k)) contas.set(k, { chopp: 0, refri: 0, agua: 0, pizza: 0 });
      return contas.get(k);
    };
    for (const p of lista) if (ehAniversariante(p) && p.aniversariante_id) zera(p.aniversariante_id);

    /* --- bebidas: custo real do item distribuído por unidades --- */
    for (const item of ["chopp", "refri", "agua"]) {
      const consumidores = lista.filter(CONSOME[item]);
      // Item com custo lançado e nenhum consumidor: pulado, sem dividir
      // por zero. O custo segue em custoRealTotal, então Σ ≠ total e o
      // selo `confere` acusa o erro de lançamento sozinho.
      if (!consumidores.length) continue;

      const pesos = new Map();
      for (const p of consumidores) acumular(pesos, pesosDaPessoa(p, mapaGrupos));

      const partes = ratearCentavos(
        custos[item],
        [...pesos.entries()].map(([id, peso]) => ({ id, peso }))
      );
      for (const [id, centavos] of partes) {
        if (id === "__sem_dono__") continue; // dinheiro sem pagante: some
        zera(id)[item] += centavos;
      }
    }

    /* --- pizza: preço por cabeça, atribuído com o mesmo peso --- */
    for (const p of lista) {
      if (!comePizza(p)) continue;
      const preco = precoPizza(cfg, p.tipo);
      if (!preco) continue;
      const partes = ratearCentavos(preco, pesosDaPessoa(p, mapaGrupos));
      for (const [id, centavos] of partes) {
        if (id === "__sem_dono__" || id === null) continue;
        zera(id).pizza += centavos;
      }
    }

    /* --- monta o resultado --- */
    const nomes = new Map();
    for (const p of lista) {
      if (ehAniversariante(p) && p.aniversariante_id) nomes.set(p.aniversariante_id, p.nome || null);
    }

    const porAniversariante = [...contas.entries()]
      .map(([id, det]) => ({
        aniversarianteId: id,
        nome: nomes.get(id) || `Aniversariante ${id}`,
        detalhe: det,
        total: det.chopp + det.refri + det.agua + det.pizza,
      }))
      .sort((a, b) => a.aniversarianteId - b.aniversarianteId);

    const totalRateado = porAniversariante.reduce((s, a) => s + a.total, 0);

    // total gasto: bebidas pelo custo real + pizzas pelo preço por cabeça
    let totalPizza = 0;
    for (const p of lista) if (comePizza(p)) totalPizza += precoPizza(cfg, p.tipo);
    const custoRealTotal = custos.chopp + custos.refri + custos.agua + totalPizza;

    return {
      porAniversariante,
      totalRateado,
      custoRealTotal,
      // O acerto precisa de quanto custou CADA item para saber o que
      // quem pagou aquele item desembolsou. Expor daqui em vez de
      // recalcular lá evita que os dois lados divirjam sobre o mesmo
      // número.
      custosPorItem: { chopp: custos.chopp, refri: custos.refri, agua: custos.agua, pizza: totalPizza },
      fechamentoCompleto,
      // verde só com os três custos lançados e as contas fechando
      confere: fechamentoCompleto && totalRateado === custoRealTotal,
    };
  }

  /* ---------- acerto: quem transfere quanto para quem ----------
     O rateio diz quanto cada aniversariante DEVE. Aqui entra quanto
     cada um PAGOU: cada item (chopp/refri/água/pizza) tem um pagador, e
     o valor do item é o custo já calculado no fechamento — ninguém
     digita valor, só marca quem pagou.

       saldo = deve - pagou     (positivo = tem a pagar; negativo = a receber)

     Como Σ deve = Σ pagou = custoRealTotal, então Σ saldo = 0 e o acerto
     sempre fecha. As transferências saem do guloso (maior devedor com
     maior credor), que para 3 pessoas é ótimo: no máximo 2.
  ------------------------------------------------------------- */
  const ITENS = ["chopp", "refri", "agua", "pizza"];
  const NOME_ITEM = { chopp: "chopp", refri: "refrigerante", agua: "água", pizza: "pizza" };

  function acerto(resultadoRateio, pagoPor) {
    const r = resultadoRateio || {};
    const custos = r.custosPorItem || { chopp: 0, refri: 0, agua: 0, pizza: 0 };
    const pp = pagoPor || {};

    const pagou = new Map();
    const faltaPagador = [];
    for (const item of ITENS) {
      const valor = custos[item] || 0;
      if (valor <= 0) continue; // item sem custo dispensa pagador
      const k = Number(pp[item]) || null;
      if (!k) { faltaPagador.push(item); continue; }
      pagou.set(k, (pagou.get(k) || 0) + valor);
    }

    // todo aniversariante do rateio entra, mesmo com saldo zero
    const saldos = (r.porAniversariante || []).map((a) => {
      const p = pagou.get(a.aniversarianteId) || 0;
      return {
        aniversarianteId: a.aniversarianteId,
        nome: a.nome,
        deve: a.total,
        pagou: p,
        saldo: a.total - p,
      };
    });

    // quem pagou item mas não tem linha no rateio (aniversariante sem
    // cadastro): não pode sumir com o dinheiro dele
    for (const [k, p] of pagou) {
      if (!saldos.some((s) => s.aniversarianteId === k)) {
        saldos.push({ aniversarianteId: k, nome: `Aniversariante ${k}`, deve: 0, pagou: p, saldo: -p });
      }
    }
    saldos.sort((a, b) => a.aniversarianteId - b.aniversarianteId);

    /* status: exige as DUAS condições. Só checar "todo item tem
       pagador" deixaria passar o caso órfão — onde o rateio não confere,
       Σ deve ≠ Σ pagou, Σ saldo ≠ 0 e as transferências não quitam nada.
       O acerto sairia silenciosamente errado. */
    let status = "completo";
    let motivo = "";
    if (!r.fechamentoCompleto) {
      status = "incompleto";
      motivo = "Feche o custo real primeiro: falta lançar o gasto de chopp, refrigerante ou água.";
    } else if (!r.confere) {
      status = "incompleto";
      motivo = "As contas do rateio não fecham — resolva isso antes de acertar entre vocês.";
    } else if (faltaPagador.length) {
      status = "incompleto";
      motivo = "Indique quem pagou: " + faltaPagador.map((i) => NOME_ITEM[i]).join(", ") + ".";
    }

    const transferencias = status === "completo" ? minimizarTransferencias(saldos) : [];
    return { saldos, transferencias, status, motivo, faltaPagador };
  }

  // Guloso: casa o maior devedor com o maior credor. Com soma zero e 3
  // pessoas, gera no máximo 2 transferências — que é o mínimo possível.
  function minimizarTransferencias(saldos) {
    const devedores = saldos.filter((s) => s.saldo > 0)
      .map((s) => ({ id: s.aniversarianteId, nome: s.nome, resta: s.saldo }))
      .sort((a, b) => b.resta - a.resta || a.id - b.id);
    const credores = saldos.filter((s) => s.saldo < 0)
      .map((s) => ({ id: s.aniversarianteId, nome: s.nome, resta: -s.saldo }))
      .sort((a, b) => b.resta - a.resta || a.id - b.id);

    const out = [];
    let i = 0, j = 0;
    while (i < devedores.length && j < credores.length) {
      const valor = Math.min(devedores[i].resta, credores[j].resta);
      if (valor > 0) {
        out.push({ de: devedores[i].id, deNome: devedores[i].nome,
                   para: credores[j].id, paraNome: credores[j].nome, valor });
      }
      devedores[i].resta -= valor;
      credores[j].resta -= valor;
      if (devedores[i].resta === 0) i++;
      if (credores[j].resta === 0) j++;
    }
    return out;
  }

  /* ---------- export (browser + node) ---------- */
  const API = {
    paraCentavos, paraReais, formatarBRL,
    confirmados, contagens, estimativa,
    ratearCentavos, pesosDaPessoa, precoPizza, rateio,
    acerto, minimizarTransferencias,
    SEXTOS,
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  else raiz.Calculo = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
