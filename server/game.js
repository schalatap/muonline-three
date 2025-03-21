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
  
  // Move em direção ao alvo
  moveMonster(monster, target.position);
}

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
  
  // Move em direção ao ponto de spawn
  moveMonster(monster, monster.spawnPosition);
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

function checkMonsterCollisionWithStatics(monsterId, newPosition, includeTypes) {
  // Verificar se o monstro tem um collidable válido
  const monsterCollidable = collisionManager.getCollidableByEntityId(monsterId);
  if (!monsterCollidable || !monsterCollidable.enabled) {
    console.warn(`Monstro ${monsterId} sem collidable válido`);
    return { hasCollision: false };
  }
  
  // Guardar a posição original
  const originalPosition = { ...monsterCollidable.position };
  
  // Atualizar temporariamente a posição para verificar colisão
  collisionManager.updateCollidablePosition(monsterId, newPosition);
  
  // Verificar colisões com os tipos especificados
  const collisions = collisionManager.checkEntityCollisions(monsterId, includeTypes);
  
  // Restaurar a posição original
  collisionManager.updateCollidablePosition(monsterId, originalPosition);
  
  // Se não houver colisões, retornar resultado negativo
  if (collisions.length === 0) {
    return { hasCollision: false };
  }
  
  // Calcular direção de escape combinada de todas as colisões
  let escapeX = 0;
  let escapeZ = 0;
  
  // Identificar tipos de colisão para melhor diagnóstico
  const collidedTypes = new Set();
  const collidedIds = [];
  
  for (const collision of collisions) {
    // Adicionar informações sobre a colisão
    if (collision.collidable) {
      collidedTypes.add(collision.collidable.type);
      collidedIds.push(collision.collidable.id);
    }
    
    // Usar a direção da colisão para calcular escape
    // Se a colisão tiver uma direção, usá-la
    if (collision.direction) {
      escapeX += collision.direction.x;
      escapeZ += collision.direction.z;
    } else {
      // Caso contrário, calcular direção com base na posição relativa
      // (do objeto colidido para o monstro = direção de afastamento)
      const colPos = collision.collidable?.position || { x: 0, z: 0 };
      const offsetX = newPosition.x - colPos.x;
      const offsetZ = newPosition.z - colPos.z;
      
      // Normalizar e adicionar ao vetor de escape
      const length = Math.sqrt(offsetX * offsetX + offsetZ * offsetZ);
      if (length > 0) {
        escapeX += offsetX / length;
        escapeZ += offsetZ / length;
      }
    }
  }
  
  // Normalizar o vetor de escape final
  const escapeLength = Math.sqrt(escapeX * escapeX + escapeZ * escapeZ);
  if (escapeLength > 0) {
    escapeX /= escapeLength;
    escapeZ /= escapeLength;
  }
  
  // Retornar resultado com detalhes
  return {
    hasCollision: true,
    escapeDirection: { x: escapeX, z: escapeZ },
    collisions: collisions,
    collidedTypes: Array.from(collidedTypes),
    collidedIds: collidedIds
  };
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


// Função centralizada para mover monstros com colisões
// Função centralizada para mover monstros com colisões
function moveMonster(monster, targetPosition) {
  // 1. Calcular a direção desejada
  const dx = targetPosition.x - monster.position.x;
  const dz = targetPosition.z - monster.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  
  // Se já está muito próximo do alvo, apenas ajusta a rotação
  if (distance < 0.05) {
    monster.rotation.y = Math.atan2(dx, dz);
    return true;
  }
  
  // Direção normalizada para o alvo
  const direction = { 
    x: dx / distance, 
    z: dz / distance 
  };
  
  // Guardar posição original
  const originalPosition = { ...monster.position };
  
  // Velocidade de movimento
  const speed = monster.stats.moveSpeed;
  
  // Calcular posição alvo direta
  const targetPos = {
    x: originalPosition.x + direction.x * speed,
    y: originalPosition.y,
    z: originalPosition.z + direction.z * speed
  };
  
  // Verificar colisão na posição alvo
  const checkResult = checkMonsterCollisionWithStatics(
    monster.id, 
    targetPos, 
    [COLLIDABLE_TYPES.STATIC]
  );
  
  // Se não há colisão com objetos estáticos, verificar colisão com outros monstros
  if (!checkResult.hasCollision) {
    // Verificação adicional para colisão apenas com monstros
    const monsterCheck = checkMonsterCollisionWithStatics(
      monster.id, 
      targetPos, 
      [COLLIDABLE_TYPES.MONSTER]
    );
    
    if (!monsterCheck.hasCollision) {
      // Caminho livre, movimento direto
      monster.position = targetPos;
      collisionManager.updateCollidablePosition(monster.id, targetPos);
      monster.rotation.y = Math.atan2(direction.x, direction.z);
      return true;
    } else {
      // Colisão com outros monstros - aplicar separação suave
      // Usar direção de escape para evitar outros monstros
      const escapeDir = monsterCheck.escapeDirection;
      const combinedDir = {
        x: direction.x * 0.7 + escapeDir.x * 0.3,  // Ponderação: 70% direção original, 30% escape
        z: direction.z * 0.7 + escapeDir.z * 0.3
      };
      
      // Normalizar direção combinada
      const combLength = Math.sqrt(combinedDir.x * combinedDir.x + combinedDir.z * combinedDir.z);
      if (combLength > 0) {
        combinedDir.x /= combLength;
        combinedDir.z /= combLength;
      }
      
      // Tentar movimento com separação
      const separatedPos = {
        x: originalPosition.x + combinedDir.x * speed * 0.8, // Velocidade reduzida para suavidade
        y: originalPosition.y,
        z: originalPosition.z + combinedDir.z * speed * 0.8
      };
      
      // Verificar se a posição com separação é válida
      if (!checkMonsterCollisionWithStatics(monster.id, separatedPos, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
        monster.position = separatedPos;
        collisionManager.updateCollidablePosition(monster.id, separatedPos);
        monster.rotation.y = Math.atan2(direction.x, direction.z); // Mantém olhando para o alvo
        return true;
      }
    }
  }
  
  // Estratégia 1: Tentar movimento apenas no eixo X
  const tryX = {
    x: originalPosition.x + direction.x * speed,
    y: originalPosition.y,
    z: originalPosition.z
  };
  
  if (!checkMonsterCollisionWithStatics(monster.id, tryX, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
    monster.position = tryX;
    collisionManager.updateCollidablePosition(monster.id, tryX);
    monster.rotation.y = Math.atan2(direction.x, direction.z);
    return true;
  }
  
  // Estratégia 2: Tentar movimento apenas no eixo Z
  const tryZ = {
    x: originalPosition.x,
    y: originalPosition.y,
    z: originalPosition.z + direction.z * speed
  };
  
  if (!checkMonsterCollisionWithStatics(monster.id, tryZ, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
    monster.position = tryZ;
    collisionManager.updateCollidablePosition(monster.id, tryZ);
    monster.rotation.y = Math.atan2(direction.x, direction.z);
    return true;
  }
  
  // Estratégia 3: Tentar deslizar ao longo da parede/obstáculo
  // Calcular vetor perpendicular (ambas as direções)
  const perpPos1 = {
    x: originalPosition.x - direction.z * speed * 0.8,
    y: originalPosition.y,
    z: originalPosition.z + direction.x * speed * 0.8
  };
  
  const perpPos2 = {
    x: originalPosition.x + direction.z * speed * 0.8,
    y: originalPosition.y,
    z: originalPosition.z - direction.x * speed * 0.8
  };
  
  // Tentar primeira direção perpendicular
  if (!checkMonsterCollisionWithStatics(monster.id, perpPos1, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
    monster.position = perpPos1;
    collisionManager.updateCollidablePosition(monster.id, perpPos1);
    monster.rotation.y = Math.atan2(direction.x, direction.z); // Mantém olhando para o alvo
    return true;
  }
  
  // Tentar segunda direção perpendicular
  if (!checkMonsterCollisionWithStatics(monster.id, perpPos2, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
    monster.position = perpPos2;
    collisionManager.updateCollidablePosition(monster.id, perpPos2);
    monster.rotation.y = Math.atan2(direction.x, direction.z); // Mantém olhando para o alvo
    return true;
  }
  
  // Estratégia 4: Usar a direção de escape da colisão para tentar sair do obstáculo
  if (checkResult.hasCollision && checkResult.escapeDirection) {
    const escapePos = {
      x: originalPosition.x + checkResult.escapeDirection.x * speed * 0.5,
      y: originalPosition.y,
      z: originalPosition.z + checkResult.escapeDirection.z * speed * 0.5
    };
    
    if (!checkMonsterCollisionWithStatics(monster.id, escapePos, [COLLIDABLE_TYPES.STATIC]).hasCollision) {
      monster.position = escapePos;
      collisionManager.updateCollidablePosition(monster.id, escapePos);
      // Ainda olha para o alvo, mas se move na direção de escape
      monster.rotation.y = Math.atan2(direction.x, direction.z);
      return true;
    }
  }
  
  // Se nenhuma estratégia funcionou, apenas rotaciona mas não move
  monster.rotation.y = Math.atan2(direction.x, direction.z);
  return false;
}

module.exports = {
  handlePlayerConnection
};