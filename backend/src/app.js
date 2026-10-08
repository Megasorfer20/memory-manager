const express = require('express');
const cors = require('cors');
const { MemoryManager } = require('../../src');

const app = express();
const manager = new MemoryManager(100, 4);

app.use(cors());
app.use(express.json());

function sendSuccess(res, data, status = 200) {
  res.status(status).json({ success: true, data, error: null });
}

function handle(handler) {
  return (req, res, next) => {
    try {
      handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

app.get('/health', (req, res) => {
  sendSuccess(res, { status: 'ok', memory: manager.totalMemory });
});

app.get('/memory', (req, res) => {
  sendSuccess(res, manager.getMemoryStats());
});

app.get('/processes', (req, res) => {
  sendSuccess(res, manager.listProcesses());
});

app.get('/swap', (req, res) => {
  sendSuccess(res, manager.listSwapProcesses());
});

app.get('/processes/:pid', handle((req, res) => {
  const process = manager.getProcessByPid(req.params.pid);
  if (!process) {
    const error = new Error(`El proceso ${req.params.pid} no existe.`);
    error.code = 'ERR_PROCESS_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  sendSuccess(res, process);
}));

app.post('/processes', handle((req, res) => {
  const { name, size } = req.body ?? {};
  sendSuccess(res, manager.createProcess(name, size), 201);
}));

app.delete('/processes/:pid', handle((req, res) => {
  sendSuccess(res, manager.terminateProcess(req.params.pid));
}));

app.post('/memory/compact', (req, res) => {
  sendSuccess(res, manager.compactMemory());
});

app.get('/processes/:pid/pages', handle((req, res) => {
  sendSuccess(res, manager.showPages(req.params.pid));
}));

app.post('/processes/:pid/swap', handle((req, res) => {
  sendSuccess(res, manager.sendToSwap(req.params.pid));
}));

app.post('/processes/:pid/swap/restore', handle((req, res) => {
  sendSuccess(res, manager.restoreFromSwap(req.params.pid));
}));

app.post('/reset', (req, res) => {
  sendSuccess(res, manager.reset());
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'ERR_ROUTE_NOT_FOUND', message: 'La ruta solicitada no existe.' }
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  const isInternal = statusCode >= 500;
  if (isInternal) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: isInternal
        ? 'ERR_INTERNAL'
        : typeof error.code === 'string' && error.code.startsWith('ERR_')
          ? error.code
          : 'ERR_BAD_REQUEST',
      message: isInternal ? 'Error interno del servidor.' : error.message || 'Solicitud no válida.'
    }
  });
});

module.exports = app;
