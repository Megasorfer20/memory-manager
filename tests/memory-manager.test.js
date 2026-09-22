const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryManager } = require('../src');

test('debe crear un proceso en memoria', () => {
  const manager = new MemoryManager(20, 4);
  const process = manager.createProcess('P1', 6);

  assert.equal(process.name, 'P1');
  assert.equal(process.location, 'RAM');
  assert.equal(process.size, 6);
  assert.ok(process.pid > 0);
});

test('debe detectar memoria fragmentada', () => {
  const manager = new MemoryManager(18, 4);
  manager.createProcess('P1', 5);
  manager.createProcess('P2', 5);
  manager.createProcess('P3', 5);
  manager.terminateProcess(2);

  assert.throws(() => manager.createProcess('P4', 7), /fragmentada/i);
});

test('debe enviar proceso a SWAP', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);
  const result = manager.sendToSwap(1);

  assert.equal(result.message.includes('SWAP'), true);
  assert.equal(manager.getProcessByPid(1).location, 'SWAP');
});

test('debe recuperar proceso desde SWAP', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);
  manager.sendToSwap(1);

  const result = manager.restoreFromSwap(1);
  assert.equal(result.message.includes('recuperado'), true);
  assert.equal(manager.getProcessByPid(1).location, 'RAM');
});

test('debe compactar memoria', () => {
  const manager = new MemoryManager(12, 4);
  manager.createProcess('P1', 3);
  manager.createProcess('P2', 3);
  manager.terminateProcess(1);

  manager.compactMemory();
  const process = manager.getProcessByPid(2);
  assert.equal(process.start, 0);
});

test('debe listar procesos activos y en swap', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 4);
  manager.createProcess('P2', 4);
  manager.sendToSwap(1);

  const activeProcesses = manager.listProcesses().filter((process) => process.location === 'RAM');
  assert.equal(activeProcesses.length, 1);
  assert.equal(manager.listSwapProcesses().length, 1);
  assert.equal(manager.listSwapProcesses()[0].name, 'P1');
});


