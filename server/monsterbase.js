/**
 * Configuração de bases de monstros no mapa
 */

const { createMonster } = require('./monsters');

const { 
  Collidable, 
  collisionManager, 
  COLLIDABLE_TYPES, 
  COLLIDER_SHAPES 
} = require('../shared/collision');

// Definições de spawn points de monstros
const monsterSpawns = [
  // Cada entry representa uma área de spawn
  {
    area: 'forest',
    monsters: [
      {
        type: 'GOBLIN',
        count: 5,
        radius: 15,
        center: { x: 20, y: 0, z: 20 }
      }
    ]
  },
  {
    area: 'hills',
    monsters: [
      {
        type: 'WOLF',
        count: 3,
        radius: 12,
        center: { x: -20, y: 0, z: -15 }
      }
    ]
  }
];

// Inicializa os monstros no mapa
function initializeMonsters() {
  const monsters = {};
  
  monsterSpawns.forEach(spawn => {
    spawn.monsters.forEach(monsterType => {
      // Cria múltiplos monstros deste tipo
      for (let i = 0; i < monsterType.count; i++) {
        // Gera uma posição aleatória dentro do raio especificado
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * monsterType.radius;
        const position = {
          x: monsterType.center.x + Math.cos(angle) * distance,
          y: monsterType.center.y,
          z: monsterType.center.z + Math.sin(angle) * distance
        };
        
        // Cria o monstro
        const monster = createMonster(monsterType.type, position);
        if (monster) {
          monsters[monster.id] = monster;
        }
      }
    });
  });
  
  return monsters;
}

// Verifica se uma posição está livre de outros monstros e objetos
function isPositionClear(position, monsters, radius = 2) {
  // Verifica colisão com outros monstros
  for (const id in monsters) {
    const monster = monsters[id];
    const dx = monster.position.x - position.x;
    const dz = monster.position.z - position.z;
    const distSq = dx * dx + dz * dz;
    
    if (distSq < (radius * radius)) {
      return false;
    }
  }
  
  // NOVO: Verificar colisão com objetos estáticos usando o sistema centralizado
  // Criar um collidable temporário para testar a posição
  const tempCollidable = new Collidable(
    `temp_spawn_check_${Date.now()}`,
    COLLIDABLE_TYPES.MONSTER,
    COLLIDER_SHAPES.CYLINDER,
    {
      position: position,
      radius: radius
    }
  );
  
  // Registrar temporariamente para verificar colisões
  collisionManager.register(tempCollidable);
  
  // Verificar colisões com objetos estáticos
  const collisions = collisionManager.checkEntityCollisions(
    tempCollidable.id,
    [COLLIDABLE_TYPES.STATIC]
  );
  
  // Remover o collidable temporário
  collisionManager.unregister(tempCollidable.id);
  
  // Retornar falso se houver colisões com objetos estáticos
  if (collisions.length > 0) {
    return false;
  }
  
  return true;
}

// Encontra uma posição aleatória válida para um monstro renascer
function findRespawnPosition(originalPosition, monsters, radius = 15) {
  // Aumentar o número de tentativas
  const MAX_ATTEMPTS = 30; // Antes era apenas 10
  
  // Tenta encontrar uma posição livre
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Nos primeiros 15 tentativas, tenta posições mais próximas do original
    // Nas tentativas seguintes, expande o raio gradualmente
    const searchRadius = attempt < 15 ? radius : radius * (1 + (attempt - 15) * 0.2);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * searchRadius;
    const position = {
      x: originalPosition.x + Math.cos(angle) * distance,
      y: originalPosition.y,
      z: originalPosition.z + Math.sin(angle) * distance
    };
    
    if (isPositionClear(position, monsters)) {
      console.log(`Posição válida encontrada para spawn após ${attempt+1} tentativas`);
      return position;
    }
  }
  
  // Se não encontrar nenhuma posição livre, usa uma posição alternativa segura
  console.warn("Não foi possível encontrar posição livre para spawn. Usando posição segura alternativa.");
  
  // Coordenadas conhecidas como seguras (ajuste para seu mapa)
  const safeFallbackPositions = [
    { x: 10, y: 0, z: 10 },
    { x: -10, y: 0, z: 10 },
    { x: 10, y: 0, z: -10 },
    { x: -10, y: 0, z: -10 }
  ];
  
  // Tenta cada posição alternativa
  for (const safePos of safeFallbackPositions) {
    if (isPositionClear(safePos, monsters)) {
      return safePos;
    }
  }
  
  // Se ainda não encontrou, tenta uma posição com offset mais distante
  return { 
    x: originalPosition.x + (Math.random() > 0.5 ? 20 : -20),
    y: originalPosition.y,
    z: originalPosition.z + (Math.random() > 0.5 ? 20 : -20)
  };
}

module.exports = {
  monsterSpawns,
  initializeMonsters,
  findRespawnPosition
};