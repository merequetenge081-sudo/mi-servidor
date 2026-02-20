# 📁 ESTRUCTURA RECOMENDADA PARA PROYECTOS LOCALES

## Problema Actual
- Tu proyecto está en: `C:\Users\Janus\Downloads\`
- Difícil mantener con otros proyectos
- Downloads puede limpiar archivos automáticamente

---

## ✅ Solución Recomendada

### Crea esta estructura de carpetas:

```
C:\Users\Janus\
├── Projects/                           (NUEVA CARPETA MADRE)
│   ├── mi-servidor/                    (Este proyecto)
│   │   ├── .env
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── src/
│   │   └── public/
│   ├── proyecto-2/                     (Otro proyecto)
│   │   └── ...
│   ├── proyecto-3/                     (Otro proyecto)
│   │   └── ...
│   └── README.md                       (Índice de todos los proyectos)
```

---

## 📋 PASOS PARA MOVER TU PROYECTO

### Windows PowerShell (RECOMENDADO):

```powershell
# 1. Crear carpeta Projects
mkdir C:\Users\Janus\Projects

# 2. Copiar tu proyecto
Copy-Item `
  "C:\Users\Janus\Downloads\mi-servidor-2e8fa8609786ef72bc55a26d1ea29e7272a63a7f\mi-servidor-2e8fa8609786ef72bc55a26d1ea29e7272a63a7f" `
  -Destination "C:\Users\Janus\Projects\mi-servidor" `
  -Recurse

# 3. Verificar la copia
ls C:\Users\Janus\Projects\mi-servidor -Recurse | Measure-Object

# 4. (OPCIONAL) Eliminar la copia de Downloads después
# rm -r "C:\Users\Janus\Downloads\mi-servidor-2e8fa8609786ef72bc55a26d1ea29e7272a63a7f"
```

---

## 🎯 VENTAJAS DE ESTA ESTRUCTURA

| Aspecto | Beneficio |
|--------|----------|
| **Organización** | Todos tus proyectos en un lugar |
| **Sin conflictos** | Cada proyecto tiene su propia carpeta |
| **Puertos únicos** | `.env` de cada proyecto con puerto diferente |
| **Fácil de mantener** | Encuentra todo rápidamente |
| **Seguro** | No se borran en limpiezas de caché |
| **Git-friendly** | Mejor para control de versiones |

---

## 🔧 CONFIGURAR PUERTOS POR PROYECTO

### Una vez movido, en `C:\Users\Janus\Projects\mi-servidor\.env`:

```dotenv
# mi-servidor → Puerto 3000
PORT=3000
```

### Para otros proyectos (si los tienes):

```
Proyecto 1 (.env): PORT=3000
Proyecto 2 (.env): PORT=3001
Proyecto 3 (.env): PORT=3002
Proyecto 4 (.env): PORT=3003
```

---

## 🚀 PRÓXIMOS PASOS

### Una vez movido:

```powershell
# 1. Navegar a la carpeta
cd C:\Users\Janus\Projects\mi-servidor

# 2. Instalar dependencias
npm install

# 3. Ejecutar
npm start

# 4. En VS Code:
#    - File > Open Folder
#    - Selecciona: C:\Users\Janus\Projects\mi-servidor
#    - En la terminal integrada de VS Code:
code .
```

---

## 📌 RESUMEN

```powershell
# Copiar proyecto a carpeta segura
mkdir C:\Users\Janus\Projects
Copy-Item "C:\Users\Janus\Downloads\mi-servidor-2e8fa8609786ef72bc55a26d1ea29e7272a63a7f\mi-servidor-2e8fa8609786ef72bc55a26d1ea29e7272a63a7f" -Destination "C:\Users\Janus\Projects\mi-servidor" -Recurse

# Instalar dependencias
cd C:\Users\Janus\Projects\mi-servidor
npm install

# Ejecutar
npm start
```

✅ **Sin conflictos, todo organizado**
