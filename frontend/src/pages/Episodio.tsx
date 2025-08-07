import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoPlayerWithFallback } from '../components/VideoPlayerWithFallback';
import { useAuthStore } from '../stores/authStore';

export const Episodio: React.FC = () => {
  const { slug, episodio } = useParams<{ slug: string; episodio: string }>();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuthStore();

  // Verificar autenticación
  if (!isAuthenticated || !token) {
    navigate('/login');
    return null;
  }

  // Verificar parámetros
  if (!slug || !episodio) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Parámetros inválidos</h1>
          <button 
            onClick={() => navigate('/catalogo')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Botón de regreso - necesitaremos encontrar el ID del anime para navegar de vuelta */}
        <motion.button
          onClick={() => navigate(-1)} // Usar navigate(-1) como alternativa
          className="mb-6 flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          whileHover={{ x: -5 }}
        >
          <span>←</span>
          <span>Volver al anime</span>
        </motion.button>

        {/* Reproductor con fallback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <VideoPlayerWithFallback 
            animeId={slug} // Ahora pasamos el slug como animeId
            episodio={episodio}
            token={token}
          />
        </motion.div>
      </div>
    </div>
  );
};