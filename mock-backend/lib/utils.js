// Función auxiliar para determinar prioridad de servidores
export function getPrioridad(serverName) {
  const prioridades = {
    streamwish: 1,
    doodstream: 2,
    filemoon: 3,
    streamtape: 4,
    mixdrop: 5,
    upstream: 6,
    yourupload: 7,
    mp4upload: 8,
    ok: 9,
    original: 999,
  };
  
  // Buscar coincidencia parcial en el nombre del servidor
  for (const [name, priority] of Object.entries(prioridades)) {
    if (serverName.toLowerCase().includes(name)) {
      return priority;
    }
  }
  
  return 999;
}
