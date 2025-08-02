// src/components/TestPlayer.tsx

import { useEffect } from 'react';
import { testReproductor } from '../api/testReproductor';
import { useAuthStore } from '../stores/authStore';

export function TestPlayer() {
  const { token, isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.warn('⚠️ No hay token disponible en authStore');
      return;
    }

    testReproductor('7', 1, token); // Cambia "7" y "1" por ID y episodio real
  }, [token, isAuthenticated]);

  return <div>Revisando endpoint /reproducir en consola del navegador...</div>;
}
