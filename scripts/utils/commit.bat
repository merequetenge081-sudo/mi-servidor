@echo off
cd /d "c:\Users\Janus\Desktop\mi-servidor"
git add .
git commit -m "Cleanup: Eliminar archivos legacy (app.html y scripts obsoletos)

- Remover app.html y backups (código monolítico obsoleto)
- Remover scripts Python de limpieza (ya no necesarios)
- Arquitectura modular ya implementada en public/
- Sistema funcionando correctamente con dashboard.html, leader.html, form.html"
git push
echo.
echo Commit complete!
pause
