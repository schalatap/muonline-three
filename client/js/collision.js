/**
 * collision.js - Sistema unificado de colisão para servidor e cliente
 * Este arquivo pode ser usado tanto no cliente quanto no servidor
 */

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
  
  // Representação unificada de um objeto com colisão
  class Collidable {
    constructor(id, type, shape, options = {}) {
      this.id = id;
      this.type = type;
      this.shape = shape;
      this.position = options.position || { x: 0, y: 0, z: 0 };
      this.dimensions = options.dimensions || { width: 1, height: 1, depth: 1 };
      this.radius = options.radius || 0.5;
      this.enabled = options.enabled !== undefined ? options.enabled : true;
      this.owner = options.owner || null; // Referência ao objeto que possui este collidable
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
      const dx = sphereB.position.x - sphereA.position.x;
      const dy = sphereB.position.y - sphereA.position.y;
      const dz = sphereB.position.z - sphereA.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
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
      const dx = closestPoint.x - sphere.position.x;
      const dy = closestPoint.y - sphere.position.y;
      const dz = closestPoint.z - sphere.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      
      return distSq < (sphere.radius * sphere.radius);
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
      
      return !(
        aMaxX < bMinX || aMinX > bMaxX ||
        aMaxY < bMinY || aMinY > bMaxY ||
        aMaxZ < bMinZ || aMinZ > bMaxZ
      );
    }
  
    // Verifica colisão com um cilindro
    checkCylinderCollision(cylinder, other) {
      // Simplificação: tratamos um cilindro como um círculo no plano XZ
      if (other.shape === COLLIDER_SHAPES.SPHERE) {
        const dx = other.position.x - cylinder.position.x;
        const dz = other.position.z - cylinder.position.z;
        const distSq = dx * dx + dz * dz;
        
        // Verificar se estamos dentro do raio combinado
        const combinedRadius = cylinder.radius + other.radius;
        if (distSq > combinedRadius * combinedRadius) {
          return false;
        }
        
        // Verificar altura
        const otherBottom = other.position.y;
        const otherTop = other.shape === COLLIDER_SHAPES.SPHERE 
          ? other.position.y + other.radius
          : other.position.y + other.dimensions.height;
        
        const cylinderBottom = cylinder.position.y;
        const cylinderTop = cylinder.position.y + cylinder.dimensions.height;
        
        return !(otherTop < cylinderBottom || otherBottom > cylinderTop);
      } else if (other.shape === COLLIDER_SHAPES.BOX) {
        // Aproximação simplificada para caixa-cilindro
        // Projetamos no plano XZ e verificamos se o cilindro (tratado como círculo) intersecta o retângulo
        const halfWidth = other.dimensions.width / 2;
        const halfDepth = other.dimensions.depth / 2;
        
        // Encontrar o ponto mais próximo do cilindro dentro do retângulo (no plano XZ)
        const closestX = Math.max(other.position.x - halfWidth, Math.min(cylinder.position.x, other.position.x + halfWidth));
        const closestZ = Math.max(other.position.z - halfDepth, Math.min(cylinder.position.z, other.position.z + halfDepth));
        
        // Calcular distância ao quadrado entre o centro do cilindro e o ponto mais próximo
        const dx = closestX - cylinder.position.x;
        const dz = closestZ - cylinder.position.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq > cylinder.radius * cylinder.radius) {
          return false;
        }
        
        // Verificar altura
        const otherBottom = other.position.y;
        const otherTop = other.position.y + other.dimensions.height;
        
        const cylinderBottom = cylinder.position.y;
        const cylinderTop = cylinder.position.y + cylinder.dimensions.height;
        
        return !(otherTop < cylinderBottom || otherBottom > cylinderTop);
      }
      
      return false;
    }
  
    // Verifica colisão de uma entidade contra todas as outras
    checkEntityCollisions(entityId, includeTypes = null) {
      const collidable = this.getCollidableByEntityId(entityId);
      if (!collidable || !collidable.enabled) return [];
      
      const collisions = [];
      
      this.collidables.forEach((other) => {
        // Não verificar colisão consigo mesmo
        if (other.id === collidable.id || !other.enabled) return;
        
        // Filtrar por tipos, se necessário
        if (includeTypes && !includeTypes.includes(other.type)) return;
        
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
  
  // Cria uma instância global do gerenciador de colisões
  const collisionManager = new CollisionManager();
  
  // Função para criar um collidable para um jogador
  function createPlayerCollidable(player) {
    return collisionManager.register(new Collidable(
      `player_collider_${player.id}`,
      COLLIDABLE_TYPES.PLAYER,
      COLLIDER_SHAPES.BOX,
      {
        position: { ...player.position },
        dimensions: { width: 1, height: 1.8, depth: 1 },
        owner: player
      }
    ));
  }
  
  // Função para criar um collidable para um monstro
  function createMonsterCollidable(monster) {
    const radius = monster.type === 'GOBLIN' ? 0.6 : 0.7;
    return collisionManager.register(new Collidable(
      `monster_collider_${monster.id}`,
      COLLIDABLE_TYPES.MONSTER,
      COLLIDER_SHAPES.BOX,
      {
        position: { ...monster.position },
        dimensions: { width: radius * 2, height: 2.0, depth: radius * 2 },
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
    
    return collisionManager.register(new Collidable(
      `static_collider_${object.id || Math.random().toString(36).substr(2, 9)}`,
      COLLIDABLE_TYPES.STATIC,
      shape,
      options
    ));
  }
  
  // Exporta os componentes do sistema de colisão
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      Collidable,
      CollisionManager,
      collisionManager,
      COLLIDABLE_TYPES,
      COLLIDER_SHAPES,
      createPlayerCollidable,
      createMonsterCollidable,
      createStaticCollidable
    };
  } else if (typeof window !== 'undefined') {
    // Para o navegador
    window.CollisionSystem = {
      Collidable,
      CollisionManager,
      collisionManager,
      COLLIDABLE_TYPES,
      COLLIDER_SHAPES,
      createPlayerCollidable,
      createMonsterCollidable,
      createStaticCollidable
    };
  }