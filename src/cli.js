const readline = require('node:readline');
const MemoryManager = require('./MemoryManager');

const color = (code, text) => process.env.NO_COLOR ? text : `\u001b[${code}m${text}\u001b[0m`;

function printHeader() {
  console.log('\n========================================');
  console.log('GESTOR DE MEMORIA - VERSIÓN CLI');
  console.log('========================================\n');
}

function showMenu() {
  console.log('1. Mostrar memoria');
  console.log('2. Crear proceso');
  console.log('3. Terminar proceso');
  console.log('4. Compactar memoria');
  console.log('5. Mostrar páginas');
  console.log('6. Enviar proceso a SWAP');
  console.log('7. Recuperar proceso de SWAP');
  console.log('8. Salir\n');
}

function printProcessTable(processes) {
  if (!processes.length) {
    console.log('No hay procesos.');
    return;
  }

  console.log('PID | Nombre | Tamaño | Estado    | Ubicación | Offset');
  console.log('----+--------+--------+-----------+-----------+--------');
  for (const process of processes) {
    const offset = process.start === null ? 'N/A' : `${process.start}-${process.end}`;
    console.log(
      `${String(process.pid).padEnd(3)} | ${process.name.padEnd(6)} | ${String(process.size).padEnd(6)} | `
      + `${process.state.padEnd(9)} | ${process.location.padEnd(9)} | ${offset}`
    );
  }
}

function printPages(process) {
  console.log(`Páginas de ${process.name} (PID ${process.pid})`);
  console.log('Página | Tamaño | Frame | Estado');
  console.log('-------+--------+-------+--------');

  for (const page of process.pages) {
    console.log(`${page.pageNumber}      | ${page.size}     | ${page.frame ?? 'N/A'}    | ${page.status}`);
  }
}

function createQuestionReader(rl) {
  const answers = [];
  const waiters = [];
  let closed = false;

  rl.on('line', (line) => {
    const answer = line.trim();
    const waiter = waiters.shift();
    if (waiter) {
      waiter(answer);
    } else {
      answers.push(answer);
    }
  });
  rl.once('close', () => {
    closed = true;
    while (waiters.length) {
      waiters.shift()(null);
    }
  });

  return (question) => {
    process.stdout.write(question);
    if (answers.length) return Promise.resolve(answers.shift());
    if (closed) return Promise.resolve(null);
    return new Promise((resolve) => waiters.push(resolve));
  };
}

function printMemory(manager) {
  const stats = manager.getMemoryStats();
  console.log(`\nRAM: ${stats.used}/${stats.total} unidades (${Math.round((stats.used / stats.total) * 100)}%)`);
  console.log(`Libre: ${stats.free} | Fragmentación externa: ${stats.fragmentation}%`);
  for (let start = 0; start < stats.layout.length; start += 10) {
    const cells = stats.layout.slice(start, start + 10)
      .map((pid) => pid === 'LIBRE' ? '----' : `P${pid}`.padEnd(4));
    console.log(`${String(start).padStart(3)}-${String(Math.min(start + 9, stats.total - 1)).padStart(3)} | ${cells.join(' ')}`);
  }
}

async function main() {
  const memoryManager = new MemoryManager(100, 4);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = createQuestionReader(rl);
  printHeader();

  let running = true;
  while (running) {
    showMenu();
    const option = await ask('Seleccione una opción: ');
    if (option === null) {
      break;
    }

    try {
      switch (option) {
        case '1':
          printMemory(memoryManager);
          break;
        case '2': {
          const name = await ask('Nombre del proceso: ');
          if (name === null) {
            running = false;
            break;
          }
          const size = await ask('Tamaño del proceso: ');
          if (size === null) {
            running = false;
            break;
          }
          const process = memoryManager.createProcess(name, size);
          console.log(`\nProceso ${process.name} creado con PID ${process.pid}.`);
          break;
        }
        case '3': {
          const pid = await ask('PID del proceso a terminar: ');
          if (pid === null) {
            running = false;
            break;
          }
          console.log(`\n${memoryManager.terminateProcess(pid).message}`);
          break;
        }
        case '4': {
          const compacted = memoryManager.compactMemory();
          console.log(`\nMemoria compactada. ${compacted.length} procesos reorganizados.`);
          break;
        }
        case '5': {
          const pid = await ask('PID del proceso para mostrar páginas: ');
          if (pid === null) {
            running = false;
            break;
          }
          const process = memoryManager.getProcessByPid(pid);
          if (!process) {
            throw new Error(`El proceso ${pid} no existe.`);
          }
          printPages(process);
          break;
        }
        case '6': {
          const pid = await ask('PID del proceso a enviar a SWAP: ');
          if (pid === null) {
            running = false;
            break;
          }
          console.log(`\n${memoryManager.sendToSwap(pid).message}`);
          break;
        }
        case '7': {
          const pid = await ask('PID del proceso a recuperar de SWAP: ');
          if (pid === null) {
            running = false;
            break;
          }
          console.log(`\n${memoryManager.restoreFromSwap(pid).message}`);
          break;
        }
        case '8':
          console.log('\nSaliendo del gestor de memoria...');
          running = false;
          break;
        default:
          console.log(color('33', '\nOpción no válida. Intente de nuevo.'));
      }

      if (option !== '8' && running) {
        printProcessTable(memoryManager.listProcesses());
        if (memoryManager.listSwapProcesses().length) {
          console.log('\n--- PROCESOS EN SWAP ---');
          printProcessTable(memoryManager.listSwapProcesses());
        }
      }
    } catch (error) {
      console.log(color('31', `\nERROR: ${error.message}`));
    }

    if (running) {
      const answer = await ask('\nPresione Enter para continuar...');
      if (answer === null) {
        running = false;
      }
      console.log('');
    }
  }

  rl.close();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(color('31', `Error inesperado en la CLI: ${error.message}`));
    process.exitCode = 1;
  });
}

module.exports = { main };
