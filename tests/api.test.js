const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../backend/src/app');

function request(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.rawBody ?? (options.body ? JSON.stringify(options.body) : null);

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode,
              body: raw ? JSON.parse(raw) : {}
            });
          });
        }
      );

      req.on('error', (error) => {
        server.close();
        reject(error);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  });
}

test('GET /health responde ok', async () => {
  await request('/reset', { method: 'POST' });
  const response = await request('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.error, null);
  assert.equal(response.body.data.status, 'ok');
});

test('POST /processes crea un nuevo proceso', async () => {
  await request('/reset', { method: 'POST' });
  const response = await request('/processes', {
    method: 'POST',
    body: { name: 'PAPI', size: 5 }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.error, null);
  assert.equal(response.body.data.name, 'PAPI');
});

test('POST /processes rechaza nombre vacío', async () => {
  await request('/reset', { method: 'POST' });
  const response = await request('/processes', {
    method: 'POST',
    body: { name: '', size: 4 }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.data, null);
  assert.equal(response.body.error.code, 'ERR_VALIDATION');
});

test('la API diferencia memoria llena, fragmentación y conflictos de estado', async () => {
  await request('/reset', { method: 'POST' });
  await request('/processes', { method: 'POST', body: { name: 'P1', size: 25 } });
  await request('/processes', { method: 'POST', body: { name: 'P2', size: 25 } });
  await request('/processes', { method: 'POST', body: { name: 'P3', size: 25 } });
  await request('/processes/2', { method: 'DELETE' });

  const fragmented = await request('/processes', {
    method: 'POST',
    body: { name: 'P4', size: 30 }
  });
  assert.equal(fragmented.status, 409);
  assert.equal(fragmented.body.error.code, 'ERR_MEMORY_FRAGMENTED');
  assert.equal(fragmented.body.data, null);

  await request('/processes/1/swap', { method: 'POST' });
  const alreadySwapped = await request('/processes/1/swap', { method: 'POST' });
  assert.equal(alreadySwapped.status, 409);
  assert.equal(alreadySwapped.body.error.code, 'ERR_PROCESS_STATE');
});

test('la API responde 404 semántico y mantiene el envelope estándar', async () => {
  await request('/reset', { method: 'POST' });
  const missingProcess = await request('/processes/999');
  const missingRoute = await request('/missing');

  assert.equal(missingProcess.status, 404);
  assert.equal(missingProcess.body.error.code, 'ERR_PROCESS_NOT_FOUND');
  assert.equal(missingRoute.status, 404);
  assert.deepEqual(Object.keys(missingRoute.body).sort(), ['data', 'error', 'success']);
  assert.equal(missingRoute.body.error.code, 'ERR_ROUTE_NOT_FOUND');
});

test('la API clasifica la memoria insuficiente con HTTP 422', async () => {
  await request('/reset', { method: 'POST' });
  await request('/processes', { method: 'POST', body: { name: 'P1', size: 100 } });

  const response = await request('/processes', {
    method: 'POST',
    body: { name: 'P2', size: 1 }
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.data, null);
  assert.equal(response.body.error.code, 'ERR_MEMORY_FULL');
});

test('el manejador global devuelve envelope para JSON malformado sin cerrar el servidor', async () => {
  const malformed = await request('/processes', { method: 'POST', rawBody: '{"name":' });
  const health = await request('/health');

  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.success, false);
  assert.equal(malformed.body.data, null);
  assert.equal(malformed.body.error.code, 'ERR_BAD_REQUEST');
  assert.equal(health.status, 200);
});
