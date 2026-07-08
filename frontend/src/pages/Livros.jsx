import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Livros.css";
import { getGeneroColor, useGeneros } from "../data/generos";
import { useAutores } from "../data/autores";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import { api } from "../services/api";
import OpenLibrarySearch from "../components/OpenLibrarySearch";
import estanteIcon from "../imagens/icons/estante (2).png";

export default function Livros() {
  const TITULO_MAX_LENGTH = 60;
  const SINOPSE_MAX_LENGTH = 3000;
  const NACIONALIDADE_MAX_LENGTH = 60;
  const autores = useAutores();
  const generos = useGeneros();
  const [busca, setBusca] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const generoParam = params.get("genero");
  const [genero, setGenero] = useState(generoParam || "Todos os gêneros");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("genero");
    if (g) setGenero(g);
  }, [location.search]);

  const [modo, setModo] = useState(() => {
    const saved = localStorage.getItem("livrosModo");
    return saved || "cards";
  });

  useEffect(() => {
    localStorage.setItem("livrosModo", modo);
  }, [modo]);

  const { user } = useAuth();
  const isBibliotecario = user?.tipo === "bibliotecario";
  const { showPopup, showConfirmPopup } = usePopup();
  const [acervo, setAcervo] = useState([]);
  const [estanteIds, setEstanteIds] = useState([]);

  const initialForm = {
    genero: "",
    titulo: "",
    autorId: "",
    autorNome: "",
    nacionalidade: "",
    editora: "",
    ano: "",
    sinopse: "",
    conteudo: "",
  };

  const [formLivro, setFormLivro] = useState(initialForm);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

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

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find((g) => g.nome === generoNome);
    if (generoCustomizado?.cor) return generoCustomizado.cor;
    return getGeneroColor(generoNome);
  };

  const autoresMap = useMemo(
    () => Object.fromEntries(autores.map((autor) => [autor.id, autor.nome])),
    [autores]
  );

  const autoresMapByNome = useMemo(
    () => Object.fromEntries(autores.map((autor) => [autor.nome.trim().toLowerCase(), autor.id])),
    [autores]
  );

  const generosOptions = useMemo(
    () => ["Todos os gêneros", ...generos.map((g) => g.nome)],
    [generos]
  );

  const getAutorNome = (livro) => {
    const autorId = Number(livro.autorId);
    return autoresMap[autorId] || livro.autor || "";
  };

  const getAutorId = (livro) => {
    const autorId = Number(livro.autorId ?? livro.autor_id);
    if (autorId) return autorId.toString();
    const autorNome = (livro.autor || "").trim().toLowerCase();
    const autorEncontradoId = autoresMapByNome[autorNome];
    return autorEncontradoId ? autorEncontradoId.toString() : "";
  };

  const livrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return acervo.filter((livro) => {
      const atendeGenero = genero === "Todos os gêneros" || livro.genero === genero;
      if (!atendeGenero) return false;
      if (!termo) return true;
      const autorNome = getAutorNome(livro);
      const alvoBusca = `${livro.titulo} ${autorNome}`.toLowerCase();
      return alvoBusca.includes(termo);
    });
  }, [busca, genero, acervo, autoresMap]);

  // ── Open Library: preencher formulário automaticamente ────
  // Chamado duas vezes pelo OpenLibrarySearch:
  //   1ª vez → dados básicos imediatos (título, autor, ano, editora, gênero)
  //   2ª vez → dados detalhados (+ sinopse e nacionalidade)
  function handleOpenLibrarySelect(livroOL) {
    const nomeNormalizado = (livroOL.autor || "").trim().toLowerCase();
    const autorId = autoresMapByNome[nomeNormalizado] || "";
    const generoEncontrado = mapearGeneroOL(livroOL.generos, generos);

    setFormLivro((prev) => ({
      ...prev,
      titulo: livroOL.titulo
        ? livroOL.titulo.substring(0, TITULO_MAX_LENGTH)
        : prev.titulo,
      autorId: autorId ? autorId.toString() : prev.autorId,
      autorNome: livroOL.autor || prev.autorNome,
      editora: livroOL.editora
        ? livroOL.editora.substring(0, 30)
        : prev.editora,
      ano: livroOL.ano ? String(livroOL.ano) : prev.ano,
      genero: generoEncontrado || prev.genero,
      // sinopse e nacionalidade chegam vazios na 1ª chamada
      // e preenchidos na 2ª — só sobrescreve se vier algo
      sinopse: livroOL.sinopse
        ? livroOL.sinopse.substring(0, SINOPSE_MAX_LENGTH)
        : prev.sinopse,
      nacionalidade: livroOL.nacionalidade
        ? livroOL.nacionalidade.substring(0, NACIONALIDADE_MAX_LENGTH)
        : prev.nacionalidade,
    }));
  }

  // ── Adicionar à estante ────────────────────────────────────
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

  const abrirAdicionarLivro = () => {
    setFormLivro(initialForm);
    setEditandoId(null);
    setFormAberto(true);
  };

  const abrirEditarLivro = (livro) => {
    setFormLivro({
      genero: livro.genero || "",
      titulo: livro.titulo || "",
      autorId: getAutorId(livro),
      autorNome: getAutorNome(livro),
      nacionalidade: livro.nacionalidade || "",
      editora: livro.editora || "",
      ano: livro.ano?.toString() || "",
      sinopse: livro.sinopse || "",
      conteudo: livro.conteudo || "",
    });
    setEditandoId(livro.id);
    setFormAberto(true);
  };

  const cancelarFormulario = () => {
    setFormLivro(initialForm);
    setEditandoId(null);
    setFormAberto(false);
  };

  const salvarLivro = async () => {
    if (!formLivro.titulo.trim() || !formLivro.autorId || !formLivro.genero.trim()) {
      showPopup("Preencha pelo menos título, autor e gênero.");
      return;
    }
    const autorId = Number(formLivro.autorId);
    const autorNome = autoresMap[autorId] || formLivro.autorNome.trim();
    if (!autorId || !autorNome) {
      showPopup("Selecione um autor válido existente.");
      return;
    }
    const livroFormatado = {
      ...formLivro,
      titulo: formLivro.titulo.trim(),
      autorId,
      autor: autorNome,
      genero: formLivro.genero.trim(),
      nacionalidade: formLivro.nacionalidade.trim(),
      editora: formLivro.editora.trim(),
      ano: Number(formLivro.ano) || 0,
      sinopse: formLivro.sinopse.trim(),
      conteudo: formLivro.conteudo.trim(),
    };
    try {
      if (editandoId) {
        const livroAtualizado = await api.editarLivro(editandoId, livroFormatado);
        setAcervo((current) => current.map((livro) => (livro.id === editandoId ? livroAtualizado : livro)));
      } else {
        const novoLivro = await api.criarLivro(livroFormatado);
        setAcervo((current) => [...current, novoLivro]);
      }
      cancelarFormulario();
    } catch (err) {
      console.error("Erro ao salvar livro:", err.message);
      showPopup("Não foi possível salvar o livro no momento.");
    }
  };

  const excluirLivro = async (livro) => {
    showConfirmPopup(
      `Tem certeza de que deseja excluir "${livro.titulo}"? Esta ação removerá o livro de todas as páginas, incluindo a Estante de leitores.`,
      async () => {
        try {
          await api.deletarLivro(livro.id);
          setAcervo((current) => current.filter((item) => item.id !== livro.id));
          window.dispatchEvent(new CustomEvent("estante:changed"));
          if (editandoId === livro.id) cancelarFormulario();
        } catch (err) {
          console.error("Erro ao excluir livro:", err.message);
          showPopup("Não foi possível excluir o livro no momento.");
        }
      }
    );
  };

  return (
    <section className="livros-page">
      <header className="livros-header">
        <div>
          <p className="livros-kicker">Acervo</p>
          <h1>Livros</h1>
        </div>
        {isBibliotecario && (
          <button type="button" className="livros-add-btn" onClick={abrirAdicionarLivro}>
            + Adicionar Livro
          </button>
        )}
      </header>

      <div className="livros-filters">
        <label htmlFor="busca-livros" className="livros-search">
          <span aria-hidden="true">🔎</span>
          <input
            id="busca-livros"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por título, autor..."
          />
        </label>

        <select value={genero} onChange={(e) => setGenero(e.target.value)}>
          {generosOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

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

      {formAberto && (
        <>
          <div className="modal-backdrop" onClick={cancelarFormulario} />
          <section className="livros-form-panel modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="livros-form-grid">
              {/* ── Busca Open Library (só ao adicionar novo livro) ── */}
              {!editandoId && (
                <OpenLibrarySearch
                  onSelect={handleOpenLibrarySelect}
                  disabled={false}
                />
              )}

              <label>
                Gênero
                <select
                  value={formLivro.genero}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, genero: e.target.value }))}
                >
                  <option value="">Selecione um gênero</option>
                  {generos.map((g) => (
                    <option key={g.nome} value={g.nome}>{g.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  value={formLivro.titulo}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, titulo: e.target.value }))}
                  maxLength={TITULO_MAX_LENGTH}
                  placeholder="Título do livro"
                />
              </label>
              <label>
                Autor
                <select
                  value={formLivro.autorId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedAutor = autores.find((a) => a.id.toString() === selectedId);
                    setFormLivro((prev) => ({
                      ...prev,
                      autorId: selectedId,
                      autorNome: selectedAutor ? selectedAutor.nome : "",
                    }));
                  }}
                >
                  <option value="">Selecione um autor existente</option>
                  {autores.map((autor) => (
                    <option key={autor.id} value={autor.id}>{autor.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Nacionalidade
                <input
                  value={formLivro.nacionalidade}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, nacionalidade: e.target.value }))}
                  maxLength={NACIONALIDADE_MAX_LENGTH}
                  placeholder="Nacionalidade"
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Sinopse
                <textarea
                  value={formLivro.sinopse}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, sinopse: e.target.value }))}
                  maxLength={SINOPSE_MAX_LENGTH}
                  placeholder="Escreva a sinopse do livro"
                  rows={4}
                  style={{ resize: "vertical", minHeight: "100px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #dfd1ba", fontFamily: "inherit", fontSize: "14px", color: "#3f311f", backgroundColor: "#fff" }}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Conteúdo do livro
                <textarea
                  value={formLivro.conteudo}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, conteudo: e.target.value }))}
                  placeholder="Cole aqui o texto completo do livro"
                  rows={10}
                  style={{ resize: "vertical", minHeight: "180px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #dfd1ba", fontFamily: "inherit", fontSize: "14px", color: "#3f311f", backgroundColor: "#fff" }}
                />
              </label>
              <label>
                Editora
                <input
                  value={formLivro.editora}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, editora: e.target.value.slice(0, 30) }))}
                  placeholder="Editora"
                />
              </label>
              <label>
                Ano
                <input
                  value={formLivro.ano}
                  onChange={(e) => setFormLivro((prev) => ({ ...prev, ano: e.target.value.slice(0, 4) }))}
                  placeholder="Ano de publicação"
                  type="number"
                />
              </label>
            </div>
            <div className="livros-form-actions">
              <button type="button" className="btn-add-estante-list" onClick={salvarLivro}>
                {editandoId ? "Salvar alterações" : "Salvar livro"}
              </button>
              <button type="button" className="btn-delete" onClick={cancelarFormulario}>
                Cancelar
              </button>
            </div>
          </section>
        </>
      )}

      {modo === "cards" && (
        <div className="livros-grid">
          {livrosFiltrados.map((livro) => (
            <article
              key={livro.id}
              className="livro-card"
              style={{ "--livro-accent": getCorGenero(livro.genero) }}
            >
              <div className="livro-card-header">
                <p className="livro-genero">{livro.genero}</p>
                <button
                  className="btn-add-estante"
                  onClick={(e) => adicionarAEstante(livro, e)}
                  title={user ? "Salvar na Estante" : "Faça login para adicionar à estante"}
                  disabled={!user}
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
                  {getAutorNome(livro) || ""}
                  {getAutorNome(livro) && livro.nacionalidade ? " • " : ""}
                  {livro.nacionalidade || ""}
                </p>
                <div className="livro-meta">
                  <p>
                    {livro.editora?.substring(0, 30) || ""}
                    {livro.editora && livro.ano ? " • " : ""}
                    {livro.ano ? String(livro.ano).substring(0, 4) : ""}
                  </p>
                </div>
              </div>
              {isBibliotecario && (
                <div className="livro-card-actions">
                  <button type="button" className="btn-delete" onClick={(e) => { e.stopPropagation(); abrirEditarLivro(livro); }}>
                    Editar
                  </button>
                  <button type="button" className="btn-delete" onClick={(e) => { e.stopPropagation(); excluirLivro(livro); }}>
                    Excluir
                  </button>
                </div>
              )}
            </article>
          ))}
          {livrosFiltrados.length === 0 && (
            <div className="livros-vazio" style={{ gridColumn: "1 / -1" }}>
              Nenhum livro encontrado.
            </div>
          )}
        </div>
      )}

      {modo === "lista" && (
        <div className="livros-lista">
          {livrosFiltrados.map((livro) => (
            <article
              key={livro.id}
              className="livro-row"
              style={{ "--livro-accent": getCorGenero(livro.genero) }}
            >
              <div>
                <h3>{livro.titulo}</h3>
                <p className="livro-autor">
                  {getAutorNome(livro) || ""}
                  {getAutorNome(livro) && livro.nacionalidade ? " • " : ""}
                  {livro.nacionalidade || ""}
                </p>
                <p className="livro-meta-row">
                  {livro.editora?.substring(0, 30) || ""}
                  {livro.editora && livro.ano ? " • " : ""}
                  {livro.ano ? String(livro.ano).substring(0, 4) : ""}
                </p>
                {isBibliotecario && (
                  <div className="livro-row-actions">
                    <button type="button" className="btn-delete" onClick={() => abrirEditarLivro(livro)}>Editar</button>
                    <button type="button" className="btn-delete" onClick={() => excluirLivro(livro)}>Excluir</button>
                  </div>
                )}
              </div>
              <button
                className="btn-add-estante-list"
                onClick={(e) => adicionarAEstante(livro, e)}
                title={user ? "Salvar na Estante" : "Faça login para adicionar à estante"}
                disabled={!user}
              >
                <img src={estanteIcon} alt="Salvar na Estante" /> Salvar
              </button>
            </article>
          ))}
          {livrosFiltrados.length === 0 && (
            <div className="livros-vazio">Nenhum livro encontrado.</div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Helper: mapear gênero da Open Library ─────────────────
function mapearGeneroOL(generosOL, generosLocais) {
  if (!generosOL || generosOL.length === 0) return "";
  if (!generosLocais || generosLocais.length === 0) return "";

  const nomesLocais = generosLocais.map((g) => g.nome.toLowerCase());

  for (const generoOL of generosOL) {
    const gl = generoOL.toLowerCase();

    // Busca direta
    const exato = nomesLocais.findIndex((n) => gl.includes(n) || n.includes(gl));
    if (exato !== -1) return generosLocais[exato].nome;

    // Mapeamentos comuns Open Library → AtlasBook
    const alias = {
      fiction: "Ficção",
      fantasy: "Fantasia",
      romance: "Romance",
      classic: "Clássico",
      novel: "Romance",
      adventure: "Ficção",
      "science fiction": "Ficção",
      dystopia: "Ficção",
      "literary fiction": "Ficção",
    };

    for (const [chave, valor] of Object.entries(alias)) {
      if (gl.includes(chave)) {
        const encontrado = generosLocais.find((g) => g.nome === valor);
        if (encontrado) return encontrado.nome;
      }
    }
  }

  return "";
}