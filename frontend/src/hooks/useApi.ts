import { useMemo } from 'react';

import { useAuthStore } from '../stores/authStore';
import type { User } from '../types/types';

const API_BASE_URL = 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// Agregar interface para el body de las requests
interface RequestBody {
  [key: string]: unknown;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const { token } = useAuthStore.getState();
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      mode: 'cors',
      ...options,
    };

    try {
      console.log(`Making request to: ${this.baseURL}${endpoint}`);
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP Error ${response.status}:`, errorText);

        // ✅ Detectar token expirado
        if (response.status === 403 && errorText.includes('Token inválido')) {
          localStorage.removeItem('token');
          window.location.href = '/login?expired=true'; // Redirige con mensaje
          return {
            error: 'Token expirado',
            status: 403,
          };
        }

        return {
          error: `Error ${response.status}: ${errorText}`,
          status: response.status,
        };
      }

      const data = await response.json();
      console.log('Response data:', data);

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      console.error('Network error:', error);
      return {
        error: `Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: RequestBody): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: RequestBody): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Hook personalizado para usar la API
export const useApi = () => {
  return useMemo(() => ({
    // Catálogo
    getCatalogo: (buscar?: string, genero?: string) => {
      const params = new URLSearchParams();
      if (buscar) params.append('buscar', buscar);
      if (genero) params.append('genero', genero);
      const query = params.toString();
      return apiClient.get(`/catalogo${query ? `?${query}` : ''}`);
    },

    // Anime específico
    getAnime: (id: number) => apiClient.get(`/anime/${id}`),

    // Stream
    getStream: (animeId: number, episodio: number) =>
      apiClient.get(`/reproducir?animeId=${animeId}&episodio=${episodio}`),

    // Autenticación
    login: (username: string, password: string) =>
      apiClient.post<{ token: string; user: User }>('/login', { username, password }),

    register: (username: string, email: string, password: string) =>
      apiClient.post<{ token: string; user: User }>('/registro', { username, email, password }),
    // Usuario
    getUser: () => apiClient.get('/usuario'),

    // Favoritos
    getFavoritos: () => apiClient.get('/favoritos'),
    addFavorito: (animeId: number) => apiClient.post('/favoritos', { animeId }),
    removeFavorito: (animeId: number) => apiClient.delete(`/favoritos/${animeId}`),

    // Historial
    getHistorial: () => apiClient.get('/historial'),
    addHistorial: (animeId: number, episodio: number, progreso: number) =>
      apiClient.post('/historial', { animeId, episodio, progreso }),
  }), []);
};
