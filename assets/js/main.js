document.addEventListener('DOMContentLoaded', () => {
  const yearTarget = document.getElementById('currentYear');
  if (yearTarget) {
    yearTarget.textContent = String(new Date().getFullYear());
  }

  const revealItems = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  initVinylDrag();
});

function initVinylDrag() {
  const vinylWrap = document.querySelector('.vinyl-wrap');
  const vinylRecord = vinylWrap?.querySelector('.vinyl-record');
  if (!vinylWrap || !vinylRecord) {
    return;
  }

  let isDragging = false;
  let lastAngle = 0;
  let manualRotation = 0;

  const getAngle = (event) => {
    const rect = vinylWrap.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
  };

  const normalizeDelta = (delta) => {
    if (delta > 180) {
      return delta - 360;
    }
    if (delta < -180) {
      return delta + 360;
    }
    return delta;
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    isDragging = true;
    lastAngle = getAngle(event);
    vinylWrap.classList.add('dragging');

    if (event.pointerId !== undefined && vinylWrap.setPointerCapture) {
      vinylWrap.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
  };

  const dragSpin = (event) => {
    if (!isDragging) {
      return;
    }

    const currentAngle = getAngle(event);
    const angleDelta = normalizeDelta(currentAngle - lastAngle);
    manualRotation += angleDelta;
    vinylRecord.style.setProperty('--drag-rotation', `${manualRotation}deg`);
    lastAngle = currentAngle;
  };

  const stopDrag = (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    vinylWrap.classList.remove('dragging');

    if (event.pointerId !== undefined && vinylWrap.releasePointerCapture) {
      try {
        vinylWrap.releasePointerCapture(event.pointerId);
      } catch {
        // Safe fallback for browsers that reject release when pointer is already gone.
      }
    }
  };

  vinylWrap.addEventListener('pointerdown', startDrag);
  window.addEventListener('pointermove', dragSpin);
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
}
