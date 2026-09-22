const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../backend/src/app');

function request(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : null;

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
  const response = await request('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'ok');
});

test('POST /processes crea un nuevo proceso', async () => {
  const response = await request('/processes', {
    method: 'POST',
    body: { name: 'PAPI', size: 5 }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.name, 'PAPI');
});

test('POST /processes rechaza nombre vacío', async () => {
  const response = await request('/processes', {
    method: 'POST',
    body: { name: '', size: 4 }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});

