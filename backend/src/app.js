const express = require('express');
const cors = require('cors');
const { MemoryManager } = require('../../src');

const app = express();
const manager = new MemoryManager(100, 4);

app.use(cors());
app.use(express.json());

function sendSuccess(res, payload, status = 200) {
  res.status(status).json({ success: true, data: payload });
}

function sendError(res, message, status = 400) {
  res.status(status).json({ success: false, message });
}

app.get('/health', (req, res) => {
  sendSuccess(res, { status: 'ok', memory: manager.totalMemory });
});

app.get('/memory', (req, res) => {
  try {
    sendSuccess(res, manager.getMemoryStats());
  } catch (error) {
    sendError(res, error.message, 500);
  }
});

app.get('/processes', (req, res) => {
  try {
    sendSuccess(res, manager.listProcesses());
  } catch (error) {
    sendError(res, error.message, 500);
  }
});

app.get('/swap', (req, res) => {
  try {
    sendSuccess(res, manager.listSwapProcesses());
  } catch (error) {
    sendError(res, error.message, 500);
  }
});

app.get('/processes/:pid', (req, res) => {
  try {
    const process = manager.getProcessByPid(Number(req.params.pid));
    if (!process) {
      throw new Error('El proceso no existe.');
    }
    sendSuccess(res, process);
  } catch (error) {
    sendError(res, error.message, 404);
  }
});

app.post('/processes', (req, res) => {
  try {
    const { name, size } = req.body ?? {};
    const process = manager.createProcess(name, size);
    sendSuccess(res, process, 201);
  } catch (error) {
    sendError(res, error.message, 400);
  }
});

app.delete('/processes/:pid', (req, res) => {
  try {
    const { pid } = req.params;
    const result = manager.terminateProcess(Number(pid));
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error.message, 404);
  }
});

app.post('/memory/compact', (req, res) => {
  try {
    const result = manager.compactMemory();
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error.message, 400);
  }
});

app.get('/processes/:pid/pages', (req, res) => {
  try {
    const { pid } = req.params;
    const pages = manager.showPages(Number(pid));
    sendSuccess(res, pages);
  } catch (error) {
    sendError(res, error.message, 404);
  }
});

app.post('/processes/:pid/swap', (req, res) => {
  try {
    const { pid } = req.params;
    const result = manager.sendToSwap(Number(pid));
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error.message, 400);
  }
});

app.post('/processes/:pid/swap/restore', (req, res) => {
  try {
    const { pid } = req.params;
    const result = manager.restoreFromSwap(Number(pid));
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error.message, 400);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  sendError(res, 'Error interno del servidor.', 500);
});

module.exports = app;
