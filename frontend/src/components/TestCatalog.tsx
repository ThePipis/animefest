import React, { useState, useEffect } from 'react';

export const TestCatalog: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testFetch = async () => {
      try {
        console.log('Testing direct fetch to backend...');
        const response = await fetch('http://localhost:3001/catalogo');
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Response data:', result);
        setData(result);
      } catch (err) {
        console.error('Test fetch error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    testFetch();
  }, []);

  if (loading) {
    return <div className="p-4 text-white">Probando conexión...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-400">
        <h3>Error de conexión:</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-white">
      <h3>Conexión exitosa!</h3>
      <p>Datos recibidos: {data ? JSON.stringify(data).substring(0, 100) + '...' : 'No data'}</p>
    </div>
  );
};
