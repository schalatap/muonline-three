// Cria um novo jogador
function createPlayer(id, spawnPoint) {
  return {
    id: id,
    position: spawnPoint,
    rotation: { y: 0 },
    health: 100,
    lastAttackTime: 0
  };
}

module.exports = {
  createPlayer
};
