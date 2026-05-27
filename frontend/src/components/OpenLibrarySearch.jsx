import { useState, useRef, useEffect } from "react";
import { buscarLivrosOpenLibrary, buscarDetalhesLivro } from "../services/openLibraryApi";
import "./OpenLibrarySearch.css";

/**
 * Campo de busca na Open Library.
 *
 * Ao digitar  → busca lista de livros (título, autor, ano, editora)
 * Ao selecionar → busca detalhes extras (sinopse + nacionalidade)
 *                 e chama onSelect com tudo preenchido
 */
export default function OpenLibrarySearch({ onSelect, disabled }) {
  const [query, setQuery]           = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);
  const [statusMsg, setStatusMsg]   = useState("");
  const [aberto, setAberto]         = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setAberto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setStatusMsg("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim() || val.trim().length < 3) {
      setResultados([]);
      setAberto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setCarregando(true);
      setAberto(true);
      setStatusMsg("Detectando idioma e buscando...");
      try {
        const livros = await buscarLivrosOpenLibrary(val, 8);
        setResultados(livros);
        setStatusMsg(livros.length === 0 ? "Nenhum resultado encontrado." : "");
      } catch {
        setStatusMsg("Erro ao buscar. Verifique sua conexão.");
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 600);
  }

  async function handleSelect(livro) {
    // Fecha dropdown imediatamente e mostra feedback
    setAberto(false);
    setResultados([]);
    setStatusMsg("");
    setQuery(livro.titulo);

    // Passa os dados básicos já disponíveis enquanto busca os detalhes
    onSelect({ ...livro, sinopse: "", nacionalidade: "" });

    // Busca sinopse + nacionalidade em paralelo
    setCarregandoDetalhes(true);
    try {
      const detalhes = await buscarDetalhesLivro(
        livro.olKey,
        livro.authorKeys || [],
        livro.idioma
      );
      // Chama onSelect novamente com os dados completos
      onSelect({ ...livro, ...detalhes });
    } catch {
      // Silencia — campos ficam vazios para o bibliotecário preencher
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  return (
    <div className="ol-search-wrap" ref={wrapRef}>
      <div className="ol-search-label">
        <span className="ol-badge">Open Library</span>
        Buscar livro para preencher automaticamente
        <span className="ol-hint">🌐 Português, Inglês, Espanhol…</span>
      </div>

      <div className="ol-search-row">
        <input
          className="ol-search-input"
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Ex: Dom Quixote, Dune, El Quijote..."
          disabled={disabled || carregandoDetalhes}
          autoComplete="off"
        />
        {(carregando || carregandoDetalhes) && (
          <span className="ol-spinner" aria-label="Buscando..." />
        )}
      </div>

      {/* Feedback ao carregar detalhes após seleção */}
      {carregandoDetalhes && (
        <p className="ol-status-msg ol-loading-inline">
          <span className="ol-spinner ol-spinner-sm" />
          Buscando sinopse e nacionalidade...
        </p>
      )}

      {aberto && (
        <div className="ol-dropdown">
          {carregando && (
            <p className="ol-dropdown-empty ol-loading-msg">
              <span className="ol-spinner ol-spinner-sm" />
              {statusMsg}
            </p>
          )}
          {!carregando && statusMsg && resultados.length === 0 && (
            <p className="ol-dropdown-empty">{statusMsg}</p>
          )}
          {resultados.map((livro, i) => (
            <button
              key={livro.olKey || i}
              type="button"
              className="ol-result-item"
              onClick={() => handleSelect(livro)}
            >
              <span className="ol-result-title">{livro.titulo}</span>
              <span className="ol-result-meta">
                {livro.autor   && <span>{livro.autor}</span>}
                {livro.ano     && <span> · {livro.ano}</span>}
                {livro.editora && <span> · {livro.editora.substring(0, 30)}</span>}
                {livro.idioma && livro.idioma !== "eng" && (
                  <span className="ol-lang-tag">
                    {livro.idioma.toUpperCase()}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}