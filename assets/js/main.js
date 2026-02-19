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
  initSlideAwayAudio();
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
  const ACCELERATION_SCALE = 0.5;
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
    const instantVelocity = (angleDelta / deltaMs) * 1000 * ACCELERATION_SCALE;
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

function initSlideAwayAudio() {
  const audio = document.getElementById('slideAwayAudio');
  const muteToggle = document.getElementById('audioMuteToggle');
  const volumeRange = document.getElementById('audioVolumeRange');
  const statusText = document.getElementById('audioStatusText');
  if (!audio || !muteToggle || !volumeRange || !statusText) {
    return;
  }

  const setStatus = (message) => {
    statusText.textContent = message;
  };

  const syncMuteButton = () => {
    const mutedState = audio.muted || audio.volume === 0;
    muteToggle.textContent = mutedState ? 'Unmute' : 'Mute';
    muteToggle.setAttribute('aria-pressed', String(!mutedState));
  };

  const setVolume = (value) => {
    const nextVolume = Math.min(1, Math.max(0, value));
    audio.volume = nextVolume;
    audio.muted = nextVolume === 0;
    syncMuteButton();
  };

  const tryStartPlayback = async () => {
    try {
      await audio.play();
      setStatus('Playing');
      return true;
    } catch {
      return false;
    }
  };

  setVolume(Number(volumeRange.value || 0.5));
  audio.muted = false;
  syncMuteButton();

  volumeRange.addEventListener('input', () => {
    setVolume(Number(volumeRange.value));
    if (audio.paused) {
      audio.play().catch(() => {});
    }
    setStatus(audio.muted ? 'Muted' : 'Playing');
  });

  muteToggle.addEventListener('click', async () => {
    if (audio.muted || audio.volume === 0) {
      if (audio.volume === 0) {
        volumeRange.value = '0.5';
        audio.volume = 0.5;
      }
      audio.muted = false;
      if (audio.paused) {
        await audio.play().catch(() => {});
      }
      setStatus('Playing');
    } else {
      audio.muted = true;
      setStatus('Muted');
    }
    syncMuteButton();
  });

  audio.addEventListener('play', () => {
    setStatus(audio.muted ? 'Playing (muted)' : 'Playing');
  });

  audio.addEventListener('pause', () => {
    setStatus('Paused');
  });

  (async () => {
    const started = await tryStartPlayback();
    if (!started) {
      setStatus('Tap anywhere to start audio');
      const unlock = async () => {
        window.removeEventListener('pointerdown', unlock);
        await audio.play().then(() => {
          audio.muted = false;
          syncMuteButton();
          setStatus('Playing');
        }).catch(() => {
          setStatus('Audio blocked by browser');
        });
      };
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  })();
}
