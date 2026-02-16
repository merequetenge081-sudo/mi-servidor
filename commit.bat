@echo off
cd /d "c:\Users\Janus\Desktop\mi-servidor"
git add app.html
git commit -m "Fix: Corregir textos encoding y logout redirige a login

- Reparar caracteres en tabla de registros (Cédula, ¿Votante?, Votación, N° Mesa, Acción)
- Redirigir logout a página de login /public/login.html
- Agregar botón de logout en sidebar del panel admin"
git push
echo.
echo Commit complete!
pause
