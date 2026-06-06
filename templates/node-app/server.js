const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>node-app is running 🚀</h1><p>Deployed by Dockre Manager.</p>');
});

server.listen(PORT, () => {
  console.log(`node-app listening on port ${PORT}`);
});
