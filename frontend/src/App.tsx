import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Catalogo } from './pages/Catalogo';
import { AnimeDetail } from './pages/AnimeDetail';
import { Watch } from './pages/Watch';
import { Episodio } from './pages/Episodio';
import { Favoritos } from './pages/Favoritos';
import { Historial } from './pages/Historial';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <div className="min-h-screen bg-dark-900">
        <Navbar />
        <Routes>
          {/* Rutas públicas */}
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
          />

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Catalogo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/anime/:id"
            element={
              <ProtectedRoute>
                <AnimeDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watch/:animeId/:episodio"
            element={
              <ProtectedRoute>
                <Watch />
              </ProtectedRoute>
            }
          />
          {/* Nueva ruta para episodios */}
          <Route
            path="/episodio/:animeId/:episodio"
            element={
              <ProtectedRoute>
                <Episodio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favoritos"
            element={
              <ProtectedRoute>
                <Favoritos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historial"
            element={
              <ProtectedRoute>
                <Historial />
              </ProtectedRoute>
            }
          />

          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
