class MemoryManager {
  constructor(totalMemory = 100, pageSize = 4) {
    if (!Number.isInteger(totalMemory) || totalMemory <= 0) {
      throw new Error('La memoria total debe ser un entero positivo.');
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
  }

  getMemoryStats() {
    const used = this.processes
      .filter((process) => process.location === 'RAM')
      .reduce((sum, process) => sum + process.size, 0);

    return {
      total: this.totalMemory,
      used,
      free: this.totalMemory - used,
      layout: [...this.ram]
    };
  }

  formatMemoryLayout() {
    const { layout } = this.getMemoryStats();
    return `[${layout.join('][')}]`;
  }

  findFreeBlock(size) {
    for (let i = 0; i <= this.ram.length - size; i++) {
      if (this.ram[i] === 'LIBRE') {
        let contiguous = 1;

        for (let j = i + 1; j < this.ram.length; j++) {
          if (this.ram[j] === 'LIBRE') {
            contiguous++;
          } else {
            break;
          }

          if (contiguous >= size) {
            return i;
          }
        }
      }
    }

    return -1;
  }

  createProcess(name, size) {
    if (!name || !String(name).trim()) {
      throw new Error('El nombre del proceso es obligatorio.');
    }

    const parsedSize = Number(size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      throw new Error('El tamaño debe ser un número mayor que cero.');
    }

    const processSize = Math.floor(parsedSize);
    const totalUsed = this.processes
      .filter((process) => process.location === 'RAM')
      .reduce((sum, process) => sum + process.size, 0);

    if (totalUsed + processSize > this.totalMemory) {
      throw new Error('No hay suficiente memoria total para crear el proceso.');
    }

    const start = this.findFreeBlock(processSize);
    if (start === -1) {
      throw new Error('Existe memoria libre, pero está fragmentada.');
    }

    const process = {
      pid: this.nextPid++,
      name: String(name).trim(),
      size: processSize,
      state: 'READY',
      location: 'RAM',
      start,
      end: start + processSize - 1,
      pages: [],
      createdAt: new Date().toISOString()
    };

    this.occupyRam(process);
    process.pages = this.buildPages(process);
    this.processes.push(process);

    return process;
  }

  occupyRam(process) {
    for (let i = process.start; i <= process.end; i++) {
      this.ram[i] = process.name;
    }
  }

  freeRamRange(start, end) {
    for (let i = start; i <= end; i++) {
      this.ram[i] = 'LIBRE';
    }
  }

  getProcessByPid(pid) {
    return this.processes.find((process) => process.pid === Number(pid));
  }

  terminateProcess(pid) {
    const process = this.getProcessByPid(pid);
    if (!process) {
      throw new Error(`El proceso ${pid} no existe.`);
    }

    if (process.location === 'SWAP') {
      this.swap = this.swap.filter((item) => item.pid !== process.pid);
      this.processes = this.processes.filter((item) => item.pid !== process.pid);
      return { message: `Proceso ${pid} eliminado del SWAP.` };
    }

    this.freeRamRange(process.start, process.end);
    process.state = 'TERMINATED';
    process.location = 'NONE';
    this.processes = this.processes.filter((item) => item.pid !== process.pid);

    return { message: `Proceso ${pid} terminado correctamente.` };
  }

  buildPages(process) {
    const pages = [];
    const totalPages = Math.ceil(process.size / this.pageSize);

    let cursor = 0;
    for (let i = 0; i < totalPages; i++) {
      const remaining = process.size - cursor;
      const pageLength = Math.min(this.pageSize, remaining);

      pages.push({
        pageNumber: i,
        size: pageLength,
        frame: process.start + cursor,
        status: process.location === 'RAM' ? 'RAM' : 'SWAP'
      });

      cursor += pageLength;
    }

    return pages;
  }

  showPages(pid) {
    const process = this.getProcessByPid(pid);
    if (!process) {
      throw new Error(`El proceso ${pid} no existe.`);
    }

    return process.pages.map((page) => ({
      page: page.pageNumber,
      size: page.size,
      frame: page.frame,
      status: page.status
    }));
  }

  compactMemory() {
    const activeProcesses = this.processes
      .filter((process) => process.location === 'RAM')
      .sort((a, b) => a.start - b.start);

    this.ram.fill('LIBRE');

    let nextIndex = 0;
    for (const process of activeProcesses) {
      const previousStart = process.start;
      const previousEnd = process.end;

      process.start = nextIndex;
      process.end = nextIndex + process.size - 1;

      for (let i = previousStart; i <= previousEnd; i++) {
        // no-op: el proceso se reubica en la RAM con el mismo contenido
      }

      for (let i = 0; i < process.size; i++) {
        this.ram[nextIndex + i] = process.name;
      }

      process.pages = this.buildPages(process);
      nextIndex += process.size;
    }

    for (let i = nextIndex; i < this.ram.length; i++) {
      this.ram[i] = 'LIBRE';
    }

    return activeProcesses.map((process) => ({
      pid: process.pid,
      name: process.name,
      start: process.start,
      end: process.end
    }));
  }

  sendToSwap(pid) {
    const process = this.getProcessByPid(pid);
    if (!process) {
      throw new Error(`El proceso ${pid} no existe.`);
    }

    if (process.location === 'SWAP') {
      throw new Error('El proceso ya está en SWAP.');
    }

    this.freeRamRange(process.start, process.end);
    process.location = 'SWAP';
    process.state = 'SUSPENDED';
    process.start = null;
    process.end = null;
    process.pages = process.pages.map((page) => ({
      ...page,
      status: 'SWAP',
      frame: null
    }));

    this.swap.push(process);
    return { message: `Proceso ${pid} enviado a SWAP.` };
  }

  restoreFromSwap(pid) {
    const process = this.getProcessByPid(pid);
    if (!process) {
      throw new Error(`El proceso ${pid} no existe.`);
    }

    if (process.location !== 'SWAP') {
      throw new Error('El proceso no está en SWAP.');
    }

    const start = this.findFreeBlock(process.size);
    if (start === -1) {
      const compacted = this.compactMemory();
      const nextFree = this.findFreeBlock(process.size);
      if (nextFree === -1) {
        throw new Error('No hay suficiente memoria para recuperar el proceso desde SWAP.');
      }

      process.start = nextFree;
      process.end = nextFree + process.size - 1;
    } else {
      process.start = start;
      process.end = start + process.size - 1;
    }

    this.occupyRam(process);
    process.location = 'RAM';
    process.state = 'READY';
    process.pages = this.buildPages(process);

    this.swap = this.swap.filter((item) => item.pid !== process.pid);
    return { message: `Proceso ${pid} recuperado de SWAP.` };
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
}

module.exports = MemoryManager;
