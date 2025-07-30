import { useState, useEffect, useRef } from "react";
import { FunnelIcon, ChevronDownIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";

interface Anime {
  id: number;
  titulo: string;
  generos: string[];
  año: number;
  categoria: string;
  estado: string;
}

interface FilterState {
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
type DropdownState = FilterKey | 'orden' | null;

const ORDER_OPTIONS = [
  "Por Defecto",
  "Recientemente Actualizados",
  "Recientemente Agregados",
  "Nombre A-Z",
  "Calificación"
] as const;

const labelMap: Record<FilterKey | 'orden', string> = {
  genero: "Género",
  año: "Año",
  categoria: "Tipo",
  estado: "Estado",
  orden: "Orden"
};

const getUnique = (arr: (string | number)[]): string[] => {
  return Array.from(new Set(arr)).filter(Boolean).map(String);
};

export default function SearchFilters({ onFiltersApply }: SearchFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
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
        const response = await fetch("http://localhost:3001/animes");
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

  const handleMulti = (key: FilterKey, value: string) => {
    setFilters((f) => {
      const arr = f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value];
      return { ...f, [key]: arr };
    });
  };

  const handleRadio = (value: string) => {
    setFilters((f) => ({ ...f, orden: value }));
    setDropdown(null);
  };

  const clearFilter = (key: FilterKey) => {
    setFilters((f) => ({ ...f, [key]: [] }));
  };

  const handleApply = () => {
    if (onFiltersApply) {
      onFiltersApply(filters);
    }
  };

  useEffect(() => {
    if (onFiltersApply) {
      onFiltersApply(filters);
    }
  }, [filters, onFiltersApply]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center bg-white rounded-xl shadow-md px-4 py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Cargando filtros...</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full flex flex-wrap gap-2 md:gap-3 items-center bg-white rounded-xl shadow-md px-4 py-4">
      {/* Contenedor de filtros */}
      <div className="flex flex-wrap gap-2 md:gap-3 items-center flex-1">
        {/* Filtros */}
        {(["genero", "año", "categoria", "estado"] as FilterKey[]).map((key) => (
          <div key={key} className="relative flex-shrink-0">
            <button
              type="button"
              className={`flex items-center justify-between min-w-[140px] max-w-[180px] px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 font-medium transition-all duration-200 focus:outline-none hover:border-gray-300 hover:shadow-md ${
                dropdown === key ? "ring-2 ring-blue-300 border-blue-300" : ""
              }`}
              onClick={() => setDropdown(dropdown === key ? null : key)}
            >
              <span className="text-gray-400 text-xs mr-2">{labelMap[key]}:</span>
              <span className={`truncate flex-1 text-left text-xs ${
                filters[key].length ? "text-blue-600 font-semibold" : "text-gray-500"
              }`}>
                {filters[key].length === 0 ? "Todos" : `${filters[key].length} sel.`}
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
              <div className="absolute left-0 z-20 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-4 grid grid-cols-2 gap-2 animate-fade-in max-h-60 overflow-y-auto">
                {options[key].length === 0 ? (
                  <div className="col-span-2 text-center text-gray-500 py-4">
                    No hay opciones disponibles
                  </div>
                ) : (
                  options[key].map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                      <input
                        type="checkbox"
                        checked={filters[key].includes(option)}
                        onChange={() => handleMulti(key, option)}
                        className="hidden"
                      />
                      <span className={`w-5 h-5 flex items-center justify-center border-2 rounded transition-colors ${
                        filters[key].includes(option) ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                      }`}>
                        {filters[key].includes(option) && <CheckIcon className="w-4 h-4 text-white" />}
                      </span>
                      <span className="truncate text-sm">{option}</span>
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
            className={`flex items-center justify-between min-w-[140px] max-w-[180px] px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 font-medium transition-all duration-200 focus:outline-none hover:border-gray-300 hover:shadow-md ${
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
            <div className="absolute left-0 z-20 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-4 animate-fade-in">
              {ORDER_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                  <input
                    type="radio"
                    name="orden"
                    checked={filters.orden === option}
                    onChange={() => handleRadio(option)}
                    className="hidden"
                  />
                  <span className={`w-5 h-5 flex items-center justify-center border-2 rounded-full transition-colors ${
                    filters.orden === option ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
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
      
      {/* Botón Filtrar */}
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all duration-200 text-sm flex-shrink-0 border border-indigo-700 hover:shadow-xl transform hover:scale-105"
        onClick={handleApply}
      >
        <FunnelIcon className="w-4 h-4" />
        FILTRAR
      </button>
    </div>
  );
}
