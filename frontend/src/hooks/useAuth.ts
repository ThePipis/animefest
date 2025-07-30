import { useAuthStore } from '../stores/authStore';
import { useApi } from './useApi';
import { useNavigate } from 'react-router-dom';

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
        login(response.data.token, response.data.user);
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
        login(response.data.token, response.data.user);
        navigate('/');
        return { success: true };
      }
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
      if (response.data) {
        setUser(response.data);
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
