import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

// ── Helpers ───────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div className="auth-field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

const TIPOS = [
  {
    value: "bibliotecario",
    label: "Bibliotecário",
    desc: "Acesso administrativo",
  },
  {
    value: "leitor",
    label: "Leitor",
    desc: "Acesso à estante pessoal",
  },
];

// ── Login Form ────────────────────────────────────────────
function LoginForm({ tipo, setTipo }) {
  const { login } = useAuth();
  const [loginVal, setLoginVal] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  async function handleSubmit() {
    if (!loginVal.trim() || !senha.trim()) {
      setErro("Preencha login e senha.");
      return;
    }
    const result = await login(loginVal.trim(), senha.trim(), tipo);
    if (!result.ok) setErro(result.erro);
  }

  return (
    <div className="auth-form">
      <span className="auth-type-label">Tipo de acesso</span>
      <div className="auth-type-buttons">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`auth-type-btn ${tipo === t.value ? "selected" : ""}`}
            onClick={() => { setTipo(t.value); setErro(""); }}
          >
            <div className="auth-type-btn-icon">{t.icon}</div>
            <div className="auth-type-btn-label">{t.label}</div>
            <div className="auth-type-btn-desc">{t.desc}</div>
          </button>
        ))}
      </div>

      {erro && <p className="auth-error">{erro}</p>}

      <Field
        label="Login"
        value={loginVal}
        onChange={(v) => { setLoginVal(v); setErro(""); }}
        placeholder={tipo === "bibliotecario" ? "Ex: admin" : "Seu login de leitor"}
      />
      <Field
        label="Senha"
        type="password"
        value={senha}
        onChange={(v) => { setSenha(v); setErro(""); }}
        placeholder="Sua senha"
      />

      <button className="auth-submit" onClick={handleSubmit}>
        Entrar →
      </button>
    </div>
  );
}

// ── Register Form ─────────────────────────────────────────
function CadastroForm({ tipo, setTipo }) {
   const { cadastrarBibliotecario, cadastrarLeitor, login } = useAuth();

  const [form, setForm] = useState({ nome: "", cpf: "", login: "", senha: "", confirmar: "" });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setErro(""); setSucesso("");

    if (!form.nome.trim())   { setErro("Informe o nome completo."); return; }
    if (!form.login.trim())  { setErro("Informe o login."); return; }
    if (!form.senha.trim())  { setErro("Informe a senha."); return; }
    if (form.senha !== form.confirmar) { setErro("As senhas não coincidem."); return; }
    if (form.senha.length < 4) { setErro("A senha deve ter no mínimo 4 caracteres."); return; }

    const fn = tipo === "bibliotecario" ? cadastrarBibliotecario : cadastrarLeitor;
    const result = await fn({          // ← await aqui
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      login: form.login.trim(),
      senha: form.senha,
    });

    if (!result.ok) { setErro(result.erro); return; }

    // Login automático após cadastro
    const resultLogin = await login(form.login.trim(), form.senha, tipo);
    if (!resultLogin.ok) {
      // Cadastrou mas falhou o login — mostra sucesso e deixa o usuário entrar manualmente
      setSucesso("Cadastro realizado! Faça login para entrar.");
      setForm({ nome: "", cpf: "", login: "", senha: "", confirmar: "" });
    }
    // Se login ok, o AuthContext já redireciona automaticamente
  }

  function mascaraCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  return (
    <div className="auth-form">
      <span className="auth-type-label">Tipo de conta</span>
      <div className="auth-type-buttons">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`auth-type-btn ${tipo === t.value ? "selected" : ""}`}
            onClick={() => { setTipo(t.value); setErro(""); setSucesso(""); }}
          >
            <div className="auth-type-btn-icon">{t.icon}</div>
            <div className="auth-type-btn-label">{t.label}</div>
            <div className="auth-type-btn-desc">{t.desc}</div>
          </button>
        ))}
      </div>

      <Field label="Nome completo" value={form.nome} onChange={set("nome")} placeholder="Seu nome" />
      <div className="auth-field">
        <label>CPF</label>
        <input
          type="text"
          value={form.cpf}
          onChange={(e) => setForm((f) => ({ ...f, cpf: mascaraCPF(e.target.value) }))}
          placeholder="000.000.000-00"
          maxLength={14}
          autoComplete="off"
        />
      </div>
      <Field label="Login" value={form.login} onChange={set("login")} placeholder="Escolha um login" />
      <Field label="Senha" type="password" value={form.senha} onChange={set("senha")} placeholder="Mínimo 4 caracteres" />
      <Field label="Confirmar senha" type="password" value={form.confirmar} onChange={set("confirmar")} placeholder="Repita a senha" />

      {erro    && <p className="auth-error">{erro}</p>}
      {sucesso && <p className="auth-success">{sucesso}</p>}

      <button className="auth-submit" onClick={handleSubmit}>
        Criar conta →
      </button>
    </div>
  );
}

// ── Main Auth Page ────────────────────────────────────────
export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "cadastro"
  const [tipo, setTipo] = useState("bibliotecario");

  return (
    <div className="auth-root">
      {/* Left decorative panel */}
      <aside className="auth-panel">
        <p className="auth-panel-logo">Atlas<span>Book</span></p>
        <p className="auth-panel-tagline">Sistema de biblioteca</p>
        <blockquote className="auth-panel-quote">
          "Uma biblioteca é um lugar onde a história humana se encontra com o futuro da humanidade."
          <cite>— Vartan Gregorian</cite>
        </blockquote>
      </aside>

      {/* Right form area */}
      <main className="auth-main">
        <div className="auth-box">
          <h1 className="auth-box-title">
            {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
          </h1>
          <p className="auth-box-subtitle">
            {mode === "login"
              ? "Acesse o sistema de gestão da biblioteca."
              : "Preencha os dados para se cadastrar."}
          </p>

          {/* Login / Cadastro tabs */}
          <div className="auth-mode-tabs">
            <button
              className={`auth-mode-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); }}
            >
              Entrar
            </button>
            <button
              className={`auth-mode-tab ${mode === "cadastro" ? "active" : ""}`}
              onClick={() => { setMode("cadastro"); }}
            >
              Cadastrar
            </button>
          </div>

          {mode === "login"
            ? <LoginForm tipo={tipo} setTipo={setTipo} />
            : <CadastroForm tipo={tipo} setTipo={setTipo} />
          }

          <div className="auth-toggle">
            {mode === "login" ? (
              <span>Não tem conta?{" "}
                <button onClick={() => setMode("cadastro")}>Cadastre-se</button>
              </span>
            ) : (
              <span>Já tem conta?{" "}
                <button onClick={() => setMode("login")}>Entrar</button>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
