// Variáveis do jogo
let scene, camera, renderer;
let localPlayer, players = {};
let gameStarted = false;
let projectiles = []; // Lista de projéteis (bolas de fogo, etc)
let mousePosition = new THREE.Vector3(); // Posição atual do mouse no mundo
let raycaster = new THREE.Raycaster(); // Raycaster para selecionar alvo

// Inicializa o jogo
function init() {
  // Inicializa o Three.js
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Céu azul claro
  
  // Configuração da câmera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);
  
  // Configuração do renderizador
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  
  // Inicializa o mundo
  initWorld();
  
  // Inicializa o sistema de entrada
  initInputSystem();
  
  // Inicializa o sistema de chat
  initChatSystem();

  // Inicializa o sistema de HUD
  initHUD();
  
  // Inicializa a rede
  initNetworking(() => {
    // Callback após a conexão ser estabelecida
    hideLoadingScreen();
    gameStarted = true;
    animate();
  });
  
  // Event listener para redimensionamento da janela
  window.addEventListener('resize', onWindowResize);
  
  // Event listener para clique do mouse (magia)
  document.addEventListener('click', onMouseClick);
  
  // Event listener para rastreamento de posição do mouse
  document.addEventListener('mousemove', onMouseMove);
}

// Rastreia a posição do mouse para sistema de mira
function onMouseMove(event) {
  // Ignora se o jogo não iniciou
  if (!gameStarted || !localPlayer) return;
  
  // Se o mouse estiver sobre o chat, ignora
  if (document.activeElement === document.getElementById('chat-input')) return;
  
  // Converte coordenadas do mouse para coordenadas normalizadas (-1 a 1)
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Atualiza o raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Encontra interseção com o plano do chão
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  raycaster.ray.intersectPlane(groundPlane, mousePosition);
}

// Inicializa o HUD do jogo
function initHUD() {
  // Criação do UI para cooldown de magia
  const spellHUD = document.createElement('div');
  spellHUD.id = 'spell-hud';
  document.getElementById('ui-container').appendChild(spellHUD);
  
  // Ícone da magia
  const spellIcon = document.createElement('div');
  spellIcon.id = 'spell-icon';
  spellHUD.appendChild(spellIcon);
  
  // Cooldown da magia
  const spellCooldown = document.createElement('div');
  spellCooldown.id = 'spell-cooldown';
  spellHUD.appendChild(spellCooldown);
}

// Gerencia o clique do mouse para ataques e magias
function onMouseClick(event) {
  // Ignora cliques no chat ou quando o jogo não está iniciado
  if (!gameStarted || !localPlayer || document.activeElement === document.getElementById('chat-input')) {
    return;
  }
  
  // Lógica para botão esquerdo (Magia)
  if (event.button === 0) {
    // Primeiro verificamos se há um jogador sob o cursor
    let targetPlayer = null;
    let closestDistance = Infinity;
    
    // Converte coordenadas do mouse para coordenadas normalizadas (-1 a 1)
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Atualiza o raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Cria um array de meshes de jogadores para verificar interseção
    const playerMeshes = [];
    const playerIds = [];
    
    for (const id in players) {
      if (id === playerId) continue; // Ignora o próprio jogador
      playerMeshes.push(players[id].mesh);
      playerIds.push(id);
    }
    
    // Verifica interseção com jogadores
    const intersects = raycaster.intersectObjects(playerMeshes, true);
    
    if (intersects.length > 0) {
      // Encontrou um jogador sob o cursor
      const intersectedObject = intersects[0].object;
      
      // Encontra o jogador dono deste objeto
      for (let i = 0; i < playerMeshes.length; i++) {
        if (playerMeshes[i] === intersectedObject || playerMeshes[i].children.includes(intersectedObject)) {
          targetPlayer = players[playerIds[i]];
          break;
        }
      }
    }
    
    // Se encontrou um jogador, mira nele, senão usa a posição do mouse no plano
    if (targetPlayer) {
      if (localPlayer.castSpell(targetPlayer.mesh.position)) {
        sendSpellCast(targetPlayer.mesh.position);
        updateSpellCooldownHUD();
      }
    } else {
      if (localPlayer.castSpell(mousePosition)) {
        sendSpellCast(mousePosition);
        updateSpellCooldownHUD();
      }
    }
  }
  
  // Lógica para botão direito (Ataque corpo a corpo)
  else if (event.button === 2) {
    // Primeiro verificamos se há um jogador sob o cursor
    let targetPlayer = null;
    let targetId = null;
    
    // Converte coordenadas do mouse para coordenadas normalizadas (-1 a 1)
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Atualiza o raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Cria um array de meshes de jogadores para verificar interseção
    const playerMeshes = [];
    const playerIds = [];
    
    for (const id in players) {
      if (id === playerId) continue; // Ignora o próprio jogador
      
      // Adiciona tanto o mesh principal quanto as partes individuais
      playerMeshes.push(players[id].mesh);
      playerIds.push(id);
      
      // Adiciona partes do corpo para melhor detecção de colisão
      if (players[id].parts) {
        for (const partKey in players[id].parts) {
          const part = players[id].parts[partKey];
          if (part instanceof THREE.Mesh) {
            playerMeshes.push(part);
            playerIds.push(id);
          } else if (part.left instanceof THREE.Mesh) {
            playerMeshes.push(part.left);
            playerMeshes.push(part.right);
            playerIds.push(id);
            playerIds.push(id);
          }
        }
      }
    }
    
    // Verifica interseção com jogadores
    const intersects = raycaster.intersectObjects(playerMeshes, true);
    
    if (intersects.length > 0) {
      // Encontrou um jogador sob o cursor
      const intersectedObject = intersects[0].object;
      
      // Encontra o jogador dono deste objeto
      let found = false;
      for (let i = 0; i < playerMeshes.length && !found; i++) {
        if (playerMeshes[i] === intersectedObject || 
            (playerMeshes[i].children && playerMeshes[i].children.includes(intersectedObject))) {
          targetId = playerIds[i];
          targetPlayer = players[targetId];
          found = true;
        }
      }
      
      // Se não encontrou o dono, verifica se é uma parte do corpo
      if (!found) {
        for (const id in players) {
          if (id === playerId) continue;
          
          // Verifica todas as partes do corpo
          if (players[id].parts) {
            for (const partKey in players[id].parts) {
              const part = players[id].parts[partKey];
              if (part === intersectedObject || 
                  (part.left && (part.left === intersectedObject || part.right === intersectedObject))) {
                targetId = id;
                targetPlayer = players[id];
                found = true;
                break;
              }
            }
          }
          
          if (found) break;
        }
      }
    }
    
    // Se encontrou um alvo, mira nele e ataca
    if (targetPlayer) {
      localPlayer.attack(targetPlayer.mesh.position);
      
      // Envia ataque direcionado para o servidor
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
    } else {
      // Ataque no ar (direção do mouse)
      localPlayer.attack(mousePosition);
      
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
}

// Atualiza o HUD de cooldown da magia
function updateSpellCooldownHUD() {
  if (!localPlayer) return;
  
  const cooldownElement = document.getElementById('spell-cooldown');
  
  if (localPlayer.spellCooldown > 0) {
    cooldownElement.style.display = 'block';
    cooldownElement.textContent = localPlayer.spellCooldown;
    
    // Atualiza o texto a cada segundo
    const updateCooldown = () => {
      if (localPlayer.spellCooldown > 0) {
        cooldownElement.textContent = localPlayer.spellCooldown;
        setTimeout(updateCooldown, 1000);
      } else {
        cooldownElement.style.display = 'none';
      }
    };
    
    setTimeout(updateCooldown, 1000);
  } else {
    cooldownElement.style.display = 'none';
  }
}

// Esconde a tela de carregamento
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.display = 'none';
}

// Atualiza as dimensões do renderizador quando a janela é redimensionada
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Loop de animação
function animate() {
  requestAnimationFrame(animate);
  
  if (gameStarted && localPlayer) {
    // Atualiza o jogador local
    updateLocalPlayer();

    // Atualiza projéteis
    updateProjectiles();
    
    // Atualiza a câmera para seguir o jogador
    updateCamera();
    
    // Atualiza os balões de chat
    updateChatBubbles();
    
    // Renderiza a cena
    renderer.render(scene, camera);
    
    // Atualiza o UI
    updateUI();
  }
}

// Atualiza todos os projéteis em movimento
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    // Se o update retornar false, remove o projétil
    if (!projectile.update()) {
      projectiles.splice(i, 1);
    }
  }
}

// Atualiza o jogador local com base nas entradas
function updateLocalPlayer() {
  const moveDirection = getMovementDirection();
  
  if (moveDirection.length() > 0) {
    // Tenta mover o jogador, respeitando colisões
    const SPEED = 0.15;
    const moved = localPlayer.move(moveDirection, SPEED, getWorldColliders());
    
    if (moved) {
      // Envia a atualização para o servidor
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
    } else {
      // Se não conseguiu mover, verifica se está preso
      if (localPlayer.checkCollisions(getWorldColliders())) {
        const escaped = localPlayer.escapeCollision(getWorldColliders());
        
        if (escaped) {
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
      }
    }
  }
  
  // Verifica ataques corpo a corpo
  if (isAttacking() && !localPlayer.isAttacking) {
    localPlayer.attack();
    sendPlayerAttack();
  }
}

// Tecla de emergência para situações onde o jogador fica realmente preso
  // Pressionando a tecla 'r' o jogador é transportado para uma posição conhecida segura
  if (isKeyPressed('r')) {
    // Reposiciona o jogador em uma posição segura
    const safePosition = new THREE.Vector3(0, 0, 0);
    localPlayer.mesh.position.copy(safePosition);
    localPlayer.updateCollider();
    localPlayer.lastValidPosition.copy(safePosition);
    
    // Notifica o servidor
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
    
    // Exibe uma mensagem
    addSystemMessage("Você foi teletransportado para uma posição segura.");
  }

// Atualiza a câmera para seguir o jogador
function updateCamera() {
  if (localPlayer) {
    const offset = new THREE.Vector3(0, 8, 10);
    camera.position.copy(localPlayer.mesh.position).add(offset);
    camera.lookAt(localPlayer.mesh.position);
  }
}

// Atualiza os balões de chat de todos os jogadores
function updateChatBubbles() {
  for (const id in players) {
    players[id].updateChatBubblePosition(camera);
  }
}

// Atualiza a interface do usuário
function updateUI() {
  if (localPlayer) {
    const healthFill = document.getElementById('health-fill');
    const healthPercent = (localPlayer.health / 100) * 100;
    healthFill.style.width = `${healthPercent}%`;
  }
}

// Mostra tela de morte para o jogador local
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
  
  // Animação de morte para o jogador local
  localPlayer.die();
  
  // Remove a tela após 5 segundos (tempo de respawn)
  setTimeout(() => {
    document.body.removeChild(deathScreen);
  }, 5000);
}

// Inicializa o jogo quando a página carrega
window.onload = init;