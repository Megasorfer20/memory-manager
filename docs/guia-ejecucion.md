# Guía de ejecución del proyecto

## Objetivo

Esta guía explica exactamente cómo ejecutar el proyecto completo para que otra persona pueda levantar la lógica del simulador, la API REST y la interfaz React sin dificultad.

## Requisitos del sistema

- Sistema operativo: Windows, Linux o macOS
- Node.js 18 o superior
- npm 9 o superior
- navegador moderno
- acceso a localhost para conexiones locales

## Verificación de requisitos

Ejecuta estos comandos en la terminal:

```bash
node -v
npm -v
```

Si ambos comandos dan una versión, el entorno está listo.

## 1. Clonar o abrir el proyecto

Ubícate en la carpeta del proyecto:

```bash
cd memory-manager
```

## 2. Instalar dependencias de la raíz

```bash
npm install
```

Esto instala las dependencias del núcleo del simulador.

## 3. Ejecutar la CLI (opcional)

```bash
npm start
```

La consola ofrece un menú interactivo para probar la lógica del gestor de memoria.

## 4. Ejecutar la API REST

Desde la carpeta `backend`:

```bash
cd backend
npm install
npm start
```

La API queda levantada en:

```text
http://localhost:3001
```

### Endpoints principales

- GET /health
- GET /memory
- GET /processes
- GET /swap
- POST /processes
- DELETE /processes/:pid
- POST /memory/compact
- POST /processes/:pid/swap
- POST /processes/:pid/swap/restore

## 5. Ejecutar la interfaz React

Desde la carpeta `frontend`:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

La interfaz queda disponible en:

```text
http://localhost:5173
```

## 6. Flujo recomendado de demostración

1. iniciar la API REST
2. iniciar el frontend
3. abrir la URL del frontend en el navegador
4. crear varios procesos con tamaños diferentes
5. observar la RAM y la fragmentación
6. compactar la memoria
7. mover algunos procesos a SWAP
8. recuperar procesos desde SWAP
9. revisar las páginas y el detalle del proceso seleccionado

## 7. Validar con pruebas automatizadas

Desde la raíz del proyecto:

```bash
npm test
```

Esto ejecuta pruebas de:

- creación de procesos
- fragmentación
- compactación
- SWAP
- recuperación
- API HTTP

## 8. Construir una versión de producción

Desde la carpeta frontend:

```bash
npm run build
```

Se genera la carpeta `dist` con una compilación lista para despliegue.

## 9. Solución rápida de problemas

### Error: puerto ya en uso

- backend: el puerto 3001 puede estar ocupado; exporta una variable:

```bash
PORT=3002 npm start
```

- frontend: Vite puede cambiar de puerto o usar el disponible automáticamente

### La UI no recibe datos

Verifica que el backend realmente esté corriendo y que la URL apuntada en el frontend sea:

```text
http://localhost:3001
```

### La aplicación no instala dependencias

Asegúrate de ejecutar `npm install` en cada carpeta relevante:

- raíz del proyecto
- backend
- frontend

## Recomendación final

Para la presentación académica, es mejor ejecutar primero el backend y luego el frontend para que el dashboard pueda consumir correctamente los datos del sistema.
