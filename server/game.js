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
      // Atualiza a posição e rotação
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
    }
  });

// Processa ataques do jogador
socket.on('playerAttack', (data) => {
  if (players[socket.id]) {
    // Garantir que temos um objeto data válido
    data = data || {};
    
    // Registra o tempo do último ataque
    const now = Date.now();
    players[socket.id].lastAttackTime = now;
    
    // Emite o evento de ataque para todos os jogadores
    // Verifica se targetId existe antes de incluí-lo no objeto
    const attackData = {
      playerId: socket.id,
      position: players[socket.id].position,
      rotation: data.rotation || { y: 0 }
    };
    
    // Adiciona targetId apenas se existir
    if (data.targetId) {
      attackData.targetId = data.targetId;
    }
    
    io.emit('playerAttack', attackData);
    
    // Se temos um alvo específico, verificamos apenas esse alvo
    if (data.targetId && players[data.targetId]) {
      const attacker = players[socket.id];
      const target = players[data.targetId];
      
      // Calcula distância entre atacante e alvo
      const dx = target.position.x - attacker.position.x;
      const dz = target.position.z - attacker.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Verifica se está dentro do alcance de ataque
      if (distance <= 2.5) { // Alcance do ataque melee
        // Aplica dano ao alvo
        const DAMAGE = 10;
        target.health -= DAMAGE;
        
        // Atualiza estatísticas
        attacker.statistics.damageDealt += DAMAGE;
        target.statistics.damageReceived += DAMAGE;
        
        console.log(`Jogador ${data.targetId} atingido diretamente! Vida restante: ${target.health}`);
        
        // Envia evento de dano
        io.emit('playerDamaged', {
          id: data.targetId,
          health: target.health,
          attackerId: socket.id,
          damage: DAMAGE
        });
        
        // Verifica se o jogador morreu
        if (target.health <= 0) {
          handlePlayerDeath(data.targetId, socket.id, io);
        }
      }
    } else {
      // Verificação normal de ataque para jogadores próximos
      checkAttackCollisions(socket.id, players[socket.id].position, io);
    }
  }
});
  
  // Processa mensagens de chat
  socket.on('chatMessage', (data) => {
    // Verifica se a mensagem não está vazia e não é muito longa
    const message = data.message.trim();
    if (!message || message.length > 100) return;
    
    // Cria o objeto de mensagem
    const chatData = {
      senderId: socket.id,
      senderName: `Jogador ${socket.id.slice(0, 4)}`,
      message: message,
      position: data.position
    };
    
    // Envia para o próprio jogador primeiro
    socket.emit('chatMessage', chatData);
    
    // Envia apenas para jogadores próximos
    const CHAT_RANGE = 15; // Distância máxima para receber mensagens
    
    // Enviar para outros jogadores dentro do alcance
    for (const playerId in players) {
      if (playerId !== socket.id) {
        const otherPlayer = players[playerId];
        const dx = otherPlayer.position.x - data.position.x;
        const dz = otherPlayer.position.z - data.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance <= CHAT_RANGE) {
          // Jogador está próximo o suficiente para receber a mensagem
          io.to(playerId).emit('chatMessage', chatData);
        }
      }
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

  // Processa lançamento de magias
socket.on('spellCast', (data) => {
  if (players[socket.id]) {
    // Verifica cooldown de magia (anti-cheating)
    const now = Date.now();
    const lastSpellTime = players[socket.id].lastSpellTime || 0;
    
    if (now - lastSpellTime < 3000) { // 3 segundos de cooldown
      return; // Ignora o lançamento se estiver em cooldown
    }
    
    // Atualiza o tempo do último lançamento
    players[socket.id].lastSpellTime = now;
    
    // Transmite o evento para todos os jogadores
    io.emit('spellCast', {
      playerId: socket.id,
      position: players[socket.id].position,
      targetPosition: data.targetPosition,
      spellType: data.spellType
    });
  }
});

// Processa acerto de magia
socket.on('spellHit', (data) => {
  if (players[socket.id] && players[data.targetId]) {
    // Verifica se o alvo existe e está ao alcance
    const caster = players[socket.id];
    const target = players[data.targetId];
    
    // Calcula distância entre lançador e alvo
    const dx = caster.position.x - target.position.x;
    const dz = caster.position.z - target.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    const SPELL_MAX_RANGE = 20; // Alcance máximo da magia (anti-cheating)
    
    if (distance <= SPELL_MAX_RANGE) {
      // Aplica dano ao alvo
      target.health -= data.damage;
      
      // Registra estatísticas
      caster.statistics.damageDealt += data.damage;
      target.statistics.damageReceived += data.damage;
      
      console.log(`Jogador ${data.targetId} atingido por magia! Vida restante: ${target.health}`);
      
      // Envia evento de dano a todos
      io.emit('spellHit', {
        casterId: socket.id,
        targetId: data.targetId,
        damage: data.damage,
        health: target.health,
        spellType: data.spellType
      });
      
      // Verifica se o jogador morreu
      if (target.health <= 0) {
        handlePlayerDeath(data.targetId, socket.id, io);
      }
    }
  }
});
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

// Função de verificação de colisão de ataque revisada
function checkAttackCollisions(attackerId, attackPosition, io) {
  const ATTACK_RANGE = 2.5; // Alcance do ataque (aumentado)
  const ATTACK_DAMAGE = 10; // Dano do ataque
  
  const attacker = players[attackerId];
  let hitAnyone = false;
  
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
      
      // Atualiza estatísticas
      attacker.statistics.damageDealt += ATTACK_DAMAGE;
      target.statistics.damageReceived += ATTACK_DAMAGE;
      
      console.log(`Jogador ${id} atingido! Vida restante: ${target.health}`);
      
      // Emite evento de dano
      io.emit('playerDamaged', {
        id: id,
        health: target.health,
        attackerId: attackerId,
        damage: ATTACK_DAMAGE
      });
      
      hitAnyone = true;
      
      // Verifica se o jogador morreu
      if (target.health <= 0) {
        handlePlayerDeath(id, attackerId, io);
      }
    }
  }
  
  return hitAnyone;
}

// Gerencia a morte de um jogador
function handlePlayerDeath(id, killerId, io) {
  console.log(`Jogador ${id} foi eliminado por ${killerId}`);
  
  // Emite evento de morte
  io.emit('playerDeath', {
    id: id,
    killerId: killerId
  });
  
  // Notifica todos os jogadores próximos sobre a morte
  const CHAT_RANGE = 20; // Alcance maior para notificações de morte
  const deadPlayer = players[id];
  
  for (const playerId in players) {
    const otherPlayer = players[playerId];
    const dx = otherPlayer.position.x - deadPlayer.position.x;
    const dz = otherPlayer.position.z - deadPlayer.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance <= CHAT_RANGE) {
      // Envia mensagem de sistema aos jogadores próximos
      io.to(playerId).emit('chatMessage', {
        system: true,
        message: `Jogador ${id.slice(0, 4)} foi eliminado por Jogador ${killerId.slice(0, 4)}`
      });
    }
  }
  
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
      
      // Notifica o jogador sobre seu respawn
      io.to(id).emit('chatMessage', {
        system: true,
        message: 'Você renasceu'
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