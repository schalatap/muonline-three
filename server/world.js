/**
 * Módulo de mundo do servidor
 * Responsável por gerenciar o mapa, pontos de spawn e colisões no servidor
 */

// Pontos de spawn no mapa (simplificado)
const spawnPoints = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 5 },
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

// Define obstáculos no mapa (para uso futuro em colisões no servidor)
const obstacles = [
  // Fonte central
  { type: 'cylinder', x: 0, y: 0, z: 0, radius: 3 },
  
  // Casas
  { type: 'box', x: -15, y: 0, z: -15, width: 5, depth: 5 },
  { type: 'box', x: 15, y: 0, z: -15, width: 7, depth: 4 },
  { type: 'box', x: -15, y: 0, z: 15, width: 6, depth: 6 },
  { type: 'box', x: 15, y: 0, z: 15, width: 5, depth: 5 },
  
  // Árvores
  { type: 'cylinder', x: -8, y: 0, z: -8, radius: 1 },
  { type: 'cylinder', x: 8, y: 0, z: -8, radius: 1 },
  { type: 'cylinder', x: -8, y: 0, z: 8, radius: 1 },
  { type: 'cylinder', x: 8, y: 0, z: 8, radius: 1 }
];

/**
 * Retorna um ponto de spawn aleatório
 * @returns {Object} Ponto de spawn com coordenadas x, y, z
 */
function getSpawnPoint() {
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
 * Verifica se há colisão entre o jogador e os obstáculos
 * @param {Object} position - Posição do jogador
 * @param {number} playerRadius - Raio do jogador (para detecção de colisão)
 * @returns {boolean} Verdadeiro se houver colisão
 */
function checkObstacleCollision(position, playerRadius = 0.5) {
  for (const obstacle of obstacles) {
    let collision = false;
    
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
 * @returns {boolean} Verdadeiro se a posição for válida
 */
function isValidPosition(position) {
  return isWithinMapBounds(position) && !checkObstacleCollision(position);
}

module.exports = {
  getSpawnPoint,
  isWithinMapBounds,
  checkObstacleCollision,
  isValidPosition,
  MAP_BOUNDS
};