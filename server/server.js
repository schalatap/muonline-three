const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { handlePlayerConnection } = require('./game');

// Importe o sistema de colisão unificado
const CollisionSystem = require('../shared/collision');

// Configuração do Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Configurações do servidor
const PORT = process.env.PORT || 3000;
const MAX_CONNECTIONS = 50; // Limite máximo de jogadores simultâneos

// Servir arquivos estáticos do cliente
app.use(express.static(path.join(__dirname, '../client')));

// Tornar o arquivo de colisão compartilhado acessível para o cliente
app.get('/shared/collision.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/collision.js'));
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Middleware para limitar conexões
io.use((socket, next) => {
  const connectionCount = io.engine.clientsCount;
  if (connectionCount >= MAX_CONNECTIONS) {
    return next(new Error('Servidor cheio, tente novamente mais tarde.'));
  }
  next();
});

// Configuração do Socket.IO para comunicação em tempo real
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id} (Total: ${io.engine.clientsCount})`);
  
  // Adiciona controles anti-cheat e validação básica
  socket.use(([event, data], next) => {
    // Implementação anti-flood básica
    if (event === 'playerMove' || event === 'playerAttack' || event === 'chatMessage') {
      const now = Date.now();
      if (!socket.lastMessageTime) {
        socket.lastMessageTime = {};
      }
      
      if (!socket.lastMessageTime[event]) {
        socket.lastMessageTime[event] = now;
      } else {
        const timeSinceLastMessage = now - socket.lastMessageTime[event];
        
        // Limites de taxa por evento (ms)
        const rateLimits = {
          'playerMove': 30,    // ~33 atualizações por segundo
          'playerAttack': 300, // ~3 ataques por segundo
          'chatMessage': 1000  // ~1 mensagem por segundo
        };
        
        if (timeSinceLastMessage < rateLimits[event]) {
          // Ignora mensagens muito frequentes (possível flood)
          return;
        }
        
        socket.lastMessageTime[event] = now;
      }
    }
    
    // Validação básica de dados (existência e tipo)
    if (event === 'playerMove') {
      if (!data || !data.position || typeof data.position.x !== 'number') {
        return;
      }
    } else if (event === 'chatMessage') {
      if (!data || !data.message || data.message.length > 100) {
        return;
      }
    }
    
    next();
  });
  
  // Gerencia a conexão do jogador
  handlePlayerConnection(io, socket);
  
  // Evento de erro
  socket.on('error', (err) => {
    console.error(`Erro no socket ${socket.id}:`, err);
  });
});

// Captura erros no servidor
server.on('error', (err) => {
  console.error('Erro no servidor:', err);
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Gerencia o desligamento gracioso do servidor
process.on('SIGINT', () => {
  console.log('Desligando servidor...');
  
  // Notifica todos os clientes
  io.emit('serverShutdown', { message: 'Servidor está sendo desligado para manutenção.' });
  
  // Fecha o servidor após 1 segundo
  setTimeout(() => {
    server.close(() => {
      console.log('Servidor desligado.');
      process.exit(0);
    });
  }, 1000);
});