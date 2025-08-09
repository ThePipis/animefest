import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  categoria: string;
  slug: string; // Agregar campo slug
}

interface AnimeCardProps {
  anime: Anime;
  index: number;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({ anime, index }) => {
  const linkTarget = anime.slug ?? anime.id.toString();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group cursor-pointer"
    >
      <Link to={`/anime/${linkTarget}`}>
        <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-dark-700/50 hover:border-primary-500/30 transition-all duration-300">
          <div className="relative">
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src={anime.imagen}
                alt={anime.titulo}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/300x400/1e293b/64748b?text=No+Image';
                }}
              />
            </div>

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Estado del anime */}
            <div className="absolute top-3 right-3">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full backdrop-blur-sm ${
                anime.estado === 'En emisión'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {anime.estado}
              </span>
            </div>

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-16 h-16 bg-primary-500/90 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-primary-400 transition-colors leading-tight">
              {anime.titulo}
            </h3>

            <p className="text-dark-400 text-sm mb-4 line-clamp-2 leading-relaxed">
              {anime.sinopsis}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {anime.generos.slice(0, 3).map((genero, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-dark-700/50 text-dark-300 text-xs rounded-lg font-medium"
                >
                  {genero}
                </span>
              ))}
              {anime.generos.length > 3 && (
                <span className="px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded-lg font-medium">
                  +{anime.generos.length - 3}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-dark-400 text-sm font-medium">{anime.año}</span>
              <div className="flex items-center text-primary-400 text-sm font-medium group-hover:text-primary-300 transition-colors">
                <span>Ver más</span>
                <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
