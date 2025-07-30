const fs = require('fs');
const path = require('path');

// Leer el archivo JSON
const animesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-backend/data/animes.json'), 'utf8'));

// Extraer valores únicos
const años = [...new Set(animesData.map(anime => anime.año))].sort((a, b) => b - a);
const generos = [...new Set(animesData.flatMap(anime => anime.generos || []))].sort();
const idiomas = [...new Set(animesData.map(anime => anime.idioma).filter(Boolean))].sort();
const categorias = [...new Set(animesData.map(anime => anime.categoria).filter(Boolean))].sort();
const estados = [...new Set(animesData.map(anime => anime.estado).filter(Boolean))].sort();

console.log('Años disponibles:', años);
console.log('Géneros disponibles:', generos);
console.log('Idiomas disponibles:', idiomas);
console.log('Categorías disponibles:', categorias);
console.log('Estados disponibles:', estados);

// Crear archivo con los datos para usar en el componente
const filterData = {
  años,
  generos,
  idiomas,
  categorias,
  estados
};

fs.writeFileSync(
  path.join(__dirname, 'frontend/src/data/filterData.json'),
  JSON.stringify(filterData, null, 2)
);

console.log('\nArchivo filterData.json creado exitosamente!');