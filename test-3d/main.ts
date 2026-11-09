import { CardiacAudioPlayer } from '../src/audio/player';
import { locationsRecord, manifest, PRESET_SOUND_SETS, spatialConfig } from '../src/data';
import { calculateSpatialAuscultation } from '../src/engine/spatial';
import { DEFAULT_MODEL_URL, Torso3DViewer } from './test-3d.ts';
import type { AuscultationPointDefinition, AuscultationPointId, PinDropData } from './types.ts';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');
  const loadingElement = document.getElementById('loading');
  const loadingProgress = document.getElementById('loading-progress');

  if (!container) {
    console.error('Fatal: #container element not found');
    return;
  }

  // Audio Auscultation Engine Setup
  const defaultSoundSet = PRESET_SOUND_SETS.find((s) => s.id === 'normal-s1-s2') ??
    PRESET_SOUND_SETS[0] ?? {
      id: 'normal-s1-s2',
      label: 'Normal S1-S2 Heart Sound',
      events: [],
    };

  const player = new CardiacAudioPlayer(defaultSoundSet, locationsRecord.aortic, manifest);
  player.setBpm(72);
  player.setVolume(0.8);
  player.setLoop(true);

  // Preload sound sample buffers in background
  void player
    .getSampleLoader()
    .preloadManifest(manifest)
    .catch((err: unknown) => {
      console.warn('Audio preloading hitch:', err);
    });

  // Info card elements
  const infoTitle = document.getElementById('infoTitle');
  const infoTag = document.getElementById('infoTag');
  const infoLandmark = document.getElementById('infoLandmark');
  const infoSound = document.getElementById('infoSound');
  const infoSignificance = document.getElementById('infoSignificance');
  const infoCondition = document.getElementById('infoCondition');

  // Audio Control Elements
  const btnPlayAudio = document.getElementById('btnPlayAudio') as HTMLButtonElement | null;
  const playIcon = document.getElementById('playIcon');
  const playLabel = document.getElementById('playLabel');
  const selectCondition = document.getElementById('selectCondition') as HTMLSelectElement | null;
  const sliderBpm = document.getElementById('sliderBpm') as HTMLInputElement | null;
  const labelBpm = document.getElementById('labelBpm');
  const sliderVolume = document.getElementById('sliderVolume') as HTMLInputElement | null;
  const labelVolume = document.getElementById('labelVolume');
  const btnToggleStethoscope = document.getElementById(
    'btnToggleStethoscope',
  ) as HTMLButtonElement | null;

  // Pin Drop HUD elements
  const pinDropHud = document.getElementById('pinDropHud');
  const pinModelCoords = document.getElementById('pinModelCoords');
  const pinNormalCoords = document.getElementById('pinNormalCoords');
  const pinProximity = document.getElementById('pinProximity');
  const pinTissueFilter = document.getElementById('pinTissueFilter');
  const pinSpatialGain = document.getElementById('pinSpatialGain');
  const btnPinClear = document.getElementById('btnPinClear');
  const btnPinCopy = document.getElementById('btnPinCopy');
  const btnTogglePinDrop = document.getElementById('btnTogglePinDrop');

  // Populate Condition Dropdown
  if (selectCondition) {
    for (const set of PRESET_SOUND_SETS) {
      const option = document.createElement('option');
      option.value = set.id;
      option.textContent = set.label;
      selectCondition.appendChild(option);
    }
    selectCondition.value = defaultSoundSet.id;
    selectCondition.addEventListener('change', () => {
      const chosen = PRESET_SOUND_SETS.find((s) => s.id === selectCondition.value);
      if (chosen) {
        player.setSoundSet(chosen);
      }
    });
  }

  const updateAudioPlayButton = (): void => {
    const isPlaying = player.getIsPlaying();
    if (btnPlayAudio) {
      btnPlayAudio.classList.toggle('playing', isPlaying);
      btnPlayAudio.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    }
    if (playIcon) playIcon.textContent = isPlaying ? '⏸' : '▶';
    if (playLabel) playLabel.textContent = isPlaying ? 'Pause' : 'Auscultate';
  };

  const toggleAudioPlayback = async (): Promise<void> => {
    if (player.getIsPlaying()) {
      player.stop();
      updateAudioPlayButton();
    } else {
      await player.play();
      updateAudioPlayButton();
    }
  };

  btnPlayAudio?.addEventListener('click', () => {
    void toggleAudioPlayback();
  });

  sliderBpm?.addEventListener('input', () => {
    const bpm = Number(sliderBpm.value);
    player.setBpm(bpm);
    if (labelBpm) labelBpm.textContent = String(bpm);
  });

  sliderVolume?.addEventListener('input', () => {
    const vol = Number(sliderVolume.value);
    player.setVolume(vol / 100);
    if (labelVolume) labelVolume.textContent = `${String(vol)}%`;
  });

  const applySpatialAcoustics = (data: PinDropData): void => {
    const spatial = calculateSpatialAuscultation(
      data.modelPosition,
      locationsRecord,
      spatialConfig,
    );

    // Apply real-time acoustic spatialization to the audio player
    player.setLocation(spatial.effectiveLocation);
    player.setSpatialParameters({
      gain: spatial.spatialGain,
      lowpassHz: spatial.tissueLowpassHz,
      pan: spatial.stereoPan,
    });

    // Update HUD metrics
    if (pinDropHud) {
      pinDropHud.style.display = 'block';
    }
    if (pinModelCoords) {
      pinModelCoords.textContent = `[${data.modelPosition.join(', ')}]`;
    }
    if (pinNormalCoords) {
      pinNormalCoords.textContent = `[${data.normal.join(', ')}]`;
    }
    if (pinProximity) {
      const nearestId = spatial.nearestValveId;
      const nearestPct = Math.round(spatial.valveWeights[nearestId] * 100);
      const valveName = nearestId.charAt(0).toUpperCase() + nearestId.slice(1);
      pinProximity.textContent = `${valveName} (${String(nearestPct)}%)`;
    }
    if (pinTissueFilter) {
      pinTissueFilter.textContent = `${spatial.tissueLowpassHz.toLocaleString()} Hz`;
    }
    if (pinSpatialGain) {
      const pct = Math.round(spatial.spatialGain * 100);
      pinSpatialGain.textContent = `${String(pct)}%`;
    }
  };

  const updateInfoCard = (point: AuscultationPointDefinition): void => {
    if (infoTitle) infoTitle.textContent = point.name;
    if (infoTag) {
      infoTag.textContent = point.id.toUpperCase();
      infoTag.style.backgroundColor = point.color;
    }
    if (infoLandmark) infoLandmark.textContent = point.landmark;
    if (infoSound) infoSound.textContent = point.soundDescription;
    if (infoSignificance) infoSignificance.textContent = point.clinicalSignificance;
    if (infoCondition) infoCondition.textContent = point.primaryCondition;

    // Update bottom dock active states
    document.querySelectorAll<HTMLButtonElement>('.switch-btn').forEach((btn) => {
      const ptId = btn.dataset['point'];
      if (ptId === point.id) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  };

  const viewer = new Torso3DViewer(container, {
    modelUrl: DEFAULT_MODEL_URL,
    initialPoint: 'aortic',
    enableAutoRotate: false,
    lockRotation: false,
    isDarkMode: true,
    enablePinDrop: true,
    enableStethoscopeDrag: true,
    onPointSelected: (point) => {
      updateInfoCard(point);
    },
    onPinDrop: (data) => {
      applySpatialAcoustics(data);
      if (btnPinCopy) {
        btnPinCopy.textContent = 'Copy Model Coordinates';
        btnPinCopy.classList.remove('copied');
      }
    },
    onStethoscopeMove: (data) => {
      applySpatialAcoustics(data);
    },
    onLoadingProgress: (percent) => {
      if (loadingProgress) {
        loadingProgress.textContent = `${String(percent)}%`;
      }
    },
    onModelLoaded: () => {
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      // Initialize with default aortic position
      viewer.selectAuscultationPoint('aortic');
    },
    onError: (err) => {
      if (loadingElement) {
        loadingElement.innerHTML = `
          <div style="color: #ef4444; font-weight: 700; margin-bottom: 8px;">Error Loading Model</div>
          <div style="font-size: 13px; color: var(--text-muted);">${err.message}</div>
        `;
      }
    },
  });

  // Stethoscope Drag Toggle
  if (btnToggleStethoscope) {
    btnToggleStethoscope.classList.add('active');
    btnToggleStethoscope.addEventListener('click', () => {
      const isSteth = viewer.toggleStethoscopeMode();
      btnToggleStethoscope.classList.toggle('active', isSteth);
    });
  }

  // Register the 2D projected overlay buttons
  const pointIds: AuscultationPointId[] = ['aortic', 'pulmonic', 'tricuspid', 'mitral'];
  pointIds.forEach((id) => {
    const btnContainer = document.getElementById(`${id}-btn`);
    if (btnContainer) {
      viewer.registerButtonElement(id, btnContainer);
    }
  });

  // Wire up bottom dock switcher buttons
  document.querySelectorAll<HTMLButtonElement>('.switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ptId = btn.dataset['point'] as AuscultationPointId | undefined;
      if (ptId) {
        viewer.selectAuscultationPoint(ptId);
      }
    });
  });

  // Wire up utility control buttons
  btnTogglePinDrop?.addEventListener('click', () => {
    const isEnabled = viewer.togglePinDrop();
    btnTogglePinDrop.classList.toggle('active', isEnabled);
  });

  btnPinClear?.addEventListener('click', () => {
    viewer.clearPin();
    if (pinDropHud) {
      pinDropHud.style.display = 'none';
    }
  });

  if (btnPinCopy) {
    btnPinCopy.addEventListener('click', () => {
      const lastPin = viewer.getLastPinDrop();
      if (!lastPin) return;
      const copyText = `[${lastPin.modelPosition.join(', ')}]`;
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          btnPinCopy.textContent = 'Copied!';
          btnPinCopy.classList.add('copied');
          setTimeout(() => {
            btnPinCopy.textContent = 'Copy Model Coordinates';
            btnPinCopy.classList.remove('copied');
          }, 2000);
        })
        .catch((err: unknown) => {
          console.warn('Clipboard copy failed:', err);
        });
    });
  }

  const btnReset = document.getElementById('btnResetCamera');
  btnReset?.addEventListener('click', () => {
    viewer.resetCamera();
  });

  const btnAutoRotate = document.getElementById('btnToggleAutoRotate');
  btnAutoRotate?.addEventListener('click', () => {
    const isRotating = viewer.toggleAutoRotate();
    btnAutoRotate.classList.toggle('active', isRotating);
  });

  const btnLockRotation = document.getElementById('btnToggleRotationLock');
  btnLockRotation?.addEventListener('click', () => {
    const isLocked = viewer.toggleRotationLock();
    btnLockRotation.classList.toggle('active', isLocked);
    btnLockRotation.textContent = isLocked ? '🔒' : '🔓';
  });

  const btnWireframe = document.getElementById('btnToggleWireframe');
  btnWireframe?.addEventListener('click', () => {
    const isWireframe = viewer.toggleWireframe();
    btnWireframe.classList.toggle('active', isWireframe);
  });

  const btnTheme = document.getElementById('btnToggleTheme');
  btnTheme?.addEventListener('click', () => {
    const isDark = viewer.toggleDarkMode();
    document.body.classList.toggle('light-mode', !isDark);
    btnTheme.textContent = isDark ? '🌙' : '🔆';
  });

  // Keyboard navigation shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case ' ':
      case 's':
        e.preventDefault();
        void toggleAudioPlayback();
        break;
      case 'l':
        btnToggleStethoscope?.click();
        break;
      case '1':
      case 'a':
        viewer.selectAuscultationPoint('aortic');
        break;
      case '2':
      case 'p':
        viewer.selectAuscultationPoint('pulmonic');
        break;
      case '3':
      case 't':
        viewer.selectAuscultationPoint('tricuspid');
        break;
      case '4':
      case 'm':
        viewer.selectAuscultationPoint('mitral');
        break;
      case 'r':
        viewer.resetCamera();
        break;
      case 'w':
        btnWireframe?.click();
        break;
      case 'd':
        btnTogglePinDrop?.click();
        break;
      case 'c':
        btnPinClear?.click();
        break;
    }
  });

  // Expose player and viewer globally for debugging / automation
  (
    window as unknown as { torsoViewer: Torso3DViewer; audioPlayer: CardiacAudioPlayer }
  ).torsoViewer = viewer;
  (
    window as unknown as { torsoViewer: Torso3DViewer; audioPlayer: CardiacAudioPlayer }
  ).audioPlayer = player;
});
