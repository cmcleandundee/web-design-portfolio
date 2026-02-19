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
  let lastMoveTime = 0;
  let manualRotation = 0;
  let dragVelocity = 0;
  let inertiaVelocity = 0;
  let frameId = null;

  const MAX_RELEASE_VELOCITY = 1080; // deg/s
  const VELOCITY_BLEND = 0.35;
  const DECAY_PER_SECOND = 0.68;
  const STOP_THRESHOLD = 6;

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

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const setManualRotation = (rotation) => {
    manualRotation = rotation;
    vinylRecord.style.setProperty('--drag-rotation', `${manualRotation}deg`);
  };

  const stopInertiaLoop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const startInertiaLoop = () => {
    if (frameId !== null) {
      return;
    }

    let prevTime = performance.now();
    const tick = (now) => {
      const deltaSeconds = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      if (!isDragging && Math.abs(inertiaVelocity) > 0) {
        setManualRotation(manualRotation + inertiaVelocity * deltaSeconds);
        inertiaVelocity *= Math.pow(DECAY_PER_SECOND, deltaSeconds);
        if (Math.abs(inertiaVelocity) < STOP_THRESHOLD) {
          inertiaVelocity = 0;
        }
      }

      if (isDragging || Math.abs(inertiaVelocity) > 0) {
        frameId = requestAnimationFrame(tick);
      } else {
        frameId = null;
      }
    };

    frameId = requestAnimationFrame(tick);
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    stopInertiaLoop();
    inertiaVelocity = 0;
    dragVelocity = 0;
    isDragging = true;
    lastAngle = getAngle(event);
    lastMoveTime = performance.now();
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
    const now = performance.now();
    const deltaMs = Math.max(now - lastMoveTime, 1);
    const instantVelocity = (angleDelta / deltaMs) * 1000;
    dragVelocity = dragVelocity * (1 - VELOCITY_BLEND) + instantVelocity * VELOCITY_BLEND;

    setManualRotation(manualRotation + angleDelta);
    lastAngle = currentAngle;
    lastMoveTime = now;
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

    inertiaVelocity = clamp(dragVelocity, -MAX_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY);
    dragVelocity = 0;
    if (Math.abs(inertiaVelocity) >= STOP_THRESHOLD) {
      startInertiaLoop();
    } else {
      inertiaVelocity = 0;
    }
  };

  vinylWrap.addEventListener('pointerdown', startDrag);
  window.addEventListener('pointermove', dragSpin);
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
}
