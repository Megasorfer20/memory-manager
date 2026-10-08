# Gestor de memoria

Simulador académico de administración de RAM, procesos, paginación y SWAP. La RAM es una estructura JavaScript en memoria; no se manipula la memoria física del equipo. El valor predeterminado es de 100 unidades y cada página representa 4 unidades.

## Arquitectura

```text
┌──────────────────┐       HTTP/JSON        ┌────────────────────┐
│ React + Vite UI  │ ──────────────────────▶│ Express REST API   │
│ :5173            │                         │ :3001              │
└──────────────────┘                         └─────────┬──────────┘
                                                       │
┌──────────────────┐       usa directamente           │
│ CLI interactiva  │ ──────────────────────┐          │
└──────────────────┘                        ▼          ▼
                                  ┌──────────────────────────┐
                                  │ MemoryManager (Core)     │
                                  │ RAM · procesos · páginas │
                                  │ compactación · SWAP      │
                                  └──────────────────────────┘
```

El Core aplica asignación contigua First-Fit, comprueba capacidad antes de modificar el estado, conserva las tablas de páginas y actualiza direcciones al compactar. La API y la CLI comparten el mismo motor. La API usa un envelope uniforme `{ success, data, error }`; la UI consume ese contrato y administra la sesión del servidor. El estado de simulación vive en memoria y se pierde cuando el backend se reinicia.

## Requisitos

- Node.js **22.13.1** y npm **11.5.2** son las versiones usadas para validar este proyecto.
- El código es compatible con Node.js 18 o posterior y npm 9 o posterior.
- Navegador moderno (Chrome, Edge o Firefox).
- No se necesita instalar herramientas globales. El frontend usa React 18 y Vite 5; el backend usa Express 4.

Comprueba las versiones instaladas:

```powershell
node --version
npm --version
```

## Instalación

Desde la raíz del repositorio, instala las dependencias en cada aplicación:

```powershell
cd memory-manager\backend
npm install
cd ..\frontend
npm install
```

La CLI y las pruebas no tienen dependencias adicionales. Para fijar también las dependencias raíz:

```powershell
cd ..\
npm install
```

## Ejecutar la CLI

Desde `memory-manager/`:

```bash
npm run cli
```

`npm start` es un alias de la CLI. El menú presenta ocho operaciones: mostrar RAM, crear, terminar, compactar, mostrar páginas, enviar a SWAP, recuperar y salir. Los errores de validación o capacidad se imprimen y permiten volver al menú. `Ctrl+C`/fin de entrada también cierra el lector de forma controlada.

## Ejecutar API y GUI

Abre dos terminales desde la raíz del repositorio.

**Terminal 1 — backend:**

```powershell
cd memory-manager\backend
npm start
```

La API estará en `http://localhost:3001`. Comprueba el servicio en `http://localhost:3001/health`.

**Terminal 2 — frontend:**

```powershell
cd memory-manager\frontend
npm run dev
```

Abre `http://localhost:5173`. El frontend consulta por defecto `http://localhost:3001`; puedes cambiarlo configurando `VITE_API_URL` antes de iniciar Vite. El botón **Reiniciar** borra los procesos de RAM y SWAP de la sesión activa.

### Endpoints

| Método | Ruta | Operación |
|---|---|---|
| `GET` | `/health` | Estado de la API |
| `GET` | `/memory` | Métricas y mapa de RAM |
| `GET` | `/processes` | Procesos en RAM y SWAP |
| `GET` | `/processes/:pid` | Detalle de un proceso |
| `POST` | `/processes` | Crear proceso (`{ "name": "P1", "size": 20 }`) |
| `DELETE` | `/processes/:pid` | Terminar proceso |
| `GET` | `/processes/:pid/pages` | Tabla de páginas |
| `POST` | `/memory/compact` | Compactar hacia la izquierda |
| `POST` | `/processes/:pid/swap` | Suspender y enviar a SWAP |
| `POST` | `/processes/:pid/swap/restore` | Recuperar desde SWAP |
| `GET` | `/swap` | Procesos suspendidos |
| `POST` | `/reset` | Reiniciar la simulación |

Respuesta exitosa:

```json
{
  "success": true,
  "data": { "status": "ok", "memory": 100 },
  "error": null
}
```

Respuesta de error:

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

Los errores de entrada usan HTTP 400, procesos inexistentes 404, conflictos de estado o fragmentación 409, falta de capacidad 422 e incidentes no controlados 500.

## Guion de exposición y demostración

La exposición de aproximadamente cuatro minutos sigue la secuencia de siete diapositivas descrita en [`../EXPOSICION_GESTOR_MEMORIA.md`](../EXPOSICION_GESTOR_MEMORIA.md). Una distribución breve:

1. **0:00–0:45 — Objetivo:** presentar el simulador y aclarar que RAM/SWAP son modelos didácticos.
2. **0:45–1:30 — RAM y procesos:** explicar unidades, First-Fit, PID y liberación al terminar.
3. **1:30–2:15 — Fragmentación y páginas:** mostrar bloques no contiguos y la relación página/frame.
4. **2:15–3:00 — Compactación y SWAP:** explicar la reubicación a la izquierda y la suspensión.
5. **3:00–4:00 — Demo y cierre:** ejecutar la demo automática, narrar el cambio de estado y resumir el aprendizaje.

El botón **Ejecutar demo de exposición · 4 min** reinicia la simulación y completa, en una sola acción, el escenario acordado:

1. Crear P1=20, P2=30 y P3=10.
2. Terminar P2 para mostrar dos huecos libres separados.
3. Compactar y comprobar los nuevos offsets.
4. Enviar P1 a SWAP y restaurarlo a RAM.

El registro del sistema y el mapa visual acompañan cada paso. La secuencia automatizada termina en segundos; los cuatro minutos corresponden a la narración completa de la presentación. Para una demostración manual, usa la tabla de procesos, el inspector de páginas y los botones por fila.

## Pruebas y build

Desde `memory-manager/`:

```bash
npm test
```

La suite usa el test runner incorporado de Node.js e incluye los diez casos de la guía, validaciones de estado, reset y endpoints HTTP.

Para comprobar el bundle de producción del frontend:

```powershell
cd frontend
npm run build
```

## Documentación relacionada

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`../GUIA_GESTOR_MEMORIA.md`](../GUIA_GESTOR_MEMORIA.md)
- [`../EXPOSICION_GESTOR_MEMORIA.md`](../EXPOSICION_GESTOR_MEMORIA.md)

Este software es un simulador académico y no reemplaza un administrador de memoria de un sistema operativo real.
