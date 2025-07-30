import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { SearchInput } from '../components/SearchInput';
import SearchFilters from '../components/SearchFilters';

interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  categoria: string;
  idioma: string;
}

interface FilterState {
  genero: string[];
  año: string[];
  categoria: string[];
  estado: string[];
  orden: string;
}

export const Catalogo: React.FC = () => {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    genero: [],
    año: [],
    categoria: [],
    estado: [],
    orden: 'Por Defecto',
  });

  const apiService = useApi();
  const navigate = useNavigate();

  const fetchAnimes = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🚀 Fetching animes...');
      const response = await apiService.getCatalogo();
      console.log('📡 API Response:', response);

      if (response.error) {
        console.error('❌ API Error:', response.error);
        setError(response.error);
      } else if (response.data) {
        console.log('✅ Setting animes:', response.data);
        setAnimes(response.data as Anime[]);
      } else {
        console.warn('⚠️ No data in response');
        setError('No se recibieron datos del servidor');
      }
    } catch (err) {
      console.error('💥 Fetch error:', err);
      setError('Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [apiService]);

  useEffect(() => {
    fetchAnimes();
  }, [fetchAnimes]);

  // Mejorar la lógica de filtrado
  const filteredAnimes = animes.filter(anime => {
    // Filtro de búsqueda por texto
    const matchesSearch = searchTerm === '' || 
      anime.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      anime.sinopsis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      anime.generos.some(genero => genero.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtro por género
    const matchesGenre = activeFilters.genero.length === 0 || 
      activeFilters.genero.some(filterGenre => 
        anime.generos.some(animeGenre => 
          animeGenre.toLowerCase().includes(filterGenre.toLowerCase())
        )
      );
    
    // Filtro por año
    const matchesYear = activeFilters.año.length === 0 || 
      activeFilters.año.includes(anime.año.toString());
    
    // Filtro por categoría
    const matchesCategory = activeFilters.categoria.length === 0 || 
      activeFilters.categoria.some(filterCat => 
        anime.categoria.toLowerCase() === filterCat.toLowerCase()
      );
    
    // Filtro por estado
    const matchesStatus = activeFilters.estado.length === 0 || 
      activeFilters.estado.some(filterStatus => 
        anime.estado.toLowerCase() === filterStatus.toLowerCase()
      );
    
    return matchesSearch && matchesGenre && matchesYear && matchesCategory && matchesStatus;
  });

  // Aplicar ordenamiento
  const sortedAnimes = [...filteredAnimes].sort((a, b) => {
    switch (activeFilters.orden) {
      case 'Nombre A-Z':
        return a.titulo.localeCompare(b.titulo);
      case 'Recientemente Agregados':
      case 'Recientemente Actualizados':
        return b.año - a.año;
      case 'Calificación':
        // Asumiendo que hay un campo de calificación, sino usar año
        return b.año - a.año;
      default:
        return 0; // Por defecto, mantener orden original
    }
  });

  const handleFiltersApply = (filters: FilterState) => {
    setActiveFilters(filters);
    setSelectedGenre(filters.genero.length > 0 ? filters.genero[0] : '');
  };

  const handleAnimeClick = (animeId: number) => {
    navigate(`/anime/${animeId}`);
  };

  return (
    <div className="min-h-screen bg-dark-900 p-8">
      <div className="max-w-7xl mx-auto">
        <SearchInput
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <div className="mt-45">
          <SearchFilters
            onFiltersApply={handleFiltersApply}
          />
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Cargando catálogo...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Error al cargar</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchAnimes}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && sortedAnimes.length > 0 && (
          <div>
            <div className="mb-6">
              <p className="text-gray-400">
                {sortedAnimes.length} anime{sortedAnimes.length !== 1 ? 's' : ''} encontrado{sortedAnimes.length !== 1 ? 's' : ''}
                {searchTerm && ` para "${searchTerm}"`}
                {selectedGenre && ` en ${selectedGenre}`}
              </p>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {sortedAnimes.map((anime) => (
                <motion.div
                  key={anime.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => handleAnimeClick(anime.id)}
                  className="group cursor-pointer"
                >
                  <div className="bg-dark-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 relative">
                    <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                      <img
                        src={anime.imagen}
                        alt={anime.titulo}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/300x400/1f2937/9ca3af?text=No+Image';
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-2">
                    <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight">
                      {anime.titulo}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-gray-400 text-xs">{anime.categoria || 'Anime'}</p>
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg border border-white inline-flex items-center gap-1">
                        ⭐ {anime.año}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state - No results */}
        {!loading && !error && animes.length > 0 && sortedAnimes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No se encontraron resultados
            </h3>
            <p className="text-gray-400">
              Intenta con otros términos de búsqueda o filtros
            </p>
          </div>
        )}

        {!loading && !error && animes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📺</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No se encontraron animes
            </h3>
            <p className="text-gray-400">
              No hay animes disponibles en este momento
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
