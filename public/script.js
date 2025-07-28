// public/microwave.js (für Three.js)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Wichtig: /addons/
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Optional: Zum Debuggen der Kamera

let scene, camera, renderer, microwaveModel, controls;

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    loadMicrowaveModel();
    animate(); // Startet den Render-Loop
});

function initThreeJS() {
    const canvas = document.getElementById('microwaveCanvas');
    const container = canvas.parentElement; // Der div.microwave-display Container

    // Szene erstellen
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); // Dunkler Hintergrund

    // Kamera erstellen (PerspectiveCamera: field of view, aspect ratio, near, far)
    camera = new THREE.PerspectiveCamera(
        75, // Sichtfeld in Grad
        container.clientWidth / container.clientHeight, // Seitenverhältnis
        0.1, // Near-Clipping-Plane
        1000 // Far-Clipping-Plane
    );
    camera.position.set(0, 1.5, 3); // Kamera-Position (X, Y, Z)

    // Renderer erstellen
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Für schärfere Darstellung auf HiDPI-Bildschirmen
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Für korrekte Farbdarstellung

    // Optional: OrbitControls für Debugging - Erlaubt es, die Kamera mit der Maus zu steuern
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Für eine weichere Bewegung
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0); // Den Fokuspunkt der Kamera setzen

    // Lichter hinzufügen
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Sanftes Umgebungslicht
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // Direktionales Licht (wie Sonnenlicht)
    directionalLight.position.set(5, 10, 7.5); // Position des Lichts
    scene.add(directionalLight);

    // Responsive Design: Passt Canvas und Kamera an die Fenstergröße an
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById('microwaveCanvas').parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function loadMicrowaveModel() {
    const loader = new GLTFLoader();

    loader.load(
        'models/microwave_model.glb', // Pfad zu deinem GLB-Modell
        function (gltf) {
            microwaveModel = gltf.scene;
            scene.add(microwaveModel);

            // Optional: Positioniere das Modell, falls es nicht zentriert ist
            microwaveModel.position.set(0, 0, 0); // Beispiel: zentrieren
            // microwaveModel.scale.set(0.1, 0.1, 0.1); // Beispiel: Skaliere das Modell, falls zu groß/klein

            console.log('Mikrowellen-Modell erfolgreich geladen!', microwaveModel);
            // Hier würden wir später die Tür und den Knopf identifizieren
        },
        function (xhr) {
            // Fortschritt der Ladung
            console.log((xhr.loaded / xhr.total * 100) + '% geladen');
        },
        function (error) {
            // Fehler beim Laden
            console.error('Fehler beim Laden des Mikrowellen-Modells:', error);
        }
    );
}

// Render-Schleife
function animate() {
    requestAnimationFrame(animate); // Fordert den nächsten Frame an

    if (controls) {
        controls.update(); // Nur aktualisieren, wenn OrbitControls verwendet werden
    }

    renderer.render(scene, camera); // Rendert die Szene mit der Kamera
}

// --- Hier würden später die Funktionen für Tür, Knopf, Items etc. hinzukommen ---