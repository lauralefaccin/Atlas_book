import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAutores, dispatchAutoresChanged } from "../data/autores";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import { getGeneroColor, useGeneros } from "../data/generos";
import { api } from "../services/api";
import "./Livros.css";
import estanteIcon from "../imagens/icons/estante (2).png";

const initialForm = {
  nome: "",
  ano_nascimento: "",
  nacionalidade: "",
  descricao: "",
  principais_generos: [],
};

export default function Autores() {
  const autores = useAutores();
  const [acervo, setAcervo] = useState([]);
  const generos = useGeneros();
  const { user } = useAuth();
  const isBibliotecario = user?.tipo === "bibliotecario";
  const { showPopup, showConfirmPopup } = usePopup();
  const [estanteIds, setEstanteIds] = useState([]);
  const navigate = useNavigate();

  const [modo, setModo] = useState(() => localStorage.getItem("autoresModo") || "cards");
  useEffect(() => { localStorage.setItem("autoresModo", modo); }, [modo]);

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find((g) => g.nome === generoNome);
    return generoCustomizado?.cor || getGeneroColor(generoNome);
  };

  const [busca, setBusca] = useState("");
  const [selectedAutor, setSelectedAutor] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [expandedLivroId, setExpandedLivroId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [formAutor, setFormAutor] = useState(initialForm);
  const [salvando, setSalvando] = useState(false);

  const autoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return autores.filter((autor) => autor.nome.toLowerCase().includes(termo));
  }, [autores, busca]);

  const livrosDoAutor = useMemo(() => {
    if (!selectedAutor) return [];
    return acervo.filter((livro) => livro.autor === selectedAutor.nome);
  }, [acervo, selectedAutor]);

  const livrosFiltradosPorBusca = useMemo(() => {
    if (!selectedAutor) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return livrosDoAutor;
    return livrosDoAutor.filter((livro) =>
      `${livro.titulo} ${livro.genero}`.toLowerCase().includes(termo)
    );
  }, [selectedAutor, livrosDoAutor, busca]);

  useEffect(() => {
    async function loadEstante() {
      if (!user) { setEstanteIds([]); return; }
      try {
        const estante = await api.getEstante();
        setEstanteIds(estante.map((item) => item.id));
      } catch (err) {
        console.error("Erro ao carregar estante:", err.message);
        setEstanteIds([]);
      }
    }
    loadEstante();
    const handler = () => loadEstante();
    window.addEventListener("estante:changed", handler);
    return () => window.removeEventListener("estante:changed", handler);
  }, [user]);

  useEffect(() => {
    async function loadLivros() {
      if (!user) { setAcervo([]); return; }
      try {
        const livros = await api.getLivros();
        setAcervo(livros);
      } catch (err) {
        console.error("Erro ao carregar livros:", err.message);
        setAcervo([]);
      }
    }
    loadLivros();
  }, [user]);

  const adicionarAEstante = async (livro, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!user) { showPopup("Faça login para adicionar livros à estante."); return; }
    if (estanteIds.includes(livro.id)) { showPopup("Este livro já está na sua estante!"); return; }
    try {
      await api.adicionarEstante(livro.id);
      setEstanteIds((current) => [...current, livro.id]);
      window.dispatchEvent(new CustomEvent("estante:changed"));
      showPopup(`${livro.titulo} foi adicionado à sua Estante!`);
    } catch (err) {
      console.error("Erro ao adicionar à estante:", err.message);
      showPopup("Não foi possível adicionar à estante no momento.");
    }
  };

  const normalizeGeneros = (g) => {
    if (Array.isArray(g)) return g;
    if (typeof g === "string") return g.split(",").map((item) => item.trim()).filter(Boolean);
    return [];
  };

  const abrirAdicionarAutor = () => {
    setFormAutor(initialForm);
    setEditandoId(null);
    setFormAberto(true);
  };

  const abrirEditarAutor = (autor) => {
    setFormAutor({
      nome: autor.nome || "",
      ano_nascimento: autor.ano_nascimento?.toString() || "",
      nacionalidade: autor.nacionalidade || "",
      descricao: autor.descricao || "",
      principais_generos: normalizeGeneros(autor.principais_generos),
    });
    setEditandoId(autor.id);
    setFormAberto(true);
  };

  const cancelarFormulario = () => {
    setFormAutor(initialForm);
    setEditandoId(null);
    setFormAberto(false);
  };

  const salvarAutor = async () => {
    if (!formAutor.nome.trim()) { showPopup("Preencha o nome do autor."); return; }
    if (formAutor.principais_generos.length === 0) { showPopup("Selecione pelo menos um gênero."); return; }

    const payload = {
      nome: formAutor.nome.trim(),
      ano_nascimento: Number(formAutor.ano_nascimento) || null,
      nacionalidade: formAutor.nacionalidade.trim(),
      descricao: formAutor.descricao.trim(),
      principais_generos: normalizeGeneros(formAutor.principais_generos),
    };

    try {
      setSalvando(true);
      if (editandoId) {
        await api.editarAutor(editandoId, payload);
      } else {
        await api.criarAutor(payload);
      }
      dispatchAutoresChanged();
      cancelarFormulario();
    } catch (err) {
      console.error("Erro ao salvar autor:", err.message);
      showPopup(`Não foi possível salvar o autor: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const excluirAutor = (autor) => {
    showConfirmPopup(
      `Tem certeza de que deseja excluir o autor ${autor.nome}?`,
      async () => {
        try {
          await api.deletarAutor(autor.id);
          dispatchAutoresChanged();
          if (selectedAutor?.id === autor.id) setSelectedAutor(null);
        } catch (err) {
          console.error("Erro ao excluir autor:", err.message);
          showPopup(`Não foi possível excluir o autor: ${err.message}`);
        }
      }
    );
  };

  return (
    <section className="livros-page">
      {!selectedAutor && (
        <>
          <header className="livros-header">
            <div>
              <p className="livros-kicker">Catálogo</p>
              <h1>Autores</h1>
            </div>
            {isBibliotecario && (
              <button type="button" className="livros-add-btn" onClick={abrirAdicionarAutor}>
                + Adicionar Autor
              </button>
            )}
          </header>

          <div className="livros-filters">
            <label htmlFor="busca-autores" className="livros-search">
              <span aria-hidden="true">🔎</span>
              <input
                id="busca-autores"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar autores pelo nome..."
              />
            </label>

            <div className="modo-toggle">
              <button
                type="button"
                className={`modo-toggle-btn ${modo === "cards" ? "active" : ""}`}
                onClick={() => setModo("cards")}
              >
                Cards
              </button>
              <button
                type="button"
                className={`modo-toggle-btn ${modo === "lista" ? "active" : ""}`}
                onClick={() => setModo("lista")}
              >
                Lista
              </button>
            </div>
          </div>
        </>
      )}

      {formAberto && (
        <>
          <div className="modal-backdrop" onClick={cancelarFormulario} />
          <section className="livros-form-panel modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="livros-form-grid">
              <label>
                Nome
                <input
                  value={formAutor.nome}
                  onChange={(e) => setFormAutor((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do autor"
                />
              </label>
              <label>
                Ano de nascimento
                <input
                  type="number"
                  value={formAutor.ano_nascimento}
                  onChange={(e) => setFormAutor((prev) => ({ ...prev, ano_nascimento: e.target.value.slice(0, 4) }))}
                  placeholder="Ano de nascimento"
                />
              </label>
              <label>
                Nacionalidade
                <input
                  value={formAutor.nacionalidade}
                  onChange={(e) => setFormAutor((prev) => ({ ...prev, nacionalidade: e.target.value }))}
                  placeholder="Nacionalidade"
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Principais gêneros
                <div className="generos-lista-selecao">
                  {generos.map((genero) => {
                    const selecionado = formAutor.principais_generos.includes(genero.nome);
                    return (
                      <button
                        key={genero.nome}
                        type="button"
                        className={`generos-lista-item${selecionado ? " is-selected" : ""}`}
                        onClick={() =>
                          setFormAutor((prev) => ({
                            ...prev,
                            principais_generos: selecionado
                              ? prev.principais_generos.filter((item) => item !== genero.nome)
                              : [...prev.principais_generos, genero.nome],
                          }))
                        }
                      >
                        <span>{genero.nome}</span>
                      </button>
                    );
                  })}
                </div>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Descrição opcional
                <textarea
                  value={formAutor.descricao}
                  onChange={(e) => setFormAutor((prev) => ({ ...prev, descricao: e.target.value.slice(0, 100) }))}
                  placeholder="Breve descrição do autor"
                  rows={4}
                  style={{ resize: "vertical", minHeight: "96px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #dfd1ba", fontFamily: "inherit", fontSize: "14px", color: "#3f311f", backgroundColor: "#fff" }}
                />
              </label>
            </div>
            <div className="livros-form-actions">
              <button type="button" className="btn-add-estante-list" onClick={salvarAutor} disabled={salvando}>
                {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar autor"}
              </button>
              <button type="button" className="btn-delete" onClick={cancelarFormulario}>
                Cancelar
              </button>
            </div>
          </section>
        </>
      )}

      {selectedAutor ? (
        <>
          <div className="livros-header" style={{ marginTop: 0 }}>
            <div>
              <p className="livros-kicker">Autor selecionado</p>
              <h1>{selectedAutor.nome}</h1>
            </div>
            <button type="button" className="livros-add-btn" onClick={() => setSelectedAutor(null)}>
              Voltar para autores
            </button>
          </div>

          <div className="livros-filters" style={{ marginBottom: 10, borderBottom: "none" }}>
            <label htmlFor="busca-livros" className="livros-search">
              <span aria-hidden="true">🔎</span>
              <input
                id="busca-livros"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar livros ou gêneros do autor..."
              />
            </label>
            <p style={{ margin: 0, color: "#6f5f49" }}>
              {livrosFiltradosPorBusca.length} livro(s) encontrado(s) para este autor.
            </p>
          </div>

          {livrosFiltradosPorBusca.length > 0 ? (
            <div className="livros-grid">
              {livrosFiltradosPorBusca.map((livro) => (
                <article
                  key={livro.id}
                  className={`livro-card${expandedLivroId === livro.id ? " expanded" : ""}`}
                  style={{ "--livro-accent": getCorGenero(livro.genero) }}
                >
                  <div className="livro-card-header">
                    <p className="livro-genero">{livro.genero}</p>
                    <button
                      className="btn-add-estante"
                      onClick={(e) => adicionarAEstante(livro, e)}
                      title="Salvar na Estante"
                    >
                      <img src={estanteIcon} alt="Salvar na Estante" />
                    </button>
                  </div>
                  <div
                    className="livro-card-clickable"
                    onClick={() => navigate(`/livro/${livro.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <h3>{livro.titulo}</h3>
                    <p className="livro-autor">{selectedAutor.nome} • {livro.nacionalidade}</p>
                    <div className="livro-meta">
                      <p>{livro.editora || "Editora não informada"}</p>
                      <p>{livro.ano || "-"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="livros-vazio">Nenhum livro encontrado para este autor.</div>
          )}
        </>
      ) : (
        <>
          {modo === "cards" && (
            <div className="livros-grid">
              {autoresFiltrados.map((autor) => {
                const generoPrincipal = normalizeGeneros(autor.principais_generos)[0] || "";
                const generosAutor = normalizeGeneros(autor.principais_generos);
                return (
                  <article
                    key={autor.id}
                    className="livro-card"
                    style={{ "--livro-accent": getCorGenero(generoPrincipal), cursor: "pointer" }}
                    onClick={() => setSelectedAutor(autor)}
                  >
                    <div className="livro-card-header">
                      <p className="livro-genero">{generoPrincipal || "Autor"}</p>
                    </div>
                    <h3>{autor.nome}</h3>
                    <p className="livro-autor">{autor.nacionalidade || ""}</p>
                    {autor.ano_nascimento && (
                      <p className="livro-meta-row">Nascido em {autor.ano_nascimento}</p>
                    )}
                    {autor.descricao && (
                      <p className="livro-descricao">{autor.descricao}</p>
                    )}
                    {generosAutor.length > 0 && (
                      <p className="livro-meta-row">Gêneros: {generosAutor.join(", ")}</p>
                    )}
                    {isBibliotecario && (
                      <div className="livro-card-actions">
                        <button
                          type="button"
                          className="btn-action-small"
                          onClick={(e) => { e.stopPropagation(); abrirEditarAutor(autor); }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-action-small"
                          onClick={(e) => { e.stopPropagation(); excluirAutor(autor); }}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}

              {autoresFiltrados.length === 0 && (
                <div className="livros-vazio">
                  Nenhum autor encontrado. Ajuste a pesquisa ou adicione um novo autor.
                </div>
              )}
            </div>
          )}

          {modo === "lista" && (
            <div className="livros-lista">
              {autoresFiltrados.map((autor) => {
                const generoPrincipal = normalizeGeneros(autor.principais_generos)[0] || "";
                const generosAutor = normalizeGeneros(autor.principais_generos);
                return (
                  <article
                    key={autor.id}
                    className="livro-row"
                    style={{ "--livro-accent": getCorGenero(generoPrincipal), cursor: "pointer" }}
                    onClick={() => setSelectedAutor(autor)}
                  >
                    <div>
                      <h3>{autor.nome}</h3>
                      <p className="livro-autor">{autor.nacionalidade || ""}</p>
                      {autor.ano_nascimento && (
                        <p className="livro-meta-row">Nascido em {autor.ano_nascimento}</p>
                      )}
                      {autor.descricao && (
                        <p className="livro-descricao">{autor.descricao}</p>
                      )}
                      {generosAutor.length > 0 && (
                        <p className="livro-meta-row">Gêneros: {generosAutor.join(", ")}</p>
                      )}
                      {isBibliotecario && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn-add-estante-list"
                            onClick={(e) => { e.stopPropagation(); abrirEditarAutor(autor); }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={(e) => { e.stopPropagation(); excluirAutor(autor); }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {autoresFiltrados.length === 0 && (
                <div className="livros-vazio">
                  Nenhum autor encontrado. Ajuste a pesquisa ou adicione um novo autor.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}