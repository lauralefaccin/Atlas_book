import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Auth from "./pages/Auth";

import Dashboard from "./pages/Dashboard";
import Livros from "./pages/Livros";
import BookDetail from "./pages/BookDetail";
import Autores from "./pages/Autores";
import Leitores from "./pages/Leitores";
import Estante from "./pages/Estante";
import Generos from "./pages/Generos";

function ProtectedApp() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`content ${collapsed ? "collapsed" : ""}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/livros" element={<Livros />} />
          <Route path="/livro/:id" element={<BookDetail />} />
          <Route path="/autores" element={<Autores />} />
          <Route path="/estante" element={<Estante />} />
          <Route path="/generos" element={<Generos />} />
          <Route
            path="/leitores"
            element={
              user.tipo === "bibliotecario"
                ? <Leitores />
                : <Navigate to="/" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}