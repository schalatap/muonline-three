/**
 * Stats management system
 */

// Track UI elements
let statPanelVisible = false;
let availablePoints = 0;

// Initialize the stats system
function initStatsSystem() {
  // Set up UI toggle
  const toggleButton = document.getElementById('toggle-stats');
  const statsPanel = document.getElementById('stats-panel');
  
  if (toggleButton && statsPanel) {
    toggleButton.addEventListener('click', () => {
      statPanelVisible = !statPanelVisible;
      statsPanel.classList.toggle('visible', statPanelVisible);
    });
  }
  
  // Set up stat allocation buttons
  const statButtons = document.querySelectorAll('.stat-button');
  statButtons.forEach(button => {
    button.addEventListener('click', () => {
      const stat = button.getAttribute('data-stat');
      allocateStat(stat);
    });
  });
  
  // Update UI initially
  updateStatsUI();
}

function updateStatsUI() {
  if (!localPlayer) return;
  
  const stats = localPlayer.stats;
  
  // Update primary attributes
  document.getElementById('strength-value').textContent = stats.strength;
  document.getElementById('agility-value').textContent = stats.agility;
  document.getElementById('vitality-value').textContent = stats.vitality;
  document.getElementById('energy-value').textContent = stats.energy;
  
  // Update derived stats with all details
  document.getElementById('health-max-value').textContent = `${stats.health}/${stats.maxHealth}`;
  document.getElementById('mana-max-value').textContent = `${stats.mana}/${stats.maxMana}`;
  document.getElementById('stamina-max-value').textContent = `${stats.stamina}/${stats.maxStamina}`;
  document.getElementById('defense-value').textContent = stats.defense.toFixed(1);
  document.getElementById('speed-value').textContent = stats.speed.toFixed(2);
  document.getElementById('phys-dmg-value').textContent = calculatePhysicalDamage().toFixed(1);
  document.getElementById('magic-dmg-value').textContent = calculateMagicDamage().toFixed(1);
  
  // Update available points
  document.getElementById('available-points').textContent = localPlayer.statPoints;
  availablePoints = localPlayer.statPoints;
  
  // Enable/disable buttons based on available points
  updateStatButtons();
}

// Enable or disable stat buttons based on available points
function updateStatButtons() {
  const buttons = document.querySelectorAll('.stat-button');
  
  buttons.forEach(button => {
    button.disabled = availablePoints <= 0;
  });
}

// Send stat allocation request to server
function allocateStat(stat) {
  if (availablePoints <= 0) return;
  
  // Send allocation request
  socket.emit('allocateStat', { stat: stat });
}

// Handle server response to stat allocation
function handleStatsUpdated(data) {
  if (!localPlayer) return;
  
  // Update local player stats
  localPlayer.stats = data.stats;
  localPlayer.statPoints = data.statPoints;
  
  // Update UI
  updateStatsUI();
  
  // Update health and mana bars
  localPlayer.updateUI();
  
  // Show notification
  showNotification(`${statNameMap[data.statLastIncreased] || 'Atributo'} aumentado!`);
}

// Handle failed stat allocation
function handleStatAllocationFailed(data) {
  showNotification(data.message, 'error');
}

// Show a notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

// Map stat names to display names
const statNameMap = {
  strength: 'Força',
  agility: 'Agilidade',
  vitality: 'Vitalidade',
  energy: 'Energia'
};

// Recalculate derived stats from primary attributes
function recalculateDerivedStats() {
  if (!localPlayer) return;
  
  const stats = localPlayer.stats;
  
  // Update all derived stats based on primary attributes
  stats.maxHealth = 100 + (stats.vitality * 10);
  stats.maxMana = 100 + (stats.energy * 5);
  stats.maxStamina = 100 + (stats.agility * 8);
  stats.manaRegen = 2 + (stats.energy * 0.1);
  stats.staminaRegen = 5 + (stats.agility * 0.2);
  stats.defense = 5 + (stats.agility * 0.5);
  stats.speed = 0.15 + (stats.agility * 0.005);
  
  // Ensure current values don't exceed maximums
  stats.health = Math.min(stats.health, stats.maxHealth);
  stats.mana = Math.min(stats.mana, stats.maxMana);
  stats.stamina = Math.min(stats.stamina, stats.maxStamina);
}

// Handle level up event
function handleLevelUp() {
  if (!localPlayer) return;
  
  // Show level up animation and notification
  showLevelUpEffect();
  showNotification(`Nível aumentado para ${localPlayer.stats.level}!`, 'level-up');
  
  // Play sound when implemented
  // playSound('level-up');
  
  // Update UI
  document.getElementById('player-level').textContent = `Nível ${localPlayer.stats.level}`;
  updateStatsUI();
}

// Create a visual level up effect
function showLevelUpEffect() {
  if (!localPlayer || !localPlayer.mesh) return;
  
  // Create particle effect
  const particleCount = 20;
  const particleGroup = new THREE.Group();
  
  for (let i = 0; i < particleCount; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particle = new THREE.Mesh(geometry, material);
    
    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.5 + Math.random() * 0.5;
    particle.position.set(
      Math.cos(angle) * radius,
      Math.random() * 2,
      Math.sin(angle) * radius
    );
    
    // Store initial position and velocity
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.05,
      0.05 + Math.random() * 0.05,
      (Math.random() - 0.5) * 0.05
    );
    
    particleGroup.add(particle);
  }
  
  // Add to scene at player position
  particleGroup.position.copy(localPlayer.mesh.position);
  scene.add(particleGroup);
  
  // Animate particles
  const startTime = Date.now();
  const duration = 2000; // 2 seconds
  
  function animateParticles() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Update each particle
    particleGroup.children.forEach(particle => {
      // Move up and outward
      particle.position.add(particle.userData.velocity);
      
      // Fade out
      if (particle.material) {
        particle.material.opacity = 0.8 * (1 - progress);
      }
    });
    
    if (progress < 1) {
      requestAnimationFrame(animateParticles);
    } else {
      // Remove particles
      scene.remove(particleGroup);
    }
  }
  
  // Start animation
  animateParticles();
}

// Apply stat effects to player
function applyStatEffects() {
  if (!localPlayer) return;
  
  // Recalculate stats
  recalculateDerivedStats();
  
  // Apply movement speed from agility
  localPlayer.moveSpeed = localPlayer.stats.speed;
}


// Adicione estas funções ao stats.js
function calculatePhysicalDamage() {
  if (!localPlayer) return 0;
  const BASE_DAMAGE = 5;
  const strengthBonus = localPlayer.stats.strength * 0.5;
  return BASE_DAMAGE + strengthBonus;
}

function calculateMagicDamage() {
  if (!localPlayer) return 0;
  const BASE_DAMAGE = 15;
  const energyBonus = localPlayer.stats.energy * 0.8;
  return BASE_DAMAGE + energyBonus;
}