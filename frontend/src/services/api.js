import { useMemo, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { usePopup } from "../context/PopupContext";
import "./Leitores.css";

function mascaraCPF(valor) {
  return valor
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).split("T")[0].split("-");
  return `${day}/${m}/${y}`;
};

function Badge({ type, children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="leitores-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="leitores-modal">
        <div className="leitores-modal-header">
          <h2>{title}</h2>
          <button className="leitores-modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children, full }) {
  return (
    <div className={`leitores-form-field${full ? " full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function SenhaCell({ senhaHash }) {
  // A API não retorna a senha em texto puro (boa prática).
  // Mostramos um placeholder e o bibliotecário pode redefinir via edição.
  return (
    <span className="login-chip" style={{ color: "#aaa", letterSpacing: 2 }}>
      ••••••••
    </span>
  );
}

export default function Leitores() {
  const [leitores,    setLeitores]    = useState([]);
  const [carregando,  setCarregando]  = useState(true);
  const [search,      setSearch]      = useState("");

  const [modalAdd,    setModalAdd]    = useState(false);
  const [formAdd,     setFormAdd]     = useState({ tipo: "leitor", nome: "", cpf: "", data_registro: today(), login: "", senha: "" });
  const [erroAdd,     setErroAdd]     = useState("");
  const [salvandoAdd, setSalvandoAdd] = useState(false);

  const [modalEdit,     setModalEdit]     = useState(false);
  const [editando,      setEditando]      = useState(null);
  const [formEdit,      setFormEdit]      = useState({ login: "", senha: "", confirmar: "" });
  const [erroEdit,      setErroEdit]      = useState("");
  const [sucessoEdit,   setSucessoEdit]   = useState("");
  const [salvandoEdit,  setSalvandoEdit]  = useState(false);

  // ── Carregar usuários ────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await api.getUsuarios();
      setLeitores(data);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  const { showPopup, showConfirmPopup } = usePopup();

  const filtered = useMemo(
    () => leitores.filter(
      (l) => !search ||
        l.nome.toLowerCase().includes(search.toLowerCase()) ||
        (l.cpf && l.cpf.includes(search))
    ),
    [leitores, search]
  );

  const inpAdd  = (k) => ({ value: formAdd[k],  onChange: (e) => setFormAdd((f)  => ({ ...f, [k]: e.target.value })) });
  const inpEdit = (k) => ({ value: formEdit[k], onChange: (e) => setFormEdit((f) => ({ ...f, [k]: e.target.value })) });

  // ── Create ───────────────────────────────────────────────
  async function handleAdd() {
    if (!formAdd.nome.trim())  { setErroAdd("⚠️ Informe o nome."); return; }
    if (!formAdd.login.trim()) { setErroAdd("⚠️ Informe o login."); return; }
    if (!formAdd.senha.trim()) { setErroAdd("⚠️ Informe a senha."); return; }

    try {
      setSalvandoAdd(true);
      await api.criarUsuario({
        tipo: formAdd.tipo,
        nome: formAdd.nome.trim(),
        cpf: formAdd.cpf.trim(),
        login: formAdd.login.trim(),
        senha: formAdd.senha,
        ...(formAdd.tipo === "leitor"
          ? { data_registro: formAdd.data_registro || today() }
          : {}),
      });
      await carregar();
      setFormAdd({ tipo: "leitor", nome: "", cpf: "", data_registro: today(), login: "", senha: "" });
      setErroAdd("");
      setModalAdd(false);
    } catch (err) {
      setErroAdd(`⚠️ ${err.message}`);
    } finally {
      setSalvandoAdd(false);
    }
  }

  // ── Update ───────────────────────────────────────────────
  function abrirEdit(leitor) {
    setEditando(leitor);
    setFormEdit({ login: leitor.login, senha: "", confirmar: "" });
    setErroEdit(""); setSucessoEdit("");
    setModalEdit(true);
  }

  async function handleUpdate() {
    setErroEdit(""); setSucessoEdit("");
    if (!formEdit.login.trim()) { setErroEdit("⚠️ Informe o login."); return; }
    if (formEdit.senha && formEdit.senha !== formEdit.confirmar) {
      setErroEdit("⚠️ As senhas não coincidem."); return;
    }

    try {
      setSalvandoEdit(true);
      await api.editarUsuario(editando.tipo, editando.id, {
        login: formEdit.login.trim(),
        ...(formEdit.senha ? { senha: formEdit.senha } : {}),
      });
      await carregar();
      setSucessoEdit("✅ Dados atualizados com sucesso!");
    } catch (err) {
      setErroEdit(`⚠️ ${err.message}`);
    } finally {
      setSalvandoEdit(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function handleRemove(leitor) {
    showConfirmPopup("Deseja remover este usuário?", async () => {
      try {
        await api.deletarUsuario(leitor.tipo, leitor.id);
        await carregar();
      } catch (err) {
        showPopup(`Erro: ${err.message}`);
      }
    });
  }

  return (
    <section className="leitores-page">
      <header className="leitores-header">
        <div>
          <p className="leitores-kicker">Cadastro</p>
          <h1>Leitores</h1>
        </div>
        <button type="button" className="leitores-add-btn" onClick={() => { setErroAdd(""); setModalAdd(true); }}>
          + Novo Usuário
        </button>
      </header>

      <div className="leitores-search-wrap">
        <label htmlFor="busca-leitores" className="leitores-search">
          <span aria-hidden="true">🔎</span>
          <input id="busca-leitores" type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou CPF..." />
        </label>
      </div>

      {carregando ? (
        <p className="leitores-vazio">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="leitores-vazio">Nenhum leitor encontrado.</p>
      ) : (
        <div className="leitores-table-wrap">
          <table className="leitores-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Registro</th>
                <th>Login</th>
                <th>Senha</th>
                <th>Tipo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={`${l.tipo}-${l.id}`}>
                  <td data-label="Nome"><strong>{l.nome}</strong></td>
                  <td data-label="CPF">{l.cpf || "—"}</td>
                  <td data-label="Registro">{fmtDate(l.data_registro)}</td>
                  <td data-label="Login"><code className="login-chip">{l.login}</code></td>
                  <td data-label="Senha"><SenhaCell /></td>
                  <td data-label="Tipo">
                    <Badge type={l.tipo === "bibliotecario" ? "gray" : "green"}>
                      {l.tipo === "bibliotecario" ? "Bibliotecário" : "Leitor"}
                    </Badge>
                  </td>
                  <td data-label="Ações" className="leitores-actions-cell">
                    <button className="btn-action" onClick={() => abrirEdit(l)}>✏️ Editar</button>
                    <button className="btn-action btn-action-danger" onClick={() => handleRemove(l)}>🗑️ Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cadastrar */}
      <Modal open={modalAdd} onClose={() => { setModalAdd(false); setErroAdd(""); }} title="Cadastrar Usuário">
        <div className="leitores-form-grid">
          <FormField label="Tipo de conta" full>
            <select {...inpAdd("tipo")}>
              <option value="leitor">Leitor</option>
              <option value="bibliotecario">Bibliotecário (acesso administrativo)</option>
            </select>
          </FormField>
          <FormField label="Nome completo" full><input {...inpAdd("nome")} placeholder="Nome" /></FormField>
          <FormField label="CPF">
            <input
              value={formAdd.cpf}
              onChange={(e) => setFormAdd((f) => ({ ...f, cpf: mascaraCPF(e.target.value) }))}
              placeholder="000.000.000-00"
              maxLength={14}
              autoComplete="off"
            />
          </FormField>
          {formAdd.tipo === "leitor" && (
            <FormField label="Data de Registro"><input type="date" {...inpAdd("data_registro")} /></FormField>
          )}
          <FormField label="Login"><input {...inpAdd("login")} placeholder="Ex: joao.silva" /></FormField>
          <FormField label="Senha"><input type="password" {...inpAdd("senha")} placeholder="Senha" /></FormField>
        </div>
        {erroAdd && <p className="leitores-modal-hint" style={{ color: "#8b2020", background: "#fde8e8", borderColor: "#f7c1c1" }}>{erroAdd}</p>}
        <p className="leitores-modal-hint">
          {formAdd.tipo === "bibliotecario"
            ? "Atenção: o bibliotecário terá acesso administrativo completo ao sistema."
            : "O leitor usará esse login e senha para acessar o sistema."}
        </p>
        <div className="leitores-modal-actions">
          <button className="btn-secondary" onClick={() => { setModalAdd(false); setErroAdd(""); }}>Cancelar</button>
          <button className="btn-primary" onClick={handleAdd} disabled={salvandoAdd}>
            {salvandoAdd ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Modal>

      {/* Modal Editar */}
      <Modal open={modalEdit} onClose={() => setModalEdit(false)} title={`Editar acesso — ${editando?.nome}`}>
        <div className="leitores-form-grid">
          <FormField label="Login" full><input {...inpEdit("login")} placeholder="Login" /></FormField>
          <FormField label="Nova senha"><input type="password" {...inpEdit("senha")} placeholder="Deixe em branco para não alterar" /></FormField>
          <FormField label="Confirmar senha"><input type="password" {...inpEdit("confirmar")} placeholder="Repita a nova senha" /></FormField>
        </div>
        {erroEdit   && <p className="leitores-modal-hint" style={{ color: "#8b2020", background: "#fde8e8", borderColor: "#f7c1c1" }}>{erroEdit}</p>}
        {sucessoEdit && <p className="leitores-modal-hint" style={{ color: "#1a5c2a", background: "#d4edda", borderColor: "#a3d3b0" }}>{sucessoEdit}</p>}
        <div className="leitores-modal-actions">
          <button className="btn-secondary" onClick={() => setModalEdit(false)}>Fechar</button>
          <button className="btn-primary" onClick={handleUpdate} disabled={salvandoEdit}>
            {salvandoEdit ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </Modal>
    </section>
  );
}