import React, { useState, useEffect, useCallback } from 'react';
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

interface Favorito {
  id: number;
  titulo: string;
  imagen: string;
}

// Componente del dropdown selector de rangos de episodios
interface EpisodeRangeSelectorProps {
  totalEpisodes: number;
  currentRange: number;
  onRangeChange: (range: number) => void;
  episodesPerRange: number;
}

const EpisodeRangeSelector: React.FC<EpisodeRangeSelectorProps> = ({
  totalEpisodes,
  currentRange,
  onRangeChange,
  episodesPerRange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalRanges = Math.ceil(totalEpisodes / episodesPerRange);
  
  const getRangeLabel = (range: number) => {
    const start = (range - 1) * episodesPerRange + 1;
    const end = Math.min(range * episodesPerRange, totalEpisodes);
    return `Ep ${start} - ${end}`;
  };

  const handleRangeSelect = (range: number) => {
    onRangeChange(range);
    setIsOpen(false);
  };

  if (totalRanges <= 1) return null;

  return (
    <div className="relative">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full max-w-xs bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-left text-white hover:bg-dark-600 transition-colors flex items-center justify-between"
        >
          <span className="text-sm font-medium">{getRangeLabel(currentRange)}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-full max-w-xs bg-dark-700 border border-dark-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {Array.from({ length: totalRanges }, (_, i) => i + 1).map((range) => (
              <button
                key={range}
                onClick={() => handleRangeSelect(range)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-dark-600 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  currentRange === range
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-300'
                }`}
              >
                {getRangeLabel(range)}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Overlay para cerrar el dropdown al hacer clic fuera */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export const AnimeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  
  // Estados para la selección de rangos
  const [currentRange, setCurrentRange] = useState(1);
  const episodesPerRange = 12; // Episodios por rango (configurable)
  
  // Estados para las nuevas funcionalidades
  const [isReversed, setIsReversed] = useState(false);
  const [episodeFilter, setEpisodeFilter] = useState('');
  
  const api = useApi();
  const { isAuthenticated } = useAuthStore();

  const fetchAnime = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.getAnime(parseInt(id!));
      
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setAnime(response.data as Anime);
      }
    } catch {
      setError('Error al cargar el anime');
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  const checkFavoriteStatus = useCallback(async () => {
    try {
      const response = await api.getFavoritos();
      if (response.data && Array.isArray(response.data)) {
        const favoriteIds = response.data.map((fav: Favorito) => fav.id);
        setIsFavorite(favoriteIds.includes(parseInt(id!)));
      }
    } catch (err) {
      console.error('Error checking favorite status:', err);
    }
  }, [api, id]);

  useEffect(() => {
    if (id) {
      fetchAnime();
      if (isAuthenticated) {
        checkFavoriteStatus();
      }
    }
  }, [id, isAuthenticated, fetchAnime, checkFavoriteStatus]);

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

  // Función para obtener episodios del rango actual con filtros aplicados
  const getCurrentRangeEpisodes = () => {
    if (!anime) return [];
    
    let episodes = anime.episodios;
    
    // Aplicar filtro por número de episodio si existe
    if (episodeFilter.trim() !== '') {
      const filterNumber = parseInt(episodeFilter);
      if (!isNaN(filterNumber)) {
        episodes = episodes.filter(ep => ep.numero === filterNumber);
      } else {
        episodes = [];
      }
    } else {
      // Si no hay filtro, aplicar paginación por rango
      const startIndex = (currentRange - 1) * episodesPerRange;
      const endIndex = startIndex + episodesPerRange;
      episodes = episodes.slice(startIndex, endIndex);
    }
    
    // Aplicar orden (invertido o normal)
    if (isReversed) {
      episodes = [...episodes].reverse();
    }
    
    return episodes;
  };

  const handleRangeChange = (range: number) => {
    setCurrentRange(range);
    // Limpiar filtro al cambiar de rango
    setEpisodeFilter('');
    // Scroll suave hacia la sección de episodios
    const episodesSection = document.getElementById('episodes-section');
    if (episodesSection) {
      episodesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInvertOrder = () => {
    setIsReversed(!isReversed);
  };

  const handleEpisodeFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEpisodeFilter(e.target.value);
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

  const currentEpisodes = getCurrentRangeEpisodes();
  const totalEpisodesCount = episodeFilter.trim() !== '' ? 
    (anime.episodios.filter(ep => ep.numero.toString().includes(episodeFilter)).length) : 
    anime.episodios.length;

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
          {/* Imagen y detalles del anime */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="card p-6 sticky top-8">
              <div className="mb-1">
                {/* Botón de favoritos encima de la imagen */}
                {isAuthenticated && (
                  <div className="mb-0">
                    <button
                      onClick={toggleFavorite}
                      disabled={favoriteLoading}
                      className={`w-full px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        isFavorite
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-pink-500 text-white hover:bg-pink-600'
                      }`}
                    >
                      {favoriteLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <span className="text-lg">{isFavorite ? '❤️' : '🤍'}</span>
                          <span>{isFavorite ? 'FAVORITO' : 'AGREGAR A FAVORITO'}</span>
                          {/* <span className="text-xs opacity-75">a favoritos</span> */}
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                <img
                  src={anime.imagen}
                  alt={anime.titulo}
                  className="w-full h-96 object-cover"
                />
                
                {/* Botón de estado debajo de la imagen */}
                <div className="mt-0">
                  <button
                    className={`w-full px-4 py-2 rounded-b-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      anime.estado === 'Finalizado'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : anime.estado === 'En emisión'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    <span className="text-lg">
                      {anime.estado === 'Finalizado' ? '✅' : 
                       anime.estado === 'En emisión' ? '📺' : '⏳'}
                    </span>
                    <span>{anime.estado.toUpperCase()}</span>
                   {/*  <span className="text-xs opacity-75">estado</span> */}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Botón de Año */}
                  <button className="w-full px-2 py-1 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-purple-500 text-white hover:bg-purple-600">
                    <span className="text-lg">📅</span>
                    <span>{anime.año}</span>
                  </button>
                  
                  {/* Botón de Categoría */}
                  <button className="w-full px-2 py-1 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-indigo-500 text-white hover:bg-indigo-600">
                    <span className="text-lg">🎭</span>
                    <span>{anime.categoria.toUpperCase()}</span>
                  </button>
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
            <div className="card p-6 mb-3">
              <h1 className="text-3xl font-bold text-white mb-4">{anime.titulo}</h1>
              <p className="text-dark-300 text-justify leading-relaxed">{anime.sinopsis}</p>
              {/* Géneros */}
              <div className="card p-6 mb-3">
                <h3 className="text-lg font-semibold text-white mb-3">Géneros</h3>
                <div className="flex flex-wrap gap-2">
                  {anime.generos.map((genero, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs"
                    >
                      {genero}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Lista de episodios con controles */}
            <div className="card p-4" id="episodes-section">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Episodios</h2>
                <span className="text-dark-400 text-sm">
                  Mostrando {currentEpisodes.length} de {totalEpisodesCount} episodios
                </span>
              </div>
              
              {/* Controles: Dropdown, Botón Invertir y Filtro */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Dropdown Selector de Rangos */}
                <EpisodeRangeSelector
                  totalEpisodes={anime.episodios.length}
                  currentRange={currentRange}
                  onRangeChange={handleRangeChange}
                  episodesPerRange={episodesPerRange}
                />
                
                {/* Botón Invertir */}
                <button
                  onClick={handleInvertOrder}
                  className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white hover:bg-dark-600 transition-colors flex items-center gap-2"
                  title={isReversed ? 'Orden: Mayor a menor' : 'Orden: Menor a mayor'}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isReversed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span className="text-sm font-medium">Invertir</span>
                </button>
                
                {/* Filtro por número de episodio */}
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-dark-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Nº episodio"
                    value={episodeFilter}
                    onChange={handleEpisodeFilterChange}
                    className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-400 text-sm w-32 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
              
              {/* Lista de episodios */}
              <div className="space-y-3">
                {currentEpisodes.length > 0 ? (
                  currentEpisodes.map((episodio) => (
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
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-dark-400">No se encontraron episodios que coincidan con el filtro.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
