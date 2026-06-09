// frontend/vite.proxy.js
// Lokale proxy server — alle sites onder één origin (localhost:5170)
// Start met: node vite.proxy.js (vanuit frontend/)

const http = require('http')
const httpProxy = require('http-proxy')

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  autoRewrite: true,
  protocolRewrite: 'http',
})

proxy.on('error', (err, req, res) => {
  console.error('Proxy fout:', err.message)
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
  }
  res.end(`Proxy fout: ${err.message}`)
})

const ROUTES = {
  '/api':        'http://localhost:8000',
  '/admin':      'http://localhost:5173',
  '/nkhockey':   'http://localhost:5174',
  '/mixmusic':   'http://localhost:5175',
  '/landing':    'http://localhost:5172',
  '/dontforget': 'http://localhost:5176',
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  console.log(`${req.method} ${url}`)

  const route = Object.keys(ROUTES).find(r => url.startsWith(r))

  if (route) {
    proxy.web(req, res, {
      target: ROUTES[route],
      changeOrigin: true,
    })
  } else {
    res.writeHead(302, { Location: '/landing/' })
    res.end()
  }
})

// WebSocket proxy voor Vite HMR
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/'
  const route = Object.keys(ROUTES).find(r => url.startsWith(r))
  if (route) {
    proxy.ws(req, socket, head, { target: ROUTES[route], changeOrigin: true })
  }
})

server.listen(5170, () => {
  console.log('Proxy draait op http://localhost:5170')
  console.log('')
  Object.entries(ROUTES).forEach(([path, target]) => {
    console.log(`  http://localhost:5170${path}/ → ${target}`)
  })
  console.log('')
  console.log('Zorg dat alle Vite servers draaien!')
})
