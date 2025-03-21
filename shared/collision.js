/**
 * shared/collision.js - Sistema unificado de colisão para cliente e servidor
 */

(function(exports) {
  // Tipos de collidables
  const COLLIDABLE_TYPES = {
    PLAYER: 'player',
    MONSTER: 'monster',
    STATIC: 'static',
    PROJECTILE: 'projectile'
  };
  
  // Forma dos collidables
  const COLLIDER_SHAPES = {
    BOX: 'box',
    SPHERE: 'sphere',
    CYLINDER: 'cylinder'
  };
  
  // Constantes de segurança - centralizar para evitar inconsistências
  const SAFETY_BUFFER = 0.05; // 5cm de segurança
  const SAFETY_FACTOR = 1.05; // Fator de segurança de 5%

  // Funções utilitárias para cálculos de colisão
  const CollisionUtils = {
    // Calcula o quadrado da distância entre dois pontos no espaço 3D
    distanceSquared: (posA, posB) => {
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dz = posB.z - posA.z;
      return dx * dx + dy * dy + dz * dz;
    },

    // Verifica se dois intervalos 1D se sobrepõem
    intervalsOverlap: (minA, maxA, minB, maxB) => {
      return !(maxA < minB || minA > maxB);
    }
  };
  
  // Representação unificada de um objeto com colisão
  class Collidable {
    constructor(id, type, shape, options = {}) {
      this.id = id;
      this.type = type;
      this.shape = shape;
      this.position = options.position || { x: 0, y: 0, z: 0 };
    
      if (shape === COLLIDER_SHAPES.BOX) {
        this.dimensions = {
          width: (options.dimensions?.width || 1) + SAFETY_BUFFER,
          height: (options.dimensions?.height || 1) + SAFETY_BUFFER,
          depth: (options.dimensions?.depth || 1) + SAFETY_BUFFER
        };
      } else {
        this.dimensions = options.dimensions || { width: 1, height: 1, depth: 1 };
      }
      
      // Adicionar buffer ao raio para shapes circulares
      this.radius = (options.radius || 0.5) + 
                   (shape === COLLIDER_SHAPES.SPHERE || shape === COLLIDER_SHAPES.CYLINDER ? 
                    SAFETY_BUFFER : 0);
      
      this.enabled = options.enabled !== undefined ? options.enabled : true;
      this.owner = options.owner || null;
    }
  
    // Ativa/desativa a colisão
    setEnabled(enabled) {
      this.enabled = enabled;
    }
  
    // Atualiza a posição do collidable
    updatePosition(position) {
      this.position = { ...position };
    }
    
    // Cria uma representação de caixa de colisão para THREE.js (cliente)
    createBox3() {
      // Implementado apenas no cliente
      if (typeof THREE === 'undefined') return null;
  
      const halfWidth = this.dimensions.width / 2;
      const halfDepth = this.dimensions.depth / 2;
      
      return new THREE.Box3(
        new THREE.Vector3(
          this.position.x - halfWidth,
          this.position.y,
          this.position.z - halfDepth
        ),
        new THREE.Vector3(
          this.position.x + halfWidth,
          this.position.y + this.dimensions.height,
          this.position.z + halfDepth
        )
      );
    }
  }
  
  // Gerenciador de colisões
  class CollisionManager {
    constructor() {
      this.collidables = new Map(); // Map para armazenar todos os collidables por ID
      this.entityToCollidableMap = new Map(); // Mapeia IDs de entidades para IDs de collidables
    }
  
    // Registra um novo collidable
    register(collidable) {
      this.collidables.set(collidable.id, collidable);
      if (collidable.owner) {
        this.entityToCollidableMap.set(collidable.owner.id, collidable.id);
      }
      return collidable;
    }
  
    // Remove um collidable
    unregister(collidableId) {
      const collidable = this.collidables.get(collidableId);
      if (collidable && collidable.owner) {
        this.entityToCollidableMap.delete(collidable.owner.id);
      }
      this.collidables.delete(collidableId);
    }
  
    // Obtém um collidable por ID de entidade
    getCollidableByEntityId(entityId) {
      const collidableId = this.entityToCollidableMap.get(entityId);
      if (collidableId) {
        return this.collidables.get(collidableId);
      }
      return null;
    }
  
    // Atualiza a posição de um collidable baseado em sua entidade
    updateCollidablePosition(entityId, position) {
      const collidable = this.getCollidableByEntityId(entityId);
      if (collidable) {
        collidable.updatePosition(position);
      }
    }
  
    // Desativa colisão para uma entidade (ex: quando o monstro morre)
    disableCollisionForEntity(entityId) {
      const collidable = this.getCollidableByEntityId(entityId);
      if (collidable) {
        collidable.setEnabled(false);
      }
    }
  
    // Ativa colisão para uma entidade
    enableCollisionForEntity(entityId) {
      const collidable = this.getCollidableByEntityId(entityId);
      if (collidable) {
        collidable.setEnabled(true);
      }
    }
  
    // Verifica colisão entre dois collidables
    checkCollision(collidableA, collidableB) {
      // Se algum collidable estiver desativado, não há colisão
      if (!collidableA.enabled || !collidableB.enabled) {
        return false;
      }
  
      // Colisão de esfera com esfera
      if (collidableA.shape === COLLIDER_SHAPES.SPHERE && 
          collidableB.shape === COLLIDER_SHAPES.SPHERE) {
        return this.checkSphereSphereCollision(collidableA, collidableB);
      }
      
      // Colisão de esfera com caixa
      if (collidableA.shape === COLLIDER_SHAPES.SPHERE && 
          collidableB.shape === COLLIDER_SHAPES.BOX) {
        return this.checkSphereBoxCollision(collidableA, collidableB);
      }
  
      if (collidableA.shape === COLLIDER_SHAPES.BOX && 
          collidableB.shape === COLLIDER_SHAPES.SPHERE) {
        return this.checkSphereBoxCollision(collidableB, collidableA);
      }
  
      // Colisão de caixa com caixa
      if (collidableA.shape === COLLIDER_SHAPES.BOX && 
          collidableB.shape === COLLIDER_SHAPES.BOX) {
        return this.checkBoxBoxCollision(collidableA, collidableB);
      }
  
      // Colisão com cilindro
      if (collidableA.shape === COLLIDER_SHAPES.CYLINDER || 
          collidableB.shape === COLLIDER_SHAPES.CYLINDER) {
        return this.checkCylinderCollision(
          collidableA.shape === COLLIDER_SHAPES.CYLINDER ? collidableA : collidableB,
          collidableA.shape === COLLIDER_SHAPES.CYLINDER ? collidableB : collidableA
        );
      }
  
      return false;
    }
  
    // Verifica colisão entre duas esferas
    checkSphereSphereCollision(sphereA, sphereB) {
      const distSq = CollisionUtils.distanceSquared(sphereA.position, sphereB.position);
      const minDistSq = (sphereA.radius + sphereB.radius) * (sphereA.radius + sphereB.radius);
      
      return distSq < minDistSq;
    }
  
    // Verifica colisão entre uma esfera e uma caixa
    checkSphereBoxCollision(sphere, box) {
      // Encontrar o ponto mais próximo da esfera dentro da caixa
      const halfWidth = box.dimensions.width / 2;
      const halfDepth = box.dimensions.depth / 2;
      
      // Calcular o ponto mais próximo
      const closestPoint = {
        x: Math.max(box.position.x - halfWidth, Math.min(sphere.position.x, box.position.x + halfWidth)),
        y: Math.max(box.position.y, Math.min(sphere.position.y, box.position.y + box.dimensions.height)),
        z: Math.max(box.position.z - halfDepth, Math.min(sphere.position.z, box.position.z + halfDepth))
      };
      
      // Calcular a distância ao quadrado entre o centro da esfera e o ponto mais próximo
      const distSq = CollisionUtils.distanceSquared(sphere.position, closestPoint);
      
      // Usar o fator de segurança padronizado
      const radiusSq = sphere.radius * sphere.radius * SAFETY_FACTOR;
      
      return distSq < radiusSq;
    }
  
    // Verifica colisão entre duas caixas
    checkBoxBoxCollision(boxA, boxB) {
      const aMinX = boxA.position.x - boxA.dimensions.width / 2;
      const aMaxX = boxA.position.x + boxA.dimensions.width / 2;
      const aMinY = boxA.position.y;
      const aMaxY = boxA.position.y + boxA.dimensions.height;
      const aMinZ = boxA.position.z - boxA.dimensions.depth / 2;
      const aMaxZ = boxA.position.z + boxA.dimensions.depth / 2;
      
      const bMinX = boxB.position.x - boxB.dimensions.width / 2;
      const bMaxX = boxB.position.x + boxB.dimensions.width / 2;
      const bMinY = boxB.position.y;
      const bMaxY = boxB.position.y + boxB.dimensions.height;
      const bMinZ = boxB.position.z - boxB.dimensions.depth / 2;
      const bMaxZ = boxB.position.z + boxB.dimensions.depth / 2;
      
      return (
        CollisionUtils.intervalsOverlap(aMinX, aMaxX, bMinX, bMaxX) &&
        CollisionUtils.intervalsOverlap(aMinY, aMaxY, bMinY, bMaxY) &&
        CollisionUtils.intervalsOverlap(aMinZ, aMaxZ, bMinZ, bMaxZ)
      );
    }
  
    // Verifica colisão com um cilindro (simplificada e aprimorada)
    checkCylinderCollision(cylinder, other) {
      // Primeiro verificamos colisão no plano XZ (tratando como círculo)
      let isXZCollision = false;
      let radiusSum = 0;
      
      if (other.shape === COLLIDER_SHAPES.SPHERE) {
        radiusSum = cylinder.radius + other.radius;
        // Ignorando componente Y para comparação XZ
        const posA = { x: cylinder.position.x, y: 0, z: cylinder.position.z };
        const posB = { x: other.position.x, y: 0, z: other.position.z };
        isXZCollision = CollisionUtils.distanceSquared(posA, posB) < (radiusSum * radiusSum);
      } 
      else if (other.shape === COLLIDER_SHAPES.BOX) {
        // Encontrar o ponto mais próximo do cilindro dentro da caixa no plano XZ
        const halfWidth = other.dimensions.width / 2;
        const halfDepth = other.dimensions.depth / 2;
        
        const closestX = Math.max(other.position.x - halfWidth, 
                          Math.min(cylinder.position.x, other.position.x + halfWidth));
        const closestZ = Math.max(other.position.z - halfDepth, 
                          Math.min(cylinder.position.z, other.position.z + halfDepth));
        
        // Verificar se o ponto está dentro do raio do cilindro
        const posA = { x: cylinder.position.x, y: 0, z: cylinder.position.z };
        const posB = { x: closestX, y: 0, z: closestZ };
        isXZCollision = CollisionUtils.distanceSquared(posA, posB) < (cylinder.radius * cylinder.radius);
      }
      
      // Se não houver colisão no plano XZ, não há colisão no 3D
      if (!isXZCollision) return false;
      
      // Verificar colisão na altura (eixo Y)
      const cylinderBottom = cylinder.position.y;
      const cylinderTop = cylinder.position.y + cylinder.dimensions.height;
      
      let otherBottom, otherTop;
      
      if (other.shape === COLLIDER_SHAPES.SPHERE) {
        otherBottom = other.position.y - other.radius;
        otherTop = other.position.y + other.radius;
      } else {
        otherBottom = other.position.y;
        otherTop = other.position.y + other.dimensions.height;
      }
      
      return CollisionUtils.intervalsOverlap(cylinderBottom, cylinderTop, otherBottom, otherTop);
    }
  
    // Verifica colisão de uma entidade contra todas as outras
    checkEntityCollisions(entityId, includeTypes = null, excludeTypes = null) {
      const collidable = this.getCollidableByEntityId(entityId);
      if (!collidable || !collidable.enabled) return [];
      
      const collisions = [];
      
      this.collidables.forEach((other) => {
        // Não verificar colisão consigo mesmo
        if (other.id === collidable.id || !other.enabled) return;
        
        // Filtrar por tipos para incluir, se necessário
        if (includeTypes && !includeTypes.includes(other.type)) return;
        
        // Filtrar por tipos para excluir, se necessário
        if (excludeTypes && excludeTypes.includes(other.type)) return;
        
        if (this.checkCollision(collidable, other)) {
          collisions.push({
            collidable: other,
            entity: other.owner
          });
        }
      });
      
      return collisions;
    }
  
    // Obtém todos os collidables ativos para um determinado tipo
    getActiveCollidablesByType(type) {
      const result = [];
      this.collidables.forEach((collidable) => {
        if (collidable.enabled && collidable.type === type) {
          result.push(collidable);
        }
      });
      return result;
    }
    
    // Obtém Box3 objetos para THREE.js (apenas cliente)
    getActiveColliderBoxes() {
      if (typeof THREE === 'undefined') return [];
      
      const boxes = [];
      this.collidables.forEach((collidable) => {
        if (collidable.enabled) {
          const box = collidable.createBox3();
          if (box) boxes.push(box);
        }
      });
      return boxes;
    }
  }
  
  // Gerenciador de colisão global
  let sharedCollisionManager = null;
  
  // Funções utilitárias para criar collidables
  
  // Função para extrair a posição, independente se é um objeto mesh ou position direta
  function getEntityPosition(entity) {
    if (!entity) return { x: 0, y: 0, z: 0 };
    
    if (entity.mesh && entity.mesh.position) {
      return entity.mesh.position;
    }
    
    if (entity.position) {
      return entity.position;
    }
    
    if (entity.x !== undefined && entity.z !== undefined) {
      return {
        x: entity.x, 
        y: entity.y || 0, 
        z: entity.z
      };
    }
    
    return { x: 0, y: 0, z: 0 };
  }
  
  // Função para criar um collidable para um jogador
  function createPlayerCollidable(player) {
    console.log(`Criando collidable para jogador ${player.id}`);
    const position = getEntityPosition(player);
    return getCollisionManager().register(new Collidable(
      player.id,
      COLLIDABLE_TYPES.PLAYER,
      COLLIDER_SHAPES.BOX,
      {
        position: { ...position, y: position.y + 0.9 },
        dimensions: { width: 1.1, height: 1.8, depth: 0.7 },
        owner: player
      }
    ));
  }
  
  // Função para criar um collidable para um monstro
  function createMonsterCollidable(monster) {
    const radius = monster.type === 'GOBLIN' ? 0.7 : 0.8;
    const position = getEntityPosition(monster);
    return getCollisionManager().register(new Collidable(
      monster.id,
      COLLIDABLE_TYPES.MONSTER,
      COLLIDER_SHAPES.BOX,
      {
        position: { ...position, y: position.y + 0.6 },
        dimensions: { width: radius * 2.2, height: 1.3, depth: radius * 2.2 },
        owner: monster
      }
    ));
  }
  
  // Função para criar um collidable para um objeto estático
  function createStaticCollidable(object) {
    const shape = object.type === 'cylinder' ? COLLIDER_SHAPES.CYLINDER : COLLIDER_SHAPES.BOX;
    
    const options = {
      position: { x: object.x, y: object.y, z: object.z },
      owner: object
    };
    
    if (shape === COLLIDER_SHAPES.CYLINDER) {
      options.radius = object.radius;
      options.dimensions = { width: object.radius * 2, height: object.height || 3, depth: object.radius * 2 };
    } else {
      options.dimensions = { 
        width: object.width || 1, 
        height: object.height || 3, 
        depth: object.depth || 1 
      };
    }
    
    return getCollisionManager().register(new Collidable(
      `static_collider_${object.id || Math.random().toString(36).substr(2, 9)}`,
      COLLIDABLE_TYPES.STATIC,
      shape,
      options
    ));
  }
  
  // Função para obter o gerenciador de colisões
  function getCollisionManager() {
    if (!sharedCollisionManager) {
      sharedCollisionManager = new CollisionManager();
    }
    return sharedCollisionManager;
  }
  
  // Exporta as classes e funções
  exports.Collidable = Collidable;
  exports.CollisionManager = CollisionManager;
  exports.COLLIDABLE_TYPES = COLLIDABLE_TYPES;
  exports.COLLIDER_SHAPES = COLLIDER_SHAPES;
  exports.createPlayerCollidable = createPlayerCollidable;
  exports.createMonsterCollidable = createMonsterCollidable;
  exports.createStaticCollidable = createStaticCollidable;
  exports.getCollisionManager = getCollisionManager;
  exports.collisionManager = getCollisionManager();

  // Adicionar métodos de utilidade para verificar se o sistema está pronto
  exports.isCollisionSystemReady = function() {
    return sharedCollisionManager !== null;
  };

  // Método para registrar um collidable com verificação de duplicata
  exports.registerCollidableSafely = function(collidable) {
    const manager = getCollisionManager();
    const existingCollidable = manager.getCollidableByEntityId(collidable.owner?.id);
    
    if (existingCollidable) {
      console.log(`Collidable já existe para entidade ${collidable.owner.id} - atualizando`);
      existingCollidable.updatePosition(collidable.position);
      return existingCollidable;
    }
    
    return manager.register(collidable);
  };

  // Método para limpar todos os collidables (útil para reiniciar o sistema)
  exports.clearAllCollidables = function() {
    const manager = getCollisionManager();
    manager.collidables.clear();
    manager.entityToCollidableMap.clear();
    return true;
  };

// Escolher o correto método de exportação baseado no ambiente
})(typeof exports === 'undefined' ? (this.CollisionSystem = {}) : exports);