import { distance } from 'fastest-levenshtein';

// Constantes de datos geográficos
export const BOGOTA_LOCALIDADES = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme',
  'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá',
  'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires',
  'Antonio Nariño', 'Puente Aranda', 'La Candelaria',
  'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

export const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia',
  'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
];

export const CAPITALES_COLOMBIA = {
  'Amazonas': 'Leticia',
  'Antioquia': 'Medellín',
  'Arauca': 'Arauca',
  'Atlántico': 'Barranquilla',
  'Bolívar': 'Cartagena',
  'Boyacá': 'Tunja',
  'Caldas': 'Manizales',
  'Caquetá': 'Florencia',
  'Casanare': 'Yopal',
  'Cauca': 'Popayán',
  'Cesar': 'Valledupar',
  'Chocó': 'Quibdó',
  'Córdoba': 'Montería',
  'Cundinamarca': 'Bogotá',
  'Guainía': 'Inírida',
  'Guaviare': 'San José del Guaviare',
  'Huila': 'Neiva',
  'La Guajira': 'Riohacha',
  'Magdalena': 'Santa Marta',
  'Meta': 'Villavicencio',
  'Nariño': 'Pasto',
  'Norte de Santander': 'Cúcuta',
  'Putumayo': 'Mocoa',
  'Quindío': 'Armenia',
  'Risaralda': 'Pereira',
  'San Andrés y Providencia': 'San Andrés',
  'Santander': 'Bucaramanga',
  'Sucre': 'Sincelejo',
  'Tolima': 'Ibagué',
  'Valle del Cauca': 'Cali',
  'Vaupés': 'Mitú',
  'Vichada': 'Puerto Carreño'
};

/**
 * Normaliza un string para comparación (remove accents, lowercase, trim)
 */
export function normalizeString(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Calcula la similitud entre dos strings (0-1, donde 1 es idéntico)
 * Usa distancia de Levenshtein normalizada por la longitud máxima
 */
export function calculateSimilarity(str1, str2) {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  
  if (normalized1 === normalized2) return 1.0;
  if (!normalized1 || !normalized2) return 0.0;
  
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const dist = distance(normalized1, normalized2);
  
  return 1 - (dist / maxLength);
}

/**
 * Encuentra el mejor match de un string en una lista de opciones
 * @param {string} input - El string de entrada a buscar
 * @param {Array<string>} options - Lista de strings válidos
 * @param {number} threshold - Umbral de similitud mínima (0-1)
 * @returns {Object|null} - { match: string, similarity: number, original: string } o null
 */
export function findBestMatch(input, options, threshold = 0.80) {
  if (!input || !options || options.length === 0) return null;
  
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const option of options) {
    const similarity = calculateSimilarity(input, option);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = option;
    }
  }
  
  if (bestSimilarity >= threshold) {
    return {
      match: bestMatch,
      similarity: bestSimilarity,
      original: input,
      corrected: bestMatch !== input
    };
  }
  
  return null;
}

/**
 * Encuentra el mejor match para una localidad de Bogotá
 */
export function matchLocalidad(input, threshold = 0.80) {
  return findBestMatch(input, BOGOTA_LOCALIDADES, threshold);
}

/**
 * Encuentra el mejor match para un departamento
 */
export function matchDepartamento(input, threshold = 0.80) {
  return findBestMatch(input, DEPARTAMENTOS_COLOMBIA, threshold);
}

/**
 * Encuentra el mejor match para una capital
 * Busca en todos los valores del objeto CAPITALES_COLOMBIA
 */
export function matchCapital(input, threshold = 0.80) {
  const capitales = Object.values(CAPITALES_COLOMBIA);
  return findBestMatch(input, capitales, threshold);
}

/**
 * Encuentra el mejor match para un puesto de votación en una lista
 * @param {string} input - Nombre del puesto de entrada
 * @param {Array<Object>} puestos - Array de objetos puesto con campo 'nombre'
 * @param {number} threshold - Umbral de similitud
 * @returns {Object|null} - El puesto matched o null
 */
export function matchPuesto(input, puestos, threshold = 0.80) {
  if (!input || !puestos || puestos.length === 0) return null;
  
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const puesto of puestos) {
    const similarity = calculateSimilarity(input, puesto.nombre);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = puesto;
    }
  }
  
  if (bestSimilarity >= threshold) {
    return {
      puesto: bestMatch,
      similarity: bestSimilarity,
      original: input,
      corrected: normalizeString(bestMatch.nombre) !== normalizeString(input)
    };
  }
  
  return null;
}

/**
 * Autocorrige un registro completo basado en los datos válidos
 * @param {Object} registro - El registro a corregir
 * @param {Array<Object>} puestos - Lista de puestos válidos
 * @param {number} threshold - Umbral de similitud
 * @returns {Object} - { registro: Object corregido, corrections: Array de correcciones }
 */
export function autocorrectRegistration(registro, puestos, threshold = 0.80) {
  const corrections = [];
  const correctedRegistro = { ...registro };
  
  // 1. Corregir localidad (si es Bogotá)
  if (registro.localidad) {
    const localidadMatch = matchLocalidad(registro.localidad, threshold);
    if (localidadMatch && localidadMatch.corrected) {
      correctedRegistro.localidad = localidadMatch.match;
      corrections.push({
        field: 'localidad',
        original: registro.localidad,
        corrected: localidadMatch.match,
        similarity: localidadMatch.similarity
      });
    }
  }
  
  // 2. Corregir puesto de votación
  if (registro.votingPlace && puestos && puestos.length > 0) {
    const puestoMatch = matchPuesto(registro.votingPlace, puestos, threshold);
    if (puestoMatch) {
      correctedRegistro.votingPlace = puestoMatch.puesto.nombre;
      correctedRegistro.puestoId = puestoMatch.puesto._id;
      correctedRegistro.localidad = puestoMatch.puesto.localidad || correctedRegistro.localidad;
      
      if (puestoMatch.corrected) {
        corrections.push({
          field: 'votingPlace',
          original: registro.votingPlace,
          corrected: puestoMatch.puesto.nombre,
          similarity: puestoMatch.similarity
        });
      }
    }
  }
  
  // 3. Corregir departamento (si aplica)
  if (registro.departamento) {
    const deptoMatch = matchDepartamento(registro.departamento, threshold);
    if (deptoMatch && deptoMatch.corrected) {
      correctedRegistro.departamento = deptoMatch.match;
      corrections.push({
        field: 'departamento',
        original: registro.departamento,
        corrected: deptoMatch.match,
        similarity: deptoMatch.similarity
      });
    }
  }
  
  // 4. Corregir capital (si aplica)
  if (registro.capital) {
    const capitalMatch = matchCapital(registro.capital, threshold);
    if (capitalMatch && capitalMatch.corrected) {
      correctedRegistro.capital = capitalMatch.match;
      corrections.push({
        field: 'capital',
        original: registro.capital,
        corrected: capitalMatch.match,
        similarity: capitalMatch.similarity
      });
    }
  }
  
  return {
    registro: correctedRegistro,
    corrections
  };
}
