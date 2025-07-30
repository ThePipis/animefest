import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="text-2xl font-bold text-white">
              Anime<span className="text-blue-400">Fest</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xs text-slate-400">Tu anime favorito</span>
            </div>
          </Link>

          {user ? (
            <div className="flex items-center space-x-6">
              <Link
                to="/"
                className="text-slate-300 hover:text-white transition-all duration-200 px-4 py-2.5 rounded-xl hover:bg-slate-800/50 font-medium"
              >
                Catálogo
              </Link>
              <Link
                to="/favoritos"
                className="text-slate-300 hover:text-white transition-all duration-200 px-4 py-2.5 rounded-xl hover:bg-slate-800/50 font-medium"
              >
                Favoritos
              </Link>
              <Link
                to="/historial"
                className="text-slate-300 hover:text-white transition-all duration-200 px-4 py-2.5 rounded-xl hover:bg-slate-800/50 font-medium"
              >
                Historial
              </Link>

              <div className="flex items-center space-x-3">
                <span className="text-slate-300 hidden sm:block">
                  Hola, {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-sm"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/login" className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-sm">
                Iniciar Sesión
              </Link>
              <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-sm">
                Registrarse
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-slate-700">
            <div className="flex flex-col space-y-2">
              <Link
                to="/"
                className="text-slate-300 hover:text-white transition-colors duration-200 text-sm px-2 py-1 rounded hover:bg-slate-700"
              >
                Catálogo
              </Link>
              <Link
                to="/favoritos"
                className="text-slate-300 hover:text-white transition-colors duration-200 text-sm px-2 py-1 rounded hover:bg-slate-700"
              >
                Favoritos
              </Link>
              <Link
                to="/historial"
                className="text-slate-300 hover:text-white transition-colors duration-200 text-sm px-2 py-1 rounded hover:bg-slate-700"
              >
                Historial
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  );
};
