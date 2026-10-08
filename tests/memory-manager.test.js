const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryManager } = require('../src');

test('caso 1: crea un proceso pequeño en RAM con First-Fit', () => {
  const manager = new MemoryManager(20, 4);
  const process = manager.createProcess('P1', 6);

  assert.equal(process.name, 'P1');
  assert.equal(process.location, 'RAM');
  assert.equal(process.start, 0);
  assert.equal(process.end, 5);
  assert.deepEqual(manager.getMemoryStats().layout.slice(0, 6), Array(6).fill(process.pid));
});

test('caso 2: crea varios procesos consecutivos y asigna el bloque que termina en el límite de RAM', () => {
  const manager = new MemoryManager(45, 4);
  const p1 = manager.createProcess('P1', 20);
  const p2 = manager.createProcess('P2', 15);
  const p3 = manager.createProcess('P3', 10);

  assert.deepEqual([p1.start, p2.start, p3.start], [0, 20, 35]);
  assert.equal(p3.end, 44);
  assert.equal(manager.getMemoryStats().free, 0);
  assert.equal(manager.listProcesses().length, 3);
});

test('caso 3: terminar un proceso libera sus unidades y lo elimina del listado', () => {
  const manager = new MemoryManager(20, 4);
  const process = manager.createProcess('P1', 5);
  manager.createProcess('P2', 5);

  const result = manager.terminateProcess(process.pid);

  assert.equal(result.process.state, 'TERMINATED');
  assert.ok(manager.getMemoryStats().layout.slice(0, 5).every((cell) => cell === 'LIBRE'));
  assert.equal(manager.getProcessByPid(process.pid), undefined);
});

test('caso 4: detecta fragmentación externa aunque haya memoria libre total', () => {
  const manager = new MemoryManager(16, 4);
  manager.createProcess('P1', 4);
  manager.createProcess('P2', 4);
  manager.createProcess('P3', 4);
  manager.terminateProcess(2);

  const stats = manager.getMemoryStats();
  assert.equal(stats.free, 8);
  assert.equal(stats.largestFreeBlock, 4);
  assert.equal(stats.fragmentation, 50);
  assert.throws(
    () => manager.createProcess('P4', 5),
    (error) => error.code === 'ERR_MEMORY_FRAGMENTED' && error.statusCode === 409
  );
});

test('caso 5: compacta a la izquierda y actualiza frames de las páginas', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 4);
  manager.createProcess('P2', 4);
  const p3 = manager.createProcess('P3', 8);
  manager.terminateProcess(2);

  manager.compactMemory();

  assert.equal(manager.getProcessByPid(p3.pid).start, 4);
  assert.deepEqual(manager.showPages(p3.pid).map((page) => page.frame), [4, 8]);
  assert.equal(manager.getMemoryStats().largestFreeBlock, 8);
});

test('caso 6: enviar un proceso a SWAP lo suspende y libera la RAM', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);

  manager.sendToSwap(1);

  const process = manager.getProcessByPid(1);
  assert.equal(process.location, 'SWAP');
  assert.equal(process.state, 'SUSPENDED');
  assert.equal(process.start, null);
  assert.equal(manager.getMemoryStats().layout.includes(1), false);
  assert.equal(manager.listSwapProcesses().length, 1);
});

test('caso 7: restaura un proceso de SWAP con sus páginas y frames válidos', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);
  const pagesBefore = manager.showPages(1).map(({ page, size }) => ({ page, size }));
  manager.sendToSwap(1);

  manager.restoreFromSwap(1);

  const process = manager.getProcessByPid(1);
  assert.equal(process.location, 'RAM');
  assert.equal(process.state, 'READY');
  assert.deepEqual(manager.showPages(1).map(({ page, size }) => ({ page, size })), pagesBefore);
  assert.deepEqual(manager.showPages(1).map((page) => page.frame), [0, 4]);
  assert.equal(manager.listSwapProcesses().length, 0);
});

test('caso 8: no restaura desde SWAP si la RAM no tiene capacidad y no muta el estado', () => {
  const manager = new MemoryManager(10, 4);
  manager.createProcess('P1', 6);
  manager.createProcess('P2', 4);
  manager.sendToSwap(2);
  manager.createProcess('P3', 4);
  const layoutBefore = manager.getMemoryStats().layout;

  assert.throws(
    () => manager.restoreFromSwap(2),
    (error) => error.code === 'ERR_MEMORY_FULL' && error.statusCode === 422
  );
  assert.deepEqual(manager.getMemoryStats().layout, layoutBefore);
  assert.equal(manager.getProcessByPid(2).location, 'SWAP');
});

test('restaura desde SWAP compactando automáticamente si el espacio libre está fragmentado', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 3);
  manager.createProcess('P2', 7);
  manager.createProcess('P3', 3);
  manager.createProcess('P4', 3);
  manager.sendToSwap(2);
  manager.createProcess('P5', 4);

  manager.restoreFromSwap(2);

  const restored = manager.getProcessByPid(2);
  assert.equal(restored.location, 'RAM');
  assert.equal(restored.start, 13);
  assert.equal(manager.showPages(2)[0].frame, 13);
  assert.equal(manager.listSwapProcesses().length, 0);
});

test('caso 9: muestra páginas, frames, estado y tamaño final parcial', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P0', 2);
  const process = manager.createProcess('P1', 10);

  assert.deepEqual(manager.showPages(process.pid), [
    { page: 0, size: 4, frame: 2, status: 'RAM' },
    { page: 1, size: 4, frame: 6, status: 'RAM' },
    { page: 2, size: 2, frame: 10, status: 'RAM' }
  ]);
});

test('caso 10: rechaza nombres, tamaños y rangos de memoria inválidos sin corromper RAM', () => {
  const manager = new MemoryManager(8, 4);

  assert.throws(() => manager.createProcess('', 2), /nombre/i);
  assert.throws(() => manager.createProcess('P1', 0), /tamaño/i);
  assert.throws(() => manager.createProcess('P1', 1.5), /entero/i);
  assert.throws(() => manager.createProcess('P1', 9), (error) => error.code === 'ERR_MEMORY_FULL');
  assert.throws(() => manager.freeRamRange(-1, 0), /rango/i);
  assert.equal(manager.getMemoryStats().used, 0);
});

test('rechaza operaciones incompatibles con el estado y PID inexistente', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);
  manager.sendToSwap(1);

  assert.throws(() => manager.sendToSwap(1), (error) => error.code === 'ERR_PROCESS_STATE');
  assert.throws(() => manager.restoreFromSwap(99), (error) => error.code === 'ERR_PROCESS_NOT_FOUND');
});

test('reinicia toda la sesión de forma consistente', () => {
  const manager = new MemoryManager(20, 4);
  manager.createProcess('P1', 5);
  manager.sendToSwap(1);

  manager.reset();

  assert.equal(manager.getMemoryStats().used, 0);
  assert.deepEqual(manager.listProcesses(), []);
  assert.deepEqual(manager.listSwapProcesses(), []);
  assert.equal(manager.createProcess('P2', 1).pid, 1);
});

test('las referencias públicas no permiten mutar el estado interno y limita memoria configurada', () => {
  const manager = new MemoryManager(8, 4);
  const process = manager.createProcess('P1', 4);
  process.start = -1;
  process.pages[0].frame = -1;
  manager.getProcessByPid(1).size = 999;

  assert.equal(manager.getProcessByPid(1).start, 0);
  assert.equal(manager.showPages(1)[0].frame, 0);
  assert.equal(manager.getMemoryStats().used, 4);
  assert.throws(() => new MemoryManager(1_000_001, 4), /1,000,000/);
});
