import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAutores } from "../data/autores";
import { useGeneros, getGeneroColor, dispatchGenerosChanged } from "../data/generos";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import { api } from "../services/api";
import "./Livros.css";
import estanteIcon from "../imagens/icons/estante (2).png";

const initialGeneroForm = {
  nome: "",
  descricao: "",
  cor: "",
};

export default function Generos() {
  const [acervo, setAcervo] = useState([]);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState(() => localStorage.getItem("generosModo") || "cards");
  useEffect(() => { localStorage.setItem("generosModo", modo); }, [modo]);

  const generos = useGeneros();
  const [formAberto, setFormAberto] = useState(false);
  const [editandoGenero, setEditandoGenero] = useState(null); // objeto completo
  const [formGenero, setFormGenero] = useState(initialGeneroForm);
  const [selectedGenero, setSelectedGenero] = useState(null);
  const [expandedLivroId, setExpandedLivroId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();

  const autores = useAutores();
  const autoresMap = useMemo(
    () => Object.fromEntries(autores.map((autor) => [autor.id, autor.nome])),
    [autores]
  );
  const [estanteIds, setEstanteIds] = useState([]);

  const { user } = useAuth();
  const isBibliotecario = user?.tipo === "bibliotecario";
  const { showPopup, showConfirmPopup } = usePopup();

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find((g) => g.nome === generoNome);
    return generoCustomizado?.cor || getGeneroColor(generoNome);
  };

  const livrosDoGenero = useMemo(() => {
    if (!selectedGenero) return [];
    return acervo.filter((livro) => livro.genero === selectedGenero.nome);
  }, [acervo, selectedGenero]);

  const livrosFiltradosPorBusca = useMemo(() => {
    if (!selectedGenero) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return livrosDoGenero;
    return livrosDoGenero.filter((livro) => {
      const autorNome = livro.autor || "";
      return `${livro.titulo} ${autorNome} ${livro.genero}`.toLowerCase().includes(termo);
    });
  }, [selectedGenero, livrosDoGenero, busca]);

  const livrosPorGenero = useMemo(() => {
    return acervo.reduce((acc, livro) => {
      acc[livro.genero] = (acc[livro.genero] || 0) + 1;
      return acc;
    }, {});
  }, [acervo]);

  const generosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return generos;
    return generos.filter((item) =>
      `${item.nome} ${item.descricao}`.toLowerCase().includes(termo)
    );
  }, [busca, generos]);

  useEffect(() => {
    async function loadEstante() {
      if (!user) { setEstanteIds([]); return; }
      try {
        const estante = await api.getEstante();
        setEstanteIds(estante.map((livro) => livro.id));
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

  const abrirAdicionarGenero = () => {
    setFormGenero(initialGeneroForm);
    setEditandoGenero(null);
    setFormAberto(true);
  };

  const abrirEditarGenero = (item) => {
    setFormGenero({ nome: item.nome, descricao: item.descricao, cor: item.cor || "" });
    setEditandoGenero(item);
    setFormAberto(true);
  };

  const cancelarFormulario = () => {
    setFormGenero(initialGeneroForm);
    setEditandoGenero(null);
    setFormAberto(false);
  };

  const salvarGenero = async () => {
    const nome = formGenero.nome.trim();
    const descricao = formGenero.descricao.trim();
    const cor = formGenero.cor.trim();

    if (!nome || !descricao) {
      showPopup("Preencha nome e descrição do gênero.");
      return;
    }

    const nomeEmUso = generos.some(
      (item) =>
        item.nome.toLowerCase() === nome.toLowerCase() &&
        item.id !== editandoGenero?.id
    );
    if (nomeEmUso) {
      showPopup("Já existe um gênero com esse nome.");
      return;
    }

    try {
      setSalvando(true);
      if (editandoGenero) {
        await api.editarGenero(editandoGenero.id, { nome, descricao, cor });
      } else {
        await api.criarGenero({ nome, descricao, cor });
      }
      dispatchGenerosChanged();
      cancelarFormulario();
    } catch (err) {
      console.error("Erro ao salvar gênero:", err.message);
      showPopup(`Não foi possível salvar o gênero: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGenero = (item) => {
    const qtd = livrosPorGenero[item.nome] || 0;
    if (qtd > 0) {
      showPopup("Não é possível excluir gêneros que têm livros cadastrados.");
      return;
    }
    showConfirmPopup(`Deseja excluir o gênero "${item.nome}"?`, async () => {
      try {
        await api.deletarGenero(item.id);
        dispatchGenerosChanged();
        if (editandoGenero?.id === item.id) cancelarFormulario();
      } catch (err) {
        console.error("Erro ao excluir gênero:", err.message);
        showPopup(`Não foi possível excluir o gênero: ${err.message}`);
      }
    });
  };

  return (
    <section className="livros-page">
      {!selectedGenero && (
        <>
          <header className="livros-header">
            <div>
              <p className="livros-kicker">Catálogo</p>
              <h1>Gêneros</h1>
            </div>
            {isBibliotecario && (
              <button type="button" className="livros-add-btn" onClick={abrirAdicionarGenero}>
                + Adicionar Gênero
              </button>
            )}
          </header>

          <div className="livros-filters">
            <label htmlFor="busca-generos" className="livros-search">
              <span aria-hidden="true">🔎</span>
              <input
                id="busca-generos"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar gênero..."
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
                  value={formGenero.nome}
                  onChange={(e) => setFormGenero((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do gênero"
                />
              </label>
              <label>
                Cor
                <input
                  type="color"
                  value={formGenero.cor || "#c08928"}
                  onChange={(e) => setFormGenero((prev) => ({ ...prev, cor: e.target.value }))}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Descrição
                <textarea
                  value={formGenero.descricao}
                  onChange={(e) => setFormGenero((prev) => ({ ...prev, descricao: e.target.value.slice(0, 80) }))}
                  placeholder="Descrição do gênero"
                  rows={3}
                  style={{ resize: "vertical", minHeight: "72px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #dfd1ba", fontFamily: "inherit", fontSize: "14px", color: "#3f311f", backgroundColor: "#fff" }}
                />
              </label>
            </div>
            <div className="livros-form-actions">
              <button type="button" className="btn-add-estante-list" onClick={salvarGenero} disabled={salvando}>
                {salvando ? "Salvando..." : editandoGenero ? "Salvar alterações" : "Salvar gênero"}
              </button>
              <button type="button" className="btn-delete" onClick={cancelarFormulario}>
                Cancelar
              </button>
            </div>
          </section>
        </>
      )}

      {selectedGenero ? (
        <>
          <div className="livros-header" style={{ marginTop: 0 }}>
            <div>
              <p className="livros-kicker">Gênero selecionado</p>
              <h1>{selectedGenero.nome}</h1>
            </div>
            <button type="button" className="livros-add-btn" onClick={() => setSelectedGenero(null)}>
              Voltar para gêneros
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
                placeholder="Pesquisar livros ou nome do autor..."
              />
            </label>
            <p style={{ margin: 0, color: "#6f5f49" }}>
              {livrosFiltradosPorBusca.length} livro(s) encontrado(s) para este gênero.
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
                      type="button"
                      className="btn-add-estante"
                      onClick={(e) => adicionarAEstante(livro, e)}
                      title={user ? "Salvar na Estante" : "Faça login para adicionar à estante"}
                      disabled={!user || estanteIds.includes(livro.id)}
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
                    <p className="livro-autor">
                      {autoresMap[livro.autorId] || livro.autor || "Autor não informado"}
                      {livro.nacionalidade ? ` • ${livro.nacionalidade}` : ""}
                    </p>
                    <div className="livro-meta">
                      <p>{livro.editora}{livro.editora && livro.ano ? " • " : ""}{livro.ano}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="livros-vazio">Nenhum livro encontrado para este gênero.</div>
          )}
        </>
      ) : (
        <>
          {modo === "cards" && (
            <div className="livros-grid">
              {generosFiltrados.map((item) => (
                <article
                  key={item.id}
                  className="livro-card"
                  style={{ "--livro-accent": item.cor || getGeneroColor(item.nome), cursor: "pointer" }}
                  onClick={() => setSelectedGenero(item)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => (e.key === "Enter" || e.key === " ") && setSelectedGenero(item)}
                >
                  <h3>{item.nome}</h3>
                  <p className="livro-descricao">{item.descricao}</p>
                  <div className="livro-meta">
                    <p>Livros no acervo</p>
                    <p>{livrosPorGenero[item.nome] || 0}</p>
                  </div>
                  {isBibliotecario && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-add-estante-list"
                        onClick={(e) => { e.stopPropagation(); abrirEditarGenero(item); }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={(e) => { e.stopPropagation(); excluirGenero(item); }}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </article>
              ))}

              {generosFiltrados.length === 0 && (
                <p className="livros-vazio">Nenhum gênero encontrado para a busca.</p>
              )}
            </div>
          )}

          {modo === "lista" && (
            <div className="livros-lista">
              {generosFiltrados.map((item) => (
                <article
                  key={item.id}
                  className="livro-row"
                  style={{ "--livro-accent": item.cor || getGeneroColor(item.nome) }}
                >
                  <div>
                    <h3>{item.nome}</h3>
                    <p className="livro-autor">{item.descricao}</p>
                    {isBibliotecario && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn-add-estante-list"
                          onClick={(e) => { e.stopPropagation(); abrirEditarGenero(item); }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={(e) => { e.stopPropagation(); excluirGenero(item); }}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                  <p>Livros no acervo</p>
                  <p>{livrosPorGenero[item.nome] || 0}</p>
                </article>
              ))}

              {generosFiltrados.length === 0 && (
                <p className="livros-vazio">Nenhum gênero encontrado para a busca.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}