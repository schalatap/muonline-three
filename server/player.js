/**
 * Enhanced player module with stat system
 */

/**
 * Creates a new player
 * @param {string} id - Unique player ID
 * @param {Object} spawnPoint - Initial player position
 * @returns {Object} Player object
 */
function createPlayer(id, spawnPoint) {
  return {
    id: id,
    position: spawnPoint,
    rotation: { y: 0 },
    
    // Basic stats
    stats: {
      // Primary attributes
      strength: 10,    // Increases physical damage
      agility: 10,     // Increases speed and defense
      vitality: 10,    // Increases health
      energy: 10,      // Increases magic damage and mana
      
      // Derived stats
      health: 100,
      maxHealth: 100,
      mana: 100,
      maxMana: 100,
      stamina: 100,
      maxStamina: 100,
      staminaRegen: 5,
      manaRegen: 2,    // Mana points regenerated per second
      speed: 0.15,     // Movement speed
      defense: 5,      // Physical damage reduction
      
      // Character info
      level: 1,
      experience: 0,
      nextLevelExp: 100
    },
    
    // Available stat points to distribute
    statPoints: 20,
    
    // Timers
    lastAttackTime: 0,
    lastSpellTime: 0,
    lastMoveTime: 0,
    lastManaRegen: Date.now(),
    lastStaminaRegen: Date.now(),
    
    // Inventory and equipment
    inventory: [],
    equipment: {},
    
    // Statistics tracking
    statistics: {
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageReceived: 0,
      spellsCast: 0,
      experienceGained: 0
    },
    
    // Spell definitions
    spells: {
      fireball: {
        manaCost: 15,
        baseDamage: 20,
        cooldown: 1.5, // Seconds
        range: 20
      }
    }
  };
}

/**
 * Applies damage to a player
 * @param {Object} player - Player object
 * @param {number} rawDamage - Raw damage amount
 * @param {Object} attacker - Attacker player object
 * @returns {number} Actual damage dealt after defenses
 */
function calculateDamage(player, rawDamage, attacker) {
  // Calculate damage reduction from defense
  const defenseReduction = player.stats.defense / (player.stats.defense + 50);
  const damageReduction = rawDamage * defenseReduction;
  
  // Calculate final damage (minimum 1)
  return Math.max(1, Math.floor(rawDamage - damageReduction));
}

/**
 * Applies damage to a player
 * @param {Object} player - Player object
 * @param {number} damage - Damage amount
 * @param {string} attackerId - Attacker's ID
 * @returns {boolean} True if player died, False otherwise
 */
function damagePlayer(player, damage, attackerId) {
  player.stats.health -= damage;
  player.statistics.damageReceived += damage;
  
  // Ensure health doesn't go below 0
  if (player.stats.health < 0) {
    player.stats.health = 0;
  }
  
  return player.stats.health <= 0;
}

/**
 * Consumes mana for casting a spell
 * @param {Object} player - Player object
 * @param {string} spellName - Name of the spell
 * @returns {boolean} True if mana was consumed, False if not enough mana
 */
function consumeMana(player, spellName) {
  if (!player.spells || !player.spells[spellName]) {
    return false; // Spell not found
  }
  
  const spell = player.spells[spellName];
  
  // Check if player has enough mana
  if (player.stats.mana < spell.manaCost) {
    return false; // Not enough mana
  }
  
  // Consume mana
  player.stats.mana -= spell.manaCost;
  
  // Record spell cast
  player.statistics.spellsCast += 1;
  
  return true;
}

/**
 * Regenerates mana over time
 * @param {Object} player - Player object
 * @param {number} deltaTime - Time passed in seconds
 */
function regenerateMana(player, deltaTime) {
  // Calculate how much mana to regenerate (affected by energy)
  const energyBonus = player.stats.energy * 0.05;
  const manaToRegen = (player.stats.manaRegen + energyBonus) * deltaTime;
  
  // Apply regeneration
  player.stats.mana = Math.min(player.stats.maxMana, player.stats.mana + manaToRegen);
}

/**
 * Adds experience to a player and handles leveling up
 * @param {Object} player - Player object
 * @param {number} amount - Amount of experience to add
 * @returns {boolean} True if player leveled up
 */
function addExperience(player, amount) {
  player.statistics.experienceGained += amount;
  player.stats.experience += amount;
  
  // Check for level up
  if (player.stats.experience >= player.stats.nextLevelExp) {
    levelUp(player);
    return true;
  }
  
  return false;
}

/**
 * Increases player level and stats
 * @param {Object} player - Player object
 * @param {number} [extraPoints=5] - Extra stat points to award (default 5)
 */
function levelUp(player, extraPoints = 5) {
  player.stats.level += 1;
  
  // Calculate experience for next level
  player.stats.experience -= player.stats.nextLevelExp;
  player.stats.nextLevelExp = Math.floor(player.stats.nextLevelExp * 1.5);
  
  // Award stat points - padronizado para 30 pontos por level
  player.statPoints += extraPoints;
  
  // Update derived stats
  updateDerivedStats(player);
  
  // Fully restore health and mana on level up
  player.stats.health = player.stats.maxHealth;
  player.stats.mana = player.stats.maxMana;
  player.stats.stamina = player.stats.maxStamina;
}
/**
 * Updates kill statistics
 * @param {Object} victim - Player who died
 * @param {Object} killer - Player who killed
 */
function recordKill(victim, killer) {
  if (victim && killer) {
    victim.statistics.deaths += 1;
    killer.statistics.kills += 1;
    
    // Award experience to the killer
    addExperience(killer, 20 * victim.stats.level);
  }
}

/**
 * Updates derived stats based on primary attributes
 * @param {Object} player - Player object
 */
function updateDerivedStats(player) {
  // Health based on vitality
  player.stats.maxHealth = 100 + (player.stats.vitality * 10);
  
  // Mana based on energy
  player.stats.maxMana = 100 + (player.stats.energy * 5);
  
  // Stamina based on agility
  player.stats.maxStamina = 100 + (player.stats.agility * 8);
  
  // Mana regeneration based on energy
  player.stats.manaRegen = 2 + (player.stats.energy * 0.1);
  
  // Stamina regeneration based on agility
  player.stats.staminaRegen = 5 + (player.stats.agility * 0.2);
  
  // Defense based on agility
  player.stats.defense = 5 + (player.stats.agility * 0.5);
  
  // Speed based on agility
  player.stats.speed = 0.15 + (player.stats.agility * 0.005);
}

module.exports = {
  createPlayer,
  damagePlayer,
  calculateDamage,
  consumeMana,
  regenerateMana,
  addExperience,
  levelUp,
  recordKill,
  updateDerivedStats
};