import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimeCard } from '../components/AnimeCard';
import { useApi } from '../hooks/useApi';

interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  categoria: string;
}

export const Favoritos: React.FC = () => {
  const [favoritos, setFavoritos] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const api = useApi();

  useEffect(() => {
    fetchFavoritos();
  }, []);

  const fetchFavoritos = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getFavoritos();
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setFavoritos(response.data);
      }
    } catch (err) {
      setError('Error al cargar favoritos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-dark-400">Cargando favoritos...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error al cargar</h2>
          <p className="text-dark-400 mb-4">{error}</p>
          <button
            onClick={fetchFavoritos}
            className="btn-primary"
          >
            Reintentar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            ❤️ Mis Favoritos
          </h1>
          <p className="text-dark-400 text-lg">
            Tus animes favoritos guardados
          </p>
        </motion.div>

        {/* Contenido */}
        {favoritos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">💔</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No tienes favoritos aún
            </h3>
            <p className="text-dark-400 mb-6">
              Explora el catálogo y agrega animes a tus favoritos
            </p>
            <a href="/" className="btn-primary">
              Explorar catálogo
            </a>
          </motion.div>
        ) : (
          <>
            {/* Contador */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <p className="text-dark-400">
                {favoritos.length} anime{favoritos.length !== 1 ? 's' : ''} en favoritos
              </p>
            </motion.div>

            {/* Grid de favoritos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favoritos.map((anime, index) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  index={index}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
