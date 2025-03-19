// Cria o jogador local
function createLocalPlayer(id, position) {
  // Cria a geometria do jogador (um personagem simples feito de cubos)
  const playerGroup = new THREE.Group();
  
  // Corpo
  const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x3498db });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.position.y = 0.75;
  playerGroup.add(bodyMesh);
  
  // Cabeça
  const headGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);
  headMesh.position.y = 1.85;
  playerGroup.add(headMesh);
  
  // Braços
  const armGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
  const armMaterial = new THREE.MeshLambertMaterial({ color: 0x3498db });
  
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.65, 0.75, 0);
  playerGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.65, 0.75, 0);
  playerGroup.add(rightArm);
  
  // Pernas
  const legGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
  
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0, 0);
  playerGroup.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0, 0);
  playerGroup.add(rightLeg);
  
  // Adiciona sombras
  playerGroup.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  
  // Posiciona o jogador
  playerGroup.position.set(position.x, position.y, position.z);
  
  // Adiciona à cena
  scene.add(playerGroup);
  
  // Cria o objeto jogador
  const player = {
    id: id,
    mesh: playerGroup,
    health: 100,
    parts: {
      body: bodyMesh,
      head: headMesh,
      arms: { left: leftArm, right: rightArm },
      legs: { left: leftLeg, right: rightLeg }
    },
    isAttacking: false,
    attackAnimation: null
  };
  
  // Adiciona à lista de jogadores
  players[id] = player;
  
  return player;
}

// Adiciona um jogador remoto
function addRemotePlayer(id, position) {
  // Reutiliza a mesma função de criação do jogador local, mas com cor diferente
  const playerGroup = new THREE.Group();
  
  // Corpo com cor diferente para diferenciar dos outros jogadores
  const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.position.y = 0.75;
  playerGroup.add(bodyMesh);
  
  // Cabeça
  const headGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);
  headMesh.position.y = 1.85;
  playerGroup.add(headMesh);
  
  // Braços
  const armGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
  const armMaterial = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  
  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.65, 0.75, 0);
  playerGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.65, 0.75, 0);
  playerGroup.add(rightArm);
  
  // Pernas
  const legGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
  
  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0, 0);
  playerGroup.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0, 0);
  playerGroup.add(rightLeg);
  
  // Adiciona sombras
  playerGroup.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  
  // Posiciona o jogador
  playerGroup.position.set(position.x, position.y, position.z);
  
  // Adiciona à cena
  scene.add(playerGroup);
  
  // Cria o objeto jogador
  const player = {
    id: id,
    mesh: playerGroup,
    health: 100,
    parts: {
      body: bodyMesh,
      head: headMesh,
      arms: { left: leftArm, right: rightArm },
      legs: { left: leftLeg, right: rightLeg }
    },
    isAttacking: false
  };
  
  // Adiciona à lista de jogadores
  players[id] = player;
  
  return player;
}

// Remove um jogador
function removePlayer(id) {
  if (players[id]) {
    scene.remove(players[id].mesh);
    delete players[id];
  }
}

// Atualiza a posição de um jogador remoto
function updateRemotePlayerPosition(id, position, rotation) {
  if (players[id]) {
    // Aplica interpolação suave para movimento mais fluido
    const player = players[id];
    const mesh = player.mesh;
    
    // Interpola posição
    mesh.position.x += (position.x - mesh.position.x) * 0.3;
    mesh.position.y += (position.y - mesh.position.y) * 0.3;
    mesh.position.z += (position.z - mesh.position.z) * 0.3;
    
    // Interpola rotação
    mesh.rotation.y += (rotation.y - mesh.rotation.y) * 0.3;
  }
}

// Atualiza a saúde do jogador local
function updatePlayerHealth(health) {
  if (localPlayer) {
    localPlayer.health = health;
  }
}

// Executa um ataque
function performAttack() {
  if (localPlayer && !localPlayer.isAttacking) {
    localPlayer.isAttacking = true;
    
    // Animação de ataque (move o braço direito)
    const rightArm = localPlayer.parts.arms.right;
    const originalRotation = rightArm.rotation.x;
    
    // Envia o evento de ataque para o servidor
    sendPlayerAttack();
    
    // Animação simples do braço
    const startAttack = Date.now();
    const attackDuration = 300; // ms
    
    if (localPlayer.attackAnimation) {
      cancelAnimationFrame(localPlayer.attackAnimation);
    }
    
    function animateAttack() {
      const elapsed = Date.now() - startAttack;
      const progress = Math.min(elapsed / attackDuration, 1);
      
      if (progress < 0.5) {
        // Movimento para frente
        rightArm.rotation.x = originalRotation - (Math.PI * 0.8) * (progress * 2);
      } else {
        // Movimento para trás
        rightArm.rotation.x = originalRotation - (Math.PI * 0.8) * (2 - progress * 2);
      }
      
      if (progress < 1) {
        localPlayer.attackAnimation = requestAnimationFrame(animateAttack);
      } else {
        rightArm.rotation.x = originalRotation;
        localPlayer.isAttacking = false;
      }
    }
    
    localPlayer.attackAnimation = requestAnimationFrame(animateAttack);
  }
}

// Mostra ataque de um jogador remoto
function showPlayerAttack(id) {
  if (players[id] && !players[id].isAttacking) {
    players[id].isAttacking = true;
    
    // Animação de ataque (move o braço direito)
    const rightArm = players[id].parts.arms.right;
    const originalRotation = rightArm.rotation.x;
    
    // Animação simples do braço
    const startAttack = Date.now();
    const attackDuration = 300; // ms
    
    function animateAttack() {
      const elapsed = Date.now() - startAttack;
      const progress = Math.min(elapsed / attackDuration, 1);
      
      if (progress < 0.5) {
        // Movimento para frente
        rightArm.rotation.x = originalRotation - (Math.PI * 0.8) * (progress * 2);
      } else {
        // Movimento para trás
        rightArm.rotation.x = originalRotation - (Math.PI * 0.8) * (2 - progress * 2);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateAttack);
      } else {
        rightArm.rotation.x = originalRotation;
        players[id].isAttacking = false;
      }
    }
    
    requestAnimationFrame(animateAttack);
  }
}

// Mostra efeito de dano em um jogador
function showDamageEffect(id) {
  const player = players[id];
  if (player) {
    // Flash vermelho ao receber dano
    const originalColor = id === playerId ? 0x3498db : 0xe74c3c;
    const damagedColor = 0xff0000;
    
    player.parts.body.material.color.setHex(damagedColor);
    player.parts.arms.left.material.color.setHex(damagedColor);
    player.parts.arms.right.material.color.setHex(damagedColor);
    
    // Retorna à cor original após 200ms
    setTimeout(() => {
      player.parts.body.material.color.setHex(originalColor);
      player.parts.arms.left.material.color.setHex(originalColor);
      player.parts.arms.right.material.color.setHex(originalColor);
    }, 200);
  }
}

// Mostra a morte de um jogador remoto
function showPlayerDeath(id) {
  const player = players[id];
  if (player) {
    // Animação simples de morte (faz o jogador cair)
    const mesh = player.mesh;
    
    // Rotaciona o jogador para o lado
    const deathAnimation = () => {
      mesh.rotation.z += 0.05;
      
      if (mesh.rotation.z < Math.PI / 2) {
        requestAnimationFrame(deathAnimation);
      } else {
        mesh.rotation.z = Math.PI / 2;
      }
    };
    
    requestAnimationFrame(deathAnimation);
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
  
  // Animação simples de morte para o jogador local
  localPlayer.mesh.rotation.z = Math.PI / 2;
  
  // Remove a tela após 5 segundos (tempo de respawn)
  setTimeout(() => {
    document.body.removeChild(deathScreen);
  }, 5000);
}

// Respawn do jogador local
function respawnLocalPlayer(position) {
  if (localPlayer) {
    localPlayer.mesh.position.set(position.x, position.y, position.z);
    localPlayer.mesh.rotation.set(0, 0, 0);
    localPlayer.health = 100;
  }
}

// Respawn de um jogador remoto
function respawnRemotePlayer(id, position) {
  if (players[id]) {
    players[id].mesh.position.set(position.x, position.y, position.z);
    players[id].mesh.rotation.set(0, 0, 0);
  }
}
