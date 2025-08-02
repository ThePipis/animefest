// src/api/testReproductor.ts

export async function testReproductor(animeId: string, episodio: number, token: string) {
  try {
    const response = await fetch(`http://localhost:3001/reproducir?id=${animeId}&episodio=${episodio}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Error en la solicitud:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('✅ Reproductor funcionando. Respuesta:', data);
    return data;
  } catch (error) {
    console.error('❌ Error general:', error);
    return null;
  }
}
