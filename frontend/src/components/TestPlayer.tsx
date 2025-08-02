// src/components/TestPlayer.tsx

import { useEffect } from 'react';
import { testReproductor } from '../api/testReproductor';

export function TestPlayer() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No hay token disponible en localStorage');
      return;
    }

    testReproductor('7', 1, token); // Cambia "7" y "1" por ID y episodio real
  }, []);

  return <div>Revisando endpoint /reproducir en consola del navegador...</div>;
}
