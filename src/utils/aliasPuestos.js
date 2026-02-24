/**
 * Alias/Sitios de puestos de votación de Bogotá 2019
 * Datos de la Registraduría Nacional del Estado Civil
 * 
 * Formato: Alias/Sitio - Nombre Completo
 */

export const aliasPuestos = {
  // Fontibón (ejemplo para comenzar - agregar más según se vaya extrayendo)
  "Veracruz": "Colegio Distrital República de Costa Rica - Sede C",
  "Modelia Sur": "Vía Pública Salón Múltiple Comunitario",
  "Santa Cecilia - Modelia": "Colegio Distrital Santa Cecilia",
  "Atahualpa": "Colegio Distrital Atahualpa",
  "Batavia": "Concentración Escolar Batavia",
  "Moravia": "Liceo Juvenil Moravia",
  "Villemar El Carmen": "Colegio Distrital Villemar El Carmen",
  "Hayuelos": "Centro Comercial Hayuelos",
  "La Felicidad": "Colegio Distrital La Felicidad",
  "Fontibón Reservado": "Salón Social Conjunto Residencial Fontibón Reservado",
  
  // Usaquén
  "Los Cedritos": "Carulla  - Los Cedrit os",
  "Cedro Golf": "Cedro Golf Club",
  "Buenavista": "Buenavista Usaquén",
  "Canaima": "Canaima",
  "Alessandro Volta": "Colegio Alessandro Volta",
  "La Carolina": "Colegio La Carolina",
  "Cristobal Colon": "Colegio Cristobal Colon",
  "Divino Maestro": "Colegio Divino Maestro",
  "Las Margaritas": "Colegio Las Margaritas",
  "Alta Blanca": "Colegio Alta Blanca",
  "Toberin": "Colegio Toberin",
  "El Pite": "El Pite",
  "El Codito": "El Codito",
  "Verbenal Santa María": "Verbenal Santa María",
  "Saludcoop Norte": "Saludcoop Norte",
  "Torca": "Torca",
  "Carulla 140": "Carulla Calle 140",
  "Calle 186": "Puesto Calle 186",
  "Plazoleta Santa Barbara": "Plazoleta Santa Barbara",
  "Universidad Militar": "Universidad Militar Nueva Granada",
  "La Estrellita": "La Estrellita",
  "Corazón": "Puesto Corazón",
  "Siervas San Jose La Calleja": "Siervas San Jose - La Calleja",
  "Colegio Provinma": "Colegio Provinma",
  "Colegio Sans Facon": "Colegio Sans Facon",
  "Anglo Americano": "Colegio Anglo Americano",
  
  // Kennedy
  "Kennedy Américas": "Centro Comercial Américas",
  "Tintal Plaza": "Centro Comercial Tintal Plaza",
  "Popular Modelo": "Barrio Popular Modelo",
  
  // Suba
  "Niza": "Centro Niza",
  "Bulevar Niza": "Parqueadero Centro Comercial Bulevar Niza",
  "La Gaitana": "Colegio Distrital La Gaitana",
  
  // Engativá
  "Portal 80": "Centro Comercial Portal 80",
  "Los Cerezos": "Colegio Distrital Los Cerezos",
  "Nueva Constitución": "Colegio Distrital Nueva Constitución",
  "Garces Navas": "Colegio Distrital Garces Navas",
  "Florida Blanca": "Colegio Distrital Florida Blanca",
  
  // Barrios Unidos
  "San Felipe Neri": "Colegio San Felipe Neri",
  
  // Mártires
  "Eduardo Santos": "Centro Educativo Distrital Eduardo Santos",
  
  // Antonio Nariño
  "Jaime Pardo Leal": "Colegio Distrital Jaime Pardo Leal",
  
  // Rafael Uribe Uribe
  "Diana T Sector Ayacucho": "Salón Comunal Diana T Sector Ayacucho",
  "Alfredo Iriarte": "Colegio Distrital Alfredo Iriarte",
  "IDIPRON UPI Molinos": "IDIPRON UPI Molinos (Unidad de Prevención Infantil)",
  
  // San Cristóbal
  "El Quindio": "Puesto El Quindio",
  "Republica Del Canada": "Colegio República Del Canada",
  "La Gloria": "Puesto La Gloria",
  "Juan Rey": "Colegio Juan Rey",
  "Villa de los Alpes": "Barrio Villa de los Alpes",
  "Los Libertadores": "Puesto Los Libertadores",
  "San Pedro Sur Oriental": "San Pedro Sur Oriental",
  "Primera De Mayo": "Barrio Primera De Mayo",
  "Bello Horizonte": "Barrio Bello Horizonte",
  
  // Ciudad Bolívar
  "Rogelio Salmona": "Colegio Distrital Rogelio Salmona",
  
  // Sumapaz
  "Nueva Granada": "Salón Comunal Nueva Granada",
  
  // Teusaquillo
  "Quinta Paredes": "Quinta Paredes",
  
  // Puente Aranda
  "Colegio Adventista": "Colegio Adventista"
};

// Función para encontrar alias por nombre completo (fuzzy)
export function encontrarAlias(nombreCompleto) {
  if (!nombreCompleto) return null;
  
  const normalizeName = (str) => str.toLowerCase().trim();
  const nombreNorm = normalizeName(nombreCompleto);
  
  for (const [alias, nombreFull] of Object.entries(aliasPuestos)) {
    if (normalizeName(nombreFull) === nombreNorm || nombreNorm.includes(normalizeName(alias))) {
      return alias;
    }
  }
  
  return null;
}

// Función para obtener nombre completo por alias
export function obtenerNombreCompleto(alias) {
  return aliasPuestos[alias] || null;
}

// Exportar todo
export default {
  aliasPuestos,
  encontrarAlias,
  obtenerNombreCompleto
};
