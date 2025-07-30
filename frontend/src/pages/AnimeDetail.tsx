import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../stores/authStore';

interface Episodio {
  numero: number;
  titulo: string;
  duracion: string;
  url_stream: string;
}

interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  categoria: string;
  episodios: Episodio[];
}

export const AnimeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  
  const api = useApi();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchAnime();
      if (isAuthenticated) {
        checkFavoriteStatus();
      }
    }
  }, [id, isAuthenticated]);

  const fetchAnime = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getAnime(parseInt(id!));
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setAnime(response.data);
      }
    } catch (err) {
      setError('Error al cargar el anime');
    } finally {
      setLoading(false);
    }
  };

  const checkFavoriteStatus = async () => {
    try {
      const response = await api.getFavoritos();
      if (response.data) {
        const favoriteIds = response.data.map((fav: any) => fav.id);
        setIsFavorite(favoriteIds.includes(parseInt(id!)));
      }
    } catch (err) {
      console.error('Error checking favorite status:', err);
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated || !anime) return;
    
    setFavoriteLoading(true);
    
    try {
      if (isFavorite) {
        await api.removeFavorito(anime.id);
        setIsFavorite(false);
      } else {
        await api.addFavorito(anime.id);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setFavoriteLoading(false);
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
          <p className="text-dark-400">Cargando anime...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Anime no encontrado</h2>
          <p className="text-dark-400 mb-4">{error}</p>
          <Link to="/" className="btn-primary">
            Volver al catálogo
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link to="/" className="text-primary-400 hover:text-primary-300 transition-colors">
            ← Volver al catálogo
          </Link>
        </motion.nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Imagen y información básica */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="card p-6">
              <img
                src={anime.imagen}
                alt={anime.titulo}
                className="w-full rounded-lg mb-4"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
                }}
              />
              
              {isAuthenticated && (
                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  className={`w-full mb-4 py-2 px-4 rounded-lg font-medium transition-colors ${
                    isFavorite
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  } disabled:opacity-50`}
                >
                  {favoriteLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cargando...
                    </div>
                  ) : (
                    <>
                      {isFavorite ? '❤️ Quitar de favoritos' : '🤍 Agregar a favoritos'}
                    </>
                  )}
                </button>
              )}

              <div className="space-y-3">
                <div>
                  <span className="text-dark-400 text-sm">Año:</span>
                  <p className="text-white">{anime.año}</p>
                </div>
                <div>
                  <span className="text-dark-400 text-sm">Estado:</span>
                  <p className="text-white">{anime.estado}</p>
                </div>
                <div>
                  <span className="text-dark-400 text-sm">Categoría:</span>
                  <p className="text-white">{anime.categoria}</p>
                </div>
                <div>
                  <span className="text-dark-400 text-sm">Episodios:</span>
                  <p className="text-white">{anime.episodios.length}</p>
                </div>
                <div>
                  <span className="text-dark-400 text-sm">Géneros:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {anime.generos.map((genero, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-dark-700 text-dark-300 text-xs rounded-md"
                      >
                        {genero}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Información detallada y episodios */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            {/* Título y sinopsis */}
            <div className="card p-6 mb-6">
              <h1 className="text-3xl font-bold text-white mb-4">{anime.titulo}</h1>
              <p className="text-dark-300 leading-relaxed">{anime.sinopsis}</p>
            </div>

            {/* Lista de episodios */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Episodios</h2>
              <div className="space-y-3">
                {anime.episodios.map((episodio) => (
                  <motion.div
                    key={episodio.numero}
                    whileHover={{ scale: 1.02 }}
                    className="bg-dark-700 rounded-lg p-4 hover:bg-dark-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">
                          Episodio {episodio.numero}: {episodio.titulo}
                        </h3>
                        <p className="text-dark-400 text-sm">Duración: {episodio.duracion}</p>
                      </div>
                      <Link
                        to={`/watch/${anime.id}/${episodio.numero}`}
                        className="btn-primary ml-4"
                      >
                        ▶️ Ver
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
