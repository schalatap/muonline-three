// Variáveis de rede
let socket;
let playerId;

// Inicializa o sistema de rede
function initNetworking(onConnected) {
  // Conecta ao servidor via Socket.IO
  socket = io();
  
  // Evento de conexão estabelecida
  socket.on('connect', () => {
    console.log('Conectado ao servidor!');
  });
  
  // Evento de inicialização do jogo
  socket.on('gameInit', (data) => {
    playerId = data.id;
    console.log(`ID do jogador: ${playerId}`);
    
    // Cria o jogador local
    const initialPosition = data.position;
    localPlayer = createPlayer(playerId, initialPosition, true);
    
    // Adiciona jogadores existentes
    for (const id in data.players) {
      if (id !== playerId) {
        createPlayer(id, data.players[id].position, false);
      }
    }
    
    // Informa que a conexão foi estabelecida
    if (onConnected) onConnected();
  });
  
  // Evento de entrada de um novo jogador
  socket.on('playerJoined', (data) => {
    if (data.id !== playerId) {
      console.log(`Jogador ${data.id} entrou no jogo`);
      createPlayer(data.id, data.position, false);
      addSystemMessage(`Jogador ${data.id.slice(0, 4)} entrou no jogo`);
    }
  });
  
  // Evento de saída de um jogador
  socket.on('playerLeft', (id) => {
    if (id !== playerId) {
      console.log(`Jogador ${id} saiu do jogo`);
      removePlayer(id);
      addSystemMessage(`Jogador ${id.slice(0, 4)} saiu do jogo`);
    }
  });
  
  // Evento de atualização do estado do jogo
  socket.on('gameState', (playersData) => {
    updatePlayersState(playersData);
  });
  
  // Evento de ataque de jogador
  socket.on('playerAttack', (data) => {
    if (data.playerId !== playerId && players[data.playerId]) {
      // Se tiver um alvo específico, roda em direção ao alvo
      if (data.targetId && players[data.targetId]) {
        players[data.playerId].attack(players[data.targetId].mesh.position);
      } else {
        // Ataque normal
        players[data.playerId].attack();
      }
    }
  });
  
  // Evento de dano recebido
  socket.on('playerDamaged', (data) => {
    if (players[data.id]) {
      if (data.id === playerId) {
        // O jogador local recebeu dano
        localPlayer.health = data.health;
      }
      
      // Visual feedback de dano
      players[data.id].showDamageEffect();
      showDamageNumber(players[data.id].mesh.position, data.damage);
    }
  });
  
  // Evento de morte de jogador
  socket.on('playerDeath', (data) => {
    if (players[data.id]) {
      if (data.id === playerId) {
        // O jogador local morreu
        showDeathScreen();
      } else {
        // Outro jogador morreu
        players[data.id].die();
      }
    }
  });
  
  // Evento de respawn de jogador
  socket.on('playerRespawn', (data) => {
    if (players[data.id]) {
      players[data.id].respawn(data.position);
    }
  });
  
  // Evento de mensagem de chat
  socket.on('chatMessage', (data) => {
    addChatMessage(data);
    
    // Mostra balão de chat para o jogador que enviou
    if (data.senderId in players) {
      players[data.senderId].showChatBubble(data.message);
    }
  });

  // Evento de lançamento de magia por outro jogador
  socket.on('spellCast', (data) => {
    if (data.playerId !== playerId && players[data.playerId]) {
      // Calcular direção da magia baseada na posição alvo
      const caster = players[data.playerId];
      const direction = new THREE.Vector3();
      direction.subVectors(
        new THREE.Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        new THREE.Vector3(caster.mesh.position.x, caster.mesh.position.y, caster.mesh.position.z)
      ).normalize();
      
      // Criar a bola de fogo
      caster.castSpell(new THREE.Vector3(
        data.targetPosition.x,
        data.targetPosition.y,
        data.targetPosition.z
      ));
    }
  });

  // Evento de acerto de magia em um jogador
  socket.on('spellHit', (data) => {
    // O servidor já calculou o dano, só precisamos mostrar o efeito visual
    if (players[data.targetId]) {
      const target = players[data.targetId];
      target.showDamageEffect();
      showDamageNumber(target.mesh.position, data.damage);
      
      // Se o alvo for o jogador local, atualiza a vida
      if (data.targetId === playerId) {
        localPlayer.health = data.health;
      }
    }
  });
}

// Envia movimentos do jogador para o servidor
function sendPlayerMove(data) {
  if (socket && socket.connected) {
    socket.emit('playerMove', data);
  }
}

// Envia ataque do jogador para o servidor
function sendPlayerAttack(data) {
  if (socket && socket.connected) {
    socket.emit('playerAttack', data);
  }
}

// Envia mensagem de chat para o servidor
function sendChatMessage(message) {
  if (socket && socket.connected && localPlayer) {
    socket.emit('chatMessage', {
      message: message,
      position: {
        x: localPlayer.mesh.position.x,
        y: localPlayer.mesh.position.y,
        z: localPlayer.mesh.position.z
      }
    });
  }
}

// Atualiza os estados dos jogadores remotos
function updatePlayersState(playersData) {
  for (const id in playersData) {
    if (id !== playerId) {
      if (players[id]) {
        // Atualiza a posição e rotação do jogador remoto
        const player = players[id];
        const data = playersData[id];
        
        // Aplica interpolação suave para movimento mais fluido
        const mesh = player.mesh;
        
        // Interpola posição
        mesh.position.x += (data.position.x - mesh.position.x) * 0.3;
        mesh.position.y += (data.position.y - mesh.position.y) * 0.3;
        mesh.position.z += (data.position.z - mesh.position.z) * 0.3;
        
        // Interpola rotação
        mesh.rotation.y += (data.rotation.y - mesh.rotation.y) * 0.3;
        
        // Atualiza o collider
        player.updateCollider();
      } else {
        // Adiciona o jogador se ele não existir
        createPlayer(id, playersData[id].position, false);
      }
    }
  }
}

// Envia evento de lançamento de magia para o servidor
function sendSpellCast(targetPosition) {
  if (socket && socket.connected && localPlayer) {
    socket.emit('spellCast', {
      position: {
        x: localPlayer.mesh.position.x,
        y: localPlayer.mesh.position.y,
        z: localPlayer.mesh.position.z
      },
      targetPosition: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      },
      spellType: 'fireball'
    });
  }
}

// Envia evento de acerto de magia para o servidor
function sendSpellHit(targetId, damage) {
  if (socket && socket.connected) {
    socket.emit('spellHit', {
      targetId: targetId,
      damage: damage,
      spellType: 'fireball'
    });
  }
}