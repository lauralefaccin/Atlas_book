const BASE = "http://localhost:3001/api";

function getToken() {
  try {
    const s = sessionStorage.getItem("sessao_atual");
    return s ? JSON.parse(s).token : null;
  } catch {
    return null;
  }
}

async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.erro || `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  login:    (login, senha, tipo) => req("POST", "/auth/login",    { login, senha, tipo }),
  cadastro: (dados)              => req("POST", "/auth/cadastro", dados),

  // Livros
  getLivros:    ()       => req("GET",    "/livros"),
  criarLivro:   (dados)  => req("POST",   "/livros",      dados),
  editarLivro:  (id, d)  => req("PUT",    `/livros/${id}`, d),
  deletarLivro: (id)     => req("DELETE", `/livros/${id}`),

  // Leitores
  getLeitores:    ()       => req("GET",    "/leitores"),
  criarLeitor:    (dados)  => req("POST",   "/leitores",      dados),
  editarLeitor:   (id, d)  => req("PUT",    `/leitores/${id}`, d),
  deletarLeitor:  (id)     => req("DELETE", `/leitores/${id}`),

  // Usuários genéricos (leitores e bibliotecários)
  getUsuarios:    ()       => req("GET",    "/usuarios"),
  editarUsuario:  (tipo, id, d) => req("PUT",    `/usuarios/${tipo}/${id}`, d),
  deletarUsuario: (tipo, id)     => req("DELETE", `/usuarios/${tipo}/${id}`),

  // Estante
  getEstante:             ()  => req("GET",    "/estante"),
  adicionarEstante:       (livroId) => req("POST",   `/estante/${livroId}`),
  atualizarStatusEstante: (livroId, status) => req("PATCH", `/estante/${livroId}`, { status }),
  toggleFavoritoEstante:  (livroId) => req("PATCH", `/estante/${livroId}/favorito`),
  removerEstante:         (livroId) => req("DELETE",  `/estante/${livroId}`),

  // Gêneros
  getGeneros:    ()       => req("GET",    "/generos"),
  criarGenero:   (dados)  => req("POST",   "/generos",      dados),
  editarGenero:  (id, d)  => req("PUT",    `/generos/${id}`, d),
  deletarGenero: (id)     => req("DELETE", `/generos/${id}`),

  // Autores
  getAutores:    ()       => req("GET",    "/autores"),
  criarAutor:    (dados)  => req("POST",   "/autores",      dados),
  editarAutor:   (id, d)  => req("PUT",    `/autores/${id}`, d),
  deletarAutor:  (id)     => req("DELETE", `/autores/${id}`),
};