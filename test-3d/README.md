# 3D Torso Auscultation Explorer (`test-3d`)

This directory integrates the 3D anatomical model (`Auscultation_Torso_v1.glb`) using Three.js, following the interactive auscultation methodology previously implemented in `CON-XR_Cardiac_Auscultation_Trainer`.

---

## 🎯 Architecture & Comparison with CON-XR

| Feature                 | Legacy CON-XR (`CON-XR_Cardiac`)                            | Modern `test-3d` Implementation                                                                                                                          |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model Format**        | `chest.fbx` & `heart.fbx` via `FBXLoader`                   | `Auscultation_Torso_v1.glb` via Three.js `GLTFLoader`                                                                                                    |
| **Auscultation Points** | Hardcoded 3D coordinate vector offsets                      | **Embedded GLTF Node Anchors**: `ANCHOR_AORTIC_VALVE`, `ANCHOR_PULMONIC_VALVE`, `ANCHOR_TRICUSPID_VALVE`, `ANCHOR_MITRAL_VALVE`                          |
| **Model Normalization** | Scaled & centered using `THREE.Box3`                        | Dynamic bounding box normalization, scaled to 5.6 units and centered at origin `(0, 0, 0)`                                                               |
| **Overlay Methodology** | 2D DOM buttons projected via `vector.project(camera)`       | CON-XR projection formula with NDC conversion, occlusion detection, and dynamic resize handling                                                          |
| **3D Markers**          | None on chest mesh                                          | Glowing center spheres with camera-facing pulsating billboarding rings + Raycaster click/hover support                                                   |
| **Lighting**            | Multi-point & directional setup with warm/cool accents      | Ambient light + Key directional light with PCF soft shadows + Opposite fill light + Overhead light + Warm (`0xff9944`) & cool (`0x4499ff`) accent lights |
| **Controls**            | `OrbitControls` with horizontal/vertical angle restrictions | `OrbitControls` with smooth damping (`dampingFactor: 0.06`), anatomical lock toggle, and free 360° examination                                           |
| **UI & Theming**        | Dark/Light mode, collapsible control panels                 | Glassmorphic floating dock, responsive clinical information card, keyboard shortcuts, and live theme switching                                           |

---

## 📍 Anatomic Valve Landmarks in `Auscultation_Torso_v1.glb`

1. **Aortic Area (`ANCHOR_AORTIC_VALVE`)**
   - **Landmark**: 2nd Intercostal Space, Right Sternal Border
   - **Acoustics**: S2 louder than S1 (A2 aortic closure)
   - **Key Findings**: Systolic ejection murmur of Aortic Stenosis radiating to carotids; early diastolic decrescendo murmur of Aortic Regurgitation.

2. **Pulmonic Area (`ANCHOR_PULMONIC_VALVE`)**
   - **Landmark**: 2nd Intercostal Space, Left Sternal Border
   - **Acoustics**: Physiological splitting of S2 during inspiration (P2 closure)
   - **Key Findings**: Pulmonic stenosis, pulmonary hypertension, and fixed S2 splitting in Atrial Septal Defect (ASD).

3. **Tricuspid Area (`ANCHOR_TRICUSPID_VALVE`)**
   - **Landmark**: 4th–5th Intercostal Space, Left Lower Sternal Border
   - **Acoustics**: Tricuspid valve closure (T1 component of S1)
   - **Key Findings**: Holosystolic murmur of Tricuspid Regurgitation (Carvallo's sign: increases with inspiration); Ventricular Septal Defect (VSD).

4. **Mitral Area (`ANCHOR_MITRAL_VALVE`)**
   - **Landmark**: 5th Intercostal Space, Left Midclavicular Line (Cardiac Apex)
   - **Acoustics**: S1 louder than S2 (M1 closure); point of maximal impulse (PMI)
   - **Key Findings**: Holosystolic murmur of Mitral Regurgitation radiating to axilla; diastolic rumble with opening snap in Mitral Stenosis; S3 and S4 gallops.

---

## 🚀 Running the Viewer

### 1. Vite Development Server

From the repository root (`cardiac-auscultation-trainer`):

```bash
npm run dev
```

Then navigate to:

- **`http://localhost:5173/test-3d/`** for the standalone 3D explorer page
- Or open the main app at `http://localhost:5173/` and navigate to the 3D model tab.

### 2. Standalone Static Server

```bash
npx serve test-3d
```

### 3. Production Build

```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

- `1` or `A`: Select Aortic Area
- `2` or `P`: Select Pulmonic Area
- `3` or `T`: Select Tricuspid Area
- `4` or `M`: Select Mitral Area
- `R`: Reset camera view
- `W`: Toggle wireframe mesh mode
