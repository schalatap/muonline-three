const { createPlayer, damagePlayer, recordKill, consumeMana, updateDerivedStats, levelUp } = require('./player');
const { getSpawnPoint } = require('./world');
const { initializeMonsters, findRespawnPosition } = require('./monsterbase');
const { MonsterTypes } = require('./monsters');

// Corrigir a importação do sistema de colisão unificado
const { 
  collisionManager, 
  COLLIDABLE_TYPES,
  COLLIDER_SHAPES,
  Collidable,
  createMonsterCollidable
} = require('../shared/collision');

// Store all connected players
const players = {};
const monsters = initializeMonsters();

// Server update rate (20 times per second)
const TICK_RATE = 50;
let serverInterval;
let ioInstance; // Para armazenar a instância do io

// Handle a new player connection
function handlePlayerConnection(io, socket) {
  // Create a new player
  ioInstance = io;
  const spawnPoint = getSpawnPoint();
  const player = createPlayer(socket.id, spawnPoint);
  players[socket.id] = player;

  // Send initial information to player
  socket.emit('gameInit', {
    id: socket.id,
    position: player.position,
    players: getPlayersData(),
    stats: player.stats,
    statPoints: player.statPoints
  });

  // Announce new player to others
  socket.broadcast.emit('playerJoined', {
    id: socket.id,
    position: player.position
  });

  // Process player movements
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      // Update position and rotation
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
    }
  });

  // Process player attacks
  socket.on('playerAttack', (data) => {
    if (players[socket.id]) {
      // Ensure we have a valid data object
      data = data || {};

      // Verificar se o jogador tem vigor suficiente
      const STAMINA_COST = 10;
      if (players[socket.id].stats.stamina < STAMINA_COST) {
        socket.emit('attackFailed', { message: "Vigor insuficiente para atacar!" });
        return;
      }
      
      // Consumir vigor
      players[socket.id].stats.stamina -= STAMINA_COST;
      
      // Record attack time
      const now = Date.now();
      players[socket.id].lastAttackTime = now;
      
      // Emit attack event to all players
      const attackData = {
        playerId: socket.id,
        position: players[socket.id].position,
        rotation: data.rotation || { y: 0 }
      };
      
      // Add targetId if it exists
      if (data.targetId) {
        attackData.targetId = data.targetId;
      }
      
      io.emit('playerAttack', attackData);

      // Calcula dano baseado em força
      const attacker = players[socket.id];
      const BASE_DAMAGE = 5;
      const strengthBonus = attacker.stats.strength * 0.5;
      const DAMAGE = Math.floor(BASE_DAMAGE + strengthBonus);
      
      // Verifica se o ID alvo pertence a um monstro
      if (data.targetId && (data.targetId.includes('goblin_') || data.targetId.includes('wolf_'))) {
        playerAttackMonster(socket.id, data.targetId, DAMAGE);
      }
      // Verifica se é ataque em jogador
      else if (data.targetId && players[data.targetId]) {
        const target = players[data.targetId];
        
        // Calculate distance between attacker and target
        const dx = target.position.x - attacker.position.x;
        const dz = target.position.z - attacker.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Check if within attack range
        if (distance <= 2.5) { // Melee attack range
          // Apply damage to target
          target.stats.health -= DAMAGE;
          
          // Update statistics
          attacker.statistics.damageDealt += DAMAGE;
          target.statistics.damageReceived += DAMAGE;
          
          console.log(`Jogador ${data.targetId} atingido diretamente! Vida restante: ${target.stats.health}`);
          
          // Send damage event
          io.emit('playerDamaged', {
            id: data.targetId,
            health: target.stats.health,
            attackerId: socket.id,
            damage: DAMAGE
          });
          
          // Check if player died
          if (target.stats.health <= 0) {
            handlePlayerDeath(data.targetId, socket.id, io);
          }
        }
      } 
      // Verificação de área sem alvo específico
      else {
        // Verifica jogadores no alcance
        checkAttackCollisions(socket.id, players[socket.id].position, io);
        
        // Verifica monstros no alcance
        checkPlayerAttackHitMonsters(socket.id, players[socket.id].position, 2.5, DAMAGE);
      }
    }
  });
  
  // Process chat messages
  socket.on('chatMessage', (data) => {
    // Check if message is valid
    const message = data.message.trim();
    if (!message || message.length > 100) return;
    
    // Create message object
    const chatData = {
      senderId: socket.id,
      senderName: `Jogador ${socket.id.slice(0, 4)}`,
      message: message,
      position: data.position
    };
    
    // Send to player first
    socket.emit('chatMessage', chatData);
    
    // Send only to nearby players
    const CHAT_RANGE = 15; // Maximum distance to receive messages
    
    // Send to other players within range
    for (const playerId in players) {
      if (playerId !== socket.id) {
        const otherPlayer = players[playerId];
        const dx = otherPlayer.position.x - data.position.x;
        const dz = otherPlayer.position.z - data.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance <= CHAT_RANGE) {
          // Player is close enough to receive message
          io.to(playerId).emit('chatMessage', chatData);
        }
      }
    }
  });

  // Handle stat point distribution
  socket.on('allocateStat', (data) => {
    if (!players[socket.id]) return;
    
    const player = players[socket.id];
    const statName = data.stat;
    
    // Check if player has stat points to allocate
    if (player.statPoints <= 0) {
      socket.emit('statAllocationFailed', { 
        message: "Você não tem pontos de status disponíveis." 
      });
      return;
    }
    
    // Check if stat is valid
    const validStats = ['strength', 'agility', 'vitality', 'energy'];
    if (!validStats.includes(statName)) {
      socket.emit('statAllocationFailed', { 
        message: "Status inválido." 
      });
      return;
    }
    
    // Armazena o valor anterior para o frontend saber o que foi aumentado
    const previousValue = player.stats[statName];
    
    // Allocate the stat point
    player.stats[statName]++;
    player.statPoints--;
    
    // Update all derived stats
    updateDerivedStats(player);
    
    // Send updated stats to player
    socket.emit('statsUpdated', {
      stats: player.stats,
      statPoints: player.statPoints,
      statLastIncreased: statName,
      previousValue: previousValue
    });
    
    console.log(`Jogador ${socket.id} aumentou ${statName} para ${player.stats[statName]}`);
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('playerLeft', socket.id);
    }
  });

  // Start server loop if this is the first player
  if (Object.keys(players).length === 1) {
    startServerLoop(io);
  }

  // Process spell casting
  socket.on('spellCast', (data) => {
    if (players[socket.id]) {
      // Check spell cooldown
      const now = Date.now();
      const lastSpellTime = players[socket.id].lastSpellTime || 0;
      
      if (now - lastSpellTime < 1500) { // 1.5 seconds cooldown
        return; // Ignore if on cooldown
      }
      
      // Check mana cost
      const MANA_COST = 15;
      if (players[socket.id].stats.mana < MANA_COST) {
        socket.emit('spellCastFailed', { message: "Mana insuficiente." });
        return;
      }

      // Verificar vigor
      const STAMINA_COST = 5;
      if (players[socket.id].stats.stamina < STAMINA_COST) {
        socket.emit('spellCastFailed', { message: "Vigor insuficiente para lançar magia!" });
        return;
      }
      
      // Consume recursos
      players[socket.id].stats.mana -= MANA_COST;
      players[socket.id].stats.stamina -= STAMINA_COST;
      
      // Update last cast time
      players[socket.id].lastSpellTime = now;
      
      // Broadcast spell cast to all players
      io.emit('spellCast', {
        playerId: socket.id,
        position: players[socket.id].position,
        targetPosition: data.targetPosition,
        spellType: data.spellType
      });
      
      // Send updated mana to player
      socket.emit('manaUpdated', { mana: players[socket.id].stats.mana });
    }
  });

  // Process spell hits
  socket.on('spellHit', (data) => {
    if (players[socket.id] && players[data.targetId]) {
      // Check if target exists and is in range
      const caster = players[socket.id];
      const target = players[data.targetId];
      
      // Calculate distance between caster and target
      const dx = caster.position.x - target.position.x;
      const dz = caster.position.z - target.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      const SPELL_MAX_RANGE = 20; // Maximum spell range
      
      if (distance <= SPELL_MAX_RANGE) {
        // Calculate magic damage based on caster's energy
        const BASE_DAMAGE = 15;
        const energyBonus = caster.stats.energy * 0.8;
        const DAMAGE = Math.floor(BASE_DAMAGE + energyBonus);
        
        // Apply damage to target
        target.stats.health -= DAMAGE;
        
        // Record statistics
        caster.statistics.damageDealt += DAMAGE;
        target.statistics.damageReceived += DAMAGE;
        
        console.log(`Jogador ${data.targetId} atingido por magia! Vida restante: ${target.stats.health}`);
        
        // Send damage event to all
        io.emit('spellHit', {
          casterId: socket.id,
          targetId: data.targetId,
          damage: DAMAGE,
          health: target.stats.health,
          spellType: data.spellType
        });
        
        // Check if player died
        if (target.stats.health <= 0) {
          handlePlayerDeath(data.targetId, socket.id, io);
        }
      }
    }
  });
  socket.on('spellHitMonster', (data) => {
    if (players[socket.id] && monsters[data.monsterId]) {
      const player = players[socket.id];
      const monster = monsters[data.monsterId];
      
      // Skip if monster is already dead
      if (monster.currentState === 'dead') {
        return;
      }
      
      // Calculate magic damage based on caster's energy with diminishing returns
      const BASE_DAMAGE = 15;
      const energyBonus = Math.pow(player.stats.energy, 0.9) * 0.8; // Slightly diminishing returns
      const DAMAGE = Math.floor(BASE_DAMAGE + energyBonus);
      
      // Apply damage to monster
      monster.stats.health -= DAMAGE;
      
      // Record statistics
      player.statistics.damageDealt += DAMAGE;
      player.statistics.spellsCast += 1;
      
      console.log(`Jogador ${socket.id} atingiu monstro ${data.monsterId} com magia! Vida restante: ${monster.stats.health}`);
      
      // Notify all clients about monster damage
      ioInstance.emit('monsterDamaged', {
        id: data.monsterId,
        health: monster.stats.health,
        maxHealth: monster.stats.maxHealth,
        attackerId: socket.id,
        damage: DAMAGE,
        isMagic: true   // Indica que foi dano mágico
      });
      
      // If the monster was in idle state, change to chase
      if (monster.currentState === 'idle') {
        monster.targetId = socket.id;
        monster.currentState = 'chase';
      }
      
      // Check if monster died
      if (monster.stats.health <= 0) {
        handleMonsterDeath(monster, socket.id);
      }
    }
  });

}

// Get data for all players
function getPlayersData() {
  const playersData = {};
  for (const id in players) {
    playersData[id] = {
      position: players[id].position,
      rotation: players[id].rotation,
      stats: players[id].stats
    };
  }
  return playersData;
}

// Check for attack collisions
function checkAttackCollisions(attackerId, attackPosition, io) {
  const ATTACK_RANGE = 2.5; // Attack range
  
  const attacker = players[attackerId];
  let hitAnyone = false;
  
  for (const id in players) {
    // Don't attack self
    if (id === attackerId) continue;
    
    const target = players[id];
    const dx = target.position.x - attackPosition.x;
    const dz = target.position.z - attackPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance <= ATTACK_RANGE) {
      // Calculate damage based on attacker's strength
      const BASE_DAMAGE = 5;
      const strengthBonus = attacker.stats.strength * 0.5;
      const DAMAGE = Math.floor(BASE_DAMAGE + strengthBonus);
      
      // Apply damage to player
      target.stats.health -= DAMAGE;
      
      // Update statistics
      attacker.statistics.damageDealt += DAMAGE;
      target.statistics.damageReceived += DAMAGE;
      
      console.log(`Jogador ${id} atingido! Vida restante: ${target.stats.health}`);
      
      // Emit damage event
      io.emit('playerDamaged', {
        id: id,
        health: target.stats.health,
        attackerId: attackerId,
        damage: DAMAGE
      });
      
      hitAnyone = true;
      
      // Check if player died
      if (target.stats.health <= 0) {
        handlePlayerDeath(id, attackerId, io);
      }
    }
  }
  
  return hitAnyone;
}

// Handle player death
function handlePlayerDeath(id, killerId, io, isMonsterKill = false) {
  console.log(`Jogador ${id} foi eliminado por ${isMonsterKill ? 'monstro' : 'jogador'} ${killerId}`);
  
  // Emite evento de morte
  io.emit('playerDeath', {
    id: id,
    killerId: killerId,
    isMonsterKill: isMonsterKill
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
      // Cria mensagem apropriada
      let message;
      if (isMonsterKill) {
        // Encontra o nome do monstro
        let monsterName = "um monstro";
        if (monsters[killerId]) {
          monsterName = monsters[killerId].name;
        }
        message = `Jogador ${id.slice(0, 4)} foi eliminado por ${monsterName}`;
      } else {
        message = `Jogador ${id.slice(0, 4)} foi eliminado por Jogador ${killerId.slice(0, 4)}`;
      }
      
      // Envia mensagem de sistema aos jogadores próximos
      io.to(playerId).emit('chatMessage', {
        system: true,
        message: message
      });
    }
  }
  
  // Respawn do jogador após 5 segundos
  setTimeout(() => {
    if (players[id]) {
      const spawnPoint = getSpawnPoint();
      players[id].position = spawnPoint;
      players[id].stats.health = players[id].stats.maxHealth;
      players[id].stats.mana = players[id].stats.maxMana;
      players[id].stats.stamina = players[id].stats.maxStamina;
      
      io.emit('playerRespawn', {
        id: id,
        position: spawnPoint,
        stats: players[id].stats
      });
      
      // Notifica o jogador sobre seu respawn
      io.to(id).emit('chatMessage', {
        system: true,
        message: 'Você renasceu'
      });
    }
  }, 5000);
}



// Monstros

// Função para atualizar o estado dos monstros
function updateMonsters() {
  const now = Date.now();
  
  // Atualiza cada monstro
  for (const id in monsters) {
    const monster = monsters[id];
    
    // Só processa monstros ativos
    if (monster.currentState === 'dead') continue;
    
    // Comportamento baseado no estado atual
    switch (monster.currentState) {
      case 'idle':
        handleIdleState(monster);
        break;
      case 'chase':
        handleChaseState(monster);
        break;
      case 'attack':
        handleAttackState(monster, now);
        break;
      case 'return':
        handleReturnState(monster);
        break;
    }
  }
}

// Comportamento do monstro quando está ocioso
function handleIdleState(monster) {
  // Verifica se há jogadores próximos para aggrear
  let nearestPlayer = null;
  let nearestDistance = Infinity;
  
  for (const id in players) {
    const player = players[id];
    
    // Calcula distância
    const dx = player.position.x - monster.position.x;
    const dz = player.position.z - monster.position.z;
    const distSq = dx * dx + dz * dz;
    
    // Verifica se está no alcance de aggro
    if (distSq < monster.stats.aggroRange * monster.stats.aggroRange) {
      if (distSq < nearestDistance) {
        nearestDistance = distSq;
        nearestPlayer = player;
      }
    }
  }
  
  // Se encontrou um jogador, começa a perseguir
  if (nearestPlayer) {
    monster.targetId = nearestPlayer.id;
    monster.currentState = 'chase';
  }
}

// Comportamento quando está em perseguição
function handleChaseState(monster) {
  // Verifica se o alvo ainda existe
  if (!monster.targetId || !players[monster.targetId]) {
    monster.targetId = null;
    monster.currentState = 'return';
    return;
  }
  
  const target = players[monster.targetId];
  
  // Calcula distância
  const dx = target.position.x - monster.position.x;
  const dz = target.position.z - monster.position.z;
  const distSq = dx * dx + dz * dz;
  
  // Verifica se está no alcance de ataque
  if (distSq <= monster.stats.attackRange * monster.stats.attackRange) {
    monster.currentState = 'attack';
    return;
  }
  
  // Verifica se o jogador está muito longe (além do alcance de perseguição)
  if (distSq > monster.stats.chaseRange * monster.stats.chaseRange) {
    monster.targetId = null;
    monster.currentState = 'return';
    return;
  }
  
  // Determina direção para o jogador
  const direction = { x: dx, z: dz };
  const length = Math.sqrt(distSq);
  
  // Normaliza a direção
  direction.x /= length;
  direction.z /= length;
  
  // Aplicar comportamento de separação de bando
  const separationDirection = calculateSeparationVector(monster);
  
  // MODIFICAÇÃO: Verificar se o monstro está em colisão 
  const isColliding = monster.lastCollisionTime && (Date.now() - monster.lastCollisionTime < 500);
  
  // Combinar as direções com pesos diferentes baseados na situação
  let chaseWeight = 0.7;
  let separationWeight = 0.3;
  
  // Se estiver em colisão, dar muito mais peso à separação
  if (isColliding) {
    chaseWeight = 0.1;     // Reduzido ainda mais (de 0.2 para 0.1)
    separationWeight = 0.9; // Aumentado (de 0.8 para 0.9)
    
    // ADIÇÃO: Jitter aleatório para ajudar a escapar de situações de travamento
    finalDirection.x += (Math.random() - 0.5) * 0.4;
    finalDirection.z += (Math.random() - 0.5) * 0.4;
  }
  
  const finalDirection = {
    x: direction.x * chaseWeight + separationDirection.x * separationWeight,
    z: direction.z * chaseWeight + separationDirection.z * separationWeight
  };
  
  // Normalizar o vetor final
  const finalLength = Math.sqrt(finalDirection.x * finalDirection.x + finalDirection.z * finalDirection.z);
  if (finalLength > 0) {
    finalDirection.x /= finalLength;
    finalDirection.z /= finalLength;
  }
  
  // Calcular nova posição tentativa
  const newPosition = {
    x: monster.position.x + finalDirection.x * monster.stats.moveSpeed,
    y: monster.position.y,
    z: monster.position.z + finalDirection.z * monster.stats.moveSpeed
  };
  
  // Verificar colisão usando o sistema de colisão
  const tempPosition = { ...monster.position };
  monster.position = newPosition;
  
  // Atualizar posição do collidable
  collisionManager.updateCollidablePosition(monster.id, monster.position);
  
  // Verificar colisões
  const collisions = collisionManager.checkEntityCollisions(
    monster.id,
    [COLLIDABLE_TYPES.MONSTER, COLLIDABLE_TYPES.STATIC]
  );
  
  if (collisions.length > 0) {
    // Reverter posição
    monster.position = tempPosition;
    collisionManager.updateCollidablePosition(monster.id, monster.position);
    
    // Tenta uma sequência de posições alternativas em diferentes ângulos
    const possibleAngles = [45, -45, 90, -90, 135, -135];
    let foundValidPosition = false;
    
    for (const angleOffset of possibleAngles) {
      const radians = angleOffset * (Math.PI / 180);
      const cosAngle = Math.cos(radians);
      const sinAngle = Math.sin(radians);
      
      // Rotacionar a direção
      const altDirection = {
        x: finalDirection.x * cosAngle - finalDirection.z * sinAngle,
        z: finalDirection.x * sinAngle + finalDirection.z * cosAngle
      };
      
      // Tentar esta nova direção
      const altPosition = {
        x: tempPosition.x + altDirection.x * monster.stats.moveSpeed,
        y: tempPosition.y,
        z: tempPosition.z + altDirection.z * monster.stats.moveSpeed
      };
      
      // Testar esta posição
      monster.position = altPosition;
      collisionManager.updateCollidablePosition(monster.id, monster.position);
      
      const altCollisions = collisionManager.checkEntityCollisions(
        monster.id,
        [COLLIDABLE_TYPES.MONSTER, COLLIDABLE_TYPES.STATIC]
      );
      
      if (altCollisions.length === 0) {
        // Encontrou posição válida!
        foundValidPosition = true;
        break;
      }
    }
    
    // Se não encontrou posição válida, volta para a posição original
    if (!foundValidPosition) {
      monster.position = tempPosition;
      collisionManager.updateCollidablePosition(monster.id, monster.position);
    }
  }
  
  // Atualiza rotação para olhar para o alvo
  monster.rotation.y = Math.atan2(finalDirection.x, finalDirection.z);
}

// Função para calcular vetor de separação (manter distância de outros monstros)
function calculateSeparationVector(monster) {
  const separationVector = { x: 0, z: 0 };
  let neighborCount = 0;
  let isColliding = false;
  const SEPARATION_RADIUS = 3.0; // Distância para considerar "muito próximo"
  const COLLISION_RADIUS = 1.5; // Distância para considerar "em colisão"
  
  // Verificar todos os outros monstros
  for (const id in monsters) {
    if (id === monster.id || monsters[id].currentState === 'dead') continue;
    
    const otherMonster = monsters[id];
    const dx = otherMonster.position.x - monster.position.x;
    const dz = otherMonster.position.z - monster.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);
    
    // Se estiver muito próximo, adicionar ao vetor de separação
    if (distSq < SEPARATION_RADIUS * SEPARATION_RADIUS) {
      // Quanto mais próximo, maior a força de separação (inversamente proporcional à distância)
      
      // CORREÇÃO: Força de separação muito mais forte e com aleatoriedade quando em colisão direta
      let factor;
      if (distSq < COLLISION_RADIUS * COLLISION_RADIUS) {
        // Em colisão - força mais forte e com componente aleatório
        factor = 2.0; // Aumentado de 1.5 para 2.0
        // Adicionar uma pequena aleatoriedade para quebrar padrões de colisão
        factor += Math.random() * 0.5;
        isColliding = true;
        
        // Armazenar o timestamp da colisão para desbloqueio
        monster.lastCollisionTime = Date.now();
      } else {
        // Próximo mas não colidindo - força normal baseada na distância
        factor = Math.max(0.2, (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS);
      }
      
      // Adicionar direção oposta (afastar-se)
      separationVector.x -= (dx / dist) * factor;
      separationVector.z -= (dz / dist) * factor;
      neighborCount++;
    }
  }
  
  // Normalizar o vetor se houver vizinhos
  if (neighborCount > 0) {
    const length = Math.sqrt(separationVector.x * separationVector.x + separationVector.z * separationVector.z);
    if (length > 0) {
      separationVector.x /= length;
      separationVector.z /= length;
      
      // Amplificar o vetor se estiver em colisão
      if (isColliding) {
        separationVector.x *= 2.0; // Aumentado de 1.5 para 2.0
        separationVector.z *= 2.0;
      }
    }
  }
  
  // CORREÇÃO: Aplicar comportamento de "escape da colisão" mais rapidamente
  if (monster.lastCollisionTime && Date.now() - monster.lastCollisionTime > 1000) { // Reduzido de 2000 para 1000
    // Se ficar em colisão por mais de 1 segundo, fazer um movimento aleatório forte
    const randomAngle = Math.random() * Math.PI * 2;
    separationVector.x = Math.cos(randomAngle) * 3.0; // Aumentado de 2.0 para 3.0
    separationVector.z = Math.sin(randomAngle) * 3.0;
    
    // Reset do timer após o movimento de escape
    monster.lastCollisionTime = null;
    
    // ADIÇÃO: Marcar o monstro como tendo executado um movimento de escape
    monster.escapeAttempted = Date.now();
  }
  
  // ADIÇÃO: Sistema de recuperação para monstros completamente travados
  // Se o monstro já tentou escapar mas continua preso por muito tempo
  if (monster.escapeAttempted && Date.now() - monster.escapeAttempted > 3000) {
    // Como último recurso, teletransportar o monstro para um ponto próximo à sua origem
    const randomOffset = {
      x: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 5
    };
    
    monster.position.x = monster.spawnPosition.x + randomOffset.x;
    monster.position.z = monster.spawnPosition.z + randomOffset.z;
    
    // Resetar estados de colisão
    monster.lastCollisionTime = null;
    monster.escapeAttempted = null;
    
    // Log para debug
    console.log(`Monstro ${monster.id} teletransportado para evitar travamento`);
    
    // Usar um vetor de direção neutro
    return { x: 0, z: 0 };
  }
  
  return separationVector;
}

// Comportamento quando está atacando
function handleAttackState(monster, now) {
  // Verifica se o alvo ainda existe
  if (!monster.targetId || !players[monster.targetId]) {
    monster.targetId = null;
    monster.currentState = 'return';
    return;
  }
  
  const target = players[monster.targetId];
  
  // Calcula distância
  const dx = target.position.x - monster.position.x;
  const dz = target.position.z - monster.position.z;
  const distSq = dx * dx + dz * dz;
  
  // Verifica se ainda está no alcance de ataque
  if (distSq > monster.stats.attackRange * monster.stats.attackRange) {
    monster.currentState = 'chase';
    return;
  }
  
  // Atualiza rotação para olhar para o alvo
  const direction = { x: dx, z: dz };
  const length = Math.sqrt(distSq);
  direction.x /= length;
  direction.z /= length;
  monster.rotation.y = Math.atan2(direction.x, direction.z);
  
  // Verifica cooldown de ataque
  const attackCooldown = monster.stats.attackSpeed * 1000; // Converte para ms
  if (now - monster.lastAttackTime >= attackCooldown) {
    // Realiza o ataque
    attackPlayer(monster, target);
    monster.lastAttackTime = now;
  }
}

// Comportamento quando está retornando ao ponto de spawn
function handleReturnState(monster) {
  // Calcula distância até o ponto de spawn
  const dx = monster.spawnPosition.x - monster.position.x;
  const dz = monster.spawnPosition.z - monster.position.z;
  const distSq = dx * dx + dz * dz;
  
  // Se chegou ao ponto de spawn, volta para idle
  if (distSq < 1) {
    monster.currentState = 'idle';
    return;
  }
  
  // Determina direção para o ponto de spawn
  const direction = { x: dx, z: dz };
  const length = Math.sqrt(distSq);
  
  // Normaliza e aplica velocidade
  direction.x /= length;
  direction.z /= length;
  
  // Aplicar comportamento de separação de bando
  const separationDirection = calculateSeparationVector(monster);
  
  // Combinar as direções com pesos diferentes baseados na situação
  let returnWeight = 0.7;
  let separationWeight = 0.3;
  
  // Se estiver em colisão, dar muito mais peso à separação
  const isColliding = monster.lastCollisionTime && (Date.now() - monster.lastCollisionTime < 500);
  if (isColliding) {
    returnWeight = 0.2;     // Reduz muito o retorno
    separationWeight = 0.8; // Aumenta muito a separação
  }
  
  const finalDirection = {
    x: direction.x * returnWeight + separationDirection.x * separationWeight,
    z: direction.z * returnWeight + separationDirection.z * separationWeight
  };
  
  // Normalizar o vetor final
  const finalLength = Math.sqrt(finalDirection.x * finalDirection.x + finalDirection.z * finalDirection.z);
  if (finalLength > 0) {
    finalDirection.x /= finalLength;
    finalDirection.z /= finalLength;
  }
  
  // Calcular nova posição tentativa
  const newPosition = {
    x: monster.position.x + finalDirection.x * monster.stats.moveSpeed,
    y: monster.position.y,
    z: monster.position.z + finalDirection.z * monster.stats.moveSpeed
  };
  
  // Verificar colisão usando o sistema de colisão
  const tempPosition = { ...monster.position };
  monster.position = newPosition;
  
  // Atualizar posição do collidable
  collisionManager.updateCollidablePosition(monster.id, monster.position);
  
  // Verificar colisões
  const collisions = collisionManager.checkEntityCollisions(
    monster.id,
    [COLLIDABLE_TYPES.MONSTER, COLLIDABLE_TYPES.STATIC]
  );
  
  if (collisions.length > 0) {
    // Reverter posição
    monster.position = tempPosition;
    collisionManager.updateCollidablePosition(monster.id, monster.position);
    
    // Tenta uma sequência de posições alternativas em diferentes ângulos
    const possibleAngles = [45, -45, 90, -90, 135, -135];
    let foundValidPosition = false;
    
    for (const angleOffset of possibleAngles) {
      const radians = angleOffset * (Math.PI / 180);
      const cosAngle = Math.cos(radians);
      const sinAngle = Math.sin(radians);
      
      // Rotacionar a direção
      const altDirection = {
        x: finalDirection.x * cosAngle - finalDirection.z * sinAngle,
        z: finalDirection.x * sinAngle + finalDirection.z * cosAngle
      };
      
      // Tentar esta nova direção
      const altPosition = {
        x: tempPosition.x + altDirection.x * monster.stats.moveSpeed,
        y: tempPosition.y,
        z: tempPosition.z + altDirection.z * monster.stats.moveSpeed
      };
      
      // Testar esta posição
      monster.position = altPosition;
      collisionManager.updateCollidablePosition(monster.id, monster.position);
      
      const altCollisions = collisionManager.checkEntityCollisions(
        monster.id,
        [COLLIDABLE_TYPES.MONSTER, COLLIDABLE_TYPES.STATIC]
      );
      
      if (altCollisions.length === 0) {
        // Encontrou posição válida!
        foundValidPosition = true;
        break;
      }
    }
    
    // Se não encontrou posição válida, volta para a posição original
    if (!foundValidPosition) {
      monster.position = tempPosition;
      collisionManager.updateCollidablePosition(monster.id, monster.position);
    }
  }
  
  // Atualiza rotação para olhar para o ponto de spawn
  monster.rotation.y = Math.atan2(finalDirection.x, finalDirection.z);
}

// Função para um monstro atacar um jogador
function attackPlayer(monster, player) {
  // Calcula dano
  const damage = monster.stats.attackDamage;
  
  // Aplica dano
  player.stats.health -= damage;
  
  // Garante que a vida não caia abaixo de 0
  if (player.stats.health < 0) {
    player.stats.health = 0;
  }
  
  // Notifica o cliente - Use ioInstance em vez de io
  ioInstance.emit('playerDamaged', {
    id: player.id,
    health: player.stats.health,
    attackerId: monster.id,
    damage: damage,
    isMonster: true
  });
  
  console.log(`Monstro ${monster.name} atacou jogador ${player.id}! Vida restante: ${player.stats.health}`);
  
  // Verifica se o jogador morreu
  if (player.stats.health <= 0) {
    handlePlayerDeath(player.id, monster.id, ioInstance, true);
  }
}

// Função para jogador atacar monstro
function playerAttackMonster(playerId, monsterId, attackDamage) {
  // Verifica se o monstro existe
  if (!monsters[monsterId]) return false;
  
  const monster = monsters[monsterId];
  
  // Ignora se o monstro já está morto
  if (monster.currentState === 'dead') return false;
  
  // Aplica dano
  monster.stats.health -= attackDamage;
  
  // Notifica clientes
  ioInstance.emit('monsterDamaged', {
    id: monster.id,
    health: monster.stats.health,
    maxHealth: monster.stats.maxHealth,
    attackerId: playerId,
    damage: attackDamage
  });
  
  // Se estiver em idle, altera para chase
  if (monster.currentState === 'idle') {
    monster.targetId = playerId;
    monster.currentState = 'chase';
  }
  
  // Verifica se o monstro morreu
  if (monster.stats.health <= 0) {
    handleMonsterDeath(monster, playerId);
    return true;
  }
  
  return false;
}

// Função para lidar com a morte de um monstro
function handleMonsterDeath(monster, killerId) {
  monster.stats.health = 0;
  monster.currentState = 'dead';

  // Desativar colisão do monstro no servidor
  collisionManager.disableCollisionForEntity(monster.id);
  
  // Notifica os clientes
  ioInstance.emit('monsterDead', {
    id: monster.id,
    killerId: killerId,
    position: monster.position, // Adiciona a posição para melhor tracking
    type: monster.type         // Adiciona o tipo para reações específicas
  });
  
  // Concede experiência ao jogador
  if (players[killerId]) {
    const expGained = monster.stats.expValue;
    players[killerId].stats.experience += expGained;
    
    // Verifica se o jogador subiu de nível
    const prevLevel = players[killerId].stats.level;
    while (players[killerId].stats.experience >= players[killerId].stats.nextLevelExp) {
      // Dá pontos extras ao subir de nível (30 pontos)
      const LEVEL_UP_STAT_POINTS = 30;
      
      // Chama a função levelUp e passa o bônus extra de pontos
      levelUp(players[killerId], LEVEL_UP_STAT_POINTS);
    }
    
    // Notifica o jogador sobre a experiência
    ioInstance.to(killerId).emit('experienceGained', {
      amount: expGained,
      totalExp: players[killerId].stats.experience,
      nextLevelExp: players[killerId].stats.nextLevelExp
    });
    
    // Notifica sobre nível, se mudou
    if (players[killerId].stats.level > prevLevel) {
      ioInstance.to(killerId).emit('levelUp', {
        id: killerId,
        level: players[killerId].stats.level,
        stats: players[killerId].stats,
        statPoints: players[killerId].statPoints
      });
    }
    
    console.log(`Jogador ${killerId} matou ${monster.name} e ganhou ${expGained} exp!`);
  }
  
  // Programa respawn
  const respawnTime = MonsterTypes[monster.type].respawnTime * 1000;
  monster.timers.respawn = setTimeout(() => {
    respawnMonster(monster);
  }, respawnTime);
}

// Função para fazer um monstro renascer
function respawnMonster(monster) {
  // Encontra uma posição livre para respawn
  const respawnPosition = findRespawnPosition(monster.spawnPosition, monsters);
  
  // Reinicia as estatísticas
  const monsterType = MonsterTypes[monster.type];
  monster.stats = { ...monsterType.stats };
  monster.position = { ...respawnPosition };
  monster.currentState = 'idle';
  monster.targetId = null;

  // Reativar colisão do monstro
  collisionManager.enableCollisionForEntity(monster.id);
  
  // Atualizar posição do collidable
  collisionManager.updateCollidablePosition(monster.id, monster.position);
  
  // Notifica os clientes
  ioInstance.emit('monsterSpawned', {
    id: monster.id,
    type: monster.type,
    name: monster.name,
    position: monster.position,
    stats: monster.stats
  });
  
  console.log(`Monstro ${monster.name} (${monster.id}) reapareceu!`);
}

// Adicionar essa verificação ao manipulador de ataques de jogador
function checkPlayerAttackHitMonsters(playerId, position, range, damage) {
  let hitAny = false;
  
  for (const id in monsters) {
    const monster = monsters[id];
    
    // Ignora monstros mortos
    if (monster.currentState === 'dead') continue;
    
    // Calcula distância
    const dx = monster.position.x - position.x;
    const dz = monster.position.z - position.z;
    const distSq = dx * dx + dz * dz;
    
    // Verifica se está no alcance de ataque
    if (distSq <= range * range) {
      playerAttackMonster(playerId, id, damage);
      hitAny = true;
    }
  }
  
  return hitAny;
}

// Modificar a função de obtenção dos dados do jogo para incluir os monstros
function getMonstersData() {
  const monstersData = {};
  
  for (const id in monsters) {
    const monster = monsters[id];
    
    // Só envia dados de monstros vivos
    if (monster.currentState !== 'dead') {
      monstersData[id] = {
        id: monster.id,
        type: monster.type,
        name: monster.name,
        position: monster.position,
        rotation: monster.rotation,
        stats: {
          health: monster.stats.health,
          maxHealth: monster.stats.maxHealth
        },
        state: monster.currentState
      };
    }
  }
  
  return monstersData;
}

// Verifica se há colisão entre dois monstros
function checkMonsterCollision(monster1, monster2) {
  // Skip if either monster is dead
  if (monster1.currentState === 'dead' || monster2.currentState === 'dead') {
    return false;
  }
  
  // Calculate distance between monsters
  const dx = monster1.position.x - monster2.position.x;
  const dz = monster1.position.z - monster2.position.z;
  const distSq = dx * dx + dz * dz;
  
  // Define minimum distance (sum of their radii)
  const minDist = 1.2; // Constant representing monster size
  const minDistSq = minDist * minDist;
  
  // Return true if monsters are too close
  return distSq < minDistSq;
}

function startServerLoop(io) {
  // Armazena a instância io (embora já deva ter sido armazenada)
  ioInstance = io;

  if (serverInterval) clearInterval(serverInterval);
  
  serverInterval = setInterval(() => {
    // Process mana and stamina regeneration for all players
    for (const id in players) {
      const player = players[id];
      
      // Regen mana
      if (player.stats.mana < player.stats.maxMana) {
        player.stats.mana = Math.min(
          player.stats.maxMana, 
          player.stats.mana + (player.stats.manaRegen / 20)
        );
      }
      
      // Regen stamina
      if (player.stats.stamina < player.stats.maxStamina) {
        const agilityBonus = player.stats.agility * 0.1;
        player.stats.stamina = Math.min(
          player.stats.maxStamina,
          player.stats.stamina + ((player.stats.staminaRegen + agilityBonus) / 20)
        );
      }
    }

    // Atualiza os monstros
    updateMonsters();
    
    // Send state updates to all players
    ioInstance.emit('gameState', getPlayersData());
    ioInstance.emit('monstersState', getMonstersData());
  }, 1000 / TICK_RATE);
}

// Adicione esta função ou modifique a existente que verifica colisões de monstros
function checkMonsterMovement(monster, targetPosition) {
  // Verificar colisões, excluindo outros monstros
  const collisions = collisionManager.checkEntityCollisions(
    monster.id, 
    [COLLIDABLE_TYPES.STATIC, COLLIDABLE_TYPES.PLAYER],
    [COLLIDABLE_TYPES.MONSTER] // Excluir colisões com outros monstros
  );
  
  return collisions.length === 0; // Pode mover se não houver colisões
}

module.exports = {
  handlePlayerConnection
};