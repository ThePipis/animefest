import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  tipo: string;
  titulo: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  tipo, 
  titulo, 
  onTimeUpdate 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setLoading(true);
    setError(null);

    // Limpiar HLS anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (tipo === 'm3u8' && Hls.isSupported()) {
      // Usar HLS.js para streams m3u8
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(src);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        console.log('✅ Stream HLS cargado correctamente');
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ Error HLS:', data);
        if (data.fatal) {
          setError('Error cargando el video. Intenta con otro servidor.');
          setLoading(false);
        }
      });
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && tipo === 'm3u8') {
      // Safari nativo para HLS
      video.src = src;
      setLoading(false);
    } else {
      // Video MP4 estándar
      video.src = src;
      setLoading(false);
    }

    // Event listeners
    const handleLoadedData = () => setLoading(false);
    const handleError = () => {
      setError('Error cargando el video');
      setLoading(false);
    };
    
    const handleTimeUpdate = () => {
      if (onTimeUpdate && video.duration) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src, tipo, onTimeUpdate]);

  if (error) {
    return (
      <div className="bg-dark-800 rounded-lg p-8 text-center">
        <div className="text-red-400 text-4xl mb-4">⚠️</div>
        <h3 className="text-white text-lg mb-2">Error de reproducción</h3>
        <p className="text-dark-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-white">Cargando video...</p>
          </div>
        </div>
      )}
      
      <video
        ref={videoRef}
        className="w-full h-auto"
        controls
        preload="metadata"
        crossOrigin="anonymous"
        style={{ aspectRatio: '16/9' }}
      >
        Tu navegador no soporta el elemento video.
      </video>
      
      {/* Información del video */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <h3 className="text-white text-sm font-medium">{titulo}</h3>
        {tipo && (
          <p className="text-gray-300 text-xs">
            Servidor: {tipo.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
};
