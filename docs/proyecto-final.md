# Proyecto final: Gestor de memoria

## Resumen

Este proyecto consolida una simulación didáctica de gestión de memoria en tres capas:

1. lógica de negocio central en Node.js
2. API REST con Express
3. interfaz React para visualización y control

La intención del proyecto es enseñar cómo opera la gestión de memoria en un sistema operativo de forma simplificada, pero con flujo realista y verificable.

## Objetivos alcanzados

- asignación de memoria por procesos
- eliminación de procesos
- fragmentación y compactación
- paginación y mapping de frames
- manejo de SWAP
- lista de procesos y navegación visual
- pruebas de validación para la lógica y la API
- documentación para ejecución y explicación del sistema

## Arquitectura

### Capa de dominio

El núcleo está en `src/MemoryManager.js` y encapsula el estado de la RAM, los procesos activos y la cola de SWAP.

Incluye:

- creación de procesos
- ubicación en memoria
- búsqueda de huecos libres
- compactación
- envío a SWAP
- recuperación desde SWAP
- listado de procesos activos y suspendidos

### Capa HTTP

La API REST en `backend/src/app.js` ofrece acceso a la lógica mediante endpoints JSON.

### Capa visual

La interfaz React en `frontend/src/App.jsx` visualiza el estado completo y permite interactuar con él de manera más natural.

## Flujo típico de uso

1. crear un proceso nuevo
2. observar la distribución en memoria
3. crear varios procesos para generar fragmentación
4. compactar la RAM
5. mover procesos a SWAP
6. recuperar procesos
7. revisar páginas y ubicación final

## Requisitos de ejecución

```bash
cd memory-manager
npm install
npm start
```

Para la API:

```bash
cd backend
npm install
npm start
```

Para el frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Validación

Se ejecutan pruebas de:

- creación de procesos
- fragmentación
- compactación
- SWAP
- recuperación
- endpoints HTTP

```bash
npm test
```

## Conclusión

El proyecto quedó en una versión funcional, didáctica y visualmente clara, adecuada para exposición académica y para continuar con extensiones futuras.
