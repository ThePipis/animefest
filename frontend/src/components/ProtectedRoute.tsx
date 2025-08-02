import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, token } = useAuthStore();
  const location = useLocation();

  // ✅ Verificación más estricta
  if (!isAuthenticated || !token) {
    console.warn('🚫 Acceso denegado: Usuario no autenticado');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
