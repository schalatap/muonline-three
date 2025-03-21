/**
 * Sistema de renderização e gerenciamento de monstros no cliente
 */

// Armazenamento para monstros
const monsters = {};

// Debug flag - definido como true para mostrar logs de debug
const DEBUG_MONSTERS = false;

// Cria um monstro no mundo do cliente
function createMonster(monsterData) {
  // Log para debugging
  if (DEBUG_MONSTERS) {
    console.log("Criando monstro:", monsterData);
  }
  
  // Verifica se já existe
  if (monsters[monsterData.id]) {
    if (DEBUG_MONSTERS) console.log("Monstro já existe, atualizando:", monsterData.id);
    
    // Atualiza dados existentes
    monsters[monsterData.id].stats = monsterData.stats;
    monsters[monsterData.id].state = monsterData.state || 'idle';
    
    // Atualiza posição
    if (monsterData.position) {
      monsters[monsterData.id].mesh.position.set(
        monsterData.position.x,
        monsterData.position.y,
        monsterData.position.z
      );
    }
    
    return monsters[monsterData.id];
  }
  
  // Cria um objeto de monstro
  const monster = {
    id: monsterData.id,
    type: monsterData.type,
    name: monsterData.name,
    mesh: null,
    parts: {},
    healthBar: null,
    nameTag: null,
    targetIndicator: null,
    stats: monsterData.stats || { health: 50, maxHealth: 50 },
    state: monsterData.state || 'idle',
    
    // Cria a representação visual do monstro
    createMesh: function(position) {
      if (DEBUG_MONSTERS) console.log("Criando mesh para monstro em posição:", position);
      
      // Determina a aparência baseada no tipo
      let bodyColor, modelSize;
      
      switch(this.type) {
        case 'GOBLIN':
          bodyColor = 0x2ecc71; // Verde para Goblin
          modelSize = 0.9; // Aumentado para melhor visibilidade (era 0.8)
          break;
        case 'WOLF':
          bodyColor = 0x7f8c8d; // Cinza para Lobo
          modelSize = 1.0; // Aumentado para melhor visibilidade (era 0.9)
          break;
        default:
          bodyColor = 0xe74c3c; // Vermelho como fallback
          modelSize = 1.0;
      }
      
      // Cria modelo básico para o monstro
      const monsterGroup = new THREE.Group();
      
      // Corpo - Aumentado para maior visibilidade
      const bodyGeometry = new THREE.BoxGeometry(1 * modelSize, 1.2 * modelSize, 0.6 * modelSize);
      const bodyMaterial = new THREE.MeshLambertMaterial({ 
        color: bodyColor,
        emissive: bodyColor, // Adicionado para destacar o monstro
        emissiveIntensity: 0.3 // Intensidade suave para não exagerar
      });
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      bodyMesh.position.y = 0.6 * modelSize;
      monsterGroup.add(bodyMesh);
      
      // Cabeça
      const headGeometry = new THREE.BoxGeometry(0.7 * modelSize, 0.7 * modelSize, 0.7 * modelSize);
      const headMaterial = new THREE.MeshLambertMaterial({ 
        color: bodyColor,
        emissive: bodyColor,
        emissiveIntensity: 0.3
      });
      const headMesh = new THREE.Mesh(headGeometry, headMaterial);
      headMesh.position.y = 1.5 * modelSize;
      monsterGroup.add(headMesh);
      
      // Pernas
      const legGeometry = new THREE.BoxGeometry(0.3 * modelSize, 0.7 * modelSize, 0.3 * modelSize);
      const legMaterial = new THREE.MeshLambertMaterial({ 
        color: bodyColor,
        emissive: bodyColor,
        emissiveIntensity: 0.2
      });
      
      const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
      leftLeg.position.set(-0.25 * modelSize, 0, 0);
      monsterGroup.add(leftLeg);
      
      const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
      rightLeg.position.set(0.25 * modelSize, 0, 0);
      monsterGroup.add(rightLeg);
      
      // Adiciona olhos para dar mais personalidade
      const eyeGeometry = new THREE.SphereGeometry(0.1 * modelSize, 8, 8);
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Olhos vermelhos
      
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.2 * modelSize, 1.5 * modelSize, 0.35 * modelSize);
      monsterGroup.add(leftEye);
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.2 * modelSize, 1.5 * modelSize, 0.35 * modelSize);
      monsterGroup.add(rightEye);
      
      // Adiciona sombras
      monsterGroup.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      
      // Armazena partes para animação
      this.parts = {
        body: bodyMesh,
        head: headMesh,
        legs: { left: leftLeg, right: rightLeg },
        eyes: { left: leftEye, right: rightEye }
      };
      
      // Posiciona
      monsterGroup.position.set(position.x, position.y || 0, position.z);
      
      // Log da posição final
      if (DEBUG_MONSTERS) {
        console.log("Mesh do monstro posicionado em:", 
          monsterGroup.position.x, 
          monsterGroup.position.y, 
          monsterGroup.position.z
        );
      }
      
      // Armazena
      this.mesh = monsterGroup;
      
      // Adiciona à cena
      if (typeof scene !== 'undefined') {
        scene.add(monsterGroup);
        if (DEBUG_MONSTERS) console.log("Adicionado à cena, objetos na cena:", scene.children.length);
      } else {
        console.error("Erro: variável 'scene' não definida ao criar mesh do monstro");
      }
      
      // Cria barra de vida e nametag
      this.createHealthBar();
      this.createNameTag();
      
      return monsterGroup;
    },
    
    // Cria barra de vida para o monstro
    createHealthBar: function() {
      // Container para a barra de vida
      const barContainer = document.createElement('div');
      barContainer.className = 'monster-health-bar';
      document.body.appendChild(barContainer);
      
      // Fundo da barra
      const barBackground = document.createElement('div');
      barBackground.className = 'monster-health-background';
      barContainer.appendChild(barBackground);
      
      // Frente da barra (preenchimento)
      const barFill = document.createElement('div');
      barFill.className = 'monster-health-fill';
      barBackground.appendChild(barFill);
      
      this.healthBar = {
        container: barContainer,
        fill: barFill
      };
      
      // Esconde inicialmente
      barContainer.style.display = 'none';
    },
    
    // Cria nametag para o monstro
    createNameTag: function() {
      const nameTag = document.createElement('div');
      nameTag.className = 'monster-name-tag';
      nameTag.textContent = this.name;
      document.body.appendChild(nameTag);
      
      this.nameTag = nameTag;
      
      // Esconde inicialmente
      nameTag.style.display = 'none';
    },
    
    // Atualiza posição dos elementos de UI
    updateUI: function(camera) {
      if (!this.mesh || !this.healthBar || !this.nameTag) return;
      
      // Pega posição do monstro
      const position = new THREE.Vector3();
      position.copy(this.mesh.position);
      position.y += 2.0; // Acima da cabeça
      
      // Projeta para coordenadas de tela
      const screenPosition = position.clone();
      screenPosition.project(camera);
      
      const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
      
      // Atualiza posição da barra de vida
      if (this.healthBar) {
        const healthPercent = (this.stats.health / this.stats.maxHealth) * 100;
        this.healthBar.fill.style.width = `${healthPercent}%`;
        
        this.healthBar.container.style.left = `${x - 25}px`;
        this.healthBar.container.style.top = `${y - 30}px`;
        
        // Mostra se estiver próximo o suficiente
        const distance = this.mesh.position.distanceTo(camera.position);
        this.healthBar.container.style.display = distance < 30 ? 'block' : 'none';
      }
      
      // Atualiza posição do nametag
      if (this.nameTag) {
        this.nameTag.style.left = `${x}px`;
        this.nameTag.style.top = `${y - 50}px`;
        
        // Mostra se estiver próximo o suficiente
        const distance = this.mesh.position.distanceTo(camera.position);
        this.nameTag.style.display = distance < 30 ? 'block' : 'none';
      }
    },
    
    // Anima o monstro de acordo com seu estado
    animate: function() {
      // Animação de andar se estiver perseguindo ou retornando
      if (this.state === 'chase' || this.state === 'return') {
        this.animateWalk();
      }
    },
    
    // Animação de andar
    animateWalk: function() {
      const now = Date.now();
      
      // Atualiza a cada 50ms
      if (!this.lastWalkTime || now - this.lastWalkTime > 50) {
        this.walkCycle = (this.walkCycle || 0) + 1;
        
        // Animação simples das pernas
        if (this.parts && this.parts.legs) {
          const leftLeg = this.parts.legs.left;
          const rightLeg = this.parts.legs.right;
          
          // Alterna as pernas
          const cycle = Math.sin(this.walkCycle * 0.4) * 0.2;
          leftLeg.rotation.x = cycle;
          rightLeg.rotation.x = -cycle;
        }
        
        this.lastWalkTime = now;
      }
    },
    
    // Mostra efeito de dano
    showDamageEffect: function() {
      if (!this.parts || !this.parts.body) return;
      
      const originalColor = this.parts.body.material.color.getHex();
      const damagedColor = 0xff0000;
      
      this.parts.body.material.color.setHex(damagedColor);
      if (this.parts.head) this.parts.head.material.color.setHex(damagedColor);
      
      // Volta à cor original após 200ms
      setTimeout(() => {
        this.parts.body.material.color.setHex(originalColor);
        if (this.parts.head) this.parts.head.material.color.setHex(originalColor);
      }, 200);
    },
    
    // Animação de morte
    die: function() {
      if (!this.mesh) return;
      
      // Atualiza o estado
      this.state = 'dead';
      
      // Desativa a colisão do monstro quando ele morre
      window.CollisionSystem.collisionManager.disableCollisionForEntity(this.id);
  
      // Remove o collider antigo
      this.collider = null;
      
      // Animação de morte
      const deathAnimation = () => {
        this.mesh.rotation.z += 0.05;
        
        if (this.mesh.rotation.z < Math.PI / 2) {
          requestAnimationFrame(deathAnimation);
        } else {
          this.mesh.rotation.z = Math.PI / 2;
          
          // Escurece o modelo para indicar que está morto
          if (this.parts && this.parts.body) {
            this.parts.body.material.color.setHex(0x333333); // Cinza escuro
            this.parts.body.material.opacity = 0.7;
            this.parts.body.material.transparent = true;
          }
          
          if (this.parts && this.parts.head) {
            this.parts.head.material.color.setHex(0x333333);
            this.parts.head.material.opacity = 0.7;
            this.parts.head.material.transparent = true;
          }
          
          if (this.parts && this.parts.legs) {
            if (this.parts.legs.left) {
              this.parts.legs.left.material.color.setHex(0x333333);
              this.parts.legs.left.material.opacity = 0.7;
              this.parts.legs.left.material.transparent = true;
            }
            if (this.parts.legs.right) {
              this.parts.legs.right.material.color.setHex(0x333333);
              this.parts.legs.right.material.opacity = 0.7;
              this.parts.legs.right.material.transparent = true;
            }
          }
          
          // Esconde UI
          if (this.healthBar) {
            this.healthBar.container.style.display = 'none';
          }
          
          if (this.nameTag) {
            this.nameTag.style.display = 'none';
          }
        }
      };
      
      requestAnimationFrame(deathAnimation);
    },
    
    // Limpa recursos
    destroy: function() {
      if (this.healthBar && this.healthBar.container) {
        document.body.removeChild(this.healthBar.container);
      }
      
      if (this.nameTag) {
        document.body.removeChild(this.nameTag);
      }
      
      if (this.mesh && scene) {
        scene.remove(this.mesh);
        if (DEBUG_MONSTERS) console.log("Removendo monstro (destroy):", this.id);
      }
    }
  };
  
  // Cria visual
  if (monsterData.position) {
    monster.createMesh(monsterData.position);
  } else {
    console.error("Erro: posição não fornecida para o monstro", monsterData.id);
  }
  
  // Salva no registro
  monsters[monsterData.id] = monster;
  
  if (DEBUG_MONSTERS) console.log("Monstro criado com sucesso:", monster.id);
  
  // Registrar o collidable do monstro
  if (monster.mesh) {
    window.CollisionSystem.createMonsterCollidable(monster);
    
    // Importante: se o monstro estiver morto, desabilitar sua colisão
    if (monster.state === 'dead') {
      window.CollisionSystem.collisionManager.disableCollisionForEntity(monster.id);
    }
  }
  
  return monster;
}

// Remove um monstro
function removeMonster(id) {
  if (monsters[id]) {
    if (DEBUG_MONSTERS) console.log("Removendo monstro:", id);
    
    // Remover o collidable do gerenciador
    window.CollisionSystem.collisionManager.disableCollisionForEntity(id);
    
    monsters[id].destroy();
    delete monsters[id];
  }
}

// Atualiza o estado dos monstros a partir do servidor
function updateMonstersState(monstersData) {
  if (DEBUG_MONSTERS) console.log("Atualizando estado dos monstros:", Object.keys(monstersData).length);
  
  // Remove monstros que não estão mais nos dados
  for (const id in monsters) {
    if (!monstersData[id]) {
      removeMonster(id);
    }
  }
  
  // Atualiza ou cria monstros
  for (const id in monstersData) {
    const data = monstersData[id];
    
    if (monsters[id]) {
      // Atualiza monstro existente
      const monster = monsters[id];
      
      // Posição e rotação
      if (monster.mesh) {
        monster.mesh.position.x += (data.position.x - monster.mesh.position.x) * 0.3;
        monster.mesh.position.y += (data.position.y - monster.mesh.position.y) * 0.3;
        monster.mesh.position.z += (data.position.z - monster.mesh.position.z) * 0.3;
        
        if (data.rotation) {
          monster.mesh.rotation.y += (data.rotation.y - monster.mesh.rotation.y) * 0.3;
        }
      }
      
      // Estatísticas
      if (data.stats) {
        monster.stats = data.stats;
      }
      
      // Estado
      if (data.state) {
        monster.state = data.state;
      }
    } else {
      // Cria novo monstro
      createMonster(data);
    }
  }

  // Atualiza os colliders depois de todas as atualizações
  updateMonsterColliders();
}

// Atualiza a animação de todos os monstros
function animateMonsters() {
  for (const id in monsters) {
    if (monsters[id] && typeof monsters[id].animate === 'function') {
      monsters[id].animate();
    }
  }
}

// Atualiza a UI de todos os monstros
function updateMonstersUI(camera) {
  for (const id in monsters) {
    if (monsters[id] && typeof monsters[id].updateUI === 'function') {
      monsters[id].updateUI(camera);
    }
  }
}

// Testa se conseguimos ver um monstro específico
function debugMonster(id) {
  if (monsters[id]) {
    console.log("Detalhes do monstro:", id);
    console.log("- Posição:", monsters[id].mesh.position);
    console.log("- Estado:", monsters[id].state);
    console.log("- Vida:", monsters[id].stats.health, "/", monsters[id].stats.maxHealth);
    
    // Destaca o monstro
    const originalColor = monsters[id].parts.body.material.color.getHex();
    monsters[id].parts.body.material.color.setHex(0xff00ff); // Rosa brilhante
    
    // Volta à cor original após 3 segundos
    setTimeout(() => {
      monsters[id].parts.body.material.color.setHex(originalColor);
    }, 3000);
    
    return true;
  } else {
    console.log("Monstro não encontrado:", id);
    console.log("Monstros existentes:", Object.keys(monsters));
    return false;
  }
}

// Atualiza o collider do monstro
function updateMonsterColliders() {
  for (const id in monsters) {
    const monster = monsters[id];
    if (monster.mesh) {
      // Atualizar a posição do collidable no gerenciador unificado
      window.CollisionSystem.collisionManager.updateCollidablePosition(monster.id, monster.mesh.position);
      
      // Manter o radius para referência
      monster.radius = monster.type === 'GOBLIN' ? 0.6 : 0.7;
    }
  }
}

// Exporta funções
window.monsters = monsters;
window.createMonster = createMonster;
window.removeMonster = removeMonster;
window.updateMonstersState = updateMonstersState;
window.animateMonsters = animateMonsters;
window.updateMonstersUI = updateMonstersUI;
window.debugMonster = debugMonster; // Função para ajudar na depuração
window.updateMonsterColliders = updateMonsterColliders;