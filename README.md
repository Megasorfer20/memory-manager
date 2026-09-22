# Gestor de memoria - proyecto final

Este proyecto implementa un simulador didáctico de administración de memoria en Node.js, con lógica central, API REST y una interfaz React para visualizar el comportamiento real de los procesos en RAM y SWAP.

## Objetivo pedagógico

El sistema permite estudiar en una consola y en una interfaz visual conceptos como:

- asignación de memoria
- fragmentación interna y externa
- compactación
- páginas y frames
- intercambio de procesos hacia SWAP
- recuperación de procesos desde SWAP
- estados de procesos y ubicaciones en memoria

## Arquitectura del proyecto

```text
memory-manager/
├── README.md
├── package.json
├── src/
│   ├── MemoryManager.js
│   ├── cli.js
│   └── index.js
├── tests/
│   ├── memory-manager.test.js
│   └── api.test.js
├── backend/
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── app.js
│       └── server.js
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
├── docs/
│   ├── roadmap.md
│   ├── proyecto-final.md
│   └── guia-ejecucion.md
└── .gitignore
```

## Stack utilizado

- Node.js 18+
- Express para la API REST
- React + Vite para la interfaz
- Node.js test runner para validación de lógica y endpoints

## Requisitos del sistema

### Requisitos mínimos

- Windows 10/11, Linux o macOS
- Node.js 18 o superior
- npm 9 o superior
- navegador moderno (Chrome, Edge, Firefox)
- conexión local entre frontend y backend

### Verificación rápida

```bash
node -v
npm -v
```

Si ambas versiones aparecen, el entorno está listo para usar.

## Instalación general

Desde la raíz del proyecto:

```bash
cd memory-manager
npm install
```

## Ejecutar la versión CLI

```bash
npm start
```

La CLI expone un menú con estas opciones:

1. mostrar memoria
2. crear proceso
3. terminar proceso
4. compactar memoria
5. mostrar páginas
6. enviar a SWAP
7. recuperar desde SWAP
8. salir

## Ejecutar la API REST

Desde la carpeta backend:

```bash
cd backend
npm install
npm start
```

La API queda disponible en:

- http://localhost:3001/health
- http://localhost:3001/memory
- http://localhost:3001/processes
- http://localhost:3001/swap

## Ejecutar la interfaz React

Desde la carpeta frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

La interfaz quedará disponible normalmente en:

- http://localhost:5173

Si quieres abrirlo directamente en el navegador, usa esa URL después de arrancar Vite.

## Flujo recomendado para demostración

1. ejecutar la API REST
2. arrancar el frontend
3. crear procesos de distinto tamaño
4. observar la fragmentación
5. compactar la memoria
6. mover procesos a SWAP
7. recuperar desde SWAP
8. revisar páginas y uso del sistema en el dashboard

## Pruebas disponibles

Se incluye una suite que valida tanto la lógica central como la API HTTP.

```bash
npm test
```

## Documentación complementaria

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [docs/roadmap.md](docs/roadmap.md)
- [docs/proyecto-final.md](docs/proyecto-final.md)
- [docs/guia-ejecucion.md](docs/guia-ejecucion.md)

## Nota final

Este proyecto es didáctico y no reemplaza un administrador real de memoria del sistema operativo; busca enseñar el comportamiento bajo un modelo simplificado, claro y verificable.
