// Class to manage players
class Player {
  constructor(id, position, isLocal = false) {
    this.id = id;
    this.isLocal = isLocal;
    this.mesh = null;
    this.parts = {};
    
    // Stats system
    this.stats = {
      // Primary attributes
      strength: 10,    // Physical damage
      agility: 10,     // Speed and defense
      vitality: 10,    // Health
      energy: 10,      // Magic and mana
      
      // Derived stats
      health: 100,
      maxHealth: 100,
      mana: 100,
      maxMana: 100,
      manaRegen: 2,
      stamina: 100,    // Novo: vigor
      maxStamina: 100, // Novo: vigor máximo
      staminaRegen: 5, // Novo: regeneração de vigor
      defense: 5,
      speed: 0.15
    };
    
    // Stat points available to distribute
    this.statPoints = 20;
    
    // Movement and physics
    this.isMoving = false;
    this.moveSpeed = 0.15;
    this.radius = 0.5;
    this.height = 1.8;
    this.lastValidPosition = new THREE.Vector3();

    // Novo: flag para redução de velocidade
    this.isExhausted = false;
    
    // Combat state
    this.isAttacking = false;
    this.isCastingSpell = false;
    this.attackAnimation = null;
    this.isInvulnerable = false;
    
    // Spell data
    this.spells = {
      fireball: {
        manaCost: 15,
        damage: 20,
        cooldown: 1.5,
        lastCast: 0,
        range: 20,
        speed: 0.35,
        icon: 'fireball-icon'
      }
    };
    
    // Chat bubble
    this.chatBubble = null;
    
    // Initialize player
    this.init(position);
  }
  
  init(position) {
    // Create mesh
    this.createMesh(position);
    
    // Initialize collider
    this.updateCollider();
    
    // Store initial position
    this.lastValidPosition.copy(this.mesh.position);
    
    // Create chat bubble
    this.createChatBubble();
    
    // Start mana regeneration if local player
    if (this.isLocal) {
      this.startManaRegeneration();
      this.startStaminaRegeneration();
    }
  }
  
  createMesh(position) {
    // Create player model
    const playerGroup = new THREE.Group();
    
    // Choose color based on type
    const bodyColor = this.isLocal ? 0x3498db : 0xe74c3c;
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 0.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = 0.75;
    playerGroup.add(bodyMesh);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.y = 1.85;
    playerGroup.add(headMesh);
    
    // Arms
    const armGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
    const armMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.65, 0.75, 0);
    playerGroup.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.65, 0.75, 0);
    playerGroup.add(rightArm);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.3, 0.9, 0.3);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x34495e });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.25, 0.05, 0); // Elevado ligeiramente
    playerGroup.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.25, 0.05, 0); // Elevado ligeiramente
    playerGroup.add(rightLeg);
    
    // Add shadows
    playerGroup.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    
    // Store body parts for animation
    this.parts = {
      body: bodyMesh,
      head: headMesh,
      arms: { left: leftArm, right: rightArm },
      legs: { left: leftLeg, right: rightLeg }
    };
    
    // Position player
    playerGroup.position.set(position.x, position.y, position.z);

    // CORREÇÃO: Elevar ligeiramente o grupo inteiro
    playerGroup.position.y = 0.45;
    
    // Store mesh
    this.mesh = playerGroup;
    
    // Add to scene
    scene.add(playerGroup);
  }
  
  // Start mana regeneration
  startManaRegeneration() {
    setInterval(() => {
      if (this.stats.mana < this.stats.maxMana) {
        // Calculate regeneration amount based on energy
        const energyBonus = this.stats.energy * 0.05;
        const regenAmount = (this.stats.manaRegen + energyBonus) / 20; // Per tick (50ms)
        
        this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + regenAmount);
        
        // Update UI
        this.updateUI();
      }
    }, 50);
  }

  startStaminaRegeneration() {
    setInterval(() => {
      if (this.stats.stamina < this.stats.maxStamina) {
        // Regeneração baseada em agilidade
        const agilityBonus = this.stats.agility * 0.1;
        const regenAmount = (this.stats.staminaRegen + agilityBonus) / 10; // 10 ticks por segundo
        
        this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regenAmount);
        
        // Se o vigor voltar a um nível adequado, remove o estado de exaustão
        if (this.isExhausted && this.stats.stamina > this.stats.maxStamina * 0.3) {
          this.isExhausted = false;
          this.moveSpeed = this.stats.speed; // Restaura a velocidade normal
        }
        
        // Atualiza a UI
        this.updateUI();
      }
    }, 100);
  }
  
  // Update UI based on current stats
  updateUI() {
    if (!this.isLocal) return;
    
    // Update health bar
    const healthFill = document.getElementById('health-fill');
    const healthPercent = (this.stats.health / this.stats.maxHealth) * 100;
    healthFill.style.width = `${healthPercent}%`;
    
    // Update mana bar
    const manaFill = document.getElementById('mana-fill');
    const manaPercent = (this.stats.mana / this.stats.maxMana) * 100;
    manaFill.style.width = `${manaPercent}%`;
    
    // Update stamina bar
    const staminaFill = document.getElementById('stamina-fill');
    const staminaPercent = (this.stats.stamina / this.stats.maxStamina) * 100;
    staminaFill.style.width = `${staminaPercent}%`;
    
    // Update spell icons
    this.updateSpellIcons();
    
    // Update level display
    document.getElementById('player-level').textContent = `Nível ${this.stats.level || 1}`;
  }
  
  // Update spell icons based on mana and cooldown
  updateSpellIcons() {
    for (const spellName in this.spells) {
      const spell = this.spells[spellName];
      const spellIcon = document.getElementById(`spell-${spellName}`);
      
      if (spellIcon) {
        // Check mana
        const hasEnoughMana = this.stats.mana >= spell.manaCost;
        spellIcon.classList.toggle('disabled', !hasEnoughMana);
        
        // Check cooldown
        const now = Date.now();
        const timeSinceLastCast = (now - spell.lastCast) / 1000;
        const onCooldown = timeSinceLastCast < spell.cooldown;
        
        // Update cooldown indicator
        const cooldownMask = spellIcon.querySelector('.spell-cooldown-mask');
        if (cooldownMask) {
          if (onCooldown) {
            const cooldownProgress = timeSinceLastCast / spell.cooldown;
            const rotation = 360 * cooldownProgress;
            cooldownMask.style.display = 'block';
            cooldownMask.style.transform = `rotate(${rotation}deg)`;
          } else {
            cooldownMask.style.display = 'none';
          }
        }
      }
    }
  }
  
  // Update collision box - Função corrigida
  updateCollider() {
    const pos = this.mesh.position;
    
    // Atualiza a posição no sistema de colisão unificado
    if (window.CollisionSystem && window.CollisionSystem.collisionManager) {
      try {
        // Verifica se o collidable do jogador existe
        const collidable = window.CollisionSystem.collisionManager.getCollidableByEntityId(this.id);
        
        if (collidable) {
          window.CollisionSystem.collisionManager.updateCollidablePosition(this.id, pos);
        } else {
          // Se não existe, criar um novo collidable
          window.CollisionSystem.createPlayerCollidable(this);
        }
      } catch (error) {
        console.warn(`Erro ao atualizar collider do jogador ${this.id}:`, error);
      }
    }
  }
  
  // Animate walking - modificado para sempre animar as pernas quando o player está se movendo
  animateWalk() {
    const now = Date.now();
    
    // Only update animation every 50ms
    if (!this.lastWalkTime || now - this.lastWalkTime > 50) {
      this.walkCycle = (this.walkCycle || 0) + 1;
      
      // Simple leg animation
      const leftLeg = this.parts.legs.left;
      const rightLeg = this.parts.legs.right;
      
      // Certifica que as pernas são visíveis
      leftLeg.material.opacity = 1;
      rightLeg.material.opacity = 1;
      
      // CORREÇÃO: Aumentar a amplitude da animação para torná-la mais visível
      const cycle = Math.sin(this.walkCycle * 0.4) * 0.3; // Aumentado de 0.2 para 0.3
      leftLeg.rotation.x = cycle;
      rightLeg.rotation.x = -cycle;
      
      this.lastWalkTime = now;
    }
  }
  
  // Move player - Simplificado para usar o sistema unificado de colisão
  move(direction, speed) {
    if (direction.length() === 0) {
      this.resetLegsPosition();
      return false;
    }
    
    // Normalize direction
    direction.normalize();
    
    // Posição original
    const originalPosition = this.mesh.position.clone();
    
    // Calcular a nova posição pretendida
    const targetPosition = originalPosition.clone().add(
      new THREE.Vector3(direction.x * speed, 0, direction.z * speed)
    );
    
    // Verificar todas as colisões usando o sistema unificado
    const canMove = !this.checkAnyCollisions(targetPosition);
    
    if (!canMove) {
      // Tentar movimento parcial em cada eixo separadamente
      const canMoveX = !this.checkAnyCollisions(new THREE.Vector3(
        originalPosition.x + direction.x * speed * 0.7,
        originalPosition.y,
        originalPosition.z
      ));
      
      const canMoveZ = !this.checkAnyCollisions(new THREE.Vector3(
        originalPosition.x,
        originalPosition.y,
        originalPosition.z + direction.z * speed * 0.7
      ));
      
      // Se puder mover em pelo menos um eixo
      if (canMoveX || canMoveZ) {
        const partialMove = originalPosition.clone();
        
        if (canMoveX) partialMove.x += direction.x * speed * 0.7;
        if (canMoveZ) partialMove.z += direction.z * speed * 0.7;
        
        // Mover para a posição parcial
        this.mesh.position.copy(partialMove);
        this.updateCollider(); // Usar o método que já tem as verificações
        
        // Atualizar rotação para a direção desejada
        const angle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = angle;
        
        this.lastValidPosition.copy(this.mesh.position);
        this.animateWalk();
        return true;
      }
      
      // Se não puder mover em nenhum eixo, mostrar feedback sutil
      if (this.isLocal) this.showCollisionFeedback();
      return false;
    }
    
    // Sem colisão, pode mover normalmente
    this.mesh.position.copy(targetPosition);
    this.updateCollider(); // Usar o método que já tem as verificações
      
    // Atualizar rotação
    const angle = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.y = angle;
    
    // Atualizar última posição válida
    this.lastValidPosition.copy(this.mesh.position);
    this.animateWalk();
    return true;
  }
  
  // Método unificado para verificação de colisões
  checkAnyCollisions(position) {
    if (!window.CollisionSystem || !window.CollisionSystem.collisionManager) {
      console.warn("Sistema de colisão não disponível ao verificar colisões");
      return false; // Se não tem sistema de colisão, assume que pode mover
    }
    
    const currentPosition = this.mesh.position.clone();
    
    try {
      // Mover temporariamente para testar colisão
      this.mesh.position.copy(position);
      window.CollisionSystem.collisionManager.updateCollidablePosition(this.id, this.mesh.position);
      
      // Verificar colisões com objetos estáticos e monstros
      const collisions = window.CollisionSystem.collisionManager.checkEntityCollisions(
        this.id, 
        [window.CollisionSystem.COLLIDABLE_TYPES.STATIC, window.CollisionSystem.COLLIDABLE_TYPES.MONSTER]
      );
      
      // Restaurar posição original
      this.mesh.position.copy(currentPosition);
      window.CollisionSystem.collisionManager.updateCollidablePosition(this.id, this.mesh.position);
      
      return collisions.length > 0;
    } catch (error) {
      console.warn("Erro ao verificar colisões:", error);
      // Restaurar posição original em caso de erro
      this.mesh.position.copy(currentPosition);
      window.CollisionSystem.collisionManager.updateCollidablePosition(this.id, this.mesh.position);
      return false; // Em caso de erro, assume que pode mover
    }
  }
  
  // Novo método para resetar a posição das pernas quando parado
  resetLegsPosition() {
    if (this.parts && this.parts.legs) {
      const leftLeg = this.parts.legs.left;
      const rightLeg = this.parts.legs.right;
      
      // Suavizar a transição para a posição parada
      const currentLeft = leftLeg.rotation.x || 0;
      const currentRight = rightLeg.rotation.x || 0;
      
      // Resetar para posição neutra com uma pequena animação
      leftLeg.rotation.x = currentLeft * 0.8;
      rightLeg.rotation.x = currentRight * 0.8;
    }
  }
  
  // Perform melee attack
  attack(targetPosition = null) {
    if (this.isAttacking) return;

    // Verifica se tem vigor suficiente
    const STAMINA_COST = 10;
    if (this.stats.stamina < STAMINA_COST) {
      if (this.isLocal) {
        addSystemMessage("Vigor insuficiente para atacar!");
      }
      return false;
    }
    
    // Consome vigor
    this.stats.stamina -= STAMINA_COST;
    
    // Verifica exaustão
    this.checkExhaustion();
    
    // Atualiza UI se for jogador local
    if (this.isLocal) {
      this.updateUI();
    }
    
    this.isAttacking = true;
    
    // Rotate to face target
    if (targetPosition && this.isLocal) {
      // Calculate angle to target
      const direction = new THREE.Vector2(
        targetPosition.x - this.mesh.position.x,
        targetPosition.z - this.mesh.position.z
      ).normalize();
      
      // Update rotation
      const targetAngle = Math.atan2(direction.x, direction.y);
      this.mesh.rotation.y = targetAngle;
      
      // Send update to server
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
    
    // Animate attack
    const rightArm = this.parts.arms.right;
    const originalRotation = rightArm.rotation.x;
    
    const startAttack = Date.now();
    const attackDuration = 300; // ms
    
    if (this.attackAnimation) {
      cancelAnimationFrame(this.attackAnimation);
    }
    
    const animateAttack = () => {
      const elapsed = Date.now() - startAttack;
      const progress = Math.min(elapsed / attackDuration, 1);
      
      if (progress < 0.5) {
        // Forward swing
        rightArm.rotation.x = originalRotation - (Math.PI * 0.8) * (progress * 2);
      } else {
        // Return swing
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
    
    // Check for hits
    if (this.isLocal) {
      this.checkMeleeAttackHits();
    }
  }
  
  // Check for melee attack hits
  checkMeleeAttackHits() {
    const MELEE_ATTACK_RANGE = 2;
    
    // Check other players
    for (const id in players) {
      if (id === this.id) continue;
      
      const target = players[id];
      const dx = target.mesh.position.x - this.mesh.position.x;
      const dz = target.mesh.position.z - this.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      
      // If in range, hit target
      if (distSq <= MELEE_ATTACK_RANGE * MELEE_ATTACK_RANGE) {
        // Calculate damage based on strength
        const BASE_DAMAGE = 5;
        const strengthBonus = this.stats.strength * 0.5;
        const damage = Math.floor(BASE_DAMAGE + strengthBonus);
        
        // Visual feedback
        target.showDamageEffect();
        
        // Show damage number
        showDamageNumber(target.mesh.position, damage);
      }
    }
  }

  checkExhaustion() {
    // Se o vigor cair abaixo de 20%, o personagem fica exausto
    if (this.stats.stamina < this.stats.maxStamina * 0.2) {
      this.isExhausted = true;
      // Reduz velocidade em 30%
      this.moveSpeed = this.stats.speed * 0.7;
      
      if (this.isLocal) {
        addSystemMessage("Você está exausto e se movendo mais devagar!");
      }
    }
  }
  
  // Cast a spell
  castSpell(targetPosition) {
    const spell = this.spells.fireball;
    
    // Check cooldown
    const now = Date.now();
    const timeSinceLastCast = (now - spell.lastCast) / 1000;
    if (timeSinceLastCast < spell.cooldown) {
      return false;
    }
    
    // Check mana
    if (this.stats.mana < spell.manaCost) {
      if (this.isLocal) {
        addSystemMessage("Mana insuficiente!");
      }
      return false;
    }

    // Verifica vigor
    const STAMINA_COST = 5;
    if (this.stats.stamina < STAMINA_COST) {
      if (this.isLocal) {
        addSystemMessage("Vigor insuficiente para lançar magia!");
      }
      return false;
    }
    
    // Consume recursos
    this.stats.mana -= spell.manaCost;
    this.stats.stamina -= STAMINA_COST;

    // Verifica exaustão
    this.checkExhaustion();

    if (this.isLocal) {
      this.updateUI();
    }
    
    // Update cooldown
    spell.lastCast = now;
    
    // Rotate to face target
    if (this.isLocal) {
      const direction = new THREE.Vector2(
        targetPosition.x - this.mesh.position.x,
        targetPosition.z - this.mesh.position.z
      ).normalize();
      
      const targetAngle = Math.atan2(direction.x, direction.y);
      this.mesh.rotation.y = targetAngle;
      
      // Send update
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
    
    // Get direction to target
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, this.mesh.position).normalize();
    
    // Create fireball
    const fireball = createFireball(this.mesh.position, direction, this.id);
    
    // Casting animation
    const leftArm = this.parts.arms.left;
    const originalRotation = leftArm.rotation.x;
    
    const startCast = Date.now();
    const castDuration = 500; // ms
    
    const animateCast = () => {
      const elapsed = Date.now() - startCast;
      const progress = Math.min(elapsed / castDuration, 1);
      
      if (progress < 0.3) {
        // Raise arm
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5) * (progress / 0.3);
      } else if (progress < 0.7) {
        // Hold
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5);
      } else {
        // Lower arm
        leftArm.rotation.x = originalRotation - (Math.PI * 0.5) * (1 - ((progress - 0.7) / 0.3));
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateCast);
      } else {
        leftArm.rotation.x = originalRotation;
      }
    };
    
    requestAnimationFrame(animateCast);
    return true;
  }
  
  // Create chat bubble
  createChatBubble() {
    const chatBubble = document.createElement('div');
    chatBubble.className = 'chat-bubble';
    chatBubble.style.display = 'none';
    document.body.appendChild(chatBubble);
    
    this.chatBubble = chatBubble;
  }
  
  // Show chat bubble with message
  showChatBubble(message) {
    this.chatBubble.textContent = message;
    this.chatBubble.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
      this.chatBubble.style.display = 'none';
    }, 5000);
  }
  
  // Update chat bubble position
  updateChatBubblePosition(camera) {
    if (!this.chatBubble) return;
    
    // Project 3D position to screen coordinates
    const position = new THREE.Vector3();
    position.copy(this.mesh.position);
    position.y += 3;
    
    const screenPosition = position.clone();
    screenPosition.project(camera);
    
    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
    
    this.chatBubble.style.left = `${x}px`;
    this.chatBubble.style.top = `${y}px`;
  }
  
  // Show damage effect
  showDamageEffect() {
    const originalColor = this.isLocal ? 0x3498db : 0xe74c3c;
    const damagedColor = 0xff0000;
    
    this.parts.body.material.color.setHex(damagedColor);
    this.parts.arms.left.material.color.setHex(damagedColor);
    this.parts.arms.right.material.color.setHex(damagedColor);
    
    // Return to original color after 200ms
    setTimeout(() => {
      this.parts.body.material.color.setHex(originalColor);
      this.parts.arms.left.material.color.setHex(originalColor);
      this.parts.arms.right.material.color.setHex(originalColor);
    }, 200);
  }
  
  // Die animation
  die() {
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
  
  // Respawn player
  respawn(position) {
    this.mesh.position.set(position.x, position.y, position.z);
    this.mesh.rotation.set(0, 0, 0);
    this.stats.health = this.stats.maxHealth;
    this.stats.mana = this.stats.maxMana;
    this.updateCollider();
    
    if (this.isLocal) {
      this.updateUI();
    }
  }
  
  // Clean up resources
  destroy() {
    if (this.chatBubble) {
      document.body.removeChild(this.chatBubble);
    }
    
    if (this.attackAnimation) {
      cancelAnimationFrame(this.attackAnimation);
    }
    
    scene.remove(this.mesh);
  }
  
  // Take damage
  takeDamage(amount) {
    if (this.isInvulnerable) return false;
    
    // Apply defense reduction
    const defenseReduction = this.stats.defense / (this.stats.defense + 50);
    const reducedDamage = Math.max(1, Math.floor(amount * (1 - defenseReduction)));
    
    // Apply damage
    this.stats.health -= reducedDamage;
    
    // Cap at 0
    if (this.stats.health < 0) {
      this.stats.health = 0;
    }
    
    // Update UI
    if (this.isLocal) {
      this.updateUI();
    }
    
    // Show damage effect
    this.showDamageEffect();
    
    // Return true if killed
    return this.stats.health <= 0;
  }

  // Animate walking - modificado para sempre animar as pernas quando o player está se movendo
  animateWalk() {
    const now = Date.now();
    
    // Only update animation every 50ms
    if (!this.lastWalkTime || now - this.lastWalkTime > 50) {
      this.walkCycle = (this.walkCycle || 0) + 1;
      
      // Simple leg animation
      const leftLeg = this.parts.legs.left;
      const rightLeg = this.parts.legs.right;
      
      // Certifica que as pernas são visíveis
      leftLeg.material.opacity = 1;
      rightLeg.material.opacity = 1;
      
      // CORREÇÃO: Aumentar a amplitude da animação para torná-la mais visível
      const cycle = Math.sin(this.walkCycle * 0.4) * 0.3; // Aumentado de 0.2 para 0.3
      leftLeg.rotation.x = cycle;
      rightLeg.rotation.x = -cycle;
      
      this.lastWalkTime = now;
    }
  }
}

// Create a new player
function createPlayer(id, position, isLocal = false) {
  const player = new Player(id, position, isLocal);
  players[id] = player;
  
  // Register the player's collidable
  if (window.CollisionSystem) {
    window.CollisionSystem.createPlayerCollidable(player);
  }
  
  return player;
}

// Remove a player
function removePlayer(id) {
  if (players[id]) {
    players[id].destroy();
    delete players[id];
  }
}

// Show floating damage number
function showDamageNumber(position, amount) {
  const damageElement = document.createElement('div');
  damageElement.className = 'damage-number';
  damageElement.textContent = amount;
  document.body.appendChild(damageElement);
  
  // Position in 3D world
  const updatePosition = () => {
    const screenPosition = new THREE.Vector3(
      position.x,
      position.y + 2,
      position.z
    );
    screenPosition.project(camera);
    
    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight;
    
    damageElement.style.left = `${x}px`;
    damageElement.style.top = `${y}px`;
  };
  
  updatePosition();
  
  // Animate
  let animationFrame;
  const startTime = Date.now();
  const duration = 1500; // ms
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    updatePosition();
    
    damageElement.style.opacity = 1 - progress;
    damageElement.style.transform = `translateY(-${progress * 50}px)`;
    
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      document.body.removeChild(damageElement);
      cancelAnimationFrame(animationFrame);
    }
  };
  
  animationFrame = requestAnimationFrame(animate);
}

// Create fireball projectile
function createFireball(startPosition, direction, casterId) {
  // Spell constants
  const FIREBALL_SPEED = 0.35;
  const FIREBALL_RANGE = 20;
  const FIREBALL_RADIUS = 0.3;
  
  // Get caster for damage calculation
  const caster = players[casterId];
  
  // Calculate damage based on energy
  const BASE_DAMAGE = 15;
  const energyBonus = caster ? caster.stats.energy * 0.8 : 0;
  const FIREBALL_DAMAGE = Math.floor(BASE_DAMAGE + energyBonus);
  
  // Create fireball geometry
  const geometry = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8);
  const material = new THREE.MeshPhongMaterial({
    color: 0xff5500,
    emissive: 0xff2200,
    transparent: true,
    opacity: 0.8
  });
  
  const fireball = new THREE.Mesh(geometry, material);
  
  // Position in front of caster
  const offset = new THREE.Vector3(direction.x, 0, direction.z).multiplyScalar(1);
  fireball.position.copy(startPosition).add(offset);
  fireball.position.y = 1.5;
  
  // Add to scene
  scene.add(fireball);
  
  // Add light
  const light = new THREE.PointLight(0xff5500, 1, 5);
  light.position.copy(fireball.position);
  scene.add(light);
  
  // Fireball data
  const fireballData = {
    mesh: fireball,
    light: light,
    direction: direction,
    distance: 0,
    maxDistance: FIREBALL_RANGE,
    casterId: casterId,
    damage: FIREBALL_DAMAGE,
    
    update: function() {
      // Move fireball
      const moveVector = new THREE.Vector3(
        this.direction.x * FIREBALL_SPEED,
        0,
        this.direction.z * FIREBALL_SPEED
      );
      
      this.mesh.position.add(moveVector);
      this.light.position.copy(this.mesh.position);
      
      // Update distance
      this.distance += moveVector.length();
      
      // Check world collision
      const raycaster = new THREE.Raycaster(
        this.mesh.position,
        this.direction,
        0,
        FIREBALL_SPEED * 2
      );
      
      const worldObjects = gameWorld.objects || [];
      const intersects = raycaster.intersectObjects(worldObjects, true);
      
      if (intersects.length > 0 && intersects[0].distance < FIREBALL_SPEED * 2) {
        this.explode();
        return false;
      }
      
      // -------- INÍCIO DA CORREÇÃO PARA MELHORAR DETECÇÃO DE MONSTROS --------
      
      // Check collision with monsters first (separate from players for better control)
      if (window.monsters) {
        for (const id in window.monsters) {
          const monster = window.monsters[id];
          
          // Skip if monster doesn't have a mesh
          if (!monster.mesh) continue;
          
          // Calculate a more generous collision check for monsters
          const dx = monster.mesh.position.x - this.mesh.position.x;
          const dy = monster.mesh.position.y + 1 - this.mesh.position.y; // More forgiving height check
          const dz = monster.mesh.position.z - this.mesh.position.z;
          
          const distSq = dx * dx + dy * dy + dz * dy;
          
          // Use a much more generous hit radius for monsters (5x larger)
          // This makes it easier to hit monsters with fireballs
          const hitRadiusSq = (monster.radius || 0.8 + FIREBALL_RADIUS) * 
                             (monster.radius || 0.8 + FIREBALL_RADIUS) * 5;
          
          if (distSq < hitRadiusSq) {
            // Hit monster
            if (monster.showDamageEffect) {
              monster.showDamageEffect();
            }
            
            showDamageNumber(monster.mesh.position, this.damage);
            
            // Notify server
            if (playerId === this.casterId) {
              // Envia informação específica de hit em monstro
              sendSpellHitMonster(id, this.damage);
            }
            
            this.explode();
            return false;
          }
        }
      }
      
      // -------- FIM DA CORREÇÃO --------
      
      // Check player collision (existing code)
      for (const id in players) {
        if (id === this.casterId) continue;
        
        const player = players[id];
        const dx = player.mesh.position.x - this.mesh.position.x;
        const dy = player.mesh.position.y + 1 - this.mesh.position.y;
        const dz = player.mesh.position.z - this.mesh.position.z;
        
        const distSq = dx * dx + dy * dy + dz * dy;
        
        if (distSq < (player.radius + FIREBALL_RADIUS) * (player.radius + FIREBALL_RADIUS) * 4) {
          // Hit player
          player.showDamageEffect();
          showDamageNumber(player.mesh.position, this.damage);
          
          // Notify server
          if (playerId === this.casterId) {
            sendSpellHit(id, this.damage);
          }
          
          this.explode();
          return false;
        }
      }
      
      // Check max range
      if (this.distance >= this.maxDistance) {
        this.remove();
        return false;
      }
      
      return true;
    },
    
    explode: function() {
      // Create explosion
      const explosionGeometry = new THREE.SphereGeometry(1, 12, 12);
      const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7700,
        transparent: true,
        opacity: 0.7
      });
      
      const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      explosion.position.copy(this.mesh.position);
      scene.add(explosion);
      
      // Animate explosion
      const startTime = Date.now();
      const duration = 500; // ms
      
      const animateExplosion = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        explosion.scale.set(1 + progress, 1 + progress, 1 + progress);
        explosionMaterial.opacity = 0.7 * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animateExplosion);
        } else {
          scene.remove(explosion);
        }
      };
      
      requestAnimationFrame(animateExplosion);
      
      // Remove fireball
      this.remove();
    },
    
    remove: function() {
      scene.remove(this.mesh);
      scene.remove(this.light);
    }
  };
  
  // Add to projectiles
  projectiles.push(fireballData);
  
  return fireballData;
}