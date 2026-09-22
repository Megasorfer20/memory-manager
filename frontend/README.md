# Frontend React

La interfaz visual del proyecto muestra el estado real del simulador en una vista tipo dashboard de administración de memoria.

## Objetivos del diseño

- visualizar la RAM como un mapa de celdas
- mostrar uso total, libre y porcentajes
- permitir filtrar procesos por ubicación y contenido
- presentar detalle del proceso seleccionado
- manejar la operación de compactar, mover a SWAP y recuperar procesos
- ofrecer una demo visual para exposición académica

## Funcionalidades actuales

- resumen estadístico superior
- búsqueda por PID o nombre
- filtros por RAM/SWAP/todos
- detalle del proceso activo
- tabla de procesos con acciones rápidas
- lista de procesos en SWAP
- vista de páginas del proceso seleccionado
- panel de métricas de uso y actividad
- demo rápida con creación y movimiento de procesos
- estilo final con paneles, cards y estados claros

## Requisitos

- Node.js 18 o superior
- npm
- backend ejecutándose en http://localhost:3001
- navegador moderno

## Instalación

```bash
cd frontend
npm install
```

## Ejecutar en modo desarrollo

```bash
npm run dev
```

La aplicación quedará disponible en:

- http://localhost:5173

## Construir versión de producción

```bash
npm run build
```

Esto genera la carpeta `dist/`, lista para despliegue estático o presentación.

## Conexión con la API

La aplicación consume la API REST del backend mediante `fetch`, con validación de errores y refresco del estado en cada operación.

## Recomendación de uso

Antes de arrancar el frontend, asegúrate de tener corrido el backend. La URL del backend está fijada por defecto en:

- http://localhost:3001

Si cambias el puerto del backend, también debes ajustar `API_URL` en [frontend/src/App.jsx](frontend/src/App.jsx).

## Solución de problemas comunes

- Si la UI no carga datos, revisa que el backend esté arriba y accesible.
- Si el puerto 5173 está ocupado, Vite puede cambiarlo automáticamente o puedes forzar otro puerto configurando el servidor.
- Si aparece un error de CORS, revisa que el backend tenga `cors` configurado correctamente.
