import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";
import { useGeneros } from "../data/generos";
import { useAutores } from "../data/autores";
import estanteIcon from "../imagens/icons/estante (2).png";
import estrelaVazadaIcon from "../imagens/icons/estrela_vazada.png";
import estrelaCheiaIcon from "../imagens/icons/estrela (2).png";
import "./Livros.css";
import "./BookDetail.css";

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showPopup } = usePopup();
  const generos = useGeneros();
  const autores = useAutores();
  const [livro, setLivro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [naEstante, setNaEstante] = useState(false);
  const [isFavorito, setIsFavorito] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const fromEstante = location?.state?.fromEstante === true;

  const STATUS_OPTIONS = ["Lendo", "Pretendo Ler", "Finalizado", "Desistiu"];

  const autoresMap = autores.reduce((acc, autor) => {
    acc[autor.id] = autor.nome;
    return acc;
  }, {});

  const getCorGenero = (generoNome) => {
    const generoCustomizado = generos.find((g) => g.nome === generoNome);
    if (generoCustomizado?.cor) {
      return generoCustomizado.cor;
    }
    return "#c08928";
  };

  useEffect(() => {
    async function loadLivro() {
      try {
        const livros = await api.getLivros();
        const encontrado = livros.find((l) => l.id === Number(id));
        if (encontrado) {
          setLivro(encontrado);
          if (fromEstante) {
            setSelectedStatus(encontrado.status || "Pretendo Ler");
          }
        } else {
          showPopup("Livro não encontrado.");
          navigate("/livros");
        }
      } catch (err) {
        console.error("Erro ao carregar livro:", err.message);
        showPopup("Erro ao carregar o livro.");
      } finally {
        setLoading(false);
      }
    }
    loadLivro();
  }, [id, navigate, showPopup]);

  useEffect(() => {
    async function verificarEstante() {
      if (!user || !livro) return;
      try {
        const estante = await api.getEstante();
        const itemEstante = estante.find((item) => item.id === livro.id);
        setNaEstante(Boolean(itemEstante));
        setIsFavorito(itemEstante?.is_favorito === true);
        if (itemEstante?.status) {
          setSelectedStatus(itemEstante.status);
        } else if (livro.status) {
          setSelectedStatus(livro.status);
        } else {
          setSelectedStatus("Pretendo Ler");
        }
      } catch (err) {
        console.error("Erro ao verificar estante:", err.message);
      }
    }
    verificarEstante();
  }, [user, livro]);

  const toggleFavorito = async () => {
    if (!user) {
      showPopup("Faça login para favoritar livros.");
      return;
    }

    if (!naEstante) {
      showPopup("Adicione o livro à estante para marcar como favorito.");
      return;
    }

    try {
      await api.toggleFavoritoEstante(livro.id);
      setIsFavorito((current) => !current);
      window.dispatchEvent(new CustomEvent("estante:changed"));
      showPopup(isFavorito ? "Removido dos favoritos." : "Adicionado aos favoritos.");
    } catch (err) {
      console.error("Erro ao atualizar favorito:", err.message);
      showPopup("Não foi possível atualizar o status de favorito.");
    }
  };

  const atualizarStatusEstante = async (novoStatus) => {
    if (!livro) return;
    try {
      await api.atualizarStatusEstante(livro.id, novoStatus);
      setLivro((current) => ({ ...current, status: novoStatus }));
      setSelectedStatus(novoStatus);
      showPopup(`Livro movido para "${novoStatus}".`);
      window.dispatchEvent(new CustomEvent("estante:changed"));
    } catch (err) {
      console.error("Erro ao atualizar status da estante:", err.message);
      showPopup("Não foi possível alterar a subdivisão do livro.");
    }
  };

  const adicionarAEstante = async () => {
    if (!user) {
      showPopup("Faça login para adicionar livros à estante.");
      return;
    }

    if (naEstante) {
      showPopup("Este livro já está na sua estante!");
      return;
    }

    try {
      await api.adicionarEstante(livro.id);
      setNaEstante(true);
      window.dispatchEvent(new CustomEvent("estante:changed"));
      showPopup(`${livro.titulo} foi adicionado à sua Estante!`);
    } catch (err) {
      console.error("Erro ao adicionar à estante:", err.message);
      showPopup("Não foi possível adicionar à estante.");
    }
  };

  if (loading) {
    return <div className="book-detail-loading">Carregando...</div>;
  }

  if (!livro) {
    return <div className="book-detail-empty">Livro não encontrado.</div>;
  }

  const autorNome = autoresMap[livro.autorId] || livro.autor || "Autor não informado";

  return (
    <div className={`book-detail-page ${fromEstante ? "with-left-panel" : ""}`}>
      <button className="book-detail-back" onClick={() => navigate(-1)}>
        ← Voltar
      </button>

      <div className="book-detail-shell">
        <div className="book-detail-container">
          <div
            className="book-detail-header"
            style={{ "--livro-accent": getCorGenero(livro.genero) }}
          >
            {user && fromEstante && (
              <button
                type="button"
                className={`book-detail-favorite-btn ${isFavorito ? "active" : ""}`}
                onClick={toggleFavorito}
                title={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                aria-label={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <img src={isFavorito ? estrelaCheiaIcon : estrelaVazadaIcon} alt="Favoritos" />
              </button>
            )}

            <div className="book-detail-meta">
              <span className="book-genre">{livro.genero}</span>
            </div>

            <h1 className="book-detail-title">{livro.titulo}</h1>

            <p className="book-detail-author">{autorNome}</p>

            {livro.nacionalidade && (
              <p className="book-detail-nationality">{livro.nacionalidade}</p>
            )}

            <div className="book-detail-publication">
              {livro.editora && <span>{livro.editora}</span>}
              {livro.ano && <span>{livro.ano}</span>}
            </div>

            {user && (
              <button
                className={`book-detail-btn-estante${naEstante ? " disabled" : ""}`}
                onClick={adicionarAEstante}
                disabled={naEstante}
              >
                <img src={estanteIcon} alt="Estante" />
                {naEstante ? "Na sua Estante" : "Adicionar à Estante"}
              </button>
            )}
          </div>

          {fromEstante && (
            <div className="livros-filters estante-filters book-detail-estante-bar" onClick={(e) => e.stopPropagation()}>
              <div className="livros-status-filter estante-status-filter">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`status-filter-btn ${selectedStatus === option ? "active" : ""}`}
                    onClick={() => atualizarStatusEstante(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="book-detail-content">
          <section className="book-detail-section">
            <h2>Sinopse</h2>
            <p className="book-detail-synopsis">
              {livro.sinopse || "Sinopse não disponível."}
            </p>
          </section>

          <section className="book-detail-section">
            <h2>Informações</h2>
            <div className="book-detail-info-grid">
              {livro.editora && (
                <div className="book-info-item">
                  <span className="book-info-label">Editora:</span>
                  <span className="book-info-value">{livro.editora}</span>
                </div>
              )}
              {livro.ano && (
                <div className="book-info-item">
                  <span className="book-info-label">Ano:</span>
                  <span className="book-info-value">{livro.ano}</span>
                </div>
              )}
              {livro.nacionalidade && (
                <div className="book-info-item">
                  <span className="book-info-label">Nacionalidade:</span>
                  <span className="book-info-value">{livro.nacionalidade}</span>
                </div>
              )}
            </div>
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
