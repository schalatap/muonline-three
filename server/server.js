const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { handlePlayerConnection } = require('./game');

// Configuração do Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Servir arquivos estáticos do cliente
app.use(express.static(path.join(__dirname, '../client')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Configuração do Socket.IO para comunicação em tempo real
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);
  handlePlayerConnection(io, socket);
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
