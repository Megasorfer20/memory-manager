class MemoryManagerError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'MemoryManagerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class MemoryManager {
  constructor(totalMemory = 100, pageSize = 4) {
    if (!Number.isInteger(totalMemory) || totalMemory <= 0 || totalMemory > 1_000_000) {
      throw new Error('La memoria total debe ser un entero entre 1 y 1,000,000.');
    }

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      throw new Error('El tamaño de página debe ser un entero positivo.');
    }

    this.totalMemory = totalMemory;
    this.pageSize = pageSize;
    this.ram = Array(totalMemory).fill('LIBRE');
    this.processes = [];
    this.swap = [];
    this.nextPid = 1;
    this.assertInvariants();
  }

  getMemoryStats() {
    this.assertInvariants();
    const used = this.ram.reduce((count, cell) => count + (cell === 'LIBRE' ? 0 : 1), 0);
    const free = this.totalMemory - used;
    let largestFreeBlock = 0;
    let currentFreeBlock = 0;

    for (const cell of this.ram) {
      if (cell === 'LIBRE') {
        currentFreeBlock++;
        largestFreeBlock = Math.max(largestFreeBlock, currentFreeBlock);
      } else {
        currentFreeBlock = 0;
      }
    }

    return {
      total: this.totalMemory,
      pageSize: this.pageSize,
      used,
      free,
      fragmentation: free === 0 ? 0 : Math.round((1 - largestFreeBlock / free) * 100),
      largestFreeBlock,
      layout: [...this.ram]
    };
  }

  formatMemoryLayout() {
    const { layout } = this.getMemoryStats();
    return `[${layout.join('][')}]`;
  }

  findFreeBlock(size) {
    if (!Number.isInteger(size) || size <= 0 || size > this.totalMemory) {
      return -1;
    }

    let freeBlockStart = -1;
    let freeBlockSize = 0;

    for (let index = 0; index < Math.min(this.ram.length, this.totalMemory); index++) {
      if (this.ram[index] === 'LIBRE') {
        if (freeBlockStart === -1) {
          freeBlockStart = index;
        }
        freeBlockSize++;
        if (freeBlockSize === size) {
          return freeBlockStart;
        }
      } else {
        freeBlockStart = -1;
        freeBlockSize = 0;
      }
    }

    return -1;
  }

  createProcess(name, size) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new MemoryManagerError('El nombre del proceso es obligatorio.', 'ERR_VALIDATION', 400);
    }

    const processSize = Number(size);
    if (!Number.isInteger(processSize) || processSize <= 0) {
      throw new MemoryManagerError('El tamaño debe ser un número entero mayor que cero.', 'ERR_VALIDATION', 400);
    }

    this.assertInvariants();
    const free = this.getMemoryStats().free;
    if (processSize > free) {
      throw new MemoryManagerError(
        'No hay suficiente memoria total para crear el proceso.',
        'ERR_MEMORY_FULL',
        422
      );
    }

    const start = this.findFreeBlock(processSize);
    if (start === -1) {
      throw new MemoryManagerError(
        'Memoria insuficiente contigua. Se requiere compactación.',
        'ERR_MEMORY_FRAGMENTED',
        409
      );
    }

    const process = {
      pid: this.nextPid++,
      name: name.trim(),
      size: processSize,
      state: 'READY',
      location: 'RAM',
      start,
      end: start + processSize - 1,
      pages: [],
      createdAt: new Date().toISOString()
    };

    process.pages = this.buildPages(process);
    this.occupyRam(process);
    this.processes.push(process);
    this.assertInvariants();
    return this.copyProcess(process);
  }

  occupyRam(process) {
    if (
      !Number.isInteger(process.start)
      || !Number.isInteger(process.end)
      || process.start < 0
      || process.end >= this.totalMemory
      || process.end - process.start + 1 !== process.size
    ) {
      throw new Error('Rango de memoria inválido.');
    }

    for (let index = process.start; index <= process.end; index++) {
      if (this.ram[index] !== 'LIBRE') {
        throw new Error(`La unidad ${index} ya está ocupada.`);
      }
    }

    for (let index = process.start; index <= process.end; index++) {
      this.ram[index] = process.pid;
    }
  }

  freeRamRange(start, end) {
    if (
      !Number.isInteger(start)
      || !Number.isInteger(end)
      || start < 0
      || end < start
      || end >= this.totalMemory
    ) {
      throw new Error('Rango de memoria inválido.');
    }

    for (let index = start; index <= end; index++) {
      this.ram[index] = 'LIBRE';
    }
  }

  getProcessByPid(pid) {
    const parsedPid = Number(pid);
    if (!Number.isInteger(parsedPid) || parsedPid <= 0) {
      return undefined;
    }
    const process = this.processes.find((item) => item.pid === parsedPid);
    return process ? this.copyProcess(process) : undefined;
  }

  requireProcess(pid) {
    const parsedPid = Number(pid);
    const process = Number.isInteger(parsedPid) && parsedPid > 0
      ? this.processes.find((item) => item.pid === parsedPid)
      : undefined;
    if (!process) {
      throw new MemoryManagerError(`El proceso ${pid} no existe.`, 'ERR_PROCESS_NOT_FOUND', 404);
    }
    return process;
  }

  terminateProcess(pid) {
    const process = this.requireProcess(pid);
    this.assertInvariants();
    if (process.location === 'RAM') {
      this.assertProcessRange(process);
      this.freeRamRange(process.start, process.end);
    } else {
      this.swap = this.swap.filter((item) => item.pid !== process.pid);
    }

    process.state = 'TERMINATED';
    process.location = 'NONE';
    this.processes = this.processes.filter((item) => item.pid !== process.pid);
    this.assertInvariants();
    return {
      message: `Proceso ${pid} terminado correctamente.`,
      process: {
        pid: process.pid,
        name: process.name,
        size: process.size,
        state: process.state,
        location: process.location
      }
    };
  }

  copyProcess(process) {
    return {
      ...process,
      pages: process.pages.map((page) => ({ ...page }))
    };
  }

  buildPages(process) {
    const pages = [];
    const totalPages = Math.ceil(process.size / this.pageSize);

    for (let pageNumber = 0; pageNumber < totalPages; pageNumber++) {
      const offset = pageNumber * this.pageSize;
      pages.push({
        pageNumber,
        size: Math.min(this.pageSize, process.size - offset),
        frame: process.location === 'RAM' ? process.start + offset : null,
        status: process.location === 'RAM' ? 'RAM' : 'SWAP'
      });
    }

    return pages;
  }

  showPages(pid) {
    this.assertInvariants();
    const process = this.requireProcess(pid);
    return process.pages.map((page) => ({
      page: page.pageNumber,
      size: page.size,
      frame: page.frame,
      status: page.status
    }));
  }

  compactMemory() {
    this.assertInvariants();
    const activeProcesses = this.processes
      .filter((process) => process.location === 'RAM')
      .sort((a, b) => a.start - b.start || a.pid - b.pid);

    const totalActiveSize = activeProcesses.reduce((total, process) => {
      if (!Number.isInteger(process.size) || process.size <= 0) {
        throw new Error(`Tamaño inválido en el proceso ${process.pid}.`);
      }
      return total + process.size;
    }, 0);
    if (totalActiveSize > this.totalMemory) {
      throw new Error('Los procesos activos exceden la capacidad total de RAM.');
    }

    this.ram.fill('LIBRE');
    let nextIndex = 0;

    for (const process of activeProcesses) {
      process.start = nextIndex;
      process.end = nextIndex + process.size - 1;
      process.pages = this.buildPages(process);
      for (let index = process.start; index <= process.end; index++) {
        this.ram[index] = process.pid;
      }
      nextIndex = process.end + 1;
    }

    this.assertInvariants();
    return activeProcesses.map((process) => ({
      pid: process.pid,
      name: process.name,
      start: process.start,
      end: process.end
    }));
  }

  sendToSwap(pid) {
    const process = this.requireProcess(pid);
    this.assertInvariants();
    if (process.location !== 'RAM') {
      throw new MemoryManagerError('El proceso ya está en SWAP.', 'ERR_PROCESS_STATE', 409);
    }

    this.assertProcessRange(process);
    this.freeRamRange(process.start, process.end);
    process.location = 'SWAP';
    process.state = 'SUSPENDED';
    process.start = null;
    process.end = null;
    process.pages = this.buildPages(process);
    this.swap.push(process);
    this.assertInvariants();
    return { message: `Proceso ${pid} enviado a SWAP.` };
  }

  restoreFromSwap(pid) {
    const process = this.requireProcess(pid);
    this.assertInvariants();
    if (process.location !== 'SWAP') {
      throw new MemoryManagerError('El proceso no está en SWAP.', 'ERR_PROCESS_STATE', 409);
    }

    if (this.getMemoryStats().free < process.size) {
      throw new MemoryManagerError(
        'No hay suficiente memoria para recuperar el proceso desde SWAP.',
        'ERR_MEMORY_FULL',
        422
      );
    }

    let start = this.findFreeBlock(process.size);
    if (start === -1) {
      this.compactMemory();
      start = this.findFreeBlock(process.size);
    }
    if (start === -1) {
      throw new MemoryManagerError(
        'Memoria insuficiente contigua. Se requiere compactación.',
        'ERR_MEMORY_FRAGMENTED',
        409
      );
    }

    process.start = start;
    process.end = start + process.size - 1;
    process.location = 'RAM';
    process.state = 'READY';
    process.pages = this.buildPages(process);
    this.occupyRam(process);
    this.swap = this.swap.filter((item) => item.pid !== process.pid);
    this.assertInvariants();
    return { message: `Proceso ${pid} recuperado de SWAP.` };
  }

  assertProcessRange(process) {
    if (
      !Number.isInteger(process.start)
      || !Number.isInteger(process.end)
      || !Number.isInteger(process.size)
      || process.start < 0
      || process.end >= this.totalMemory
      || process.end - process.start + 1 !== process.size
    ) {
      throw new Error(`Rango de memoria inválido en el proceso ${process.pid}.`);
    }

    for (let index = process.start; index <= process.end; index++) {
      if (this.ram[index] !== process.pid) {
        throw new Error(`La RAM no coincide con el proceso ${process.pid} en la unidad ${index}.`);
      }
    }
  }

  assertInvariants() {
    if (this.ram.length !== this.totalMemory) {
      throw new Error('La longitud del mapa RAM no coincide con la capacidad configurada.');
    }

    const processByPid = new Map();
    for (const process of this.processes) {
      if (processByPid.has(process.pid)) {
        throw new Error(`PID duplicado: ${process.pid}.`);
      }
      processByPid.set(process.pid, process);
      if (process.location === 'RAM') {
        this.assertProcessRange(process);
        if (process.state !== 'READY') {
          throw new Error(`Estado inválido para el proceso ${process.pid} en RAM.`);
        }
      } else if (process.location === 'SWAP') {
        if (process.state !== 'SUSPENDED' || process.start !== null || process.end !== null) {
          throw new Error(`Estado o rango inválido para el proceso ${process.pid} en SWAP.`);
        }
        if (this.ram.includes(process.pid)) {
          throw new Error(`El proceso ${process.pid} en SWAP conserva unidades ocupadas en RAM.`);
        }
      } else {
        throw new Error(`Ubicación inválida para el proceso ${process.pid}.`);
      }
    }

    const swapPids = new Set();
    for (const process of this.swap) {
      if (swapPids.has(process.pid) || processByPid.get(process.pid) !== process || process.location !== 'SWAP') {
        throw new Error(`Registro SWAP inconsistente para el proceso ${process.pid}.`);
      }
      swapPids.add(process.pid);
    }
    if (swapPids.size !== this.processes.filter((process) => process.location === 'SWAP').length) {
      throw new Error('Hay procesos suspendidos sin registro en SWAP.');
    }

    for (const cell of this.ram) {
      if (cell !== 'LIBRE' && processByPid.get(cell)?.location !== 'RAM') {
        throw new Error(`La unidad RAM contiene un PID inválido: ${cell}.`);
      }
    }
  }

  listProcesses() {
    return this.processes.map((process) => ({
      pid: process.pid,
      name: process.name,
      size: process.size,
      state: process.state,
      location: process.location,
      start: process.start,
      end: process.end
    }));
  }

  listSwapProcesses() {
    return this.swap.map((process) => ({
      pid: process.pid,
      name: process.name,
      size: process.size,
      state: process.state,
      location: 'SWAP'
    }));
  }

  reset() {
    this.ram.fill('LIBRE');
    this.processes = [];
    this.swap = [];
    this.nextPid = 1;
    this.assertInvariants();
    return { message: 'Simulación reiniciada correctamente.' };
  }
}

module.exports = MemoryManager;
