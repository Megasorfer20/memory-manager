# Backend REST

La capa de backend expone la lógica del simulador de memoria a través de una API HTTP con Express.

## Objetivo

Permitir que la interfaz React y otros clientes consuman el estado del sistema en formato JSON, sin depender de la consola ni del núcleo de ejecución del simulador.

## Requisitos

- Node.js 18 o superior
- npm
- acceso local a localhost:3001

## Instalación

```bash
cd backend
npm install
```

## Ejecutar el servidor

```bash
npm start
```

El backend queda escuchando en:

- http://localhost:3001

## Endpoints principales

```text
GET /health
GET /memory
GET /processes
GET /swap
GET /processes/:pid
GET /processes/:pid/pages
POST /processes
DELETE /processes/:pid
POST /memory/compact
POST /processes/:pid/swap
POST /processes/:pid/swap/restore
POST /reset
```

## Patrón de respuesta

Todas las rutas devuelven una respuesta consistente:

```json
{
  "success": true,
  "data": {
    "pid": 1,
    "name": "P1",
    "size": 8,
    "location": "RAM"
  },
  "error": null
}
```

En caso de error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERR_MEMORY_FRAGMENTED",
    "message": "Memoria insuficiente contigua. Se requiere compactación."
  }
}
```

Los errores de validación responden HTTP 400, los procesos inexistentes HTTP 404, conflictos de estado o fragmentación HTTP 409, la memoria insuficiente HTTP 422 y los errores inesperados HTTP 500. Las rutas usan un manejador global que registra los errores internos y mantiene el servidor disponible.

## Flujo de ejemplo

1. `POST /processes` con `{ "name": "P1", "size": 10 }`
2. `GET /memory` para validar la ocupación
3. `POST /processes/1/swap` para moverlo a SWAP
4. `POST /processes/1/swap/restore` para recuperarlo
5. `POST /memory/compact` para reorganizar la RAM
6. `POST /reset` para limpiar la sesión de simulación

## Validación

La API se comprueba con pruebas HTTP usando el `node:test` y peticiones reales sobre la app Express.

## Solución de problemas comunes

- Si el puerto 3001 está ocupado, cambia la variable de entorno `PORT`:

```bash
PORT=3002 npm start
```

- Si la API no responde, verifica que el proceso realmente se haya levantado y que Node.js esté instalado.

## Recomendación para la demo

Se recomienda arrancar primero el backend y luego el frontend para evitar errores de conexión desde la interfaz.
