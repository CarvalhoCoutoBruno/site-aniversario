// =============================================================
//  CONFIGURAÇÃO DO SITE  —  edite tudo por aqui
// =============================================================
//
//  Preços, taxas de consumo e prazo de confirmação NÃO ficam aqui:
//  moram na tabela `config` do Supabase e são editados pelo painel.
//
// -------------------------------------------------------------

window.CONFIG = {
  // ---- Dados da festa ----------------------------------------
  festa: {
    titulo: "Festa dos 160 anos",
    // offset -03:00 explícito: a contagem não muda com o fuso de quem abre
    data: "2026-10-31T11:00:00-03:00",
    dataTexto: "Sábado, 31 de outubro de 2026, às 11h",
    local: "Salão 3 — Av. Cel. Marcos, 627, Pedra Redonda, Porto Alegre/RS",
    localMapa:
      "https://www.google.com/maps/search/?api=1&query=Av.+Cel.+Marcos%2C+627+-+Pedra+Redonda%2C+Porto+Alegre+-+RS%2C+91760-000",
  },

  // ---- Os 3 aniversariantes ----------------------------------
  //  ⚠️ A ORDEM É O IDENTIFICADOR: o banco grava `convidado_por` como
  //  número (1, 2, 3) apontando para as posições desta lista.
  //  Dá para RENOMEAR à vontade; NÃO reordene nem remova depois que
  //  houver confirmação salva, senão os registros trocam de dono.
  aniversariantes: [
    "Bruno", // 1
    "Braz",  // 2
    "Bocão", // 3
  ],

  // ---- Relações sugeridas para acompanhantes -----------------
  relacoes: ["Esposa", "Marido", "Filho(a)", "Acompanhante"],

  //  Bebidas e comida NÃO são configuráveis: viraram colunas booleanas
  //  fixas no banco (bebe_agua / bebe_refri / bebe_chopp / come_pizza),
  //  porque cada uma tem regra e preço próprios no rateio.

  // ---- Supabase (cole suas chaves aqui) ----------------------
  supabase: {
    url: "https://mbzuxkvrrtvbgkikrivh.supabase.co",
    // chave publishable/anon — pública por design; a segurança está na RLS
    anonKey: "sb_publishable_K86bohNhtKvfzytzszn_YA_UlNN2iDL",
    bucketFotos: "fotos",
  },
};
