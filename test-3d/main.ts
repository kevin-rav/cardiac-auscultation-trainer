import { Torso3DViewer } from './test-3d.ts';
import type { AuscultationPointDefinition, AuscultationPointId } from './types.ts';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('container');
  const loadingElement = document.getElementById('loading');
  const loadingProgress = document.getElementById('loading-progress');

  if (!container) {
    console.error('Fatal: #container element not found');
    return;
  }

  // Info card elements
  const infoTitle = document.getElementById('infoTitle');
  const infoTag = document.getElementById('infoTag');
  const infoLandmark = document.getElementById('infoLandmark');
  const infoSound = document.getElementById('infoSound');
  const infoSignificance = document.getElementById('infoSignificance');
  const infoCondition = document.getElementById('infoCondition');

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
    modelUrl: './Auscultation_Torso_v1.glb',
    initialPoint: 'aortic',
    enableAutoRotate: false,
    lockRotation: false,
    isDarkMode: true,
    onPointSelected: (point) => {
      updateInfoCard(point);
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
    }
  });

  // Expose viewer globally for debugging / automation
  (window as unknown as { torsoViewer: Torso3DViewer }).torsoViewer = viewer;
});
