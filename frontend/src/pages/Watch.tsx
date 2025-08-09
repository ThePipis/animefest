import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoPlayer } from '../components/VideoPlayer';
import { useApi } from '../hooks/useApi';

interface StreamData {
  url: string;
  titulo: string;
  anime: string;
  episodio: number;
  tipo: string;
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
  const { slug, episodio } = useParams<{ slug: string; episodio: string }>();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [animeData, setAnimeData] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const api = useApi();
  const navigate = useNavigate();

  // Memoizar las funciones para evitar renders innecesarios
  const fetchStreamData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getStream(slug!, parseInt(episodio!));
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setStreamData(response.data as StreamData);
      }
    } catch {
      setError('Error al cargar el stream');
    } finally {
      setLoading(false);
    }
  }, [api, slug, episodio]);

  const fetchAnimeData = useCallback(async () => {
    try {
      const response = await api.getAnime(slug!);
      if (response.data) {
        setAnimeData(response.data as Anime);
      }
    } catch (err) {
      console.error('Error fetching anime data:', err);
    }
  }, [api, slug]);

  useEffect(() => {
    if (slug && episodio) {
      fetchStreamData();
      fetchAnimeData();
    }
  }, [slug, episodio, fetchStreamData, fetchAnimeData]);


  const handleTimeUpdate = async (currentTime: number, duration: number) => {
    // Calcular el progreso como porcentaje
    const progress = Math.round((currentTime / duration) * 100);
    
    // Guardar progreso cada cierto porcentaje para evitar muchas requests
    if (progress > 0 && progress % 10 === 0) {
      try {
        await api.addHistorial(slug!, parseInt(episodio!), progress);
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    }
    
    // Si el video está casi terminado (>90%), navegar al siguiente episodio
    if (progress > 90 && animeData) {
      const currentEp = parseInt(episodio!);
      const nextEpisode = animeData.episodios.find(ep => ep.numero === currentEp + 1);
      
      if (nextEpisode) {
        // Marcar como completado antes de navegar
        await api.addHistorial(slug!, parseInt(episodio!), 100);
        navigate(`/watch/${slug}/${nextEpisode.numero}`);
      }
    }
  };

  const navigateToEpisode = (episodeNumber: number) => {
    navigate(`/watch/${slug}/${episodeNumber}`);
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
          <Link to={`/anime/${slug}`} className="btn-primary">
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
              to={`/anime/${slug}`}
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
              tipo={streamData.tipo}
              titulo={`${streamData.anime} - Episodio ${streamData.episodio}: ${streamData.titulo}`}
              onTimeUpdate={handleTimeUpdate}
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
                  to={`/anime/${slug}`}
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
