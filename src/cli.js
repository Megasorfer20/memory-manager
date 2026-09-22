const readline = require('readline');
const MemoryManager = require('./MemoryManager');

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
  console.log('8. Salir');
  console.log('');
}

function printProcessTable(processes) {
  if (!processes.length) {
    console.log('No hay procesos en ejecución.');
    return;
  }

  console.log('PID | Nombre | Tamaño | Estado | Ubicación');
  console.log('----+--------+--------+--------+-----------');
  for (const process of processes) {
    console.log(`${process.pid}   | ${process.name.padEnd(6)} | ${String(process.size).padEnd(6)} | ${String(process.state).padEnd(6)} | ${process.location}`);
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

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  const memoryManager = new MemoryManager(100, 4);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  printHeader();

  while (true) {
    showMenu();
    const option = await askQuestion(rl, 'Seleccione una opción: ');

    try {
      switch (option) {
        case '1': {
          const stats = memoryManager.getMemoryStats();
          console.log(`\nMemoria total: ${stats.total}`);
          console.log(`Memoria usada: ${stats.used}`);
          console.log(`Memoria libre: ${stats.free}`);
          console.log(memoryManager.formatMemoryLayout());
          break;
        }

        case '2': {
          const name = await askQuestion(rl, 'Nombre del proceso: ');
          const size = await askQuestion(rl, 'Tamaño del proceso: ');
          const process = memoryManager.createProcess(name, Number(size));
          console.log(`\nProceso ${process.name} creado con PID ${process.pid}.`);
          break;
        }

        case '3': {
          const pid = await askQuestion(rl, 'PID del proceso a terminar: ');
          const result = memoryManager.terminateProcess(Number(pid));
          console.log(`\n${result.message}`);
          break;
        }

        case '4': {
          const compacted = memoryManager.compactMemory();
          console.log('\nMemoria compactada correctamente.');
          console.log(compacted);
          break;
        }

        case '5': {
          const pid = await askQuestion(rl, 'PID del proceso para mostrar páginas: ');
          const process = memoryManager.getProcessByPid(Number(pid));
          if (!process) {
            throw new Error(`El proceso ${pid} no existe.`);
          }
          printPages(process);
          break;
        }

        case '6': {
          const pid = await askQuestion(rl, 'PID del proceso a enviar a SWAP: ');
          const result = memoryManager.sendToSwap(Number(pid));
          console.log(`\n${result.message}`);
          break;
        }

        case '7': {
          const pid = await askQuestion(rl, 'PID del proceso a recuperar de SWAP: ');
          const result = memoryManager.restoreFromSwap(Number(pid));
          console.log(`\n${result.message}`);
          break;
        }

        case '8': {
          console.log('\nSaliendo del gestor de memoria...');
          rl.close();
          process.exit(0);
        }

        default:
          console.log('\nOpción no válida. Intente de nuevo.');
      }

      const processes = memoryManager.listProcesses();
      const swap = memoryManager.listSwapProcesses();
      console.log('\n--- PROCESOS EN RAM ---');
      printProcessTable(processes);

      if (swap.length) {
        console.log('\n--- PROCESOS EN SWAP ---');
        printProcessTable(swap);
      }
    } catch (error) {
      console.log(`\nERROR: ${error.message}`);
    }

    console.log('\nPresione Enter para continuar...');
    await askQuestion(rl, '');
  }
}

main();
