/**
 * openLibraryApi.js
 * Serviço para buscar livros na Open Library (https://openlibrary.org)
 */

const OL_BASE = "https://openlibrary.org";

/**
 * Busca livros pelo título ou autor na Open Library.
 * @param {string} query - Termo de busca
 * @param {number} limit - Quantidade máxima de resultados
 * @returns {Promise<Array>} Lista de livros normalizados
 */
export async function buscarLivrosOpenLibrary(query, limit = 10) {
  if (!query || !query.trim()) return [];

  const url = `${OL_BASE}/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=key,title,author_name,first_publish_year,publisher,isbn,subject,language`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar na Open Library");

  const data = await res.json();
  const docs = data.docs || [];

  return docs.map((doc) => normalizarLivro(doc));
}

/**
 * Busca livros pelo ISBN.
 * @param {string} isbn
 * @returns {Promise<Object|null>} Livro normalizado ou null
 */
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

/**
 * Busca a capa de um livro pelo ISBN ou OL cover ID.
 * Tamanhos disponíveis: S, M, L
 */
export function getCoverUrl(isbn, tamanho = "M") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${tamanho}.jpg`;
}

// ── Normalizadores internos ─────────────────────────────────

function normalizarLivro(doc) {
  return {
    olKey: doc.key || "",
    titulo: doc.title || "",
    autor: (doc.author_name || []).join(", "),
    ano: doc.first_publish_year || null,
    editora: (doc.publisher || [])[0] || "",
    isbn: (doc.isbn || [])[0] || "",
    generos: (doc.subject || []).slice(0, 5),
    idioma: (doc.language || [])[0] || "",
  };
}

function normalizarLivroISBN(book, isbn) {
  const autores = (book.authors || []).map((a) => a.name).join(", ");
  const editoras = (book.publishers || []).map((p) => p.name).join(", ");

  return {
    olKey: book.key || "",
    titulo: book.title || "",
    autor: autores,
    ano: book.publish_date
      ? parseInt(book.publish_date.match(/\d{4}/)?.[0] || "0", 10) || null
      : null,
    editora: editoras,
    isbn,
    generos: (book.subjects || []).map((s) => s.name).slice(0, 5),
    sinopse: "",
  };
}