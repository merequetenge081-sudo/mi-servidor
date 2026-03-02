const s = 'C.DTAL.EL SILENCIO(ANT CEB';
try {
   const safeString = s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   console.log("Safe string:", safeString);
   const searchRegex = new RegExp(safeString, 'i');
   console.log("Regex works:", searchRegex);
} catch (e) {
   console.error("Error:", e);
}
