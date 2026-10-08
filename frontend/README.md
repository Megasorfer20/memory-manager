# Frontend React

La interfaz visual del proyecto muestra el estado real del simulador en una vista tipo dashboard de administración de memoria.

## Objetivos del diseño

- visualizar la RAM como un mapa de celdas
- mostrar uso total, libre y porcentajes
- permitir filtrar procesos por ubicación y contenido
- presentar detalle del proceso seleccionado
- manejar la operación de compactar, mover a SWAP y recuperar procesos
- administrar una simulación mediante formulario, confirmaciones y notificaciones integradas
- ofrecer la demo de exposición con el escenario P1=20, P2=30, P3=10

## Funcionalidades actuales

- métricas de RAM usada/libre, fragmentación externa y procesos en RAM/SWAP
- mapa de memoria identificado por PID y con offset/frame en cada unidad
- búsqueda por PID o nombre
- filtros por RAM/SWAP/todos
- tabla de procesos con offsets, páginas y acciones contextuales
- lista de procesos en SWAP
- inspector de tablas de páginas
- registro de actividad del sistema
- demo automática con reset limpio de sesión
- diseño oscuro y responsive

## Requisitos

- Node.js 18 o superior (validado con 22.13.1)
- npm 9 o superior (validado con 11.5.2)
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

Para apuntar a otra URL de API, configura `VITE_API_URL` antes de ejecutar Vite. El valor predeterminado es `http://localhost:3001`.

## Construir versión de producción

```bash
npm run build
```

Esto genera la carpeta `dist/`, lista para despliegue estático o presentación.

## Conexión con la API

La aplicación consume la API REST del backend mediante `fetch`, comprueba el envelope `{ success, data, error }` y muestra los errores en notificaciones. Crear procesos usa un formulario controlado y las acciones destructivas usan confirmación visual; no se usan diálogos nativos del navegador.

## Recomendación de uso

Antes de arrancar el frontend, asegúrate de tener corrido el backend. La URL predeterminada es:

- http://localhost:3001

## Solución de problemas comunes

- Si la UI no carga datos, revisa que el backend esté arriba y accesible.
- Si el puerto 5173 está ocupado, Vite puede cambiarlo automáticamente o puedes forzar otro puerto configurando el servidor.
- Si aparece un error de CORS, revisa que el backend tenga `cors` configurado correctamente.
