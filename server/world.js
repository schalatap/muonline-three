/**
 * Módulo de mundo do servidor
 * Responsável por gerenciar o mapa, pontos de spawn e colisões no servidor
 */

// Importar o sistema de colisão unificado
const { 
  collisionManager, 
  createStaticCollidable, 
  COLLIDABLE_TYPES,
  COLLIDER_SHAPES
} = require('../shared/collision');

// Pontos de spawn no mapa (simplificado)
const spawnPoints = [
  { x: 7, y: 0, z: 7 },    // Novo ponto seguro
  { x: -7, y: 0, z: 7 },   // Novo ponto seguro
  { x: 7, y: 0, z: -7 },   // Novo ponto seguro
  { x: -7, y: 0, z: -7 },  // Novo ponto seguro
  { x: 5, y: 0, z: 5 },    // Pontos anteriores
  { x: -5, y: 0, z: -5 },
  { x: 5, y: 0, z: -5 },
  { x: -5, y: 0, z: 5 }
];

// Define os limites do mapa
const MAP_BOUNDS = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50
};

// Define obstáculos no mapa (para uso em colisões no servidor)
const obstacles = [
  // Fonte central
  { id: 'fountain_center', type: 'cylinder', x: 0, y: 0, z: 0, radius: 3, height: 3 },
  
  // Casas
  { id: 'building_1', type: 'box', x: -15, y: 0, z: -15, width: 5, depth: 5, height: 4 },
  { id: 'building_2', type: 'box', x: 15, y: 0, z: -15, width: 7, depth: 4, height: 5 },
  { id: 'building_3', type: 'box', x: -15, y: 0, z: 15, width: 6, depth: 6, height: 4 },
  { id: 'building_4', type: 'box', x: 15, y: 0, z: 15, width: 5, depth: 5, height: 3 },
  
  // Árvores
  { id: 'tree_1', type: 'cylinder', x: -8, y: 0, z: -8, radius: 1, height: 2 },
  { id: 'tree_2', type: 'cylinder', x: 8, y: 0, z: -8, radius: 1, height: 2 },
  { id: 'tree_3', type: 'cylinder', x: -8, y: 0, z: 8, radius: 1, height: 2 },
  { id: 'tree_4', type: 'cylinder', x: 8, y: 0, z: 8, radius: 1, height: 2 },
  
  // Muralhas
  { id: 'wall_north', type: 'box', x: 0, y: 0, z: -50, width: 100, depth: 1, height: 3 },
  { id: 'wall_south', type: 'box', x: 0, y: 0, z: 50, width: 100, depth: 1, height: 3 },
  { id: 'wall_west', type: 'box', x: -50, y: 0, z: 0, width: 1, depth: 100, height: 3 },
  { id: 'wall_east', type: 'box', x: 50, y: 0, z: 0, width: 1, depth: 100, height: 3 }
];

// Flag para controlar a inicialização
let worldObstaclesInitialized = false;

/**
 * Inicializa todos os obstáculos do mundo no sistema de colisão
 * Esta função deve ser chamada na inicialização do servidor
 */
function initializeWorldObstacles() {
  if (worldObstaclesInitialized) {
    console.log("Obstáculos do mundo já inicializados");
    return;
  }

  console.log("Inicializando obstáculos do mundo no sistema de colisão...");
  
  // Registra cada obstáculo no sistema de colisão unificado
  obstacles.forEach(obstacle => {
    try {
      const collidable = createStaticCollidable(obstacle);
      console.log(`Obstáculo registrado: ${obstacle.id}`);
    } catch (error) {
      console.error(`Erro ao registrar obstáculo ${obstacle.id}:`, error);
    }
  });
  
  worldObstaclesInitialized = true;
  console.log("Obstáculos do mundo inicializados com sucesso.");
}

/**
 * Retorna um ponto de spawn aleatório
 * @returns {Object} Ponto de spawn com coordenadas x, y, z
 */
function getSpawnPoint() {
  // Garante que os obstáculos sejam inicializados antes de retornar pontos de spawn
  if (!worldObstaclesInitialized) {
    initializeWorldObstacles();
  }
  
  const randomIndex = Math.floor(Math.random() * spawnPoints.length);
  return { ...spawnPoints[randomIndex] };
}

/**
 * Verifica se uma posição está dentro dos limites do mapa
 * @param {Object} position - Posição com coordenadas x, y, z
 * @returns {boolean} Verdadeiro se estiver dentro dos limites
 */
function isWithinMapBounds(position) {
  return (
    position.x >= MAP_BOUNDS.minX && 
    position.x <= MAP_BOUNDS.maxX &&
    position.z >= MAP_BOUNDS.minZ && 
    position.z <= MAP_BOUNDS.maxZ
  );
}

/**
 * Verifica se há colisão entre o jogador e os obstáculos usando o sistema unificado
 * @param {Object} position - Posição do jogador
 * @param {string} entityId - ID da entidade (jogador ou monstro)
 * @returns {boolean} Verdadeiro se houver colisão
 */
function checkObstacleCollision(position, entityId) {
  // Garante que os obstáculos foram inicializados
  if (!worldObstaclesInitialized) {
    initializeWorldObstacles();
  }
  
  // Verifica colisão usando o sistema unificado
  const tempPosition = { ...position };
  
  // Obtém o collidable da entidade, se existir
  const entityCollidable = collisionManager.getCollidableByEntityId(entityId);
  
  if (entityCollidable) {
    // Salva posição atual
    const originalPosition = { ...entityCollidable.position };
    
    // Atualiza temporariamente para a posição a ser testada
    collisionManager.updateCollidablePosition(entityId, tempPosition);
    
    // Verifica colisões com objetos estáticos
    const collisions = collisionManager.checkEntityCollisions(
      entityId,
      [COLLIDABLE_TYPES.STATIC]
    );
    
    // Restaura posição original
    collisionManager.updateCollidablePosition(entityId, originalPosition);
    
    return collisions.length > 0;
  }
  
  // Se não temos um collidable para a entidade, usamos o método antigo
  for (const obstacle of obstacles) {
    let collision = false;
    const playerRadius = 0.5;
    
    if (obstacle.type === 'cylinder') {
      // Colisão com obstáculo cilíndrico (distância entre círculos)
      const dx = position.x - obstacle.x;
      const dz = position.z - obstacle.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      collision = distance < (obstacle.radius + playerRadius);
    } 
    else if (obstacle.type === 'box') {
      // Colisão com obstáculo retangular
      const halfWidth = obstacle.width / 2;
      const halfDepth = obstacle.depth / 2;
      
      // Verifica se o jogador está dentro da caixa estendida pelo raio do jogador
      collision = (
        position.x >= obstacle.x - halfWidth - playerRadius &&
        position.x <= obstacle.x + halfWidth + playerRadius &&
        position.z >= obstacle.z - halfDepth - playerRadius &&
        position.z <= obstacle.z + halfDepth + playerRadius
      );
    }
    
    if (collision) {
      return true;
    }
  }
  
  return false;
}

/**
 * Valida se uma posição é válida (dentro dos limites e sem colisões)
 * @param {Object} position - Posição a ser validada
 * @param {string} [entityId] - ID opcional da entidade
 * @returns {boolean} Verdadeiro se a posição for válida
 */
function isValidPosition(position, entityId) {
  return isWithinMapBounds(position) && !checkObstacleCollision(position, entityId);
}

/**
 * Exibe informações de depuração sobre os obstáculos registrados
 */
function debugObstacles() {
  console.log("=== Obstáculos Registrados ===");
  
  // Exibe os obstáculos definidos localmente
  console.log("Obstáculos definidos:", obstacles.length);
  
  // Verifica os obstáculos no sistema de colisão
  const staticCollidables = Array.from(collisionManager.collidables.values())
    .filter(c => c.type === COLLIDABLE_TYPES.STATIC);
  
  console.log("Collidables estáticos no sistema de colisão:", staticCollidables.length);
  
  // Exibe detalhes dos collidables estáticos
  staticCollidables.forEach(c => {
    console.log(`- ID: ${c.id}, Posição: (${c.position.x}, ${c.position.y}, ${c.position.z})`);
  });
  
  return {
    definedObstacles: obstacles.length,
    registeredCollidables: staticCollidables.length
  };
}

module.exports = {
  getSpawnPoint,
  isWithinMapBounds,
  checkObstacleCollision,
  isValidPosition,
  MAP_BOUNDS,
  initializeWorldObstacles,
  debugObstacles
};