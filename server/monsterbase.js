/**
 * Configuração de bases de monstros no mapa
 */

const { createMonster } = require('./monsters');

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
  
  // Você pode adicionar verificação de colisão com objetos do mundo aqui
  // Por enquanto, estamos apenas evitando sobreposição com outros monstros
  
  return true;
}

// Encontra uma posição aleatória válida para um monstro renascer
function findRespawnPosition(originalPosition, monsters, radius = 15) {
  // Tenta encontrar uma posição livre 10 vezes
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const position = {
      x: originalPosition.x + Math.cos(angle) * distance,
      y: originalPosition.y,
      z: originalPosition.z + Math.sin(angle) * distance
    };
    
    if (isPositionClear(position, monsters)) {
      return position;
    }
  }
  
  // Se não encontrou posição livre, retorna a posição original
  return { ...originalPosition };
}

module.exports = {
  monsterSpawns,
  initializeMonsters,
  findRespawnPosition
};