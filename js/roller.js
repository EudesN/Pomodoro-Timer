/**
 * ROLLER MODULE - POPOMUS
 * Number Rolling Animation (3D Mechanical Odometer / Drum Reel effect)
 * High-performance, drift-safe, hardware-accelerated rolling digit animations.
 */

class DigitRoller {
  constructor(element, options = {}) {
    this.element = element;
    this.enabled = options.enabled !== false;
    this.duration = options.duration || 360;
    this.currentValue = '';
    this.slots = [];
    this.lastDirection = 'down';

    // Pre-initialize if element already has text
    const initialText = this.element.textContent.trim();
    if (initialText) {
      this.setValue(initialText, null, true);
    }
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  _buildSlots(text) {
    this.element.innerHTML = '';
    this.slots = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const slot = document.createElement('span');
      const isDigit = /\d/.test(char);

      if (isDigit) {
        slot.className = 'roll-slot roll-slot-digit';
        slot.setAttribute('aria-hidden', 'true');
        slot.dataset.index = String(i);

        const unit = document.createElement('span');
        unit.className = 'roll-unit roll-unit-active';
        unit.textContent = char;
        slot.appendChild(unit);
      } else {
        slot.className = 'roll-slot roll-slot-sep';
        slot.setAttribute('aria-hidden', 'true');
        slot.textContent = char;
      }

      this.element.appendChild(slot);
      this.slots.push(slot);
    }

    this.element.setAttribute('aria-label', text);
  }

  setValue(newText, direction = null, isInitial = false) {
    if (newText === undefined || newText === null) return;
    const str = String(newText);

    // Initial setup or string format length change requires rebuilding slot structure
    if (isInitial || this.slots.length !== str.length || this.element.children.length === 0) {
      this._buildSlots(str);
      this.currentValue = str;
      return;
    }

    this.element.setAttribute('aria-label', str);

    // If animations disabled, update text directly without rolling
    if (!this.enabled) {
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const slot = this.slots[i];
        if (!slot) continue;
        if (slot.classList.contains('roll-slot-digit')) {
          slot.innerHTML = `<span class="roll-unit roll-unit-active">${char}</span>`;
        } else {
          slot.textContent = char;
        }
      }
      this.currentValue = str;
      return;
    }

    // Nothing changed
    if (str === this.currentValue) return;

    const oldStr = this.currentValue;
    this.currentValue = str;
    const dir = direction ? (direction === 'up' ? 'up' : 'down') : 'down';
    this.lastDirection = dir;

    for (let i = 0; i < str.length; i++) {
      const oldChar = oldStr[i];
      const newChar = str[i];

      if (oldChar === newChar) continue;

      const slot = this.slots[i];
      if (!slot || slot.classList.contains('roll-slot-sep')) continue;

      this._rollSlot(slot, oldChar, newChar, dir);
    }
  }

  _rollSlot(slot, oldChar, newChar, direction) {
    // Clean up any stale exit elements immediately
    const existingExits = slot.querySelectorAll('.roll-unit-exit');
    existingExits.forEach(el => el.remove());

    const currentUnit = slot.querySelector('.roll-unit-active') || slot.querySelector('.roll-unit-enter') || slot.lastElementChild;

    if (currentUnit) {
      currentUnit.className = `roll-unit roll-unit-exit roll-dir-${direction}`;
    }

    const newUnit = document.createElement('span');
    newUnit.className = `roll-unit roll-unit-enter roll-dir-${direction}`;
    newUnit.textContent = newChar;
    slot.appendChild(newUnit);

    const animDuration = this.duration || 350;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (currentUnit && currentUnit.parentNode === slot) {
        currentUnit.remove();
      }
      if (newUnit.parentNode === slot) {
        newUnit.className = 'roll-unit roll-unit-active';
        newUnit.style.transform = '';
        newUnit.style.opacity = '';
      }
    };

    // Prioritize Web Animations API (runs smoothly in all modern WebKit/Blink/Gecko)
    if (typeof newUnit.animate === 'function') {
      const isDown = (direction === 'down');
      const enterKeyframes = isDown
        ? [
            { transform: 'translateY(-100%)', opacity: 0.15 },
            { transform: 'translateY(0)', opacity: 1 }
          ]
        : [
            { transform: 'translateY(100%)', opacity: 0.15 },
            { transform: 'translateY(0)', opacity: 1 }
          ];

      const exitKeyframes = isDown
        ? [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(100%)', opacity: 0.05 }
          ]
        : [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-100%)', opacity: 0.05 }
          ];

      const animOptions = {
        duration: animDuration,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      };

      try {
        if (currentUnit) {
          currentUnit.animate(exitKeyframes, animOptions);
        }
        const enterAnim = newUnit.animate(enterKeyframes, animOptions);
        enterAnim.onfinish = settle;
      } catch (e) {
        newUnit.addEventListener('animationend', settle, { once: true });
      }
    } else {
      newUnit.addEventListener('animationend', settle, { once: true });
    }

    // Safety fallback timeout
    setTimeout(settle, animDuration + 40);
  }
}

if (typeof window !== 'undefined') {
  window.DigitRoller = DigitRoller;
}

/**
 * Rolling counter animation for stats numbers (count-up roll)
 */
function animateRollingCounter(element, targetValue, duration = 550, suffix = '') {
  if (!element) return;
  const start = 0;
  const end = typeof targetValue === 'number' ? targetValue : parseFloat(targetValue) || 0;
  const isFloat = end % 1 !== 0;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Smooth easeOutExpo: fast launch, silky deceleration
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = start + (end - start) * ease;
    const displayVal = isFloat ? current.toFixed(1) : Math.round(current);
    element.textContent = `${displayVal}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = `${isFloat ? end.toFixed(1) : end}${suffix}`;
    }
  }

  requestAnimationFrame(step);
}
