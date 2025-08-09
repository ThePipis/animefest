import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import type { User } from '../types/types';

import { useApi } from './useApi';

export const useAuth = () => {
  const { user, token, isAuthenticated, login, logout, setUser } = useAuthStore();
  const api = useApi();
  const navigate = useNavigate();

  const handleLogin = async (username: string, password: string) => {
    try {
      console.log('Attempting login with:', { username, password });
      const response = await api.login(username, password);
      console.log('Login response:', response);

      if (response.error) {
        console.error('Login error from API:', response.error);
        throw new Error(response.error);
      }

      if (response.data) {
        console.log('Login successful, storing data');
        // Asegurar que el usuario tenga el campo role
        const userWithRole = {
          ...response.data.user,
          role: response.data.user.role || 'user'
        };
        login(response.data.token, userWithRole);
        navigate('/');
        return { success: true };
      }

      return { success: false, error: 'No data received' };
    } catch (error) {
      console.error('Login catch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en el login'
      };
    }
  };

  const handleRegister = async (username: string, email: string, password: string) => {
    try {
      const response = await api.register(username, email, password);
      
      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        // Asegurar que el usuario tenga el campo role
        const userWithRole = {
          ...response.data.user,
          role: response.data.user.role || 'user'
        };
        login(response.data.token, userWithRole);
        navigate('/');
        return { success: true };
      }
      
      return { success: false, error: 'No data received' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error en el registro' 
      };
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const updateUser = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.getUser();
      if (response.data && typeof response.data === 'object' && 'id' in response.data) {
        const userData = response.data as Partial<User>;
        if (userData.id && userData.username && userData.email) {
          const userWithRole: User = {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            role: userData.role || 'user'
          };
          setUser(userWithRole);
        }
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    updateUser,
  };
};
