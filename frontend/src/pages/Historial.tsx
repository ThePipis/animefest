import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';

interface HistorialItem {
  animeId: number;
  episodio: number;
  progreso: number;
  fechaVisto: string;
  animeTitle: string;
  animeImage: string;
  animeSlug: string;
}

export const Historial: React.FC = () => {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const api = useApi();

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getHistorial();
      
      if (response.error) {
        setError(response.error);
      } else if (response.data && Array.isArray(response.data)) {
        // Ordenar por fecha más reciente
        const historialData = response.data as HistorialItem[];
        const sortedHistorial = historialData.sort((a: HistorialItem, b: HistorialItem) =>
          new Date(b.fechaVisto).getTime() - new Date(a.fechaVisto).getTime()
        );
        setHistorial(sortedHistorial);
      }
    } catch {
      setError('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-primary-500';
  };

  const getProgressText = (progress: number) => {
    if (progress >= 90) return 'Completado';
    if (progress >= 50) return 'En progreso';
    return 'Iniciado';
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
          <p className="text-dark-400">Cargando historial...</p>
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
            onClick={fetchHistorial}
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
            📺 Mi Historial
          </h1>
          <p className="text-dark-400 text-lg">
            Episodios que has visto recientemente
          </p>
        </motion.div>

        {/* Contenido */}
        {historial.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">📺</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No hay historial aún
            </h3>
            <p className="text-dark-400 mb-6">
              Comienza a ver animes para que aparezcan aquí
            </p>
            <Link to="/" className="btn-primary">
              Explorar catálogo
            </Link>
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
                {historial.length} episodio{historial.length !== 1 ? 's' : ''} en el historial
              </p>
            </motion.div>

            {/* Lista de historial */}
            <div className="space-y-4">
              {historial.map((item, index) => (
                <motion.div
                  key={`${item.animeId}-${item.episodio}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card p-6 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {/* Imagen del anime */}
                    <div className="flex-shrink-0">
                      <img
                        src={item.animeImage}
                        alt={item.animeTitle}
                        className="w-16 h-20 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/64x80/1e293b/64748b?text=No+Image';
                        }}
                      />
                    </div>

                    {/* Información del episodio */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-lg truncate">
                        {item.animeTitle}
                      </h3>
                      <p className="text-dark-300 mb-2">
                        Episodio {item.episodio}
                      </p>
                      
                      {/* Barra de progreso */}
                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-dark-400">
                            {getProgressText(item.progreso)}
                          </span>
                          <span className="text-sm text-dark-400">
                            {Math.round(item.progreso)}%
                          </span>
                        </div>
                        <div className="w-full bg-dark-600 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(item.progreso)}`}
                            style={{ width: `${item.progreso}%` }}
                          ></div>
                        </div>
                      </div>

                      <p className="text-dark-400 text-sm">
                        Visto {formatDate(item.fechaVisto)}
                      </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex-shrink-0 flex flex-col space-y-2">
                      <Link
                        to={`/watch/${item.animeSlug || item.animeId}/${item.episodio}`}
                        className="btn-primary text-sm"
                      >
                        {item.progreso >= 90 ? 'Ver de nuevo' : 'Continuar'}
                      </Link>
                      <Link
                        to={`/anime/${item.animeSlug || item.animeId}`}
                        className="btn-secondary text-sm"
                      >
                        Ver anime
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
