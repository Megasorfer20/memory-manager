import React, { useEffect, useMemo, useState } from 'react';
import './index.css';

const API_URL = 'http://localhost:3001';

const initialMemoryState = {
  total: 100,
  used: 0,
  free: 100,
  layout: Array(100).fill('LIBRE')
};

const statusOptions = ['ALL', 'RAM', 'SWAP'];

export default function App() {
  const [memory, setMemory] = useState(initialMemoryState);
  const [processes, setProcesses] = useState([]);
  const [swapProcesses, setSwapProcesses] = useState([]);
  const [selectedPid, setSelectedPid] = useState(null);
  const [pages, setPages] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoLog, setDemoLog] = useState(['Demo lista para iniciar.']);
  const [activity, setActivity] = useState([
    'Sistema listo para demo académica.',
    'Memoria disponible en estado inicial.',
    'Puedes crear procesos o ejecutar la demo.'
  ]);

  const selectedProcess = useMemo(
    () => processes.find((process) => process.pid === Number(selectedPid)) ?? null,
    [selectedPid, processes]
  );

  const filteredProcesses = useMemo(() => {
    return processes.filter((process) => {
      const matchesSearch = !searchTerm || `${process.pid}`.includes(searchTerm) || process.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || process.location === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [processes, searchTerm, statusFilter]);

  const filteredSwap = useMemo(() => {
    return swapProcesses.filter((process) => {
      const matchesSearch = !searchTerm || `${process.pid}`.includes(searchTerm) || process.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [swapProcesses, searchTerm]);

  const memoryUsagePercent = memory.total ? (memory.used / memory.total) * 100 : 0;
  const swapPercent = Math.min(100, (swapProcesses.length / Math.max(1, processes.length + swapProcesses.length || 1)) * 100 || 0);
  const processDistribution = useMemo(() => {
    const total = processes.reduce((sum, process) => sum + Number(process.size || 0), 0) || 1;
    return processes.map((process) => ({
      ...process,
      percentage: (Number(process.size || 0) / total) * 100
    }));
  }, [processes]);

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || 'Error al consultar la API.');
    }

    return payload.data;
  };

  const pushActivity = (message) => {
    setActivity((prev) => [message, ...prev].slice(0, 5));
  };

  const loadPages = async (pid) => {
    if (!pid) {
      setPages([]);
      return;
    }

    try {
      const data = await fetchJson(`${API_URL}/processes/${pid}/pages`);
      setPages(data ?? []);
    } catch (err) {
      setPages([]);
    }
  };

  const refreshData = async () => {
    setBusy(true);
    try {
      const [memoryData, processesData, swapData] = await Promise.all([
        fetchJson(`${API_URL}/memory`),
        fetchJson(`${API_URL}/processes`),
        fetchJson(`${API_URL}/swap`)
      ]);

      setMemory(memoryData ?? initialMemoryState);
      setProcesses(processesData ?? []);
      setSwapProcesses(swapData ?? []);
      setError('');
    } catch (err) {
      setError('No se pudo conectar con la API del gestor de memoria.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (selectedPid !== null && selectedPid !== undefined) {
      loadPages(selectedPid);
    } else {
      setPages([]);
    }
  }, [selectedPid]);

  const handleCreateProcess = async () => {
    const name = window.prompt('Nombre del proceso');
    const size = Number(window.prompt('Tamaño del proceso'));

    if (!name || !Number.isFinite(size) || size <= 0) {
      setError('Nombre o tamaño inválidos.');
      return;
    }

    try {
      const created = await fetchJson(`${API_URL}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, size })
      });

      pushActivity(`Proceso ${created.name} creado con tamaño ${created.size}.`);
      setSelectedPid(created.pid);
      setError('');
      await refreshData();
    } catch (err) {
      setError(err.message || 'No se pudo crear el proceso.');
    }
  };

  const terminateProcess = async (pid) => {
    try {
      const result = await fetchJson(`${API_URL}/processes/${pid}`, { method: 'DELETE' });
      pushActivity(result.message || `Proceso ${pid} eliminado.`);
      if (selectedPid === pid) {
        setSelectedPid(null);
      }
      await refreshData();
    } catch (err) {
      setError(err.message || 'No se pudo terminar el proceso.');
    }
  };

  const compactMemory = async () => {
    try {
      const result = await fetchJson(`${API_URL}/memory/compact`, { method: 'POST' });
      pushActivity(`Compactación ejecutada: ${result.length} procesos reorganizados.`);
      await refreshData();
    } catch (err) {
      setError(err.message || 'No se pudo compactar la memoria.');
    }
  };

  const sendProcessToSwap = async (pid) => {
    try {
      const result = await fetchJson(`${API_URL}/processes/${pid}/swap`, { method: 'POST' });
      pushActivity(result.message || `Proceso ${pid} movido a SWAP.`);
      setSelectedPid(null);
      await refreshData();
    } catch (err) {
      setError(err.message || 'No se pudo enviar el proceso a SWAP.');
    }
  };

  const restoreProcess = async (pid) => {
    try {
      const result = await fetchJson(`${API_URL}/processes/${pid}/swap/restore`, { method: 'POST' });
      pushActivity(result.message || `Proceso ${pid} restaurado.`);
      setSelectedPid(pid);
      await refreshData();
    } catch (err) {
      setError(err.message || 'No se pudo restaurar el proceso.');
    }
  };

  const appendDemoLog = (message) => {
    setDemoLog((prev) => [message, ...prev].slice(0, 6));
  };

  const runPresentationDemo = async () => {
    try {
      setBusy(true);
      setError('');
      setShowDemoModal(true);
      appendDemoLog('Preparando la demostración de memoria...');

      const demoProcesses = [
        { name: 'DemoA', size: 12 },
        { name: 'DemoB', size: 15 },
        { name: 'DemoC', size: 10 },
        { name: 'DemoD', size: 18 }
      ];

      for (const item of demoProcesses) {
        const created = await fetchJson(`${API_URL}/processes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        appendDemoLog(`Proceso ${created.name} creado en RAM.`);
        pushActivity(`Demo: ${created.name} ingresó a RAM.`);
      }

      await refreshData();
      const active = await fetchJson(`${API_URL}/processes`);

      if (active.length > 1) {
        const target = active[0];
        await fetchJson(`${API_URL}/processes/${target.pid}/swap`, { method: 'POST' });
        appendDemoLog(`Proceso ${target.name} enviado a SWAP.`);
        pushActivity(`Demo: ${target.name} pasó a SWAP.`);
      }

      await fetchJson(`${API_URL}/memory/compact`, { method: 'POST' });
      appendDemoLog('Se ejecuta compactación para eliminar fragmentación.');
      pushActivity('Demo: memoria compactada para mostrar reubicación.');
      await refreshData();
      appendDemoLog('Demostración finalizada con éxito.');
    } catch (err) {
      setError(err.message || 'No se pudo ejecutar la demo de presentación.');
      appendDemoLog('La demo falló y necesita revisión del backend.');
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (pid) => (
    <div className="row-actions">
      <button className="secondary-button" onClick={() => setSelectedPid(pid)}>Ver</button>
      <button className="secondary-button" onClick={() => terminateProcess(pid)}>Terminar</button>
      <button className="secondary-button" onClick={() => sendProcessToSwap(pid)}>A SWAP</button>
      <button className="secondary-button" onClick={() => restoreProcess(pid)}>Recuperar</button>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="app-container">
        <header className="topbar">
          <div>
            <p className="eyebrow">Simulador educativo</p>
            <h1>Gestor de memoria</h1>
          </div>
          <div className="topbar-actions">
            <button onClick={handleCreateProcess}>Crear proceso</button>
            <button className="ghost-button" onClick={compactMemory}>Compactar</button>
            <button className="ghost-button" onClick={runPresentationDemo}>Demo</button>
            <button className="ghost-button" onClick={refreshData}>Actualizar</button>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}

        <section className="stats-grid">
          <StatCard label="Memoria total" value={memory.total} accent="blue" />
          <StatCard label="Memoria usada" value={memory.used} accent="green" />
          <StatCard label="Memoria libre" value={memory.free} accent="amber" />
          <StatCard label="Uso" value={`${memoryUsagePercent.toFixed(0)}%`} accent="violet" />
        </section>

        <section className="presentation-grid">
          <div className="panel usage-panel">
            <div className="panel-header">
              <h2>Uso de memoria</h2>
            </div>

            <div className="gauge-wrap">
              <div className="gauge-ring" style={{ '--progress': `${memoryUsagePercent}%` }}>
                <div className="gauge-inner">
                  <strong>{Math.round(memoryUsagePercent)}%</strong>
                  <span>ocupada</span>
                </div>
              </div>
            </div>

            <div className="usage-bars">
              <UsageBar label="RAM" value={memoryUsagePercent} color="var(--primary)" />
              <UsageBar label="SWAP" value={swapPercent} color="var(--warning)" />
            </div>
          </div>

          <div className="panel activity-panel presentation-copy-panel">
            <div className="panel-header">
              <h2>Explicación para exposición</h2>
            </div>
            <div className="presentation-copy">
              <p>
                Este sistema simula cómo un sistema operativo asigna procesos en memoria principal,
                cómo se fragmenta el espacio disponible y cómo la compactación reduce la pérdida de memoria.
              </p>
              <ul>
                <li>Los procesos entran a RAM y consumen bloques contiguos.</li>
                <li>Cuando eliminamos procesos, aparece fragmentación y el espacio se vuelve no contiguo.</li>
                <li>La compactación reorganiza la memoria para recuperar bloques útiles.</li>
                <li>Cuando la memoria es insuficiente, los procesos pueden moverse a SWAP.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="panel process-chart-panel">
          <div className="panel-header">
            <h2>Distribución por proceso</h2>
          </div>
          <div className="process-distribution">
            {processDistribution.length === 0 ? (
              <p className="empty-text">Todavía no hay procesos en memoria principal.</p>
            ) : (
              processDistribution.map((process) => (
                <div key={process.pid} className="process-bar-row">
                  <div className="process-bar-meta">
                    <span>{process.name}</span>
                    <strong>{process.size} u</strong>
                  </div>
                  <div className="process-track">
                    <div
                      className="process-fill"
                      style={{ width: `${Math.max(8, process.percentage)}%`, background: `hsl(${(process.pid * 47) % 200 + 190}, 76%, 53%)` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {showDemoModal && (
          <div className="demo-modal-overlay" onClick={() => setShowDemoModal(false)}>
            <div className="demo-modal" onClick={(event) => event.stopPropagation()}>
              <div className="demo-modal-header">
                <div>
                  <p className="eyebrow">Demo automática</p>
                  <h3>Presentación del gestor de memoria</h3>
                </div>
                <button className="ghost-button" onClick={() => setShowDemoModal(false)}>Cerrar</button>
              </div>

              <div className="demo-script">
                <p>
                  La demo recrea el flujo clásico de un sistema operativo: creación de procesos,
                  fragmentación de memoria, movimiento a SWAP y compactación para recuperar espacio.
                </p>
                <ul>
                  <li>Se crean varios procesos con tamaños distintos.</li>
                  <li>Se observa cómo los huecos libres aparecen en distintos puntos.</li>
                  <li>Se activa la compactación para reorganizar la memoria.</li>
                  <li>Se mueve un proceso a SWAP para explicar gestión de memoria virtual.</li>
                </ul>
              </div>

              <div className="demo-log">
                {demoLog.map((entry, index) => (
                  <div key={`${entry}-${index}`} className="demo-log-item">{entry}</div>
                ))}
              </div>

              <div className="demo-modal-actions">
                <button className="ghost-button" onClick={() => setShowDemoModal(false)}>Cancelar</button>
                <button onClick={runPresentationDemo}>{busy ? 'Ejecutando...' : 'Iniciar demo'}</button>
              </div>
            </div>
          </div>
        )}

        <section className="controls-panel">
          <div className="search-box">
            <label htmlFor="search">Buscar proceso</label>
            <input
              id="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="PID o nombre"
            />
          </div>

          <div className="filter-box">
            <label>Filtrar por ubicación</label>
            <div className="segmented-control">
              {statusOptions.map((option) => (
                <button
                  key={option}
                  className={statusFilter === option ? 'segment active' : 'segment'}
                  onClick={() => setStatusFilter(option)}
                >
                  {option === 'ALL' ? 'Todos' : option}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="main-grid">
          <article className="panel memory-panel">
            <div className="panel-header">
              <h2>Memoria RAM</h2>
              <div className="legend">
                <span><em className="legend-dot free" /> Libre</span>
                <span><em className="legend-dot used" /> Ocupada</span>
              </div>
            </div>

            <div className="memory-grid" aria-label="Mapa de memoria">
              {memory.layout.map((cell, index) => {
                const free = cell === 'LIBRE';
                return (
                  <div
                    key={`${cell}-${index}`}
                    className={free ? 'memory-cell free' : 'memory-cell used'}
                    title={free ? 'Espacio libre' : `Proceso ${cell}`}
                  >
                    {free ? 'L' : String(cell).charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="panel detail-panel">
            <div className="panel-header">
              <h2>Detalle</h2>
            </div>

            {selectedProcess ? (
              <div className="detail-card">
                <div className="detail-row"><span>PID</span><strong>{selectedProcess.pid}</strong></div>
                <div className="detail-row"><span>Nombre</span><strong>{selectedProcess.name}</strong></div>
                <div className="detail-row"><span>Tamaño</span><strong>{selectedProcess.size}</strong></div>
                <div className="detail-row"><span>Estado</span><strong>{selectedProcess.state}</strong></div>
                <div className="detail-row"><span>Ubicación</span><strong>{selectedProcess.location}</strong></div>
                <div className="detail-row"><span>Inicio</span><strong>{selectedProcess.start ?? 'N/A'}</strong></div>
                <div className="detail-row"><span>Fin</span><strong>{selectedProcess.end ?? 'N/A'}</strong></div>
              </div>
            ) : (
              <p className="empty-text">Selecciona un proceso para ver sus detalles.</p>
            )}
          </aside>
        </section>

        <section className="tables-grid">
          <article className="panel">
            <div className="panel-header">
              <h2>Procesos activos</h2>
              <span className="count-badge">{filteredProcesses.length}</span>
            </div>

            {busy && <div className="loading-bar" aria-live="polite" />}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>Nombre</th>
                    <th>Tamaño</th>
                    <th>Estado</th>
                    <th>Ubicación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.length > 0 ? (
                    filteredProcesses.map((process) => (
                      <tr key={process.pid} className={selectedPid === process.pid ? 'selected-row' : ''}>
                        <td>{process.pid}</td>
                        <td>{process.name}</td>
                        <td>{process.size}</td>
                        <td><span className="status-badge">{process.state}</span></td>
                        <td>{process.location}</td>
                        <td>{renderActions(process.pid)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-cell">No hay procesos que coincidan con el filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel swap-panel">
            <div className="panel-header">
              <h2>SWAP</h2>
              <span className="count-badge soft">{filteredSwap.length}</span>
            </div>

            {filteredSwap.length === 0 ? (
              <p className="empty-text">No hay procesos en SWAP.</p>
            ) : (
              <ul className="swap-list">
                {filteredSwap.map((process) => (
                  <li key={process.pid}>
                    <div>
                      <strong>{process.name}</strong>
                      <small>PID {process.pid}</small>
                    </div>
                    <span>{process.size} u</span>
                    <button className="secondary-button" onClick={() => restoreProcess(process.pid)}>Recuperar</button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="panel pages-panel">
          <div className="panel-header">
            <h2>Páginas del proceso seleccionado</h2>
          </div>

          {pages.length === 0 ? (
            <p className="empty-text">Selecciona un proceso para visualizar sus páginas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Página</th>
                    <th>Tamaño</th>
                    <th>Frame</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.page}>
                      <td>{page.page}</td>
                      <td>{page.size}</td>
                      <td>{page.frame ?? 'N/A'}</td>
                      <td><span className="status-badge muted">{page.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentMap = {
    blue: '#4f7cff',
    green: '#16a34a',
    amber: '#f59e0b',
    violet: '#8b5cf6'
  };

  return (
    <div className="stat-card" style={{ borderTopColor: accentMap[accent] || '#4f7cff' }}>
      <span>{label}</span>
      <strong style={{ color: accentMap[accent] || '#4f7cff' }}>{value}</strong>
    </div>
  );
}

function UsageBar({ label, value, color }) {
  return (
    <div className="usage-bar-row">
      <div className="usage-bar-meta">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      <div className="usage-track">
        <div className="usage-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  );
}
