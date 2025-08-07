import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

// ✅ IMPORTS CENTRALIZADOS
import {
  Login,
  Register,
  Catalogo,
  AnimeDetail,
  Watch,
  Episodio,
  Favoritos,
  Historial,
  AdminAnimes
} from './pages';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/catalogo" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/anime/:slug" element={<AnimeDetail />} />
          <Route path="/watch" element={<Watch />} />
          <Route 
            path="/watch/:slug/:episodio" 
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
          <Route 
            path="/admin/animes" 
            element={
              <ProtectedRoute>
                <AdminAnimes />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
