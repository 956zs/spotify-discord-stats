import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const START_PORT = 4173;
const MAX_PORT = 4190;
const DEMO_PATH = path.resolve(
  fileURLToPath(new URL('../docs/prototypes/recap-components-v2-demo.html', import.meta.url))
);

function createServer() {
  return http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.stack ?? error.message);
    });
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${HOST}`);
  if (url.pathname !== '/' && url.pathname !== '/recap-components-v2-demo.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(await fs.readFile(DEMO_PATH, 'utf8'));
}

function listen(port) {
  const server = createServer();
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < MAX_PORT) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, HOST, () => {
    console.log(`Recap demo: http://${HOST}:${port}`);
  });
}

listen(START_PORT);
