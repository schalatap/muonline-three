// Classe para gerenciar jogadores
class Player {
  constructor(id, position, isLocal = false) {
    this.id = id;
    this.health = 100;
    this.isLocal = isLocal;
    this.isAttacking = false;
    this.isCastingSpell = false;
    this.attackAnimation = null;
    this.spellCooldown = 0;
    this.mesh = this.createPlayerMesh(isLocal);
    
    // Posiciona o jogador
    this.mesh.position.set(position.x, position.y, position.z);
    
    // Adiciona à cena
    scene.add(this.mesh);
    
    // Propriedades físicas do jogador
    this.radius = 0.5; // Raio de colisão do jogador
    this.height = 1.8; // Altura do jogador para colisões
    
    // Cria um collider para o jogador - usamos uma caixa mais ajustada ao corpo
    this.updateCollider();
    
    // Cria um balão de chat
    this.createChatBubble();
    
    // Armazena a última posição válida para caso de colisão
    this.lastValidPosition = new THREE.Vector3(position.x, position.y, position.z);

    // Constantes de ataque
    this.MELEE_ATTACK_RANGE = 2; // Alcance do ataque corpo a corpo
    this.MELEE_ATTACK_DAMAGE = 10; // Dano do ataque corpo a corpo
  }
  
  createPlayerMesh(isLocal) {
    // Cria a geometria do jogador (um personagem simples feito de cubos)
    const playerGroup = new THREE.Group();
    
    // Escolhe a cor com base no tipo de jogador (local ou remoto)
    const bodyColor = isLocal ? 0x3498db : 0xe74c3c;
    
    // Corpo
    const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
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
    const armMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    
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
    
    // Armazena as partes do corpo para referência futura
    this.parts = {
      body: bodyMesh,
      head: headMesh,
      arms: { left: leftArm, right: rightArm },
      legs: { left: leftLeg, right: rightLeg }
    };
    
    return playerGroup;
  }
  
  createChatBubble() {
    // Cria o elemento de balão de chat
    const chatBubble = document.createElement('div');
    chatBubble.className = 'chat-bubble';
    chatBubble.style.display = 'none';
    document.body.appendChild(chatBubble);
    
    this.chatBubble = chatBubble;
  }
  
  // Atualiza a posição do collider
  updateCollider() {
    // Usando uma caixa de colisão um pouco menor que o modelo visual para permitir movimento mais suave
    const colliderWidth = 0.8; // Mais estreito que o modelo visual
    const colliderDepth = 0.4; // Mais fino na profundidade
    
    // Cria uma caixa de colisão personalizada baseada na posição atual
    this.collider = new THREE.Box3(
      new THREE.Vector3(
        this.mesh.position.x - colliderWidth/2,
        this.mesh.position.y,
        this.mesh.position.z - colliderDepth/2
      ),
      new THREE.Vector3(
        this.mesh.position.x + colliderWidth/2,
        this.mesh.position.y + this.height,
        this.mesh.position.z + colliderDepth/2
      )
    );
  }
  
// Tenta mover para uma nova posição, respeitando colisões
move(direction, speed, worldColliders) {
  if (direction.length() === 0) return false;
  
  // Normaliza e aplica a velocidade
  direction.normalize();
  
  // Implementação de sliding - tentamos mover em X e Z separadamente
  let moved = false;
  
  // Salva a posição original antes de tentar mover
  const originalX = this.mesh.position.x;
  const originalZ = this.mesh.position.z;
  
  // Tenta mover em X
  if (Math.abs(direction.x) > 0.01) {
    const newPositionX = originalX + direction.x * speed;
    this.mesh.position.x = newPositionX;
    this.updateCollider();
    
    // Se houver colisão, volta para a posição original em X
    if (this.checkCollisions(worldColliders)) {
      this.mesh.position.x = originalX;
      this.updateCollider();
    } else {
      moved = true;
    }
  }
  
  // Tenta mover em Z
  if (Math.abs(direction.z) > 0.01) {
    const newPositionZ = originalZ + direction.z * speed;
    this.mesh.position.z = newPositionZ;
    this.updateCollider();
    
    // Se houver colisão, volta para a posição original em Z
    if (this.checkCollisions(worldColliders)) {
      this.mesh.position.z = originalZ;
      this.updateCollider();
    } else {
      moved = true;
    }
  }
  
  // Se conseguimos mover em qualquer direção, atualizamos a rotação e a última posição válida
  if (moved) {
    // Atualiza a rotação se estiver se movendo
    const angle = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.y = angle;
    
    // Atualiza a última posição válida
    this.lastValidPosition.copy(this.mesh.position);
  } else if (this.checkCollisions(worldColliders)) {
    // Se ainda estiver em colisão (caso raro), retornamos à última posição válida
    // Isso impede que o jogador fique preso
    this.mesh.position.copy(this.lastValidPosition);
    this.updateCollider();
  }
  
  return moved;
}

// Método auxiliar para verificar colisões
checkCollisions(worldColliders) {
  // Verifica colisão com objetos do mundo
  for (const collider of worldColliders) {
    if (this.collider.intersectsBox(collider)) {
      return true;
    }
  }
  
  // Verifica colisão com outros jogadores
  for (const id in players) {
    if (id !== this.id) {
      if (this.collider.intersectsBox(players[id].collider)) {
        return true;
      }
    }
  }
  
  return false;
}

// Método para escapar de colisões (usado em casos onde o jogador fica preso)
escapeCollision(worldColliders) {
  // Direções para tentar escapar
  const escapeDirections = [
    new THREE.Vector3(1, 0, 0),   // +X
    new THREE.Vector3(-1, 0, 0),  // -X
    new THREE.Vector3(0, 0, 1),   // +Z
    new THREE.Vector3(0, 0, -1),  // -Z
    new THREE.Vector3(1, 0, 1).normalize(),    // +X+Z
    new THREE.Vector3(-1, 0, 1).normalize(),   // -X+Z
    new THREE.Vector3(1, 0, -1).normalize(),   // +X-Z
    new THREE.Vector3(-1, 0, -1).normalize()   // -X-Z
  ];
  
  // Tenta cada direção para escapar
  for (const dir of escapeDirections) {
    const testPos = new THREE.Vector3().copy(this.mesh.position);
    testPos.add(dir.multiplyScalar(0.5)); // Tenta mover 0.5 unidades
    
    // Testa colisão na nova posição
    const tempMesh = this.mesh.clone();
    tempMesh.position.copy(testPos);
    
    const tempCollider = new THREE.Box3();
    tempCollider.setFromObject(tempMesh);
    
    let hasCollision = false;
    
    // Verifica todas as colisões
    for (const collider of worldColliders) {
      if (tempCollider.intersectsBox(collider)) {
        hasCollision = true;
        break;
      }
    }
    
    for (const id in players) {
      if (id !== this.id && !hasCollision) {
        if (tempCollider.intersectsBox(players[id].collider)) {
          hasCollision = true;
          break;
        }
      }
    }
    
    // Se não tiver colisão, move para essa posição
    if (!hasCollision) {
      this.mesh.position.copy(testPos);
      this.updateCollider();
      this.lastValidPosition.copy(testPos);
      return true;
    }
  }
  
  return false;
}
  
  // Executa um ataque corpo a corpo
  attack(targetPosition = null) {
    if (this.isAttacking) return;
    
    this.isAttacking = true;
    
    // Se temos uma posição alvo, rotaciona o jogador para ela
    if (targetPosition && this.isLocal) {
      // Calcula o ângulo para o alvo
      const direction = new THREE.Vector2(
        targetPosition.x - this.mesh.position.x,
        targetPosition.z - this.mesh.position.z
      ).normalize();
      
      // Atualiza a rotação do jogador
      const targetAngle = Math.atan2(direction.x, direction.y);
      this.mesh.rotation.y = targetAngle;
      
      // Envia a atualização de rotação para o servidor
      sendPlayerMove({
        position: {
          x: this.mesh.position.x,
          y: this.mesh.position.y,
          z: this.mesh.position.z
        },
        rotation: {
          y: this.mesh.rotation.y
        }
      });
    }
    
    // Animação de ataque (move o braço direito)
    const rightArm = this.parts.arms.right;
    const originalRotation = rightArm.rotation.x;
    
    // Animação simples do braço
    const startAttack = Date.now();
    const attackDuration = 300; // ms
    
    if (this.attackAnimation) {
      cancelAnimationFrame(this.attackAnimation);
    }
    
    const animateAttack = () => {
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
        this.attackAnimation = requestAnimationFrame(animateAttack);
      } else {
        rightArm.rotation.x = originalRotation;
        this.isAttacking = false;
      }
    };
    
    this.attackAnimation = requestAnimationFrame(animateAttack);
    
    // Para jogador local, verificamos alvos e mostramos dano
    if (this.isLocal) {
      // Verificar jogadores próximos para acertar com o ataque
      this.checkMeleeAttackHits();
    }
  }
  

  // Verifica se o ataque corpo a corpo atingiu algum jogador (apenas no cliente para feedback imediato)
  checkMeleeAttackHits() {
    // Verificamos todos os outros jogadores
    for (const id in players) {
      if (id === this.id) continue; // Pula o próprio jogador
      
      const target = players[id];
      const dx = target.mesh.position.x - this.mesh.position.x;
      const dz = target.mesh.position.z - this.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      
      // Verificamos o alcance do ataque corpo a corpo
      if (distSq <= this.MELEE_ATTACK_RANGE * this.MELEE_ATTACK_RANGE) {
        // Mostra efeito de dano no cliente para feedback imediato
        target.showDamageEffect();
        
        // Mostra número de dano flutuante
        showDamageNumber(target.mesh.position, this.MELEE_ATTACK_DAMAGE);
      }
    }
  }

  // Conjura uma magia de ataque
  castSpell(targetPosition) {
    if (this.isCastingSpell || this.spellCooldown > 0) return false;
    
    this.isCastingSpell = true;
    
    // Rotaciona o jogador para olhar para o alvo
    if (this.isLocal) {
      // Calcula o ângulo para o alvo
      const direction = new THREE.Vector2(
        targetPosition.x - this.mesh.position.x,
        targetPosition.z - this.mesh.position.z
      ).normalize();
      
      // Atualiza a rotação do jogador
      const targetAngle = Math.atan2(direction.x, direction.y);
      this.mesh.rotation.y = targetAngle;
      
      // Envia a atualização de rotação para o servidor
      sendPlayerMove({
        position: {
          x: this.mesh.position.x,
          y: this.mesh.position.y,
          z: this.mesh.position.z
        },
        rotation: {
          y: this.mesh.rotation.y
        }
      });
    }
    
    // Obtém direção para o alvo
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, this.mesh.position).normalize();
    
    // Cria a bola de magia
    const fireball = createFireball(this.mesh.position, direction, this.id);
    
    // Anima o braço esquerdo para o gesto de magia
    const leftArm = this.parts.arms.left;
    const originalRotation = leftArm.rotation.x;
    
    // Animação simples do braço
    const startCast = Date.now();
    const castDuration = 500; // ms
    
    const animateCast = () => {
      const elapsed = Date.now() - startCast;
      const progress = Math.min(elapsed / castDuration, 1);
      
      if (progress < 0.3) {
        // Movimento para cima
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5) * (progress / 0.3);
      } else if (progress < 0.7) {
        // Mantém posição
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5);
      } else {
        // Movimento para baixo
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5) * (1 - ((progress - 0.7) / 0.3));
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateCast);
      } else {
        leftArm.rotation.x = originalRotation;
        this.isCastingSpell = false;
        
        // Adiciona cooldown
        this.spellCooldown = 3; // 3 segundos
        const cooldownInterval = setInterval(() => {
          this.spellCooldown -= 1;
          if (this.spellCooldown <= 0) {
            clearInterval(cooldownInterval);
          }
        }, 1000);
      }
    };
    
    requestAnimationFrame(animateCast);
    return true;
  }
  
  // Mostra um balão de chat
  showChatBubble(message) {
    this.chatBubble.textContent = message;
    this.chatBubble.style.display = 'block';
    
    // Esconde o balão após 5 segundos
    setTimeout(() => {
      this.chatBubble.style.display = 'none';
    }, 5000);
  }
  
  // Atualiza a posição do balão de chat
  updateChatBubblePosition(camera) {
    if (!this.chatBubble) return;
    
    // Converte a posição 3D para coordenadas de tela
    const position = new THREE.Vector3();
    position.copy(this.mesh.position);
    position.y += 3; // Acima da cabeça
    
    const screenPosition = position.clone();
    screenPosition.project(camera);
    
    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
    
    this.chatBubble.style.left = `${x}px`;
    this.chatBubble.style.top = `${y}px`;
  }
  
 // Mostra efeito de dano
  showDamageEffect() {
    const originalColor = this.isLocal ? 0x3498db : 0xe74c3c;
    const damagedColor = 0xff0000;
    
    this.parts.body.material.color.setHex(damagedColor);
    this.parts.arms.left.material.color.setHex(damagedColor);
    this.parts.arms.right.material.color.setHex(damagedColor);
    
    // Retorna à cor original após 200ms
    setTimeout(() => {
      this.parts.body.material.color.setHex(originalColor);
      this.parts.arms.left.material.color.setHex(originalColor);
      this.parts.arms.right.material.color.setHex(originalColor);
    }, 200);
  }
  
  // Mostra morte do jogador
  die() {
    // Animação simples de morte (faz o jogador cair)
    const deathAnimation = () => {
      this.mesh.rotation.z += 0.05;
      
      if (this.mesh.rotation.z < Math.PI / 2) {
        requestAnimationFrame(deathAnimation);
      } else {
        this.mesh.rotation.z = Math.PI / 2;
      }
    };
    
    requestAnimationFrame(deathAnimation);
  }
  
  // Respawn do jogador
  respawn(position) {
    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.rotation.set(0, 0, 0);
    this.health = 100;
    this.updateCollider();
  }
  
  // Limpa os recursos ao remover o jogador
  destroy() {
    if (this.chatBubble) {
      document.body.removeChild(this.chatBubble);
    }
    
    if (this.attackAnimation) {
      cancelAnimationFrame(this.attackAnimation);
    }
    
    scene.remove(this.mesh);
  }
}

// Função para criar/obter jogadores
function createPlayer(id, position, isLocal = false) {
  const player = new Player(id, position, isLocal);
  players[id] = player;
  return player;
}

// Remove um jogador
function removePlayer(id) {
  if (players[id]) {
    players[id].destroy();
    delete players[id];
  }
}

// Função para criar números de dano flutuantes
function showDamageNumber(position, amount) {
  // Cria elemento HTML para o número de dano
  const damageElement = document.createElement('div');
  damageElement.className = 'damage-number';
  damageElement.textContent = amount;
  document.body.appendChild(damageElement);
  
  // Posiciona o elemento no mundo 3D
  const updatePosition = () => {
    // Projeta a posição 3D para coordenadas 2D da tela
    const screenPosition = new THREE.Vector3(
      position.x,
      position.y + 2, // Acima da cabeça
      position.z
    );
    screenPosition.project(camera);
    
    // Converte para coordenadas CSS
    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
    
    // Atualiza posição do elemento
    damageElement.style.left = `${x}px`;
    damageElement.style.top = `${y}px`;
  };
  
  // Posição inicial
  updatePosition();
  
  // Animação do número subindo
  let animationFrame;
  const startTime = Date.now();
  const duration = 1500; // ms
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Atualiza posição do dano
    updatePosition();
    
    // Fade out e movimento para cima
    damageElement.style.opacity = 1 - progress;
    damageElement.style.transform = `translateY(-${progress * 50}px)`;
    
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      // Remove o elemento quando a animação terminar
      document.body.removeChild(damageElement);
      cancelAnimationFrame(animationFrame);
    }
  };
  
  animationFrame = requestAnimationFrame(animate);
}

// Função para criar uma bola de fogo
function createFireball(startPosition, direction, casterId) {
  // Constantes da magia
  const FIREBALL_SPEED = 0.35; // Ligeiramente mais rápido
  const FIREBALL_RANGE = 20;  // Aumentado o alcance
  const FIREBALL_DAMAGE = 20;
  const FIREBALL_RADIUS = 0.3;
  
  // Cria geometria da bola de fogo
  const geometry = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);
  const material = new THREE.MeshPhongMaterial({
    color: 0xff5500,
    emissive: 0xff2200,
    transparent: true,
    opacity: 0.8
  });
  
  const fireball = new THREE.Mesh(geometry, material);
  
  // Posiciona a bola de fogo na frente do jogador, mas um pouco acima
  const offset = new THREE.Vector3(direction.x, 0, direction.z).multiplyScalar(1);
  fireball.position.copy(startPosition).add(offset);
  fireball.position.y = 1.5; // Altura da bola de fogo
  
  // Adiciona à cena
  scene.add(fireball);
  
  // Adiciona luz pontual para efeito de iluminação
  const light = new THREE.PointLight(0xff5500, 1, 5);
  light.position.copy(fireball.position);
  scene.add(light);
  
  // Dados da bola de fogo
  const fireballData = {
    mesh: fireball,
    light: light,
    direction: direction,
    distance: 0,
    maxDistance: FIREBALL_RANGE,
    casterId: casterId,
    damage: FIREBALL_DAMAGE,
    
    update: function() {
      // Move a bola de fogo
      const moveVector = new THREE.Vector3(
        this.direction.x * FIREBALL_SPEED,
        0,
        this.direction.z * FIREBALL_SPEED
      );
      
      this.mesh.position.add(moveVector);
      this.light.position.copy(this.mesh.position);
      
      // Atualiza distância percorrida
      this.distance += moveVector.length();
      
      // Verifica colisão com objetos do mundo
      const raycaster = new THREE.Raycaster(
        this.mesh.position,
        this.direction,
        0,
        FIREBALL_SPEED * 2 // Aumentado para detecção mais precisa
      );
      
      const worldObjects = gameWorld.objects || [];
      const intersects = raycaster.intersectObjects(worldObjects, true);
      
      if (intersects.length > 0 && intersects[0].distance < FIREBALL_SPEED * 2) {
        // Colisão com objeto do mundo
        this.explode();
        return false;
      }
      
      // Verifica colisão com jogadores
      for (const id in players) {
        if (id === this.casterId) continue; // Ignora o lançador
        
        const player = players[id];
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dy = player.mesh.position.y + 1 - this.mesh.position.y; // Altura média
        const dz = player.mesh.position.z - this.mesh.position.z;
        
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq < (player.radius + FIREBALL_RADIUS) * (player.radius + FIREBALL_RADIUS) * 4) { // Aumentado para melhor detecção
          // Colisão com jogador
          player.showDamageEffect();
          showDamageNumber(player.mesh.position, this.damage);
          
          // Notificar servidor do acerto
          if (playerId === this.casterId) {
            sendSpellHit(id, this.damage);
          }
          
          this.explode();
          return false;
        }
      }
      
      // Verifica se atingiu o alcance máximo
      if (this.distance >= this.maxDistance) {
        this.remove();
        return false;
      }
      
      return true;
    },
    
    explode: function() {
      // Efeito de explosão
      const explosionGeometry = new THREE.SphereGeometry(1, 12, 12);
      const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7700,
        transparent: true,
        opacity: 0.7
      });
      
      const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      explosion.position.copy(this.mesh.position);
      scene.add(explosion);
      
      // Animação de explosão
      const startTime = Date.now();
      const duration = 500; // ms
      
      const animateExplosion = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Expande e desaparece
        explosion.scale.set(1 + progress, 1 + progress, 1 + progress);
        explosionMaterial.opacity = 0.7 * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animateExplosion);
        } else {
          scene.remove(explosion);
        }
      };
      
      requestAnimationFrame(animateExplosion);
      
      // Remove a bola de fogo
      this.remove();
    },
    
    remove: function() {
      // Remove elementos da cena
      scene.remove(this.mesh);
      scene.remove(this.light);
    }
  };
  
  // Adiciona à lista de projéteis
  projectiles.push(fireballData);
  
  return fireballData;
}