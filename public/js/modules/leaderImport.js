const getRowValue = (row, keys) => {
  if (!row) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
};

const mapImportRow = (row) => ({
  firstName: getRowValue(row, ['Nombre']),
  lastName: getRowValue(row, ['Apellido']),
  cedula: getRowValue(row, ['Cédula', 'Cedula']),
  email: getRowValue(row, ['Email']),
  phone: getRowValue(row, ['Celular', 'Telefono']),
  votingTable: getRowValue(row, ['Mesa']),
  localidad: getRowValue(row, ['Localidad']),
  votingPlace: getRowValue(row, ['Puesto Votación', 'Puesto Votacion'])
});

const mapImportRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapImportRow);
};

if (typeof window !== 'undefined') {
  window.leaderImport = { mapImportRow, mapImportRows };
}

export { mapImportRow, mapImportRows };
