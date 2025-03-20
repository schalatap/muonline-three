/**
 * Definições de monstros para o jogo
 */

const { 
  createMonsterCollidable,
  serverCollisionManager
} = require('../shared/collision');

// Tipos de monstros
const MonsterTypes = {
    // Monstro básico
    GOBLIN: {
      id: 'goblin',
      name: 'Goblin',
      model: 'goblin',  // identificador para o modelo visual
      stats: {
        health: 50,
        maxHealth: 50,
        attackDamage: 5,
        attackRange: 3.0,  // range um pouco maior que o jogador
        attackSpeed: 1.5,  // tempo em segundos entre ataques
        moveSpeed: 0.08,
        aggroRange: 10,    // distância em que o monstro detecta jogadores
        chaseRange: 15,    // distância máxima que persegue antes de voltar
        expValue: 15       // experiência concedida ao matar
      },
      drops: [
        // Aqui podemos definir itens que o monstro pode soltar (futuro)
      ],
      respawnTime: 10,     // tempo em segundos para renascer
      level: 1
    },
    
    // Você pode adicionar mais tipos de monstros aqui
    WOLF: {
      id: 'wolf',
      name: 'Lobo',
      model: 'wolf',
      stats: {
        health: 75,
        maxHealth: 75,
        attackDamage: 8,
        attackRange: 3.2,
        attackSpeed: 1.2,
        moveSpeed: 0.1,
        aggroRange: 12,
        chaseRange: 18,
        expValue: 25
      },
      drops: [],
      respawnTime: 15,
      level: 2
    },
  };
  
  // Função para criar um monstro
  function createMonster(type, spawnPoint) {
    const monsterType = MonsterTypes[type];
    if (!monsterType) {
      console.error(`Monster type ${type} not found!`);
      return null;
    }
    
    const monster = {
      id: `${monsterType.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: type,
      name: monsterType.name,
      model: monsterType.model,
      position: { ...spawnPoint },
      rotation: { y: 0 },
      stats: { ...monsterType.stats },
      level: monsterType.level,
      
      // Estado atual do monstro
      currentState: 'idle',
      targetId: null,
      lastAttackTime: 0,
      spawnPosition: { ...spawnPoint },
      
      // Temporizadores
      timers: {
        respawn: null
      }
    };
    
    // Registrar collidable do monstro no servidor
    createMonsterCollidable(monster);
    
    return monster;
  }
  
  module.exports = {
    MonsterTypes,
    createMonster
  };