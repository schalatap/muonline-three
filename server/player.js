/**
 * Cria um novo jogador
 * @param {string} id - ID único do jogador
 * @param {Object} spawnPoint - Posição inicial do jogador
 * @returns {Object} Objeto jogador
 */
function createPlayer(id, spawnPoint) {
  return {
    id: id,
    position: spawnPoint,
    rotation: { y: 0 },
    health: 100,
    lastAttackTime: 0,
    lastSpellTime: 0,   // Tempo do último lançamento de magia
    lastMoveTime: 0,
    inventory: [],
    statistics: {
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageReceived: 0,
      spellsCast: 0     // Contador de magias lançadas
    }
  };
}

/**
 * Aplica dano a um jogador
 * @param {Object} player - Objeto jogador
 * @param {number} damage - Quantidade de dano
 * @param {string} attackerId - ID do atacante
 * @returns {boolean} True se o jogador morreu, False caso contrário
 */
function damagePlayer(player, damage, attackerId) {
  player.health -= damage;
  player.statistics.damageReceived += damage;
  
  return player.health <= 0;
}

/**
 * Atualiza as estatísticas de um jogador após uma morte
 * @param {Object} victim - Jogador que morreu
 * @param {Object} killer - Jogador que matou
 */
function recordKill(victim, killer) {
  if (victim && killer) {
    victim.statistics.deaths += 1;
    killer.statistics.kills += 1;
  }
}

module.exports = {
  createPlayer,
  damagePlayer,
  recordKill
};