/**
 * Utility functions for the game
 */

// Vector calculation utilities
const VectorUtils = {
    /**
     * Calculates distance between two points
     * @param {Object} point1 - First point with x, y, z coordinates
     * @param {Object} point2 - Second point with x, y, z coordinates
     * @returns {number} Distance between points
     */
    distance: function(point1, point2) {
      const dx = point2.x - point1.x;
      const dy = point2.y - point1.y;
      const dz = point2.z - point1.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    
    /**
     * Calculates squared distance between two points (faster than distance)
     * @param {Object} point1 - First point with x, y, z coordinates
     * @param {Object} point2 - Second point with x, y, z coordinates
     * @returns {number} Squared distance between points
     */
    distanceSquared: function(point1, point2) {
      const dx = point2.x - point1.x;
      const dy = point2.y - point1.y;
      const dz = point2.z - point1.z;
      return dx * dx + dy * dy + dz * dz;
    },
    
    /**
     * Interpolates between two positions
     * @param {Object} current - Current position
     * @param {Object} target - Target position
     * @param {number} factor - Interpolation factor (0-1)
     * @returns {Object} Interpolated position
     */
    lerp: function(current, target, factor) {
      return {
        x: current.x + (target.x - current.x) * factor,
        y: current.y + (target.y - current.y) * factor,
        z: current.z + (target.z - current.z) * factor
      };
    }
  };
  
  // Math utilities
  const MathUtils = {
    /**
     * Clamps a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp: function(value, min, max) {
      return Math.max(min, Math.min(value, max));
    },
    
    /**
     * Generates a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt: function(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Converts degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    degToRad: function(degrees) {
      return degrees * (Math.PI / 180);
    },
    
    /**
     * Converts radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    radToDeg: function(radians) {
      return radians * (180 / Math.PI);
    }
  };
  
  // Physics utilities
  const PhysicsUtils = {
    /**
     * Improved collision detection between a point and a box
     * @param {Object} point - Point with x, y, z coordinates
     * @param {Object} box - Box with min and max properties (THREE.Box3)
     * @returns {boolean} True if point is inside box
     */
    pointInBox: function(point, box) {
      return (
        point.x >= box.min.x && point.x <= box.max.x &&
        point.y >= box.min.y && point.y <= box.max.y &&
        point.z >= box.min.z && point.z <= box.max.z
      );
    },
    
    /**
     * Checks if a sphere intersects a box
     * @param {Object} sphereCenter - Center of sphere
     * @param {number} sphereRadius - Radius of sphere
     * @param {Object} box - Box with min and max properties (THREE.Box3)
     * @returns {boolean} True if sphere intersects box
     */
    sphereIntersectsBox: function(sphereCenter, sphereRadius, box) {
      // Find closest point on box to sphere center
      const closestPoint = {
        x: MathUtils.clamp(sphereCenter.x, box.min.x, box.max.x),
        y: MathUtils.clamp(sphereCenter.y, box.min.y, box.max.y),
        z: MathUtils.clamp(sphereCenter.z, box.min.z, box.max.z)
      };
      
      // Check if distance to closest point is less than radius
      return VectorUtils.distanceSquared(sphereCenter, closestPoint) <= (sphereRadius * sphereRadius);
    }
  };
  
  // UI utilities
  const UIUtils = {
    /**
     * Creates an element with specified attributes
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} content - Text content
     * @returns {HTMLElement} Created element
     */
    createElement: function(tag, attributes = {}, content = '') {
      const element = document.createElement(tag);
      
      // Set attributes
      for (const key in attributes) {
        if (key === 'style') {
          Object.assign(element.style, attributes.style);
        } else if (key === 'className') {
          element.className = attributes.className;
        } else {
          element.setAttribute(key, attributes[key]);
        }
      }
      
      // Set content
      if (content) {
        element.textContent = content;
      }
      
      return element;
    },
    
    /**
     * Shows a temporary message
     * @param {string} message - Message to show
     * @param {number} duration - Duration in milliseconds
     * @param {string} type - Message type (info, warning, error)
     */
    showMessage: function(message, duration = 3000, type = 'info') {
      const messageElement = this.createElement('div', {
        className: `game-message ${type}`,
        style: {
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          backgroundColor: type === 'error' ? 'rgba(255,0,0,0.7)' : 
                           type === 'warning' ? 'rgba(255,165,0,0.7)' : 
                           'rgba(0,0,255,0.7)',
          color: 'white',
          borderRadius: '5px',
          zIndex: '1000',
          pointerEvents: 'none'
        }
      }, message);
      
      document.body.appendChild(messageElement);
      
      // Remove after duration
      setTimeout(() => {
        document.body.removeChild(messageElement);
      }, duration);
    }
  };
  
  // Debug utilities
  const DebugUtils = {
    /**
     * Creates a visual representation of a collision box
     * @param {Object} box - THREE.Box3 object
     * @returns {THREE.Mesh} Wireframe mesh
     */
    createCollisionBoxHelper: function(box) {
      // Calculate dimensions
      const width = box.max.x - box.min.x;
      const height = box.max.y - box.min.y;
      const depth = box.max.z - box.min.z;
      
      // Create geometry
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      
      // Position at center of box
      mesh.position.set(
        box.min.x + width/2,
        box.min.y + height/2,
        box.min.z + depth/2
      );
      
      return mesh;
    },
    
    /**
     * Logs performance metrics
     * @param {string} label - Metric label
     * @param {number} value - Metric value
     */
    logPerformance: function(label, value) {
      console.log(`%c${label}: ${value}`, 'color: #0099ff');
    }
  };
  
  // Time utilities
  const TimeUtils = {
    /**
     * Formats time in milliseconds to mm:ss format
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time
     */
    formatTime: function(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    },
    
    /**
     * Creates a cooldown timer
     * @param {number} duration - Duration in milliseconds
     * @param {Function} onTick - Callback on each tick
     * @param {Function} onComplete - Callback on completion
     * @returns {Object} Timer control object
     */
    createTimer: function(duration, onTick, onComplete) {
      const startTime = Date.now();
      const endTime = startTime + duration;
      let timerId = null;
      
      const tick = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const progress = 1 - (remaining / duration);
        
        if (onTick) {
          onTick(remaining, progress);
        }
        
        if (now >= endTime) {
          if (onComplete) {
            onComplete();
          }
          
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
      
      // Start timer
      timerId = setInterval(tick, 100);
      tick(); // Initial tick
      
      // Return control object
      return {
        stop: () => {
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        },
        isRunning: () => timerId !== null,
        getRemaining: () => Math.max(0, endTime - Date.now()),
        getProgress: () => {
          const remaining = Math.max(0, endTime - Date.now());
          return 1 - (remaining / duration);
        }
      };
    }
  };
  
  // Export all utilities
  window.VectorUtils = VectorUtils;
  window.MathUtils = MathUtils;
  window.PhysicsUtils = PhysicsUtils;
  window.UIUtils = UIUtils;
  window.DebugUtils = DebugUtils;
  window.TimeUtils = TimeUtils;