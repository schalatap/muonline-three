// Network variables
let socket;
let playerId;

// Initialize networking
function initNetworking(onConnected) {
  // Connect to server
  socket = io();
  
  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server!');
  });
  
  // Game initialization
  socket.on('gameInit', (data) => {
    playerId = data.id;
    console.log(`Player ID: ${playerId}`);
    
    // Create local player
    const initialPosition = data.position;
    localPlayer = createPlayer(playerId, initialPosition, true);
    
    // Set player stats and stat points
    if (data.stats) {
      localPlayer.stats = data.stats;
    }
    
    if (data.statPoints !== undefined) {
      localPlayer.statPoints = data.statPoints;
    }
    
    // Add existing players
    for (const id in data.players) {
      if (id !== playerId) {
        createPlayer(id, data.players[id].position, false);
        
        // Set their stats if available
        if (data.players[id].stats) {
          players[id].stats = data.players[id].stats;
        }
      }
    }
    
    // Initialize stats UI
    initStatsSystem();
    
    // Update UI
    localPlayer.updateUI();
    
    // Notify connection established
    if (onConnected) onConnected();
  });
  
  // New player joined
  socket.on('playerJoined', (data) => {
    if (data.id !== playerId) {
      console.log(`Player ${data.id} joined the game`);
      createPlayer(data.id, data.position, false);
      addSystemMessage(`Jogador ${data.id.slice(0, 4)} entrou no jogo`);
    }
  });
  
  // Player left
  socket.on('playerLeft', (id) => {
    if (id !== playerId) {
      console.log(`Player ${id} left the game`);
      removePlayer(id);
      addSystemMessage(`Jogador ${id.slice(0, 4)} saiu do jogo`);
    }
  });
  
  // Game state update
  socket.on('gameState', (playersData) => {
    updatePlayersState(playersData);
  });
  
  // Player attack
  socket.on('playerAttack', (data) => {
    if (data.playerId !== playerId && players[data.playerId]) {
      // If targeted, rotate to target
      if (data.targetId && players[data.targetId]) {
        players[data.playerId].attack(players[data.targetId].mesh.position);
      } else {
        // Normal attack
        players[data.playerId].attack();
      }
    }
  });
  
  // Player damaged
  socket.on('playerDamaged', (data) => {
    if (players[data.id]) {
      if (data.id === playerId) {
        // Local player damaged
        localPlayer.stats.health = data.health;
        localPlayer.updateUI();
      } else {
        // Update remote player health
        players[data.id].stats.health = data.health;
      }
      
      // Show damage effect
      players[data.id].showDamageEffect();
      showDamageNumber(players[data.id].mesh.position, data.damage);
    }
  });
  
  // Player death
  socket.on('playerDeath', (data) => {
    if (players[data.id]) {
      if (data.id === playerId) {
        // Local player died
        showDeathScreen();
      } else {
        // Other player died
        players[data.id].die();
      }
    }
  });
  
  // Player respawn
  socket.on('playerRespawn', (data) => {
    if (players[data.id]) {
      players[data.id].respawn(data.position);
      
      // Update stats if provided
      if (data.stats) {
        players[data.id].stats = data.stats;
        
        // Update UI if local player
        if (data.id === playerId) {
          localPlayer.updateUI();
        }
      }
    }
  });
  
  // Chat message
  socket.on('chatMessage', (data) => {
    addChatMessage(data);
    
    // Show chat bubble
    if (data.senderId in players) {
      players[data.senderId].showChatBubble(data.message);
    }
  });

  // Spell cast by another player
  socket.on('spellCast', (data) => {
    if (data.playerId !== playerId && players[data.playerId]) {
      // Calculate direction
      const caster = players[data.playerId];
      const direction = new THREE.Vector3();
      direction.subVectors(
        new THREE.Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        new THREE.Vector3(caster.mesh.position.x, caster.mesh.position.y, caster.mesh.position.z)
      ).normalize();
      
      // Cast spell
      caster.castSpell(new THREE.Vector3(
        data.targetPosition.x,
        data.targetPosition.y,
        data.targetPosition.z
      ));
    }
  });

  // Spell hit
  socket.on('spellHit', (data) => {
    // Visual feedback only
    if (players[data.targetId]) {
      const target = players[data.targetId];
      target.showDamageEffect();
      showDamageNumber(target.mesh.position, data.damage);
      
      // Update local player health
      if (data.targetId === playerId) {
        localPlayer.stats.health = data.health;
        localPlayer.updateUI();
      } else {
        // Update remote player health
        target.stats.health = data.health;
      }
    }
  });
  
  // Spell cast failed
  socket.on('spellCastFailed', (data) => {
    addSystemMessage(data.message);
  });
  
  // Mana updated
  socket.on('manaUpdated', (data) => {
    if (localPlayer) {
      localPlayer.stats.mana = data.mana;
      localPlayer.updateUI();
    }
  });
  
  // Stats updated
  socket.on('statsUpdated', (data) => {
    handleStatsUpdated(data);
  });
  
  // Stat allocation failed
  socket.on('statAllocationFailed', (data) => {
    handleStatAllocationFailed(data);
  });
  
  // Player leveled up
  socket.on('levelUp', (data) => {
    if (players[data.id]) {
      // Update stats
      players[data.id].stats.level = data.level;
      
      if (data.stats) {
        players[data.id].stats = data.stats;
      }
      
      if (data.id === playerId) {
        // Local player level up
        localPlayer.statPoints = data.statPoints || localPlayer.statPoints;
        handleLevelUp();
        updateStatsUI();
      }
    }
  });

  // Evento de estado dos monstros
socket.on('monstersState', (monstersData) => {
  updateMonstersState(monstersData);
});

// Evento de dano em monstro
socket.on('monsterDamaged', (data) => {
  if (monsters[data.id]) {
    monsters[data.id].stats.health = data.health;
    monsters[data.id].showDamageEffect();
    
    // Mostrar número flutuante de dano
    showDamageNumber(monsters[data.id].mesh.position, data.damage);
  }
});

// Evento de morte de monstro
socket.on('monsterDead', (data) => {
  if (monsters[data.id]) {
    monsters[data.id].die();
  }
});

// Evento de spawn de monstro
socket.on('monsterSpawned', (data) => {
  createMonster(data);
});

// Evento de ganho de experiência
socket.on('experienceGained', (data) => {
  if (localPlayer) {
    // Atualiza experiência do jogador
    localPlayer.stats.experience = data.totalExp;
    updateExpBar();
    
    // Mostra informação de experiência ganha
    showExperienceGain(data.amount);
  }
});
}

// Send player movement
function sendPlayerMove(data) {
  if (socket && socket.connected) {
    socket.emit('playerMove', data);
  }
}

// Send player attack
function sendPlayerAttack(data) {
  if (socket && socket.connected) {
    socket.emit('playerAttack', data);
  }
}

// Send chat message
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

// Update remote players
function updatePlayersState(playersData) {
  for (const id in playersData) {
    if (id !== playerId) {
      if (players[id]) {
        // Update position and rotation
        const player = players[id];
        const data = playersData[id];
        
        // Smooth interpolation
        const mesh = player.mesh;
        
        // Position
        mesh.position.x += (data.position.x - mesh.position.x) * 0.3;
        mesh.position.y += (data.position.y - mesh.position.y) * 0.3;
        mesh.position.z += (data.position.z - mesh.position.z) * 0.3;
        
        // Rotation
        mesh.rotation.y += (data.rotation.y - mesh.rotation.y) * 0.3;
        
        // Update collider
        player.updateCollider();
        
        // Update stats if available
        if (data.stats) {
          player.stats = data.stats;
        }
      } else {
        // Add new player
        createPlayer(id, playersData[id].position, false);
        
        // Set stats if available
        if (playersData[id].stats) {
          players[id].stats = playersData[id].stats;
        }
      }
    }
  }
}

// Send spell cast
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

// Send spell hit
function sendSpellHit(targetId, damage) {
  if (socket && socket.connected) {
    socket.emit('spellHit', {
      targetId: targetId,
      damage: damage,
      spellType: 'fireball'
    });
  }
}

// Envia evento de acerto de magia em monstro
function sendSpellHitMonster(monsterId, damage) {
  if (socket && socket.connected) {
    socket.emit('spellHitMonster', {
      monsterId: monsterId,
      damage: damage,
      spellType: 'fireball'
    });
  }
}

// Exporta a função
window.sendSpellHitMonster = sendSpellHitMonster;


// Função para mostrar experiência ganha
function showExperienceGain(amount) {
  const expElement = document.createElement('div');
  expElement.className = 'exp-gain';
  expElement.textContent = `+${amount} XP`;
  
  // Posiciona no centro inferior da tela
  expElement.style.left = '50%';
  expElement.style.bottom = '100px';
  expElement.style.transform = 'translateX(-50%)';
  
  document.body.appendChild(expElement);
  
  // Remove após a animação
  setTimeout(() => {
    document.body.removeChild(expElement);
  }, 2000);
}