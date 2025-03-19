// Pontos de spawn no mapa (simplificado)
const spawnPoints = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 5 },
  { x: -5, y: 0, z: -5 },
  { x: 5, y: 0, z: -5 },
  { x: -5, y: 0, z: 5 }
];

// Retorna um ponto de spawn aleatório
function getSpawnPoint() {
  const randomIndex = Math.floor(Math.random() * spawnPoints.length);
  return { ...spawnPoints[randomIndex] };
}

module.exports = {
  getSpawnPoint
};
