import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAutores } from "../data/autores";
import "./Livros.css";
import {
  GENEROS,
  getGeneroColor,
  loadGeneros,
  saveGeneros,
} from "../data/generos";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import { api } from "../services/api";
import estanteIcon from "../imagens/icons/estante (2).png";

const initialGeneroForm = {
  nome: "",
  descricao: "",
  cor: "",
};

export default function Generos() {
  const [acervo, setAcervo] = useState([]);
  const [carregandoLivros, setCarregandoLivros] = useState(true);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("cards");
  const [generos, setGeneros] = useState(() => loadGeneros());
  const [formAberto, setFormAberto] = useState(false);
  const [editandoGenero, setEditandoGenero] = useState(null);
  const [formGenero, setFormGenero] = useState(initialGeneroForm);
  const [selectedGenero, setSelectedGenero] = useState(null);
  const [expandedLivroId, setExpandedLivroId] = useState(null);
  const navigate = useNavigate();

  const autores = useAutores();
  const autoresMap = useMemo(
    () => Object.fromEntries(autores.map((autor) => [autor.id, autor.nome])),
    [autores]
  );
  const [estanteIds, setEstanteIds] = useState([]);

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find((g) => g.nome === generoNome);
    if (generoCustomizado?.cor) {
      return generoCustomizado.cor;
    }
    return getGeneroColor(generoNome);
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
      const alvo = `${livro.titulo} ${autorNome} ${livro.genero}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [selectedGenero, livrosDoGenero, busca]);

  const livrosPorGenero = useMemo(() => {
    return acervo.reduce((acc, livro) => {
      acc[livro.genero] = (acc[livro.genero] || 0) + 1;
      return acc;
    }, {});
  }, [acervo]);

  const { user } = useAuth();
  const isBibliotecario = user?.tipo === "bibliotecario";
  const { showPopup, showConfirmPopup } = usePopup();

  useEffect(() => {
    async function loadEstante() {
      if (!user) {
        setEstanteIds([]);
        return;
      }

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
      if (!user) {
        setAcervo([]);
        setCarregandoLivros(false);
        return;
      }

      try {
        const livros = await api.getLivros();
        setAcervo(livros);
      } catch (err) {
        console.error("Erro ao carregar livros:", err.message);
        setAcervo([]);
      } finally {
        setCarregandoLivros(false);
      }
    }

    loadLivros();
  }, [user]);

  const generosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return generos;
    }

    return generos.filter((item) => {
      const alvo = `${item.nome} ${item.descricao}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [busca, generos]);

  const abrirAdicionarGenero = () => {
    setFormGenero(initialGeneroForm);
    setEditandoGenero(null);
    setFormAberto(true);
  };

  const abrirEditarGenero = (item) => {
    setFormGenero({
      nome: item.nome,
      descricao: item.descricao,
      cor: item.cor || "",
    });
    setEditandoGenero(item.nome);
    setFormAberto(true);
  };

  const cancelarFormulario = () => {
    setFormGenero(initialGeneroForm);
    setEditandoGenero(null);
    setFormAberto(false);
  };

  const salvarGenero = () => {
    const nome = formGenero.nome.trim();
    const descricao = formGenero.descricao.trim();
    const cor = formGenero.cor.trim();

    if (!nome || !descricao) {
      showPopup("Preencha nome e descrição do gênero.");
      return;
    }

    const existeOutro = generos.some(
      (item) => item.nome.toLowerCase() === nome.toLowerCase() && item.nome !== editandoGenero
    );

    if (existeOutro) {
      showPopup("Já existe um gênero com esse nome.");
      return;
    }

    const novoGenero = { nome, descricao, cor };
    const generosAtualizados = editandoGenero
      ? generos.map((item) => (item.nome === editandoGenero ? novoGenero : item))
      : [...generos, novoGenero];

    setGeneros(generosAtualizados);
    saveGeneros(generosAtualizados);

    if (editandoGenero && editandoGenero !== nome) {
      // A atualização de gêneros de livros ainda não é persistida no backend.
      // Portanto apenas a lista de gêneros é atualizada aqui.
    }

    cancelarFormulario();
  };

  const adicionarAEstante = async (livro, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user) {
      showPopup("Faça login para adicionar livros à estante.");
      return;
    }

    if (estanteIds.includes(livro.id)) {
      showPopup("Este livro já está na sua estante!");
      return;
    }

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

  const excluirGenero = (item) => {
    const qtd = livrosPorGenero[item.nome] || 0;
    if (qtd > 0) {
      showPopup("Não é possível excluir gêneros que têm livros cadastrados.");
      return;
    }

    showConfirmPopup(`Deseja excluir o gênero "${item.nome}"?`, () => {
      const generosAtuais = generos.filter((genero) => genero.nome !== item.nome);
      setGeneros(generosAtuais);
      saveGeneros(generosAtuais);

      if (editandoGenero === item.nome) {
        cancelarFormulario();
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
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Pesquisar gênero..."
              />
            </label>

            <select
              value={modo}
              onChange={(event) => setModo(event.target.value)}
              aria-label="Modo de visualização"
            >
              <option value="cards">Cards</option>
              <option value="lista">Lista</option>
            </select>
          </div>
        </>
      )}

      {formAberto && (
        <>
          <div className="modal-backdrop" onClick={cancelarFormulario} />
          <section className="livros-form-panel modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="livros-form-grid">
              <label>
                Nome
                <input
                  value={formGenero.nome}
                  onChange={(event) => setFormGenero((prev) => ({ ...prev, nome: event.target.value }))}
                  placeholder="Nome do gênero"
                />
              </label>
              <label>
                Cor
                <input
                  type="color"
                  value={formGenero.cor}
                  onChange={(event) => setFormGenero((prev) => ({ ...prev, cor: event.target.value }))}
                  placeholder="Cor (hex)"
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Descrição
                <textarea
                  value={formGenero.descricao}
                  onChange={(event) => {
                    const valor = event.target.value.slice(0, 80);
                    setFormGenero((prev) => ({ ...prev, descricao: valor }));
                  }}
                  placeholder="Descrição do gênero"
                  rows={3}
                  style={{ resize: "vertical", minHeight: "72px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #dfd1ba", fontFamily: "inherit", fontSize: "14px", color: "#3f311f", backgroundColor: "#fff" }}
                />
              </label>
            </div>
            <div className="livros-form-actions">
              <button type="button" className="btn-add-estante-list" onClick={salvarGenero}>
                {editandoGenero ? "Salvar alterações" : "Salvar gênero"}
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
            <p style={{ margin: 0, color: "#6f5f49" }}>{livrosFiltradosPorBusca.length} livro(s) encontrado(s) para este gênero.</p>
          </div>

          {livrosFiltradosPorBusca.length > 0 ? (
            <div className="livros-grid">
              {livrosFiltradosPorBusca.map((livro) => {
                const aberto = expandedLivroId === livro.id;
                return (
                  <article
                    key={livro.id}
                    className={`livro-card${aberto ? " expanded" : ""}`}
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
                      <p className="livro-autor">{autoresMap[livro.autorId] || livro.autor || "Autor não informado"} • {livro.nacionalidade}</p>
                      <div className="livro-meta">
                        <p>{livro.editora} • {livro.ano}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="livros-vazio">Nenhum livro encontrado para este gênero.</div>
          )}
        </>
      ) : (
        modo === "cards" && (
          <div className="livros-grid">
            {generosFiltrados.map((item) => (
              <article
                key={item.nome}
                className="livro-card"
                style={{ "--livro-accent": item.cor || getGeneroColor(item.nome), cursor: "pointer" }}
                onClick={() => setSelectedGenero(item)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedGenero(item)}
              >
                <h3>{item.nome}</h3>
                <p className="livro-descricao">{item.descricao}</p>

                <div className="livro-meta">
                  <p>Livros no acervo</p>
                  <p>{livrosPorGenero[item.nome] || 0}</p>
                </div>

                {isBibliotecario && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button type="button" className="btn-add-estante-list" onClick={(e) => { e.stopPropagation(); abrirEditarGenero(item); }}>
                      Editar
                    </button>
                    <button type="button" className="btn-delete" onClick={(e) => { e.stopPropagation(); excluirGenero(item); }}>
                      Excluir
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      )}

      {modo === "lista" && (
        <div className="livros-lista">
          {generosFiltrados.map((item) => (
            <article
              key={item.nome}
              className="livro-row"
              style={{ "--livro-accent": item.cor || getGeneroColor(item.nome) }}
            >
              <div>
                <h3>{item.nome}</h3>
                <p className="livro-autor">{item.descricao}</p>
                {isBibliotecario && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button type="button" className="btn-add-estante-list" onClick={(e) => { e.stopPropagation(); abrirEditarGenero(item); }}>
                      Editar
                    </button>
                    <button type="button" className="btn-delete" onClick={(e) => { e.stopPropagation(); excluirGenero(item); }}>
                      Excluir
                    </button>
                  </div>
                )}
              </div>
              <p>Livros no acervo</p>
              <p>{livrosPorGenero[item.nome] || 0}</p>
            </article>
          ))}
        </div>
      )}

      {generosFiltrados.length === 0 && (
        <p className="livros-vazio">Nenhum gênero encontrado para a busca.</p>
      )}
    </section>
  );
}