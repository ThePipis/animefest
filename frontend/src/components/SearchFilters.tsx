import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDownIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface Anime {
  id: number;
  titulo: string;
  generos: string[];
  año: number;
  categoria: string;
  estado: string;
}

interface FilterState {
  letra: string;
  genero: string[];
  año: string[];
  categoria: string[];
  estado: string[];
  orden: string;
}

interface OptionsState {
  genero: string[];
  año: string[];
  categoria: string[];
  estado: string[];
}

interface SearchFiltersProps {
  onFiltersApply?: (filters: FilterState) => void;
}

type FilterKey = 'genero' | 'año' | 'categoria' | 'estado';
type DropdownState = FilterKey | 'orden' | 'letra' | null;

const ORDER_OPTIONS = [
  "Por Defecto",
  "Recientemente Actualizados",
  "Recientemente Agregados",
  "Nombre A-Z",
  "Calificación"
] as const;

const LETTER_OPTIONS = [
  "Seleccionar",
  "0-9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
] as const;

const labelMap: Record<FilterKey | 'orden' | 'letra', string> = {
  letra: "Letra",
  genero: "Género",
  año: "Año",
  categoria: "Tipo",
  estado: "Estado",
  orden: "Orden"
};

const getUnique = (arr: (string | number)[]): string[] => {
  return Array.from(new Set(arr))
    .filter(item => item !== undefined && item !== null && item !== '')
    .map(String);
};

export default function SearchFilters({ onFiltersApply }: SearchFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    letra: "",
    genero: [],
    año: [],
    categoria: [],
    estado: [],
    orden: "Por Defecto"
  });
  const [dropdown, setDropdown] = useState<DropdownState>(null);
  const [options, setOptions] = useState<OptionsState>({
    genero: [],
    año: [],
    categoria: [],
    estado: []
  });
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        // Cambiar de "/animes" a "/catalogo" para usar la misma fuente
        const response = await fetch("http://localhost:3001/catalogo");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Anime[] = await response.json();
        
        setOptions({
          genero: getUnique(data.flatMap((a) => a.generos)),
          año: getUnique(data.map((a) => a.año)).sort((a, b) => Number(b) - Number(a)),
          categoria: getUnique(data.map((a) => a.categoria)),
          estado: getUnique(data.map((a) => a.estado))
        });
      } catch (error) {
        console.error('Error fetching animes:', error);
        setOptions({
          genero: [],
          año: [],
          categoria: [],
          estado: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdown(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleMulti = useCallback((key: FilterKey, value: string) => {
    // Remover esta línea: console.log('handleMulti called with:', key, value, typeof value);
    
    if (!value || value === undefined || value === null) {
      return;
    }
    
    setFilters((f) => {
      const arr = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: arr };
    });
  }, []);

  const handleRadio = useCallback((value: string) => {
    setFilters((f) => ({ ...f, orden: value }));
    setDropdown(null);
  }, []);

  const handleLetter = useCallback((value: string) => {
    setFilters((f) => ({ ...f, letra: value === "Seleccionar" ? "" : value }));
    setDropdown(null);
  }, []);

  const clearFilter = useCallback((key: FilterKey) => {
    setFilters((f) => ({ ...f, [key]: [] }));
  }, []);

  const clearLetter = useCallback(() => {
    setFilters((f) => ({ ...f, letra: "" }));
  }, []);

  // Auto-filtrado al cambiar cualquier filtro - CORREGIDO
  useEffect(() => {
    if (onFiltersApply) {
      onFiltersApply(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]); // Removed onFiltersApply from dependencies array

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
        <span className="ml-2 text-slate-300">Cargando filtros...</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full flex flex-wrap gap-2 md:gap-3 items-center bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-4 z-10">
      {/* Filtro por Letra */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          className={`flex items-center justify-between min-w-[120px] max-w-[160px] px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-gray-700 font-medium transition-all duration-200 focus:outline-none hover:border-slate-300 hover:shadow-md ${
            dropdown === "letra" ? "ring-2 ring-blue-300 border-blue-300" : ""
          }`}
          onClick={() => setDropdown(dropdown === "letra" ? null : "letra")}
        >
          <span className="text-gray-400 text-xs mr-2">{labelMap.letra}:</span>
          <span className={`truncate flex-1 text-left text-xs ${
            filters.letra ? "text-blue-600 font-semibold" : "text-gray-500"
          }`}>
            {filters.letra || "Seleccionar"}
          </span>
          <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-400 flex-shrink-0" />
          {filters.letra && (
            <XMarkIcon 
              className="w-3 h-3 ml-1 text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 transition-colors" 
              onClick={(e) => {
                e.stopPropagation(); 
                clearLetter();
              }} 
            />
          )}
        </button>
        {dropdown === "letra" && (
          <div className="absolute left-0 z-[9999] mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-2">
              <button
                onClick={() => handleLetter("Seleccionar")}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  !filters.letra ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Seleccionar
              </button>
            </div>
            <div className="p-2 space-y-1">
              {LETTER_OPTIONS.slice(1).map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleLetter(letter)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    filters.letra === letter ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtros multiselección */}
      {(["genero", "año", "categoria", "estado"] as FilterKey[]).map((key) => (
        <div key={key} className="relative flex-1 min-w-0">
          <button
            type="button"
            className={`flex items-center justify-between w-full px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-gray-700 font-medium transition-all duration-200 focus:outline-none hover:border-slate-300 hover:shadow-md ${
              dropdown === key ? "ring-2 ring-blue-300 border-blue-300" : ""
            }`}
            onClick={() => setDropdown(dropdown === key ? null : key)}
          >
            <span className="text-gray-400 text-xs mr-2">{labelMap[key]}:</span>
            <span className={`truncate flex-1 text-left text-xs ${
              filters[key].length ? "text-blue-600 font-semibold" : "text-gray-500"
            }`}>
              {filters[key].length === 0 ? "Todos" : `${filters[key].length} seleccionados`}
            </span>
            <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-400 flex-shrink-0" />
            {filters[key].length > 0 && (
              <XMarkIcon 
                className="w-3 h-3 ml-1 text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 transition-colors" 
                onClick={(e) => {
                  e.stopPropagation(); 
                  clearFilter(key);
                }} 
              />
            )}
          </button>
          {dropdown === key && (
            <div className={`absolute left-0 z-[9999] mt-2 bg-slate-100 border border-slate-200 rounded-xl shadow-2xl p-3 ${
              key === 'año' || key === 'estado' 
                ? 'grid grid-cols-2 gap-2 w-fit min-w-[200px]' 
                : key === 'categoria'
                ? 'flex flex-col gap-1 w-fit min-w-[280px] max-w-[350px]'
                : 'grid grid-cols-3 gap-2 w-fit min-w-[450px] max-w-[550px]'
            }`}>
              {options[key].length === 0 ? (
                <div className={`text-center text-slate-500 py-3 text-xs ${
                  key === 'año' || key === 'estado' ? 'col-span-2' : key === 'categoria' ? '' : 'col-span-3'
                }`}>
                  No hay opciones disponibles
                </div>
              ) : (
                options[key].map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer select-none text-slate-700 hover:bg-blue-50 rounded px-2 py-1.5 transition-colors whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={filters[key].includes(option)}
                      onChange={() => handleMulti(key, option)}
                      className="hidden"
                    />
                    <span className={`w-3.5 h-3.5 flex items-center justify-center border-2 rounded transition-colors flex-shrink-0 ${
                      filters[key].includes(option) ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
                    }`}>
                      {filters[key].includes(option) && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-xs">{option}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* Orden */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          className={`flex items-center justify-between min-w-[140px] max-w-[180px] px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-gray-700 font-medium transition-all duration-200 focus:outline-none hover:border-slate-300 hover:shadow-md ${
            dropdown === "orden" ? "ring-2 ring-blue-300 border-blue-300" : ""
          }`}
          onClick={() => setDropdown(dropdown === "orden" ? null : "orden")}
        >
          <span className="text-gray-400 text-xs mr-2">Orden:</span>
          <span className="truncate flex-1 text-left text-blue-600 font-semibold text-xs">
            {filters.orden === "Por Defecto" ? "Defecto" : filters.orden.split(" ")[0]}
          </span>
          <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-400 flex-shrink-0" />
        </button>
        {dropdown === "orden" && (
          <div className="absolute left-0 z-[9999] mt-2 w-64 bg-slate-100 border border-slate-200 rounded-xl shadow-2xl p-4">
            {ORDER_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer select-none text-slate-700 hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                <input
                  type="radio"
                  name="orden"
                  checked={filters.orden === option}
                  onChange={() => handleRadio(option)}
                  className="hidden"
                />
                <span className={`w-5 h-5 flex items-center justify-center border-2 rounded-full transition-colors ${
                  filters.orden === option ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"
                }`}>
                  {filters.orden === option && <CheckIcon className="w-4 h-4 text-white" />}
                </span>
                <span className="truncate text-sm">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
