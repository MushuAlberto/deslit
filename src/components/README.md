
# 🚀 Guía de Despliegue: Litio Dashboard SQM

Este proyecto está diseñado para funcionar como una aplicación web moderna (PWA) que se puede instalar en Windows, Mac o Linux directamente desde el navegador.

## 📦 Despliegue en Vercel (Paso a Paso)

1. **Subir a GitHub**: 
   - Sube todos los archivos de este directorio a un repositorio de GitHub.
   - Asegúrate de incluir `index.html`, `index.tsx`, `vercel.json`, `manifest.json` y `sw.js`.

2. **Conectar a Vercel**:
   - Entra en [Vercel](https://vercel.com).
   - Haz clic en **Import Project** y selecciona tu repositorio.

3. **Configuración de la Operación**:
   - Este sistema ejecuta la totalidad del procesamiento, resúmenes operativos y visualización de gráficos de forma de forma 100% local y segura directamente en el cliente. No se requieren claves API externas para su funcionamiento normal.

4. **Configuración de Build**:
   - Como usamos **ES6 Modules e Import Maps**, no necesitas comandos de compilación. Vercel servirá los archivos estáticos directamente.

## 🖥️ Cómo instalar como App de PC

Una vez desplegado en tu URL de Vercel (ej. `https://mi-proyecto.vercel.app`):

1. **Abre la URL** en Chrome o Edge.
2. **Instala la App**:
   - En la barra de direcciones verás un icono de una pantalla con un "+" o una flecha.
   - Haz clic en **"Instalar Litio Dashboard"**.
3. **Uso Nativo**:
   - La aplicación aparecerá en tu Inicio de Windows o Aplicaciones de Mac.
   - Se abrirá en una ventana propia sin barras de navegador, permitiendo subir archivos Excel locales y generar reportes PDF.

## 🛠️ Archivos Clave para el Hosting
- `vercel.json`: Gestiona las rutas y asegura que el Service Worker (`sw.js`) tenga los permisos correctos.
- `manifest.json`: Define el icono y el comportamiento de la "ventana" de la aplicación.
- `sw.js`: Permite que la app cargue más rápido y tenga soporte básico offline.
