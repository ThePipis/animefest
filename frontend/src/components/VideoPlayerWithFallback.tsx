/// <reference types="node" />
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Anime, Episodio } from '@/types/anime';

interface Servidor {
  nombre: string;
  iframe: string;
  prioridad: number;
}

interface VideoPlayerWithFallbackProps {
  animeId: string;
  episodio: string;
  token: string;
}

export const VideoPlayerWithFallback: React.FC<VideoPlayerWithFallbackProps> = ({
  animeId,
  episodio,
  token
}) => {
  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animeInfo, setAnimeInfo] = useState<Anime | null>(null);
  const [episodioInfo, setEpisodioInfo] = useState<Episodio | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchServidores = async () => {
      if (!animeId || !episodio || !token) {
        setError('Parámetros inválidos');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`🎬 Obteniendo servidores para anime ${animeId}, episodio ${episodio}`);

        const response = await fetch(
          `http://localhost:3001/reproductor/${animeId}/${episodio}`, // animeId ahora contiene el slug
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Episodio no encontrado');
          } else if (response.status === 401 || response.status === 403) {
            setError('Sesión expirada');
          } else {
            setError(`Error del servidor: ${response.status}`);
          }
          setLoading(false);
          return;
        }

        const result = await response.json();
        
        if (result.servidores && result.servidores.length > 0) {
          setServidores(result.servidores);
          setAnimeInfo(result.anime);
          setEpisodioInfo(result.episodio);
          setCurrentServerIndex(0);
          
          console.log(`✅ ${result.servidores.length} servidores encontrados`);
        } else {
          setError('No se encontraron servidores disponibles');
        }

      } catch (err) {
        console.error('🚨 Error obteniendo servidores:', err);
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchServidores();
  }, [animeId, episodio, token]);

  // Función para cambiar al siguiente servidor
  const tryNextServer = () => {
    if (currentServerIndex < servidores.length - 1) {
      console.log(`⚠️ Servidor ${servidores[currentServerIndex].nombre} falló, probando siguiente...`);
      setCurrentServerIndex(prev => prev + 1);
      setIframeError(false);
    } else {
      console.error('❌ Todos los servidores fallaron');
      setError('No se pudo cargar el episodio en ningún servidor');
    }
  };

  // Manejar error del iframe
  const handleIframeError = () => {
    console.warn(`⚠️ Error cargando iframe del servidor: ${servidores[currentServerIndex]?.nombre}`);
    setIframeError(true);
    
    // Esperar un poco antes de cambiar al siguiente servidor
    timeoutRef.current = setTimeout(() => {
      tryNextServer();
    }, 2000);
  };

  // Manejar carga exitosa del iframe
  const handleIframeLoad = () => {
    console.log(`✅ Iframe cargado exitosamente: ${servidores[currentServerIndex]?.nombre}`);
    setIframeError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Cargando servidores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-white text-lg mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (servidores.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">📺</div>
          <p className="text-white text-lg">No hay servidores disponibles</p>
        </div>
      </div>
    );
  }

  const currentServer = servidores[currentServerIndex];

  return (
    <div className="w-full">
      {/* Información del episodio */}
      {animeInfo && episodioInfo && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-2">
            {animeInfo.titulo} - Episodio {episodioInfo.numero}
          </h2>
          <p className="text-gray-300">{episodioInfo.titulo}</p>
        </div>
      )}

      {/* Indicador de servidor actual */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Servidor:</span>
          <span className="text-white font-semibold capitalize">{currentServer.nombre}</span>
          {iframeError && (
            <span className="text-yellow-500 text-sm">(Cargando siguiente...)</span>
          )}
        </div>
        <div className="text-gray-400 text-sm">
          {currentServerIndex + 1} de {servidores.length}
        </div>
      </div>

      {/* Reproductor de video */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <AnimatePresence mode="wait">
          <motion.iframe
            key={currentServerIndex}
            ref={iframeRef}
            src={currentServer.iframe}
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            frameBorder="0"
            allowFullScreen
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        </AnimatePresence>
        
        {/* Overlay de carga */}
        {iframeError && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-white text-sm">Cambiando servidor...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controles de servidor manual */}
      {servidores.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {servidores.map((servidor, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentServerIndex(index);
                setIframeError(false);
              }}
              className={`px-3 py-1 rounded text-sm capitalize ${
                index === currentServerIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {servidor.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};