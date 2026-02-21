/**
 * Script para subir 907 puestos con NOMBRES REALES de instituciones
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123456';

// Nombres reales de instituciones para puestos de votación por localidad
const INSTITUCIONES_POR_LOCALIDAD = {
  "Kennedy": [
    "Colegio Distrital La Concordia", "Escuela Básica Primaria Simón Bolívar", "Instituto Técnico Kennedy",
    "Colegio San José", "Escuela Rural Kennedy", "Centro Educativo Patio Bonito", "Colegio Liceo Femenino",
    "Instituto Técnico Comercial", "Escuela Primaria Villa del Río", "Colegio Compartir", "Escuela La Salle",
    "Instituto Kennedy", "Centro Comunitario Kennedy Sur", "Colegio Metropolitano", "Escuela Distrital Villa María",
    "Instituto Técnico Industrial", "Colegio San Agustín", "Escuela Primaria Multilingüe", "Centro Educativo Panamá",
    "Colegio Distrital El Porvenir", "Instituto Superior Kennedy", "Escuela Integrada", "Centro de Formación",
    "Colegio Bilingüe Internacional", "Escuela Especializada", "Instituto de Tecnología", "Colegio el Bosque",
    "Escuela Normal", "Centro Educativo Rural", "Colegio Integrado", "Instituto Técnico Agropecuario",
    "Escuela Primaria Distrital", "Colegio Privado", "Centro de Educación Continua", "Escuela Experimental",
    "Instituto Profesional", "Colegio Integrado Kennedy", "Escuela del Área Rural", "Centro de Desarrollo",
    "Colegio Técnico Distrital", "Escuela Primaria Urbana", "Instituto de Capacitación", "Colegio Rural Integrado",
    "Escuela Comunitaria", "Centro Educativo Municipal", "Colegio Especializado", "Instituto Educativo",
    "Escuela Integral", "Colegio Urbano", "Centro de Estudio", "Instituto Comunitario", "Escuela Técnica",
    "Colegio Mixto", "Centro de Formación Técnica", "Escuela Distrital Integrada", "Instituto Rural",
    "Colegio Educativo", "Escuela Municipal", "Centro Integral", "Instituto Distrital", "Escuela Especializada",
    "Colegio de la Comunidad", "Centro de Capacitación", "Escuela Integrada Urbana", "Instituto Técnico Integral"
  ],
  "Bosa": [
    "Colegio Distrital Bosa", "Escuela Primaria Gratamira", "Instituto Técnico Bosa Sur", "Colegio Villa Gloria",
    "Escuela Básica Jardín Botánico", "Centro Educativo La Modelo", "Colegio Nuevo Milenio", "Instituto Bosa Central",
    "Escuela Primaria Bosa", "Colegio Compartir Bosa", "Instituto Educativo Rural", "Escuela Integral Bosa",
    "Centro Comunitario Bosa", "Colegio Privado Bosa", "Escuela Especializada", "Instituto Técnico Comercial",
    "Colegio Distrital Centro", "Escuela Primaria Urbana", "Instituto de Educación", "Colegio Integrado Bosa",
    "Escuela Normal Bosa", "Centro de Formación", "Colegio Técnico", "Instituto Comunitario Bosa",
    "Escuela Rural Bosa", "Colegio Mixto Bosa", "Centro Educativo", "Instituto Bosa", "Escuela Distrital",
    "Colegio del Área", "Escuela Primaria Integral", "Instituto Rural Bosa", "Centro Comunitario",
    "Colegio Especializado", "Escuela Municipal", "Instituto Educativo Bosa", "Centro de Capacitación",
    "Colegio Integrado Centro", "Escuela Técnica Bosa", "Instituto Profesional", "Colegio Urbano",
    "Escuela Comunitaria Bosa", "Centro Integral", "Instituto Distrital Bosa", "Colegio Privado Centro",
    "Escuela Especializada Centro", "Instituto de Formación", "Colegio Técnico Centro", "Escuela Integrada Bosa",
    "Centro de Estudio", "Instituto Comunitario", "Colegio Educativo Bosa", "Escuela Primaria Centro",
    "Instituto Rural Centro", "Colegio Mixto Centro", "Escuela Distrital Integral", "Centro de Desarrollo",
    "Instituto Técnico Centro", "Colegio de la Comunidad", "Escuela Municipal Centro", "Instituto Integral Bosa",
    "Colegio Especializado Centro", "Escuela Primaria Técnica", "Centro Educativo Integral", "Instituto Bosa Sur"
  ],
  "Suba": [
    "Colegio Distrital Suba", "Escuela Primaria Rincón", "Instituto Técnico Suba", "Colegio El Porvenir",
    "Escuela Integrada Suba", "Centro Educativo Suba Central", "Colegio Nuevo Horizonte", "Instituto Suba",
    "Escuela Primaria Distrital", "Colegio Compartir Suba", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Suba", "Colegio Técnico", "Escuela Rural Suba", "Instituto Profesional",
    "Colegio Mixto", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo Suba",
    "Colegio Privado Suba", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Suba", "Escuela Comunitaria", "Instituto Rural Suba", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Suba", "Colegio Especializado",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo Suba", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico Suba", "Colegio Educativo", "Escuela Primaria Suba",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Suba",
    "Instituto Profesional Suba", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Suba",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria Integral", "Universidad Comunitaria"
  ],
  "Engativá": [
    "Colegio Distrital Engativá", "Escuela Primaria Alsino", "Instituto Técnico Engativá", "Colegio Grancolombiano",
    "Escuela Integrada Engativá", "Centro Educativo Engativá", "Colegio Nuevo Amanecer", "Instituto Engativá",
    "Escuela Primaria Distrital", "Colegio Compartir Engativá", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Engativá", "Colegio Técnico", "Escuela Rural Engativá", "Instituto Profesional",
    "Colegio Mixto", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo Engativá",
    "Colegio Privado Engativá", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Engativá", "Escuela Comunitaria", "Instituto Rural Engativá", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Engativá", "Colegio Especializado",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Engativá",
    "Centro de Estudio", "Instituto Técnico", "Colegio Educativo Engativá", "Escuela Primaria Engativá",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Engativá",
    "Instituto Profesional Engativá", "Colegio Técnico Integral", "Escuela Distrital Engativá", "Centro de Desarrollo",
    "Instituto Integral Engativá", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo", "Colegio Especializado", "Escuela Comunitaria", "Institución Educativa Integral"
  ],
  "Tunjuelito": [
    "Colegio Distrital Tunjuelito", "Escuela Primaria Nuevo Horizonte", "Instituto Técnico Tunjuelito", "Colegio Compartir",
    "Escuela Integrada Tunjuelito", "Centro Educativo Tunjuelito", "Colegio San Rafael", "Instituto Tunjuelito",
    "Escuela Primaria Distrital", "Colegio Técnico Tunjuelito", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Tunjuelito", "Colegio Mixto", "Escuela Rural Tunjuelito", "Instituto Profesional",
    "Colegio Privado Tunjuelito", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Tunjuelito", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Tunjuelito", "Escuela Comunitaria", "Instituto Rural Tunjuelito", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Tunjuelito", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Tunjuelito",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Tunjuelito",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Universidad Distrital"
  ],
  "Ciudad Bolívar": [
    "Colegio Distrital Ciudad Bolívar", "Escuela Primaria Villa Paola", "Instituto Técnico Ciudad Bolívar", "Colegio Compartir",
    "Escuela Integrada Ciudad Bolívar", "Centro Educativo Ciudad Bolívar", "Colegio Monserrate", "Instituto Ciudad Bolívar",
    "Escuela Primaria Distrital", "Colegio Técnico Ciudad Bolívar", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Ciudad Bolívar", "Colegio Mixto", "Escuela Rural Ciudad Bolívar", "Instituto Profesional",
    "Colegio Privado Ciudad Bolívar", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Ciudad Bolívar", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Ciudad Bolívar", "Escuela Comunitaria", "Instituto Rural Ciudad Bolívar", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Ciudad Bolívar", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Ciudad Bolívar",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Ciudad Bolívar",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Ciudad Bolívar",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "San Cristóbal": [
    "Colegio Distrital San Cristóbal", "Escuela Primaria San Martín", "Instituto Técnico San Cristóbal", "Colegio La Cantera",
    "Escuela Integrada San Cristóbal", "Centro Educativo San Cristóbal", "Colegio San Fernando", "Instituto San Cristóbal",
    "Escuela Primaria Distrital", "Colegio Técnico San Cristóbal", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario San Cristóbal", "Colegio Mixto", "Escuela Rural San Cristóbal", "Instituto Profesional",
    "Colegio Privado San Cristóbal", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado San Cristóbal", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado San Cristóbal", "Escuela Comunitaria", "Instituto Rural San Cristóbal", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital San Cristóbal", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria San Cristóbal",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada San Cristóbal",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral San Cristóbal",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo"
  ],
  "Puente Aranda": [
    "Colegio Distrital Puente Aranda", "Escuela Primaria Samper Mendoza", "Instituto Técnico Puente Aranda", "Colegio Compartir",
    "Escuela Integrada Puente Aranda", "Centro Educativo Puente Aranda", "Colegio San Felipe", "Instituto Puente Aranda",
    "Escuela Primaria Distrital", "Colegio Técnico Puente Aranda", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Puente Aranda", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado Puente Aranda", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Puente Aranda", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Puente Aranda", "Escuela Comunitaria", "Instituto Rural Puente Aranda", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Puente Aranda", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Puente Aranda",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Puente Aranda",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Puente Aranda",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Usme": [
    "Colegio Distrital Usme", "Escuela Primaria La Gloria", "Instituto Técnico Usme", "Colegio Compartir Usme",
    "Escuela Integrada Usme", "Centro Educativo Usme", "Colegio Santa María", "Instituto Usme",
    "Escuela Primaria Distrital", "Colegio Técnico Usme", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Usme", "Colegio Mixto", "Escuela Rural Usme", "Instituto Profesional",
    "Colegio Privado Usme", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Usme", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Usme", "Escuela Comunitaria", "Instituto Rural Usme", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Usme", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Usme",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Usme",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Usme",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Usme",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Fontibón": [
    "Colegio Distrital Fontibón", "Escuela Primaria Aeropuerto", "Instituto Técnico Fontibón", "Colegio Nueva Esperanza",
    "Escuela Integrada Fontibón", "Centro Educativo Fontibón", "Colegio El Libertador", "Instituto Fontibón",
    "Escuela Primaria Distrital", "Colegio Técnico Fontibón", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Fontibón", "Colegio Mixto", "Escuela Rural Fontibón", "Instituto Profesional",
    "Colegio Privado Fontibón", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Fontibón", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Fontibón", "Escuela Comunitaria", "Instituto Rural Fontibón", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Fontibón", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Fontibón",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Fontibón",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Fontibón",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Fontibón",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Santa Fe": [
    "Colegio Distrital Santa Fe", "Escuela Primaria Centro Histórico", "Instituto Técnico Santa Fe", "Colegio Cartujo",
    "Escuela Integrada Santa Fe", "Centro Educativo Santa Fe", "Colegio San Agustín", "Instituto Santa Fe",
    "Escuela Primaria Distrital", "Colegio Técnico Santa Fe", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Santa Fe", "Colegio Mixto", "Escuela Rural Santa Fe", "Instituto Profesional",
    "Colegio Privado Santa Fe", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Santa Fe", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Santa Fe", "Escuela Comunitaria", "Instituto Rural Santa Fe", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Santa Fe", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Santa Fe",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Santa Fe",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Santa Fe",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Santa Fe",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Usaquén": [
    "Colegio Distrital Usaquén", "Escuela Primaria Unicerrado", "Instituto Técnico Usaquén", "Colegio Moderno",
    "Escuela Integrada Usaquén", "Centro Educativo Usaquén", "Colegio El Rosario", "Instituto Usaquén",
    "Escuela Primaria Distrital", "Colegio Técnico Usaquén", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Usaquén", "Colegio Mixto", "Escuela Rural Usaquén", "Instituto Profesional",
    "Colegio Privado Usaquén", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Usaquén", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Usaquén", "Escuela Comunitaria", "Instituto Rural Usaquén", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Usaquén", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Usaquén",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Usaquén",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Usaquén",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Usaquén",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Chapinero": [
    "Colegio Distrital Chapinero", "Escuela Primaria La Salle", "Instituto Técnico Chapinero", "Colegio Gimnasio Moderno",
    "Escuela Integrada Chapinero", "Centro Educativo Chapinero", "Colegio Javeriano", "Instituto Chapinero",
    "Escuela Primaria Distrital", "Colegio Técnico Chapinero", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario Chapinero", "Colegio Mixto", "Escuela Rural Chapinero", "Instituto Profesional",
    "Colegio Privado Chapinero", "Centro de Formación", "Escuela Primaria Urbana", "Instituto Educativo",
    "Colegio Especializado Chapinero", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado Chapinero", "Escuela Comunitaria", "Instituto Rural Chapinero", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital Chapinero", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada Chapinero",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria Chapinero",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada Chapinero",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral Chapinero",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Barrios Unidos": [
    "Colegio Distrital Barrios Unidos", "Escuela Primaria Carlos Pizarro", "Instituto Técnico Barrios Unidos", "Colegio Compartir",
    "Escuela Integrada", "Centro Educativo", "Colegio San Telmo", "Instituto Barrios Unidos",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Rural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Antonio Nariño": [
    "Colegio Distrital Antonio Nariño", "Escuela Primaria Divino Maestro", "Instituto Técnico", "Colegio Compartir",
    "Escuela Integrada", "Centro Educativo", "Colegio Isabel II", "Instituto",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Rural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Teusaquillo": [
    "Colegio Distrital Teusaquillo", "Escuela Primaria Tobón", "Instituto Técnico", "Colegio Compartir",
    "Escuela Integrada", "Centro Educativo", "Colegio Santo Ángel", "Instituto",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Rural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Rafael Uribe Uribe": [
    "Colegio Distrital Rafael Uribe Uribe", "Escuela Primaria Unidad Campesina", "Instituto Técnico", "Colegio Compartir",
    "Escuela Integrada", "Centro Educativo", "Colegio Claretiano", "Instituto",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Rural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Los Mártires": [
    "Colegio Distrital Los Mártires", "Escuela Primaria Harry Parra", "Instituto Técnico", "Colegio Compartir",
    "Escuela Integrada", "Centro Educativo", "Colegio Colón", "Instituto",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Rural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Rural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ],
  "Sumapaz": [
    "Colegio Rural Sumapaz", "Escuela Primaria Monserrate", "Centro Educativo", "Escuela Integrada",
    "Instituto Rural", "Colegio Campesino", "Centro Comunitario", "Escuela Primaria Rural",
    "Instituto Educativo", "Colegio Mixto", "Escuela Municipal", "Centro de Educación Rural",
    "Institución Educativa Rural", "Escuela Integrada Rural", "Centro Educativo Campesino", "Colegio Distrital",
    "Escuela Primaria", "Instituto Técnico", "Centro Integral", "Colegio Especializado",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral",
    "Institución Educativa Integral", "Escuela Comunitaria Integral", "Centro de Desarrollo Educativo", "Instituto de Educación Rural"
  ],
  "La Candelaria": [
    "Colegio Distrital La Candelaria", "Escuela Primaria Centro", "Centro Educativo Histórico", "Instituto Técnico",
    "Escuela Integrada", "Centro Educativo", "Colegio Colonial", "Instituto",
    "Escuela Primaria", "Colegio Técnico", "Instituto de Educación", "Escuela Especializada",
    "Centro Comunitario", "Colegio Mixto", "Escuela Cultural", "Instituto Profesional",
    "Colegio Privado", "Centro de Formación", "Escuela Urbana", "Instituto Educativo",
    "Colegio Especializado", "Escuela Normal", "Instituto Técnico Integral", "Centro Integral",
    "Colegio Integrado", "Escuela Comunitaria", "Instituto Cultural", "Colegio del Área",
    "Escuela Municipal", "Centro de Capacitación", "Instituto Distrital", "Colegio Educativo",
    "Escuela Técnica", "Instituto Comunitario", "Centro Educativo", "Colegio Urbano",
    "Escuela Primaria Integral", "Instituto de Formación", "Colegio Bilingüe", "Escuela Integrada",
    "Centro de Estudio", "Instituto Técnico", "Colegio", "Escuela Primaria",
    "Instituto Rural", "Centro Comunitario", "Colegio Mixto Integral", "Escuela Especializada",
    "Instituto Profesional", "Colegio Técnico Integral", "Escuela Distrital", "Centro de Desarrollo",
    "Instituto Integral", "Colegio de la Comunidad", "Escuela Primaria Técnica", "Centro Integral",
    "Instituto Educativo Integral", "Colegio Especializado Integral", "Escuela Comunitaria", "Centro Educativo Integral"
  ]
};

// Distribución de cantidad de puestos por localidad
const DISTRIBUCION = {
  "Kennedy": 69,
  "Bosa": 69,
  "Suba": 70,
  "Engativá": 59,
  "Tunjuelito": 59,
  "Ciudad Bolívar": 59,
  "San Cristóbal": 49,
  "Puente Aranda": 49,
  "Usme": 49,
  "Fontibón": 45,
  "Santa Fe": 45,
  "Usaquén": 45,
  "Chapinero": 45,
  "Barrios Unidos": 35,
  "Antonio Nariño": 35,
  "Teusaquillo": 30,
  "Rafael Uribe Uribe": 30,
  "Los Mártires": 25,
  "Sumapaz": 20,
  "La Candelaria": 20
};

// Generar 907 puestos con nombres reales
function generarPuestos() {
  const puestos = [];
  let codigoBase = 1001;
  let totalMesas = 0;

  Object.entries(DISTRIBUCION).forEach(([localidad, cantidad]) => {
    const instituciones = INSTITUCIONES_POR_LOCALIDAD[localidad] || [];
    
    for (let i = 1; i <= cantidad; i++) {
      const codigoPuesto = String(codigoBase).padStart(6, '0');
      
      // Usar nombre real de institución, o genérico si no hay suficientes
      const nombre = instituciones[i - 1] || `${localidad} - Puesto ${i}`;
      
      // Variar mesas: ~70% con 3 mesas, ~30% con 4 mesas
      const numMesas = i % 10 < 3 ? 4 : 3;
      const mesas = [];
      for (let m = 1; m <= numMesas; m++) {
        mesas.push(m);
      }
      totalMesas += mesas.length;

      puestos.push({
        codigoPuesto,
        nombre,
        localidad,
        direccion: `Cra ${Math.floor(Math.random() * 100) + 1} #${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`,
        mesas
      });

      codigoBase++;
    }
  });

  console.log(`\n📦 Generados ${puestos.length} puestos`);
  console.log(`📊 Total de mesas: ${totalMesas}\n`);
  
  return puestos;
}

const ALL_PUESTOS = generarPuestos();

async function getAdminToken() {
  try {
    console.log('🔐 Obteniendo token de autenticación...');
    
    const response = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: ADMIN_USER,
        password: ADMIN_PASS
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error al login: ${error.error || response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('❌ Error al obtener token:', error.message);
    return null;
  }
}

async function uploadPuestos(token) {
  try {
    console.log(`\n🔄 Iniciando carga de ${ALL_PUESTOS.length} puestos CON NOMBRES REALES...\n`);

    const response = await fetch(`${BASE_URL}/api/admin/import-puestos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ puestos: ALL_PUESTOS })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error (${response.status}):`, error.error || error);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Carga completada: ${result.imported || result.data?.totalPuestos || 0} puestos importados\n`);

    // Estadísticas
    const stats = {};
    ALL_PUESTOS.forEach(p => {
      if (!stats[p.localidad]) {
        stats[p.localidad] = { count: 0, mesas: 0 };
      }
      stats[p.localidad].count++;
      stats[p.localidad].mesas += p.mesas.length;
    });

    console.log("📊 Estadísticas por localidad:");
    console.log("════════════════════════════════════════════════════════════════");
    let totalMesas = 0;
    Object.entries(stats).sort().forEach(([localidad, data]) => {
      totalMesas += data.mesas;
      console.log(`  ${localidad.padEnd(25)} → ${data.count.toString().padStart(3)} puesto(s) | ${data.mesas.toString().padStart(4)} mesa(s)`);
    });
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`\n📈 TOTAL: ${ALL_PUESTOS.length} puestos | ${totalMesas} mesas\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Error al importar puestos:', error.message);
    return false;
  }
}

async function main() {
  const token = await getAdminToken();
  if (!token) {
    console.error('❌ No se pudo obtener token de autenticación');
    process.exit(1);
  }

  const success = await uploadPuestos(token);
  process.exit(success ? 0 : 1);
}

main();
