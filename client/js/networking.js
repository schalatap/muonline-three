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
    localPlayer = createLocalPlayer(playerId, initialPosition);
    
    // Adiciona jogadores existentes
    for (const id in data.players) {
      if (id !== playerId) {
        addRemotePlayer(id, data.players[id].position);
      }
    }
    
    // Informa que a conexão foi estabelecida
    if (onConnected) onConnected();
  });
  
  // Evento de entrada de um novo jogador
  socket.on('playerJoined', (data) => {
    if (data.id !== playerId) {
      console.log(`Jogador ${data.id} entrou no jogo`);
      addRemotePlayer(data.id, data.position);
    }
  });
  
  // Evento de saída de um jogador
  socket.on('playerLeft', (id) => {
    if (id !== playerId) {
      console.log(`Jogador ${id} saiu do jogo`);
      removePlayer(id);
    }
  });
  
  // Evento de atualização do estado do jogo
  socket.on('gameState', (playersData) => {
    updatePlayersState(playersData);
  });
  
  // Evento de ataque de jogador
  socket.on('playerAttack', (data) => {
    if (data.id !== playerId) {
      showPlayerAttack(data.id);
    }
  });
  
  // Evento de dano recebido
  socket.on('playerDamaged', (data) => {
    if (data.id === playerId) {
      // O jogador local recebeu dano
      updatePlayerHealth(data.health);
    }
    
    // Visual feedback de dano
    showDamageEffect(data.id);
  });
  
  // Evento de morte de jogador
  socket.on('playerDeath', (data) => {
    if (data.id === playerId) {
      // O jogador local morreu
      showDeathScreen();
    } else {
      // Outro jogador morreu
      showPlayerDeath(data.id);
    }
  });
  
  // Evento de respawn de jogador
  socket.on('playerRespawn', (data) => {
    if (data.id === playerId) {
      // O jogador local respawnou
      respawnLocalPlayer(data.position);
    } else {
      // Outro jogador respawnou
      respawnRemotePlayer(data.id, data.position);
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
function sendPlayerAttack() {
  if (socket && socket.connected) {
    socket.emit('playerAttack', {
      position: {
        x: localPlayer.mesh.position.x,
        y: localPlayer.mesh.position.y,
        z: localPlayer.mesh.position.z
      },
      rotation: {
        y: localPlayer.mesh.rotation.y
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
        updateRemotePlayerPosition(id, playersData[id].position, playersData[id].rotation);
      } else {
        // Adiciona o jogador se ele não existir
        addRemotePlayer(id, playersData[id].position);
      }
    }
  }
}
