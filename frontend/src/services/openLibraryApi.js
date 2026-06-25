/**
 * openLibraryApi.js
 *
 * O que a Open Library realmente fornece:
 *
 * SINOPSE → NÃO vem no search.json. Precisa buscar /works/{key}.json
 *            separadamente, só quando o usuário SELECIONA um livro.
 *            Campo: description (string ou {type, value}).
 *
 * NACIONALIDADE → Não existe como campo direto na API.
 *   Estratégia em camadas (da mais para a menos precisa):
 *   1. /authors/{author_key}.json → campo "bio" (texto livre)
 *   2. Fallback: idioma do livro → tabela idioma→nacionalidade
 */

const OL_BASE = "https://openlibrary.org";
const MM_BASE = "https://api.mymemory.translated.net/get";

const cacheTraducao = new Map();

// ── Tabela idioma → nacionalidade (fallback) ────────────────
const IDIOMA_NACIONALIDADE = {
  por: "Brasileira", pt: "Brasileira",
  eng: "Britânica",  en: "Britânica",
  spa: "Espanhola",  es: "Espanhola",
  fre: "Francesa",   fra: "Francesa", fr: "Francesa",
  ger: "Alemã",      deu: "Alemã",    de: "Alemã",
  ita: "Italiana",   it: "Italiana",
  rus: "Russa",      ru: "Russa",
  jpn: "Japonesa",   ja: "Japonesa",
  chi: "Chinesa",    zho: "Chinesa",  zh: "Chinesa",
  ara: "Árabe",      ar: "Árabe",
  swe: "Sueca",      nor: "Norueguesa",
  dan: "Dinamarquesa", nld: "Holandesa",
  pol: "Polonesa",   ces: "Tcheca",
  hun: "Húngara",    fin: "Finlandesa",
  tur: "Turca",      gre: "Grega",
  heb: "Israelense", kor: "Coreana",
  hin: "Indiana",
};

const BIO_NACIONALIDADE = [
  [/\b(american|norte.american)\b/i,   "Americana"],
  [/\b(british|english|welsh|scottish|irish)\b/i, "Britânica"],
  [/\b(brazilian|brasileir)/i,          "Brasileira"],
  [/\b(portuguese|portugu[eê]s)\b/i,    "Portuguesa"],
  [/\b(spanish|espanhol|españ)\b/i,     "Espanhola"],
  [/\b(french|franc[eê]s)\b/i,          "Francesa"],
  [/\b(german|alemã|alemão)\b/i,        "Alemã"],
  [/\b(italian|italian[ao])\b/i,        "Italiana"],
  [/\b(russian|russ[ao])\b/i,           "Russa"],
  [/\b(japanese|japonês|japonesa)\b/i,  "Japonesa"],
  [/\b(chinese|chinês|chinesa)\b/i,     "Chinesa"],
  [/\b(arabic|arab|árabe)\b/i,          "Árabe"],
  [/\b(swedish|suec[ao])\b/i,           "Sueca"],
  [/\b(norwegian|noruegu[eê]s)\b/i,     "Norueguesa"],
  [/\b(danish|dinamarqu[eê]s)\b/i,      "Dinamarquesa"],
  [/\b(dutch|holand[eê]s)\b/i,          "Holandesa"],
  [/\b(polish|polon[eê]s)\b/i,          "Polonesa"],
  [/\b(czech|tchec[ao])\b/i,            "Tcheca"],
  [/\b(hungarian|húngar[ao])\b/i,       "Húngara"],
  [/\b(finnish|finland[eê]s)\b/i,       "Finlandesa"],
  [/\b(turkish|turc[ao])\b/i,           "Turca"],
  [/\b(greek|greg[ao])\b/i,             "Grega"],
  [/\b(korean|corean[ao])\b/i,          "Coreana"],
  [/\b(indian|indian[ao]|hindi)\b/i,    "Indiana"],
  [/\b(argentin[ao])\b/i,               "Argentina"],
  [/\b(mexican|mexican[ao])\b/i,        "Mexicana"],
  [/\b(colombian|colombian[ao])\b/i,    "Colombiana"],
  [/\b(chilean|chilen[ao])\b/i,         "Chilena"],
];

function extrairNacionalidadeDaBio(bio) {
  if (!bio) return "";
  for (const [regex, nac] of BIO_NACIONALIDADE) {
    if (regex.test(bio)) return nac;
  }
  return "";
}

function nacionalidadePorIdioma(idioma) {
  return IDIOMA_NACIONALIDADE[(idioma || "").toLowerCase()] || "";
}

// ── Detecção de idioma (somente local, sem chamada de rede) ─
// A detecção via MyMemory era lenta, instável e adicionava uma
// requisição extra antes de cada busca. A heurística local é
// suficiente para distinguir PT de EN para nossos propósitos.

const PALAVRAS_PT = new Set([
  "de","do","da","dos","das","em","no","na","nos","nas",
  "um","uma","uns","umas","o","a","os","as","e","é",
  "que","com","por","para","como","ao","à","ou","se",
  "sua","seu","ele","ela","não","mais","foi","era",
  "são","ser","ter","tem","há","já","aqui","isto","isso",
]);

function parecePT(texto) {
  if (!texto) return false;
  // Acentos tipicamente portugueses/espanhóis → provavelmente não é inglês
  if (/[àáâãäçèéêìíîïñòóôõùúûü]/i.test(texto)) return true;
  const tokens = texto.toLowerCase().split(/\s+/);
  if (tokens.length < 2) return true; // query curta → trata como PT
  const hits = tokens.filter((t) => PALAVRAS_PT.has(t));
  return hits.length / tokens.length > 0.2;
}

function detectarIdioma(texto) {
  if (!texto || texto.trim().length < 3) return "pt";
  return parecePT(texto.trim()) ? "pt" : "en";
}

// ── Tradução ────────────────────────────────────────────────

async function traduzir(texto, par) {
  if (!texto || !texto.trim()) return texto;
  const chave = `${par}::${texto.trim()}`;
  if (cacheTraducao.has(chave)) return cacheTraducao.get(chave);
  try {
    const url = `${MM_BASE}?q=${encodeURIComponent(texto.trim())}&langpair=${par}`;
    const res = await fetch(url);
    if (!res.ok) return texto;
    const data = await res.json();
    const raw = data?.responseData?.translatedText || texto;
    // Se MyMemory devolver tudo em maiúsculas é sinal de falha
    const resultado =
      raw.toUpperCase() === raw && texto.toUpperCase() !== texto ? texto : raw;
    cacheTraducao.set(chave, resultado);
    return resultado;
  } catch {
    return texto;
  }
}

/**
 * Traduz somente se o texto parecer estar em inglês.
 * Evita corromper títulos já em português.
 */
async function traduzirSeIngles(texto) {
  if (!texto || !texto.trim()) return texto;
  // Tem acentos ou parece PT → não traduz
  if (parecePT(texto)) return texto;
  return traduzir(texto, "en-US|pt-BR");
}

// ── Ordenação por idioma ─────────────────────────────────────
// Quanto menor o número, mais prioritário.
const PRIORIDADE_IDIOMA = { por: 0, pt: 0, eng: 2, en: 2, spa: 1, es: 1 };

function prioridadeIdioma(idioma) {
  return PRIORIDADE_IDIOMA[(idioma || "").toLowerCase()] ?? 3;
}

// ── Normalização de título ───────────────────────────────────
// A Open Library às vezes retorna títulos em CAPS LOCK.
// Converte para Title Case apenas se o título inteiro estiver em maiúsculas.
function normalizarTitulo(titulo) {
  if (!titulo) return titulo;
  const semEspacos = titulo.replace(/\s/g, "");
  if (semEspacos.length > 3 && semEspacos === semEspacos.toUpperCase()) {
    // Title Case simples: capitaliza cada palavra
    return titulo
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }
  return titulo;
}

// ── Relevância: o título EN faz sentido para a query PT? ────
// Compara tokens da query com tokens do título EN.
// Evita incluir resultados da busca paralela EN que não têm relação
// com o que o usuário digitou.
function tituloENRelevante(tituloEN, queryPT) {
  if (!tituloEN || !queryPT) return false;
  const tokensQuery = queryPT.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const tituloLower = tituloEN.toLowerCase();
  // Pelo menos um token significativo da query deve aparecer no título EN
  return tokensQuery.some((t) => tituloLower.includes(t));
}

// ── Busca na API ─────────────────────────────────────────────

const OL_FIELDS =
  "key,title,author_name,author_key,first_publish_year,publisher,isbn,subject,language";

async function buscarNaOL(queryString, limit) {
  const url =
    `${OL_BASE}/search.json?q=${encodeURIComponent(queryString)}` +
    `&limit=${limit}` +
    `&fields=${OL_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar na Open Library");
  const data = await res.json();
  return (data.docs || []).map(normalizarLivro);
}

// ── API principal de busca ───────────────────────────────────

/**
 * Busca livros priorizando resultados em português.
 *
 * Estratégia (query em PT):
 *  1. Busca com a query original → pega edições PT/BR catalogadas na OL
 *  2. Traduz a query PT→EN e busca novamente → pega edições EN do mesmo título
 *  3. Coleta os olKeys dos resultados PT para usar como filtro
 *  4. Dos resultados EN, só mantém os que:
 *     a) Já existem nos resultados PT (mesmo olKey = mesma obra, idioma diferente), OU
 *     b) São do mesmo autor de algum resultado PT (série/coleção do mesmo escritor)
 *  5. Deduplica, ordena PT→ES→EN→outros, normaliza títulos em CAPS
 */
export async function buscarLivrosOpenLibrary(query, limit = 10) {
  if (!query || !query.trim()) return [];

  const queryTrimada = query.trim();
  const idiomaQuery = detectarIdioma(queryTrimada);

  let docs;

  if (idiomaQuery === "pt") {
    const queryEN = await traduzir(queryTrimada, "pt-BR|en-US");
    const buscaPT = buscarNaOL(queryTrimada, limit * 2);
    const buscaEN =
      queryEN && queryEN.toLowerCase() !== queryTrimada.toLowerCase()
        ? buscarNaOL(queryEN, limit * 2)
        : Promise.resolve([]);

    const [resultadosPT, resultadosEN] = await Promise.all([buscaPT, buscaEN]);

    // Conjunto de olKeys que vieram da busca PT
    const keysPT = new Set(resultadosPT.map((l) => l.olKey).filter(Boolean));

    // Conjunto de autores que vieram da busca PT (para capturar outras obras da série)
    const autoresPT = new Set(
      resultadosPT.flatMap((l) => l.authorKeys).filter(Boolean)
    );

    // Filtra resultados EN: só entra se for a mesma obra (olKey em keysPT)
    // ou do mesmo autor (para pegar volumes da série não catalogados em PT)
    const resultadosENFiltrados = resultadosEN.filter(
      (l) =>
        keysPT.has(l.olKey) ||
        l.authorKeys.some((k) => autoresPT.has(k))
    );

    // Une PT + EN filtrado, deduplica por olKey (PT tem prioridade)
    const vistos = new Set();
    docs = [...resultadosPT, ...resultadosENFiltrados].filter((livro) => {
      if (!livro.olKey || vistos.has(livro.olKey)) return false;
      vistos.add(livro.olKey);
      return true;
    });
  } else {
    // Query em inglês ou outro idioma: busca direta
    const brutos = await buscarNaOL(queryTrimada, limit * 2);
    const vistos = new Set();
    docs = brutos.filter((livro) => {
      if (!livro.olKey || vistos.has(livro.olKey)) return false;
      vistos.add(livro.olKey);
      return true;
    });
  }

  // Ordena: PT/BR primeiro, depois ES, depois EN, depois o resto
  const ordenados = [...docs].sort(
    (a, b) => prioridadeIdioma(a.idioma) - prioridadeIdioma(b.idioma)
  );

  const cortados = ordenados.slice(0, limit);

  // Normaliza títulos em CAPS e traduz somente os que parecem inglês
  const titulos = await Promise.all(
    cortados.map((l) => traduzirSeIngles(normalizarTitulo(l.titulo)))
  );

  return cortados.map((livro, i) => ({
    ...livro,
    titulo: titulos[i] || normalizarTitulo(livro.titulo),
  }));
}

// ── Detalhes ao selecionar (sinopse + nacionalidade) ────────

async function buscarSinopse(olKey) {
  if (!olKey) return "";
  try {
    const res = await fetch(`${OL_BASE}${olKey}.json`);
    if (!res.ok) return "";
    const data = await res.json();
    const desc = data.description;
    if (!desc) return "";
    const texto = typeof desc === "string" ? desc : (desc.value || "");
    return traduzirSeIngles(texto.substring(0, 3000));
  } catch {
    return "";
  }
}

async function buscarNacionalidadeAutor(authorKey) {
  if (!authorKey) return "";
  try {
    const res = await fetch(`${OL_BASE}${authorKey}.json`);
    if (!res.ok) return "";
    const data = await res.json();
    const bio = typeof data.bio === "string"
      ? data.bio
      : (data.bio?.value || "");
    return extrairNacionalidadeDaBio(bio);
  } catch {
    return "";
  }
}

export async function buscarDetalhesLivro(olKey, authorKeys = [], idiomaFallback = "") {
  const [sinopse, nacAutor] = await Promise.all([
    buscarSinopse(olKey),
    buscarNacionalidadeAutor(authorKeys[0] || ""),
  ]);
  const nacionalidade = nacAutor || nacionalidadePorIdioma(idiomaFallback);
  return { sinopse, nacionalidade };
}

// ── Busca por ISBN ───────────────────────────────────────────

export async function buscarPorISBN(isbn) {
  const limpo = isbn.replace(/[^0-9X]/gi, "");
  if (!limpo) return null;
  const url = `${OL_BASE}/api/books?bibkeys=ISBN:${limpo}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar ISBN na Open Library");
  const data = await res.json();
  const chave = `ISBN:${limpo}`;
  if (!data[chave]) return null;
  return normalizarLivroISBN(data[chave], limpo);
}

export function getCoverUrl(isbn, tamanho = "M") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${tamanho}.jpg`;
}

// ── Normalizadores ───────────────────────────────────────────

function normalizarLivro(doc) {
  return {
    olKey:      doc.key || "",
    authorKeys: doc.author_key || [],
    titulo:     doc.title || "",
    autor:      (doc.author_name || []).join(", "),
    ano:        doc.first_publish_year || null,
    editora:    (doc.publisher || [])[0] || "",
    isbn:       (doc.isbn || [])[0] || "",
    generos:    (doc.subject || []).slice(0, 5),
    idioma:     (doc.language || [])[0] || "",
  };
}

function normalizarLivroISBN(book, isbn) {
  return {
    olKey:      book.key || "",
    authorKeys: [],
    titulo:     book.title || "",
    autor:      (book.authors || []).map((a) => a.name).join(", "),
    ano:        book.publish_date
      ? parseInt(book.publish_date.match(/\d{4}/)?.[0] || "0", 10) || null
      : null,
    editora:    (book.publishers || []).map((p) => p.name).join(", "),
    isbn,
    generos:    (book.subjects || []).map((s) => s.name).slice(0, 5),
    sinopse:    "",
    idioma:     "",
  };
}