export interface Episodio {
  numero: number;
  titulo: string;
  duracion: string;
  url_stream: string;
}

export interface Anime {
  id: number;
  titulo: string;
  sinopsis: string;
  imagen: string;
  generos: string[];
  año: number;
  estado: string;
  idioma: string;
  categoria: string;
  episodios: Episodio[];
}
