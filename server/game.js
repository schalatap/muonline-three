const { createPlayer } = require('./player');
const { getSpawnPoint } = require('./world');

// Armazena todos os jogadores conectados
const players = {};

// Taxa de atualização do servidor (20 vezes por segundo)
const TICK_RATE = 50;
let serverInterval;

// Gerencia a conexão de um novo jogador
function handlePlayerConnection(io, socket) {
  // Cria um novo jogador
  const spawnPoint = getSpawnPoint();
  const player = createPlayer(socket.id, spawnPoint);
  players[socket.id] = player;

  // Envia informações iniciais ao jogador
  socket.emit('gameInit', {
    id: socket.id,
    position: player.position,
    players: getPlayersData()
  });

  // Anuncia o novo jogador para todos os outros
  socket.broadcast.emit('playerJoined', {
    id: socket.id,
    position: player.position
  });

  // Processa movimentos do jogador
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
    }
  });

  // Processa ataques do jogador
  socket.on('playerAttack', (data) => {
    if (players[socket.id]) {
      // Emite o evento de ataque para todos os jogadores
      io.emit('playerAttack', {
        id: socket.id,
        position: players[socket.id].position,
        rotation: players[socket.id].rotation
      });
      
      // Verifica colisão com outros jogadores
      checkAttackCollisions(socket.id, players[socket.id].position, io);
    }
  });

  // Gerencia a desconexão do jogador
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('playerLeft', socket.id);
    }
  });

  // Se este for o primeiro jogador, inicia o loop do servidor
  if (Object.keys(players).length === 1) {
    startServerLoop(io);
  }
}

// Obtém dados de todos os jogadores
function getPlayersData() {
  const playersData = {};
  for (const id in players) {
    playersData[id] = {
      position: players[id].position,
      rotation: players[id].rotation,
      health: players[id].health
    };
  }
  return playersData;
}

// Verifica colisões de ataques
function checkAttackCollisions(attackerId, attackPosition, io) {
  const ATTACK_RANGE = 2; // Alcance do ataque
  const ATTACK_DAMAGE = 10; // Dano do ataque
  
  for (const id in players) {
    // Não atacar a si mesmo
    if (id === attackerId) continue;
    
    const target = players[id];
    const dx = target.position.x - attackPosition.x;
    const dz = target.position.z - attackPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance <= ATTACK_RANGE) {
      // Aplica dano ao jogador
      target.health -= ATTACK_DAMAGE;
      console.log(`Jogador ${id} atingido! Vida restante: ${target.health}`);
      
      // Emite evento de dano
      io.emit('playerDamaged', {
        id: id,
        health: target.health,
        attackerId: attackerId
      });
      
      // Verifica se o jogador morreu
      if (target.health <= 0) {
        handlePlayerDeath(id, attackerId, io);
      }
    }
  }
}

// Gerencia a morte de um jogador
function handlePlayerDeath(id, killerId, io) {
  console.log(`Jogador ${id} foi eliminado por ${killerId}`);
  
  // Emite evento de morte
  io.emit('playerDeath', {
    id: id,
    killerId: killerId
  });
  
  // Respawn do jogador após 5 segundos
  setTimeout(() => {
    if (players[id]) {
      const spawnPoint = getSpawnPoint();
      players[id].position = spawnPoint;
      players[id].health = 100;
      
      io.emit('playerRespawn', {
        id: id,
        position: spawnPoint
      });
    }
  }, 5000);
}

// Inicia o loop principal do servidor
function startServerLoop(io) {
  if (serverInterval) clearInterval(serverInterval);
  
  serverInterval = setInterval(() => {
    // Envia atualizações de estado a todos os jogadores
    io.emit('gameState', getPlayersData());
  }, 1000 / TICK_RATE);
}

module.exports = {
  handlePlayerConnection
};
