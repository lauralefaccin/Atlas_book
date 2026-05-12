import { useState, useRef, useEffect } from "react";
import { buscarLivrosOpenLibrary } from "../services/openLibraryApi";
import "./OpenLibrarySearch.css";

/**
 * Componente de busca na Open Library.
 * Ao selecionar um resultado, chama onSelect(livro) com os campos preenchidos.
 */
export default function OpenLibrarySearch({ onSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setErro("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim() || val.trim().length < 3) {
      setResultados([]);
      setAberto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setCarregando(true);
      setAberto(true);
      try {
        const livros = await buscarLivrosOpenLibrary(val, 8);
        setResultados(livros);
        if (livros.length === 0) setErro("Nenhum resultado encontrado.");
      } catch {
        setErro("Erro ao buscar. Verifique sua conexão.");
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 500);
  }

  function handleSelect(livro) {
    setQuery(livro.titulo);
    setAberto(false);
    setResultados([]);
    onSelect(livro);
  }

  return (
    <div className="ol-search-wrap" ref={wrapRef}>
      <div className="ol-search-label">
        <span className="ol-badge">Open Library</span>
        Buscar livro para preencher automaticamente
      </div>
      <div className="ol-search-row">
        <input
          className="ol-search-input"
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Ex: Dom Quixote, Harry Potter..."
          disabled={disabled}
          autoComplete="off"
        />
        {carregando && <span className="ol-spinner" aria-label="Buscando..." />}
      </div>

      {aberto && (
        <div className="ol-dropdown">
          {erro && !carregando && (
            <p className="ol-dropdown-empty">{erro}</p>
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
                {livro.autor && <span>{livro.autor}</span>}
                {livro.ano && <span> · {livro.ano}</span>}
                {livro.editora && <span> · {livro.editora.substring(0, 30)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}