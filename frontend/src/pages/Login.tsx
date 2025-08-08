import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // ✅ Remover useNavigate
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const expired = params.get('expired') === 'true';
  // ✅ Remover esta línea: const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        // La navegación ya se maneja dentro de useAuth
      } else {
        console.error('Error al iniciar sesión:', result.error);
        // Aquí puedes mostrar el error al usuario
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Anime<span className="text-blue-400">Fest</span>
          </h1>
          <p className="text-slate-400">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit}>
          {expired && (
            <div className="bg-yellow-100 text-yellow-800 text-sm p-3 rounded mb-4 text-center">
              ⚠️ Tu sesión ha expirado. Por favor, inicia sesión nuevamente.
            </div>
          )}
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-8 space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 w-full outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                placeholder="Ingresa tu usuario"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 w-full outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                placeholder="Ingresa tu contraseña"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg border-none cursor-pointer transition-all duration-200 text-center inline-block w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>

            <div className="text-center">
              <p className="text-slate-400">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Regístrate aquí
                </Link>
              </p>
            </div>

            <div className="text-center text-sm text-slate-500">
              <p className="mb-1">Credenciales de prueba:</p>
              <p>Usuario: <span className="text-blue-400">admin</span></p>
              <p>Contraseña: <span className="text-blue-400">admin123</span></p>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};