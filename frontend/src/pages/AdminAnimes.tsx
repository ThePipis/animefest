import React, { useState, useEffect, useCallback } from 'react'; // ✅ Agregar useCallback
import { useAuthStore } from '../stores/authStore';

interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  idioma: string;
  categoria: string;
  sitio_origen: string;
  url_origen: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  episodios: number; // Cambiado: ahora es un número (conteo)
}

const AdminAnimes: React.FC = () => {
  const { token } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [sitio, setSitio] = useState('latanime');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loadingAnimes, setLoadingAnimes] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [animesFiltrados, setAnimesFiltrados] = useState<Anime[]>([]);

  // ✅ Función cargarAnimes con useCallback
  const cargarAnimes = useCallback(async () => {
    setLoadingAnimes(true);
    try {
      const response = await fetch('http://localhost:3001/api/animes/registered', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnimes(data.animes || []);
        setAnimesFiltrados(data.animes || []);
      } else {
        console.error('Error al cargar animes');
        setMessage('Error al cargar la lista de animes');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error de conexión al cargar animes');
      setMessageType('error');
    } finally {
      setLoadingAnimes(false);
    }
  }, [token]); // ✅ Dependencia: token

  // ✅ useEffect corregido
  useEffect(() => {
    cargarAnimes();
  }, [cargarAnimes]); // ✅ Dependencia: cargarAnimes

  // Filtrar animes cuando cambia la búsqueda
  useEffect(() => {
    if (busqueda.trim() === '') {
      setAnimesFiltrados(animes);
    } else {
      const filtrados = animes.filter(anime => 
        anime.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (anime.generos && anime.generos.some(genero => genero.toLowerCase().includes(busqueda.toLowerCase())))
      );
      setAnimesFiltrados(filtrados);
    }
  }, [busqueda, animes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nombre.trim()) {
      setMessage('Por favor ingresa el nombre del anime o URL');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/animes/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          sitio
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Anime ${data.message}`);
        setMessageType('success');
        setNombre('');
        cargarAnimes(); // Recargar la lista
      } else {
        setMessage(data.message || 'Error al procesar el anime');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      setMessage('Error de conexión con el servidor');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const eliminarAnime = async (id: number, titulo: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${titulo}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/animes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setMessage('Anime eliminado correctamente');
        setMessageType('success');
        cargarAnimes();
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Error al eliminar el anime');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error en eliminarAnime:', error);
      setMessage('Error de conexión');
      setMessageType('error');
    }
  };

  const actualizarAnime = async (anime: Anime) => {
    if (!confirm(`¿Actualizar "${anime.titulo}"? Esto volverá a scrapear todos los datos.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/animes/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: anime.url_origen,
          sitio: anime.sitio_origen
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Anime actualizado correctamente');
        setMessageType('success');
        cargarAnimes();
      } else {
        setMessage(data.message || 'Error al actualizar el anime');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error en actualizarAnime:', error);
      setMessage('Error de conexión');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="text-3xl">🎬</div>
          <div>
            <h1 className="text-3xl font-bold">Gestión de Animes</h1>
            <p className="text-gray-400">Agrega nuevos animes scrapeando desde sitios web</p>
          </div>
        </div>

        {/* Formulario de registro */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📝</span>
            <h2 className="text-xl font-semibold">Registrar Nuevo Anime</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre del Anime o URL</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Novia de Alquiler S1 Castellano o https://latanime.org/anime/..."
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Sitio Web Origen</label>
              <select
                value={sitio}
                onChange={(e) => setSitio(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="latanime">LatAnime.org</option>
              </select>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Scrapear y Guardar
                </>
              )}
            </button>
          </form>
          
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              messageType === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Lista de animes registrados */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <h2 className="text-xl font-semibold">Animes Registrados</h2>
              <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">
                {animes.length}
              </span>
            </div>
            
            {/* Búsqueda */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar anime..."
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          </div>
          
          {loadingAnimes ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Cargando animes...</p>
            </div>
          ) : animesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {busqueda ? 'No se encontraron animes que coincidan con la búsqueda' : 'No hay animes registrados aún'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4">Anime</th>
                    <th className="text-left py-3 px-4">Géneros</th>
                    <th className="text-left py-3 px-4">Año</th>
                    <th className="text-left py-3 px-4">Estado</th>
                    <th className="text-left py-3 px-4">Episodios</th>
                    <th className="text-left py-3 px-4">Origen</th>
                    <th className="text-left py-3 px-4">Fecha</th>
                    <th className="text-left py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {animesFiltrados.map((anime) => (
                    <tr key={anime.id} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {anime.imagen ? (
                            <img 
                              src={anime.imagen} 
                              alt={anime.titulo}
                              className="w-12 h-16 object-cover rounded"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-16 bg-gray-600 rounded flex items-center justify-center text-xs">
                              Sin imagen
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{anime.titulo}</div>
                            <div className="text-sm text-gray-400 truncate max-w-xs">
                              {anime.sinopsis || 'Sin sinopsis'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {anime.generos && anime.generos.length > 0 ? (
                            anime.generos.slice(0, 3).map((genero, index) => (
                              <span key={index} className="bg-blue-600 text-xs px-2 py-1 rounded">
                                {genero}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">Sin géneros</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{anime.año}</td>
                      <td className="py-3 px-4">
                        <span className="bg-green-600 text-xs px-2 py-1 rounded">
                          {anime.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-purple-600 text-xs px-2 py-1 rounded">
                          {anime.episodios || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-orange-600 text-xs px-2 py-1 rounded">
                          {anime.sitio_origen}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {new Date(anime.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => actualizarAnime(anime)}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
                            title="Actualizar anime"
                          >
                            🔄
                          </button>
                          <button
                            onClick={() => eliminarAnime(anime.id, anime.titulo)}
                            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition-colors"
                            title="Eliminar anime"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnimes;