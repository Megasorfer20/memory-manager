import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EMPTY_MEMORY = {
  total: 100,
  pageSize: 4,
  used: 0,
  free: 100,
  fragmentation: 0,
  largestFreeBlock: 100,
  layout: Array(100).fill('LIBRE')
};

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || `La API respondió HTTP ${response.status}.`);
  }
  if (!payload || !Object.hasOwn(payload, 'data')) {
    throw new Error('La API devolvió una respuesta con formato inválido.');
  }
  return payload.data;
}

export default function App() {
  const [memory, setMemory] = useState(EMPTY_MEMORY);
  const [processes, setProcesses] = useState([]);
  const [selectedPid, setSelectedPid] = useState(null);
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', size: '' });
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoLog, setDemoLog] = useState([]);
  const [eventLog, setEventLog] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), message: 'Simulador listo. Esperando conexión con la API.' }
  ]);
  const logRef = useRef(null);
  const noticeTimer = useRef(null);

  const processesInRam = useMemo(() => processes.filter((process) => process.location === 'RAM'), [processes]);
  const swapProcesses = useMemo(() => processes.filter((process) => process.location === 'SWAP'), [processes]);
  const selectedProcess = useMemo(
    () => processes.find((process) => process.pid === Number(selectedPid)) || null,
    [processes, selectedPid]
  );
  const visibleProcesses = useMemo(() => processes.filter((process) => {
    const matchesSearch = !search
      || String(process.pid).includes(search)
      || process.name.toLowerCase().includes(search.toLowerCase());
    const matchesLocation = filter === 'ALL' || process.location === filter;
    return matchesSearch && matchesLocation;
  }), [filter, processes, search]);
  const ramUsage = memory.total ? (memory.used / memory.total) * 100 : 0;
  const formValidation = useMemo(() => {
    if (form.name.length > 0 && !form.name.trim()) return 'El nombre no puede contener solo espacios.';
    if (!form.size) return '';
    const size = Number(form.size);
    if (!Number.isInteger(size) || size <= 0) return 'El tamaño debe ser un entero mayor que cero.';
    if (size > memory.free) return `Memoria insuficiente: solo quedan ${memory.free} unidades libres.`;
    if (size > memory.largestFreeBlock) return 'La memoria libre está fragmentada; compacta antes de admitir este proceso.';
    return '';
  }, [form.name, form.size, memory.free, memory.largestFreeBlock]);

  const addLog = (message) => {
    setEventLog((items) => [
      ...items,
      { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), message }
    ].slice(-80));
  };

  const showNotice = (message, type = 'success') => {
    setNotice({ message, type });
    if (noticeTimer.current) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  };

  const refreshData = async () => {
    const [memoryData, processesData] = await Promise.all([
      fetchJson('/memory'),
      fetchJson('/processes')
    ]);
    setMemory(memoryData);
    setProcesses(processesData);
    return { memoryData, processesData };
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchJson('/memory'), fetchJson('/processes')])
      .then(([memoryData, processesData]) => {
        if (cancelled) return;
        setMemory(memoryData);
        setProcesses(processesData);
        addLog('Conexión con la API establecida.');
      })
      .catch((error) => {
        if (!cancelled) {
          showNotice(`No se pudo conectar con la API: ${error.message}`, 'error');
          addLog(`Error de conexión: ${error.message}`);
        }
      });
    return () => {
      cancelled = true;
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (selectedPid === null || selectedPid === undefined) {
      setPages([]);
      return;
    }
    let cancelled = false;
    fetchJson(`/processes/${selectedPid}/pages`)
      .then((items) => {
        if (!cancelled) setPages(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setPages([]);
          showNotice(error.message, 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPid, processes]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [eventLog]);

  const runRequest = async (operation, successMessage) => {
    setBusy(true);
    try {
      const result = await operation();
      await refreshData();
      if (successMessage) {
        const message = typeof successMessage === 'function' ? successMessage(result) : successMessage;
        showNotice(message);
        addLog(message);
      }
      return result;
    } catch (error) {
      showNotice(error.message, 'error');
      addLog(`Error: ${error.message}`);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const size = Number(form.size);
    if (!name || !Number.isInteger(size) || size <= 0) {
      setFormError('Ingresa un nombre y un tamaño entero mayor que cero.');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const created = await fetchJson('/processes', {
        method: 'POST',
        body: JSON.stringify({ name, size })
      });
      await refreshData();
      setSelectedPid(created.pid);
      setForm({ name: '', size: '' });
      setShowCreate(false);
      showNotice(`${created.name} fue admitido en RAM con PID ${created.pid}.`);
      addLog(`Creado ${created.name} (PID ${created.pid}), ${created.size} unidades.`);
    } catch (error) {
      setFormError(error.message);
      showNotice(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const terminateProcess = (process) => {
    setConfirmation({
      title: 'Terminar proceso',
      message: `¿Terminar ${process.name} (PID ${process.pid}) y liberar sus unidades de RAM?`,
      confirmLabel: 'Terminar proceso',
      run: async () => {
        const result = await runRequest(
          () => fetchJson(`/processes/${process.pid}`, { method: 'DELETE' }),
          (data) => data.message
        );
        if (result && Number(selectedPid) === process.pid) setSelectedPid(null);
      }
    });
  };

  const compactMemory = () => {
    setConfirmation({
      title: 'Compactar memoria',
      message: 'Los procesos en RAM se moverán hacia la izquierda para reunir el espacio libre.',
      confirmLabel: 'Compactar',
      run: () => runRequest(
        () => fetchJson('/memory/compact', { method: 'POST' }),
        (items) => `Compactación completada: ${items.length} procesos reorganizados.`
      )
    });
  };

  const resetSimulation = () => {
    setConfirmation({
      title: 'Reiniciar simulación',
      message: 'Se terminarán todos los procesos de RAM y SWAP y los PIDs volverán a iniciar en 1.',
      confirmLabel: 'Reiniciar todo',
      run: async () => {
        const result = await runRequest(
          () => fetchJson('/reset', { method: 'POST' }),
          (data) => data.message
        );
        if (result) {
          setSelectedPid(null);
          setPages([]);
        }
      }
    });
  };

  const moveToSwap = (process) => runRequest(
    () => fetchJson(`/processes/${process.pid}/swap`, { method: 'POST' }),
    (data) => data.message
  ).then((result) => {
    if (result && Number(selectedPid) === process.pid) setSelectedPid(null);
  });

  const restoreProcess = (process) => runRequest(
    () => fetchJson(`/processes/${process.pid}/swap/restore`, { method: 'POST' }),
    (data) => data.message
  ).then((result) => {
    if (result) setSelectedPid(process.pid);
  });

  const runPresentationDemo = async () => {
    if (busy) return;
    setBusy(true);
    setDemoLog([]);
    setDemoOpen(true);
    const logDemo = (line) => setDemoLog((items) => [...items, line]);
    try {
      await fetchJson('/reset', { method: 'POST' });
      logDemo('Sesión limpia: RAM y SWAP vacíos.');
      addLog('Demo: sesión reiniciada.');
      const created = [];
      for (const [name, size] of [['P1', 20], ['P2', 30], ['P3', 10]]) {
        const process = await fetchJson('/processes', {
          method: 'POST',
          body: JSON.stringify({ name, size })
        });
        created.push(process);
        logDemo(`${name} creado (${size} unidades).`);
        addLog(`Demo: ${name} ingresó a RAM.`);
      }
      await refreshData();
      await fetchJson(`/processes/${created[1].pid}`, { method: 'DELETE' });
      logDemo('P2 terminado: quedan dos huecos separados y 70 unidades libres.');
      addLog('Demo: P2 terminado; fragmentación externa visible.');
      await refreshData();
      await fetchJson('/memory/compact', { method: 'POST' });
      logDemo('Memoria compactada: P1 y P3 se desplazan hacia la izquierda.');
      addLog('Demo: RAM compactada.');
      await refreshData();
      await fetchJson(`/processes/${created[0].pid}/swap`, { method: 'POST' });
      logDemo('P1 enviado a SWAP; sus páginas quedan suspendidas.');
      addLog('Demo: P1 enviado a SWAP.');
      await refreshData();
      await fetchJson(`/processes/${created[0].pid}/swap/restore`, { method: 'POST' });
      logDemo('P1 restaurado a RAM. Secuencia de exposición completada.');
      addLog('Demo: P1 restaurado desde SWAP.');
      setSelectedPid(created[0].pid);
      await refreshData();
      showNotice('Demo completada con el escenario P1=20, P2=30, P3=10.');
    } catch (error) {
      logDemo(`La demo se detuvo: ${error.message}`);
      showNotice(error.message, 'error');
      addLog(`Error en la demo: ${error.message}`);
      try {
        await refreshData();
      } catch (refreshError) {
        addLog(`No fue posible actualizar el estado: ${refreshError.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Gestor de memoria, inicio">
          <span className="brand-icon">MM</span>
          <span><small>SIMULADOR DE SISTEMAS OPERATIVOS</small><strong>Gestor de memoria</strong></span>
        </a>
        <div className="topbar-actions">
          <span className="connection-state"><i /> API local · 3001</span>
          <button className="button secondary" onClick={() => refreshData().catch((error) => showNotice(error.message, 'error'))} disabled={busy}>
            Actualizar
          </button>
          <button className="button secondary" onClick={resetSimulation} disabled={busy}>Reiniciar</button>
          <button className="button primary" onClick={() => { setFormError(''); setShowCreate(true); }} disabled={busy}>
            <span aria-hidden="true">＋</span> Crear proceso
          </button>
        </div>
      </header>

      <div className="content">
        <section className="intro-row">
          <div>
            <p className="eyebrow">Monitor del sistema</p>
            <h1>Memoria en tiempo real</h1>
            <p className="subtitle">Visualiza asignación, fragmentación, paginación e intercambio de procesos.</p>
          </div>
          <button className="button demo-button" onClick={runPresentationDemo} disabled={busy}>
            <span aria-hidden="true">▷</span> Ejecutar demo de exposición · 4 min
          </button>
        </section>

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            <span>{notice.message}</span>
            <button className="icon-button" onClick={() => setNotice(null)} aria-label="Cerrar notificación">×</button>
          </div>
        )}

        <section className="metrics-grid" aria-label="Métricas de memoria">
          <Metric label="RAM total" value={`${memory.total} u`} detail="Capacidad configurada" icon="▦" tone="blue" />
          <Metric label="Memoria usada" value={`${memory.used} u`} detail={`${Math.round(ramUsage)}% de ocupación`} icon="◧" tone="green" />
          <Metric label="Memoria libre" value={`${memory.free} u`} detail={`Bloque mayor: ${memory.largestFreeBlock} u`} icon="◇" tone="cyan" />
          <Metric label="Fragmentación externa" value={`${memory.fragmentation}%`} detail="Espacio libre no contiguo" icon="⌁" tone="amber" />
          <Metric label="Procesos" value={`${processesInRam.length} / ${swapProcesses.length}`} detail="En RAM / En SWAP" icon="▤" tone="purple" />
        </section>

        <section className="dashboard-grid">
          <article className="panel memory-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Mapa físico</p><h2>RAM <span className="muted">· {memory.total} unidades</span></h2></div>
              <div className="legend"><span><i className="legend-free" /> Libre</span><span><i className="legend-used" /> Proceso</span></div>
            </div>
            <div className="memory-grid" style={{ '--cell-count': memory.layout.length }} aria-label={`Mapa de ${memory.layout.length} unidades de memoria`}>
              {memory.layout.map((owner, offset) => {
                const process = owner === 'LIBRE' ? null : processes.find((item) => item.pid === owner);
                const hue = process ? (process.pid * 67 + 195) % 360 : 0;
                return (
                  <button
                    type="button"
                    key={offset}
                    className={`memory-cell ${process ? 'occupied' : 'free'}`}
                    style={process ? { '--process-color': `hsl(${hue} 72% 44%)` } : undefined}
                    title={process
                      ? `PID ${process.pid} · ${process.name} · Unidad ${offset} · Frame ${offset}`
                      : `Unidad ${offset} · Libre`}
                    aria-label={process
                      ? `Unidad ${offset}, proceso ${process.name}, PID ${process.pid}, frame ${offset}`
                      : `Unidad ${offset}, libre`}
                  >
                    <span>{process ? `P${process.pid}` : '·'}</span>
                    <small>{offset}</small>
                  </button>
                );
              })}
            </div>
            <div className="memory-footer">
              <span><strong>{memory.used}</strong> ocupadas</span>
              <span><strong>{memory.free}</strong> libres</span>
              <div className="usage-track"><i style={{ width: `${ramUsage}%` }} /></div>
              <span>{Math.round(ramUsage)}%</span>
            </div>
          </article>

          <article className="panel quick-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Acciones del sistema</p><h2>Control de memoria</h2></div>
              <span className="live-indicator">● EN LÍNEA</span>
            </div>
            <p className="quick-copy">Administra la memoria contigua y controla procesos en ejecución o suspendidos.</p>
            <button className="button primary full-button" onClick={() => { setFormError(''); setShowCreate(true); }} disabled={busy}>＋ Admitir proceso</button>
            <button className="button secondary full-button" onClick={compactMemory} disabled={busy}>⇥ Compactar memoria</button>
            <div className="quick-stats">
              <div><span>Proceso de mayor tamaño</span><strong>{[...processesInRam].sort((a, b) => b.size - a.size)[0]?.name || '—'}</strong></div>
              <div><span>Bloque libre más grande</span><strong>{memory.largestFreeBlock} unidades</strong></div>
            </div>
            <p className="quick-footnote">Asignación contigua con algoritmo First-Fit.</p>
          </article>
        </section>

        <section className="panel processes-panel">
          <div className="panel-heading processes-heading">
            <div><p className="eyebrow">Administración</p><h2>Procesos <span className="count-pill">{processes.length}</span></h2></div>
            <div className="table-controls">
              <label className="search-control"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar PID o nombre" aria-label="Buscar proceso por PID o nombre" /></label>
              <div className="filter-control" aria-label="Filtrar procesos">
                {['ALL', 'RAM', 'SWAP'].map((option) => (
                  <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>
                    {option === 'ALL' ? 'Todos' : option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>PID</th><th>Proceso</th><th>Tamaño</th><th>Estado</th><th>Ubicación</th><th>Offset</th><th>Páginas</th><th>Acciones</th></tr></thead>
              <tbody>
                {visibleProcesses.length ? visibleProcesses.map((process) => (
                  <tr key={process.pid} className={Number(selectedPid) === process.pid ? 'selected-row' : ''}>
                    <td className="pid-cell">#{String(process.pid).padStart(3, '0')}</td>
                    <td><button className="process-link" onClick={() => setSelectedPid(process.pid)}>{process.name}</button></td>
                    <td>{process.size} u</td>
                    <td><span className={`status-chip ${process.location === 'RAM' ? 'ready' : 'suspended'}`}>{process.state}</span></td>
                    <td><span className="location"><i className={process.location === 'RAM' ? 'ram-dot' : 'swap-dot'} />{process.location}</span></td>
                    <td className="offset-cell">{process.start === null ? '—' : `${process.start} – ${process.end}`}</td>
                    <td>{Math.ceil(process.size / memory.pageSize)}</td>
                    <td><div className="row-actions">
                      <button className="text-action" onClick={() => setSelectedPid(process.pid)}>Páginas</button>
                      {process.location === 'RAM'
                        ? <button className="text-action" onClick={() => moveToSwap(process)} disabled={busy}>A SWAP</button>
                        : <button className="text-action" onClick={() => restoreProcess(process)} disabled={busy}>Restaurar</button>}
                      <button className="text-action danger-action" onClick={() => terminateProcess(process)} disabled={busy}>Terminar</button>
                    </div></td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" className="empty-state">No hay procesos que coincidan con el filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lower-grid">
          <article className="panel swap-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Almacenamiento secundario</p><h2>Área SWAP <span className="count-pill">{swapProcesses.length}</span></h2></div>
              <span className="swap-caption">Procesos suspendidos</span>
            </div>
            {swapProcesses.length ? <ul className="swap-list">
              {swapProcesses.map((process) => <li key={process.pid}>
                <span className="swap-file">↧</span>
                <span className="swap-name"><strong>{process.name}</strong><small>PID {process.pid} · {Math.ceil(process.size / memory.pageSize)} páginas · {process.size} u</small></span>
                <button className="button secondary small-button" onClick={() => restoreProcess(process)} disabled={busy}>Restaurar</button>
              </li>)}
            </ul> : <p className="empty-state">No hay procesos suspendidos en SWAP.</p>}
          </article>

          <article className="panel pages-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Inspector de paginación</p><h2>{selectedProcess ? `${selectedProcess.name} · Tabla de páginas` : 'Tabla de páginas'}</h2></div>
              {selectedProcess && <span className="count-pill">PID {selectedProcess.pid}</span>}
            </div>
            {selectedProcess && pages.length ? <div className="page-list">
              <div className="page-list-head"><span>PÁGINA</span><span>TAMAÑO</span><span>FRAME</span><span>ESTADO</span></div>
              {pages.map((page) => <div className="page-row" key={page.page}>
                <span>{String(page.page).padStart(2, '0')}</span><span>{page.size} u</span><span>{page.frame ?? '—'}</span>
                <span className={`page-state ${page.status.toLowerCase()}`}>{page.status}</span>
              </div>)}
            </div> : <p className="empty-state">Selecciona un proceso para inspeccionar su mapeo lógico-físico.</p>}
          </article>
        </section>

        <section className="panel event-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Actividad reciente</p><h2>Registro del sistema</h2></div>
            <span className="terminal-label">KERNEL LOG</span>
          </div>
          <div className="event-log" ref={logRef} role="log" aria-live="polite">
            {eventLog.map((entry) => <div className="event-entry" key={entry.id}><time>{entry.time}</time><span>{entry.message}</span></div>)}
          </div>
        </section>
      </div>

      {showCreate && <Modal title="Admitir proceso en RAM" onClose={() => setShowCreate(false)}>
        <form className="create-form" onSubmit={submitCreate}>
          <p>El proceso se asignará en el primer bloque contiguo disponible.</p>
          <label>Nombre del proceso<input autoFocus value={form.name} maxLength={32} onChange={(event) => { setForm({ ...form, name: event.target.value }); setFormError(''); }} placeholder="Ej. Editor" /></label>
          <label>Tamaño en unidades<input type="number" min="1" step="1" value={form.size} onChange={(event) => { setForm({ ...form, size: event.target.value }); setFormError(''); }} placeholder="Ej. 20" /></label>
          {(formError || formValidation) && <p className="form-error" role="alert">{formError || formValidation}</p>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowCreate(false)}>Cancelar</button><button className="button primary" disabled={busy || Boolean(formValidation)}>Admitir proceso</button></div>
        </form>
      </Modal>}

      {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
        <p className="confirmation-copy">{confirmation.message}</p>
        <div className="modal-actions">
          <button className="button secondary" onClick={() => setConfirmation(null)}>Cancelar</button>
          <button className="button primary" disabled={busy} onClick={async () => {
            const action = confirmation.run;
            setConfirmation(null);
            await action();
          }}>{confirmation.confirmLabel}</button>
        </div>
      </Modal>}

      {demoOpen && <Modal title="Demo para exposición · 4 minutos" onClose={() => setDemoOpen(false)} wide>
        <div className="demo-intro"><strong>Secuencia automatizada</strong><p>Reinicia la sesión y ejecuta P1=20, P2=30, P3=10; termina P2, compacta la RAM, envía P1 a SWAP y lo restaura.</p></div>
        <ol className="demo-steps">{demoLog.map((line, index) => <li key={`${line}-${index}`}><i>{index + 1}</i><span>{line}</span></li>)}</ol>
        <div className="modal-actions"><button className="button secondary" onClick={() => setDemoOpen(false)}>Cerrar</button><button className="button primary" onClick={runPresentationDemo} disabled={busy}>{busy ? 'Ejecutando…' : 'Ejecutar secuencia'}</button></div>
      </Modal>}
    </main>
  );
}

function Metric({ label, value, detail, icon, tone }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>;
}

function Modal({ title, onClose, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></header>
      {children}
    </section>
  </div>;
}
