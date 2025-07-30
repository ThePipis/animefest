import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoPlayer } from '../components/VideoPlayer';
import { useApi } from '../hooks/useApi';

interface StreamData {
  url: string;
  titulo: string;
  anime: string;
  episodio: number;
}

interface Anime {
  id: number;
  titulo: string;
  episodios: Array<{
    numero: number;
    titulo: string;
    duracion: string;
  }>;
}

export const Watch: React.FC = () => {
  const { animeId, episodio } = useParams<{ animeId: string; episodio: string }>();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [animeData, setAnimeData] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const api = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    if (animeId && episodio) {
      fetchStreamData();
      fetchAnimeData();
    }
  }, [animeId, episodio]);

  const fetchStreamData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getStream(parseInt(animeId!), parseInt(episodio!));
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setStreamData(response.data);
      }
    } catch (err) {
      setError('Error al cargar el stream');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimeData = async () => {
    try {
      const response = await api.getAnime(parseInt(animeId!));
      if (response.data) {
        setAnimeData(response.data);
      }
    } catch (err) {
      console.error('Error fetching anime data:', err);
    }
  };

  const handleProgress = async (progress: number) => {
    // Guardar progreso en el historial
    try {
      await api.addHistorial(parseInt(animeId!), parseInt(episodio!), progress);
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  };

  const handleVideoEnded = () => {
    // Marcar como completado (100% de progreso)
    handleProgress(100);
    
    // Navegar al siguiente episodio si existe
    if (animeData) {
      const currentEp = parseInt(episodio!);
      const nextEpisode = animeData.episodios.find(ep => ep.numero === currentEp + 1);
      
      if (nextEpisode) {
        navigate(`/watch/${animeId}/${nextEpisode.numero}`);
      }
    }
  };

  const navigateToEpisode = (episodeNumber: number) => {
    navigate(`/watch/${animeId}/${episodeNumber}`);
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
          <p className="text-dark-400">Preparando reproducción...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error de reproducción</h2>
          <p className="text-dark-400 mb-4">{error}</p>
          <Link to={`/anime/${animeId}`} className="btn-primary">
            Volver al anime
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="flex items-center space-x-2 text-sm">
            <Link to="/" className="text-primary-400 hover:text-primary-300 transition-colors">
              Catálogo
            </Link>
            <span className="text-dark-400">→</span>
            <Link 
              to={`/anime/${animeId}`} 
              className="text-primary-400 hover:text-primary-300 transition-colors"
            >
              {streamData.anime}
            </Link>
            <span className="text-dark-400">→</span>
            <span className="text-white">Episodio {streamData.episodio}</span>
          </div>
        </motion.nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Reproductor principal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <VideoPlayer
              src={streamData.url}
              title={`${streamData.anime} - Episodio ${streamData.episodio}: ${streamData.titulo}`}
              onProgress={handleProgress}
              onEnded={handleVideoEnded}
            />
          </motion.div>

          {/* Lista de episodios */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-1"
          >
            <div className="card p-4">
              <h3 className="text-white font-semibold mb-4">Episodios</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {animeData?.episodios.map((ep) => (
                  <button
                    key={ep.numero}
                    onClick={() => navigateToEpisode(ep.numero)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      ep.numero === parseInt(episodio!)
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-white'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      Episodio {ep.numero}
                    </div>
                    <div className="text-xs opacity-75 truncate">
                      {ep.titulo}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de navegación */}
            <div className="card p-4 mt-4">
              <h4 className="text-white font-semibold mb-3">Navegación</h4>
              <div className="space-y-2">
                {animeData && (
                  <>
                    {/* Episodio anterior */}
                    {parseInt(episodio!) > 1 && (
                      <button
                        onClick={() => navigateToEpisode(parseInt(episodio!) - 1)}
                        className="w-full btn-secondary text-sm"
                      >
                        ← Episodio anterior
                      </button>
                    )}
                    
                    {/* Episodio siguiente */}
                    {animeData.episodios.find(ep => ep.numero === parseInt(episodio!) + 1) && (
                      <button
                        onClick={() => navigateToEpisode(parseInt(episodio!) + 1)}
                        className="w-full btn-primary text-sm"
                      >
                        Episodio siguiente →
                      </button>
                    )}
                  </>
                )}
                
                <Link
                  to={`/anime/${animeId}`}
                  className="w-full btn-secondary text-sm block text-center"
                >
                  Ver detalles del anime
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
