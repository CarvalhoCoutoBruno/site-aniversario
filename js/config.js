// =============================================================
//  CONFIGURAÇÃO DO SITE  —  edite tudo por aqui
// =============================================================
//
//  1) Preencha os dados da festa abaixo.
//  2) Cole a URL e a chave "anon" do seu projeto Supabase
//     (Supabase > Project Settings > API).
//
// -------------------------------------------------------------

window.CONFIG = {
  // ---- Dados da festa ----------------------------------------
  festa: {
    titulo: "Aniversário",           // título grande no topo
    subtitulo: "Vem comemorar com a gente!",
    data: "2026-09-12T20:00:00",     // data/hora (formato AAAA-MM-DDTHH:MM:SS)
    dataTexto: "12 de setembro, 20h", // como aparece escrito na tela
    local: "Salão de Festas — Rua Exemplo, 123",
    localMapa: "https://maps.google.com/?q=Rua+Exemplo+123", // link do Google Maps (opcional)
  },

  // ---- Os 3 aniversariantes ----------------------------------
  //  O convidado escolhe qual(is) o convidou (múltipla escolha).
  aniversariantes: [
    "Aniversariante 1",
    "Aniversariante 2",
    "Aniversariante 3",
  ],

  // ---- Opções de bebida e comida -----------------------------
  bebidas: ["Água", "Refrigerante", "Chopp"],
  comidas: ["Pizza", "Sobremesa"],

  // ---- Relações sugeridas para acompanhantes -----------------
  relacoes: ["Esposa", "Marido", "Filho(a)", "Acompanhante"],

  // ---- Supabase (cole suas chaves aqui) ----------------------
  supabase: {
    url: "COLE_A_URL_DO_SUPABASE_AQUI",       // ex: https://xxxx.supabase.co
    anonKey: "COLE_A_CHAVE_ANON_AQUI",        // chave pública "anon"
    bucketFotos: "fotos",                     // nome do bucket de fotos
  },
};
