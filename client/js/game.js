// Core game variables
let scene, camera, renderer;
let localPlayer, players = {};
let gameStarted = false;
let projectiles = [];
let worldMousePosition = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let selectedTarget = null; // Currently selected target
let targetIndicator; // Visual indicator for selected target

// Initialize the game
function init() {
  // Initialize Three.js
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Light blue sky
  
  // Camera setup
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  
  // Renderer setup
  renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('game-canvas'), 
    antialias: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  
  // Inicializar o sistema de colisão
  initCollisionSystem();
  
  // Initialize subsystems
  initWorld();
  initInputSystem();
  initChatSystem();
  initUI();
  initTargetIndicator();
  
  // Create experience bar
  createExpBar();
  
  // Initialize networking
  initNetworking(() => {
    // Callback after connection established
    hideLoadingScreen();
    gameStarted = true;
    animate();
  });
  
  // Event listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('click', onMouseClick);
  document.addEventListener('mousemove', onMouseMoveWorld);
  document.addEventListener('keydown', handleKeydown);
  
  // Add stats toggle listener
  const toggleStatsButton = document.getElementById('toggle-stats');
  if (toggleStatsButton) {
    toggleStatsButton.addEventListener('click', () => {
      const statsPanel = document.getElementById('stats-panel');
      if (statsPanel) {
        statsPanel.classList.toggle('visible');
      }
    });
  }
}

// Função para inicializar o sistema de colisão
function initCollisionSystem() {
  console.log("Inicializando sistema de colisão unificado");
  
  // Verificar se o script collision.js foi carregado
  if (typeof window.CollisionSystem === 'undefined') {
    console.error("ERRO CRÍTICO: Sistema de colisão não encontrado. Verifique se collision.js foi carregado corretamente.");
    // Exibir mensagem ao usuário
    const errorMsg = document.createElement('div');
    errorMsg.style.position = 'absolute';
    errorMsg.style.top = '10px';
    errorMsg.style.left = '10px';
    errorMsg.style.color = 'red';
    errorMsg.style.background = 'black';
    errorMsg.style.padding = '10px';
    errorMsg.style.zIndex = '9999';
    errorMsg.textContent = 'Erro ao carregar sistema de colisão. Recarregue a página ou contate o suporte.';
    document.body.appendChild(errorMsg);
    return;
  }
  
  // Usar o método unificado para obter o gerenciador de colisões
  window.CollisionSystem.collisionManager = window.CollisionSystem.getCollisionManager();
  console.log("Sistema de colisão inicializado com sucesso");
}

// Create experience bar
function createExpBar() {
  // Create experience bar if not exists
  if (!document.getElementById('exp-bar')) {
    const expBar = document.createElement('div');
    expBar.id = 'exp-bar';
    
    const expFill = document.createElement('div');
    expFill.id = 'exp-fill';
    
    expBar.appendChild(expFill);
    document.body.appendChild(expBar);
  }
}

// Update experience bar
function updateExpBar() {
  if (!localPlayer || !localPlayer.stats) return;
  
  const expFill = document.getElementById('exp-fill');
  if (!expFill) return;
  
  const expPercentage = (localPlayer.stats.experience / localPlayer.stats.nextLevelExp) * 100;
  expFill.style.width = `${expPercentage}%`;
}

// Initialize the target selection indicator
function initTargetIndicator() {
  targetIndicator = document.getElementById('target-indicator');
}

// Track mouse position in world
function onMouseMoveWorld(event) {
  if (!gameStarted || !localPlayer) return;
  
  // Ignore if mouse is over chat input
  if (document.activeElement === document.getElementById('chat-input')) return;
  
  // Convert mouse coordinates to normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Update raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Primeiro verifica se há monstros sob o cursor
  const monsterMeshes = [];
  const monsterIds = [];
  
  for (const id in monsters) {
    if (monsters[id].mesh) {
      monsterMeshes.push(monsters[id].mesh);
      monsterIds.push(id);
      
      // Adiciona também todas as partes do monstro para melhorar a detecção
      if (monsters[id].parts) {
        if (monsters[id].parts.body) {
          monsterMeshes.push(monsters[id].parts.body);
          monsterIds.push(id);
        }
        if (monsters[id].parts.head) {
          monsterMeshes.push(monsters[id].parts.head);
          monsterIds.push(id);
        }
        if (monsters[id].parts.legs) {
          if (monsters[id].parts.legs.left) {
            monsterMeshes.push(monsters[id].parts.legs.left);
            monsterIds.push(id);
          }
          if (monsters[id].parts.legs.right) {
            monsterMeshes.push(monsters[id].parts.legs.right);
            monsterIds.push(id);
          }
        }
      }
    }
  }
  
  let intersects = raycaster.intersectObjects(monsterMeshes, true);
  
  if (intersects.length > 0) {
    // Encontrou um monstro sob o cursor
    const intersectedObject = intersects[0].object;
    let foundMonster = false;
    
    // Tenta encontrar o monstro dono desta mesh
    for (let i = 0; i < monsterMeshes.length; i++) {
      if (monsterMeshes[i] === intersectedObject || 
          (monsterMeshes[i].children && monsterMeshes[i].children.includes(intersectedObject))) {
        const monsterId = monsterIds[i];
        const targetMonster = monsters[monsterId];
        
        if (targetMonster) {
          updateTargetIndicator(targetMonster);
          selectedTarget = targetMonster;
          foundMonster = true;
          break;
        }
      }
    }
    
    if (foundMonster) return;
  }
  
  // Se não encontrou monstro, verifica jogadores
  const playerMeshes = [];
  const playerIds = [];
  
  for (const id in players) {
    if (id === playerId) continue; // Skip local player
    playerMeshes.push(players[id].mesh);
    playerIds.push(id);
    
    // Adiciona também todas as partes do jogador para melhorar a detecção
    if (players[id].parts) {
      if (players[id].parts.body) {
        playerMeshes.push(players[id].parts.body);
        playerIds.push(id);
      }
      if (players[id].parts.head) {
        playerMeshes.push(players[id].parts.head);
        playerIds.push(id);
      }
      if (players[id].parts.arms) {
        if (players[id].parts.arms.left) {
          playerMeshes.push(players[id].parts.arms.left);
          playerIds.push(id);
        }
        if (players[id].parts.arms.right) {
          playerMeshes.push(players[id].parts.arms.right);
          playerIds.push(id);
        }
      }
      if (players[id].parts.legs) {
        if (players[id].parts.legs.left) {
          playerMeshes.push(players[id].parts.legs.left);
          playerIds.push(id);
        }
        if (players[id].parts.legs.right) {
          playerMeshes.push(players[id].parts.legs.right);
          playerIds.push(id);
        }
      }
    }
  }
  
  intersects = raycaster.intersectObjects(playerMeshes, true);
  
  if (intersects.length > 0) {
    // Found a player under cursor - highlight them
    const intersectedObject = intersects[0].object;
    let foundPlayer = false;
    
    for (let i = 0; i < playerMeshes.length; i++) {
      if (playerMeshes[i] === intersectedObject || 
          (playerMeshes[i].children && playerMeshes[i].children.includes(intersectedObject))) {
        const targetId = playerIds[i];
        
        if (players[targetId]) {
          updateTargetIndicator(players[targetId]);
          selectedTarget = players[targetId];
          foundPlayer = true;
          break;
        }
      }
    }
    
    if (foundPlayer) return;
  }
  
  // If no player or monster under cursor, find intersection with ground
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  raycaster.ray.intersectPlane(groundPlane, worldMousePosition);
  
  // Hide target indicator
  hideTargetIndicator();
  selectedTarget = null;
}

// Update target indicator position
function updateTargetIndicator(target) {
  if (!targetIndicator || !target) return;
  
  // Project target position to screen coordinates
  const screenPosition = target.mesh.position.clone();
  screenPosition.y += 2; // Above target's head
  screenPosition.project(camera);
  
  // Convert to CSS coordinates
  const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
  
  // Adaptative size based on target type and distance
  let baseSize;
  
  // Identifica se é monstro ou jogador e ajusta tamanho
  if (target.id && (target.id.includes('goblin_') || target.id.includes('wolf_'))) {
    // Tamanho base para monstros (menores)
    baseSize = 24;
    
    // Ajusta ainda mais baseado no tipo específico
    if (target.type === 'GOBLIN') {
      baseSize = 22; // Goblins são menores
    } else if (target.type === 'WOLF') {
      baseSize = 26; // Lobos são um pouco maiores
    }
  } else {
    // Tamanho base para jogadores (maiores)
    baseSize = 30;
  }
  
  // Ajuste baseado na distância (perspective)
  const distance = camera.position.distanceTo(target.mesh.position);
  const perspectiveAdjust = 15 / Math.max(1, distance / 10);
  
  // Tamanho final com todos os ajustes
  const size = Math.max(15, baseSize + perspectiveAdjust);
  
  // Update indicator style
  targetIndicator.style.display = 'block';
  targetIndicator.style.left = `${x - size/2}px`;
  targetIndicator.style.top = `${y - size/2}px`;
  targetIndicator.style.width = `${size}px`;
  targetIndicator.style.height = `${size}px`;
  
  // Ajusta cor do indicador baseado no tipo de alvo
  if (target.id && (target.id.includes('goblin_') || target.id.includes('wolf_'))) {
    targetIndicator.style.borderColor = '#e74c3c'; // Vermelho para monstros
  } else {
    targetIndicator.style.borderColor = '#3498db'; // Azul para jogadores
  }
  
  // Store selected target
  selectedTarget = target;
}

// Hide target indicator
function hideTargetIndicator() {
  if (targetIndicator) {
    targetIndicator.style.display = 'none';
  }
  selectedTarget = null;
}

// Initialize UI elements
function initUI() {
  // Ensure basic UI elements exist
  if (!document.getElementById('health-fill')) {
    console.error('Health bar not found in DOM');
  }
  
  if (!document.getElementById('mana-fill')) {
    console.error('Mana bar not found in DOM');
  }
  
  if (!document.getElementById('stamina-fill')) {
    console.error('Stamina bar not found in DOM');
  }
  
  // Initialize spell UI
  updateSpellUI();
}

// Update spell UI to reflect current mana and cooldowns
function updateSpellUI() {
  if (!localPlayer) return;
  
  // Update each spell in the bar
  const spellBar = document.getElementById('spell-bar');
  
  // Check if the player has enough mana for each spell
  for (const spellName in localPlayer.spells) {
    const spell = localPlayer.spells[spellName];
    const spellElement = document.getElementById(`spell-${spellName}`);
    
    if (spellElement) {
      // Check mana availability
      const hasEnoughMana = localPlayer.stats.mana >= spell.manaCost;
      if (hasEnoughMana) {
        spellElement.classList.remove('disabled');
      } else {
        spellElement.classList.add('disabled');
      }
      
      // Update cooldown visualization
      const cooldownMask = spellElement.querySelector('.spell-cooldown-mask');
      if (cooldownMask) {
        const now = Date.now();
        const timeSinceLastCast = (now - spell.lastCast) / 1000;
        
        if (timeSinceLastCast < spell.cooldown) {
          // Calculate cooldown progress
          const cooldownProgress = timeSinceLastCast / spell.cooldown;
          const degrees = 360 * cooldownProgress;
          
          // Update mask position
          cooldownMask.style.display = 'block';
          cooldownMask.style.transform = `rotate(${degrees}deg)`;
        } else {
          cooldownMask.style.display = 'none';
        }
      }
    }
  }
}

// Handle mouse clicks for attacks and spells
function onMouseClick(event) {
  if (!gameStarted || !localPlayer || document.activeElement === document.getElementById('chat-input')) {
    return;
  }
  
  // Left click for spells
  if (event.button === 0) {
    castSpellAtTarget(event);
  }
  // Right click for melee attack
  else if (event.button === 2) {
    performMeleeAttack(event);
  }
}

// Cast spell at target or position
function castSpellAtTarget(event) {
  // Ignora se não tiver mana ou vigor suficientes
  const spell = localPlayer.spells.fireball;
  if (localPlayer.stats.mana < spell.manaCost) {
    addSystemMessage("Mana insuficiente!");
    return;
  }
  
  const STAMINA_COST = 5;
  if (localPlayer.stats.stamina < STAMINA_COST) {
    addSystemMessage("Vigor insuficiente para lançar magia!");
    return;
  }
  
  // First check if we have a selected target
  if (selectedTarget) {
    if (localPlayer.castSpell(selectedTarget.mesh.position)) {
      sendSpellCast(selectedTarget.mesh.position);
    }
  } else {
    // Otherwise cast at mouse position on ground
    if (localPlayer.castSpell(worldMousePosition)) {
      sendSpellCast(worldMousePosition);
    }
  }
}

// Perform melee attack at target or position
function performMeleeAttack(event) {
  // Ignora se não tiver vigor suficiente
  const STAMINA_COST = 10;
  if (localPlayer.stats.stamina < STAMINA_COST) {
    addSystemMessage("Vigor insuficiente para atacar!");
    return;
  }
  
  // Check if we have a selected target
  if (selectedTarget) {
    // Verificar se o alvo é um monstro ou jogador
    if (selectedTarget.id && (selectedTarget.id.includes('goblin_') || selectedTarget.id.includes('wolf_'))) {
      // É um monstro
      localPlayer.attack(selectedTarget.mesh.position);
      
      // Envia ataque direcionado para o servidor
      sendPlayerAttack({
        targetId: selectedTarget.id,
        position: {
          x: localPlayer.mesh.position.x,
          y: localPlayer.mesh.position.y,
          z: localPlayer.mesh.position.z
        },
        rotation: {
          y: localPlayer.mesh.rotation.y
        }
      });
    } else {
      // É um jogador (código original)
      const targetId = Object.keys(players).find(id => players[id] === selectedTarget);
      
      localPlayer.attack(selectedTarget.mesh.position);
      
      // Envia ataque para o servidor
      sendPlayerAttack({
        targetId: targetId,
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
  } else {
    // Ataque no ar (direção do mouse)
    localPlayer.attack(worldMousePosition);
    
    // Envia ataque normal para o servidor
    sendPlayerAttack({
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

// Handle keyboard inputs
function handleKeydown(event) {
  // Emergency teleport (for getting unstuck)
  if (event.key === 'r' && localPlayer) {
    const safePosition = new THREE.Vector3(0, 0, 0);
    localPlayer.mesh.position.copy(safePosition);
    localPlayer.updateCollider();
    localPlayer.lastValidPosition.copy(safePosition);
    
    sendPlayerMove({
      position: {
        x: localPlayer.mesh.position.x,
        y: localPlayer.mesh.position.y,
        z: localPlayer.mesh.position.z
      },
      rotation: {
        y: localPlayer.mesh.rotation.y
      }
    });
    
    addSystemMessage("Você foi teletransportado para uma posição segura.");
  }
  
  // Number keys for spell selection (1-9)
  if (!isNaN(parseInt(event.key)) && parseInt(event.key) >= 1 && parseInt(event.key) <= 9) {
    // Select corresponding spell (implement spell selection logic here)
    console.log(`Selected spell slot ${event.key}`);
  }
}

// Hide loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.display = 'none';
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Main animation loop
function animate() {
  requestAnimationFrame(animate);
  
  if (gameStarted && localPlayer) {
    // Update local player
    updateLocalPlayer();
    
    // Update projectiles
    updateProjectiles();
    
    // Atualiza animações de monstros
    animateMonsters();
    
    // Update camera
    updateCamera();
    
    // Update chat bubbles
    updateChatBubbles();
    
    // Atualiza UI de monstros
    updateMonstersUI(camera);
    
    // Update UI
    updateUI();
    
    // Update experience bar
    updateExpBar();
    
    // Update target indicator if target exists
    if (selectedTarget) {
      updateTargetIndicator(selectedTarget);
    }
    
    // Render scene
    renderer.render(scene, camera);
  }
}

// Update all projectiles
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    // If update returns false, remove the projectile
    if (!projectile.update()) {
      projectiles.splice(i, 1);
    }
  }
}

// Função auxiliar para obter todos os colliders ativos
// Simplificada para usar apenas o sistema unificado
function getAllColliders() {
  if (window.CollisionSystem && window.CollisionSystem.collisionManager) {
    return window.CollisionSystem.collisionManager.getActiveColliderBoxes();
  }
  return [];
}

// Update local player based on inputs
function updateLocalPlayer() {
  const moveDirection = getMovementDirection();
  
  if (moveDirection.length() > 0) {
    // Tenta mover o jogador, respeitando colisões
    const SPEED = localPlayer.moveSpeed || 0.15;
    
    // Verificar se o player existe e tem método move
    if (localPlayer && typeof localPlayer.move === 'function') {
      // Move usa apenas o sistema unificado internamente
      const moved = localPlayer.move(moveDirection, SPEED);
      
      if (moved) {
        // Enviar atualização para o servidor
        sendPlayerMove({
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
    } else {
      console.error("Player não está disponível ou não tem método move");
    }
  } else if (localPlayer && typeof localPlayer.resetLegsPosition === 'function') {
    // Se não estiver se movendo, resetar animação das pernas
    localPlayer.resetLegsPosition();
  }
  
  // Check for melee attacks - MANTER ESTE TRECHO
  if (isAttacking() && !localPlayer.isAttacking) {
    // Check if we have enough stamina
    const STAMINA_COST = 10;
    if (localPlayer.stats.stamina >= STAMINA_COST) {
      localPlayer.attack();
      localPlayer.stats.stamina -= STAMINA_COST;
      localPlayer.updateUI();
      sendPlayerAttack();
    } else {
      addSystemMessage("Vigor insuficiente para atacar!");
    }
  }
}

// Update camera position
function updateCamera() {
  if (localPlayer) {
    const offset = new THREE.Vector3(0, 8, 10);
    camera.position.copy(localPlayer.mesh.position).add(offset);
    camera.lookAt(localPlayer.mesh.position);
  }
}

// Update chat bubble positions
function updateChatBubbles() {
  for (const id in players) {
    players[id].updateChatBubblePosition(camera);
  }
}

// Update UI elements
function updateUI() {
  if (localPlayer) {
    // Update health and mana bars
    const healthFill = document.getElementById('health-fill');
    const healthPercent = (localPlayer.stats.health / localPlayer.stats.maxHealth) * 100;
    healthFill.style.width = `${healthPercent}%`;
    
    const manaFill = document.getElementById('mana-fill');
    const manaPercent = (localPlayer.stats.mana / localPlayer.stats.maxMana) * 100;
    manaFill.style.width = `${manaPercent}%`;
    
    const staminaFill = document.getElementById('stamina-fill');
    const staminaPercent = (localPlayer.stats.stamina / localPlayer.stats.maxStamina) * 100;
    staminaFill.style.width = `${staminaPercent}%`;
    
    // Update spell cooldowns
    updateSpellUI();
    
    // Update stats display if panel is visible
    const statsPanel = document.getElementById('stats-panel');
    if (statsPanel && statsPanel.classList.contains('visible')) {
      updateStatsUI();
    }
    
    // Update derived stat displays
    document.getElementById('health-max-value').textContent = 
      `${Math.floor(localPlayer.stats.health)}/${localPlayer.stats.maxHealth}`;
    document.getElementById('mana-max-value').textContent = 
      `${Math.floor(localPlayer.stats.mana)}/${localPlayer.stats.maxMana}`;
    document.getElementById('stamina-max-value').textContent = 
      `${Math.floor(localPlayer.stats.stamina)}/${localPlayer.stats.maxStamina}`;
  }
}

// Show death screen for local player
function showDeathScreen() {
  const deathScreen = document.createElement('div');
  deathScreen.id = 'death-screen';
  deathScreen.style.position = 'absolute';
  deathScreen.style.top = '0';
  deathScreen.style.left = '0';
  deathScreen.style.width = '100%';
  deathScreen.style.height = '100%';
  deathScreen.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
  deathScreen.style.display = 'flex';
  deathScreen.style.justifyContent = 'center';
  deathScreen.style.alignItems = 'center';
  deathScreen.style.color = 'white';
  deathScreen.style.fontSize = '36px';
  deathScreen.style.textShadow = '2px 2px 4px black';
  deathScreen.style.zIndex = '1000';
  deathScreen.textContent = 'Você morreu! Respawnando em 5 segundos...';
  
  document.body.appendChild(deathScreen);
  
  // Death animation
  localPlayer.die();
  
  // Remove screen after 5 seconds
  setTimeout(() => {
    document.body.removeChild(deathScreen);
  }, 5000);
}

// Show experience gain notification
function showExperienceGain(amount) {
  const expElement = document.createElement('div');
  expElement.className = 'exp-gain';
  expElement.textContent = `+${amount} XP`;
  
  // Position in center-bottom of screen
  expElement.style.left = '50%';
  expElement.style.bottom = '100px';
  expElement.style.transform = 'translateX(-50%)';
  
  document.body.appendChild(expElement);
  
  // Remove after animation completes
  setTimeout(() => {
    document.body.removeChild(expElement);
  }, 2000);
}

// Initialize game on page load
window.onload = init;