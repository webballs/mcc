// public/microwave.js

import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('microwaveCanvas');
    const toggleDoorButton = document.getElementById('toggleDoorButton');
    // HINZUGEFÜGT: Referenz auf die Item-Buttons
    const itemButtons = document.querySelectorAll('.itemButton');

    if (!canvas || !toggleDoorButton || itemButtons.length === 0) {
        console.error('Canvas, Button oder Item-Buttons nicht gefunden!');
        return;
    }

    // Szene, Kamera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    // Beleuchtung
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5).normalize();
    scene.add(directionalLight);

    // Kamera-Position (Anfangsbetrachtung)
    camera.position.set(0, 1.5, 5);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // Raycasting-Variablen
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Variablen für 3D-Modell und Animation
    let microwaveModel;
    let mixer;
    let clock = new THREE.Clock();
    let doorAction;
    let doorOpen = false;
    let isAnimating = false; // Ist eine Three.js Animation aktiv?

    // Globale Variable für den Zustand des Mikrowellenprozesses
    let processRunning = false; // Ist der 10-Sekunden-Prozess aktiv?
    let processAbortController = null; // Zum Abbrechen des setTimeout

    const doorAnimationName = "DoorOpenCloseAnimation";
    const doorMeshName = "microwave_door";
    const startButtonName = "start_button";
    const stopButtonName = "stop_button";
    const redLightObjectName = "microwave_red";
    const timerObjectName = "microwave_timer";
    const timerAnimationName = "timer_animation";

    let redLightModelPart;
    let timerModelPart;
    let timerAction;

    // *** HINZUGEFÜGT: Item-Verwaltung ***
    let currentLoadedItem = null; // Referenz auf das aktuell geladene Item-Modell
    let currentItemType = null;   // Speichert den Typ des aktuellen Items (z.B. 'pizza', 'popcorn')
    const itemLoader = new GLTFLoader(); // Separater Loader für Items
    // Position für die Items in der Mikrowelle (muss eventuell angepasst werden)
    const itemPosition = new THREE.Vector3(0, 0.8, 0.4); // Beispielkoordinaten: X, Y, Z

    // Button initial deaktivieren
    toggleDoorButton.disabled = true;

    // GLTF-Loader für Mikrowelle
    const loader = new GLTFLoader();
    loader.load(
        'models/microwave_model.glb',
        (gltf) => {
            microwaveModel = gltf.scene;
            scene.add(microwaveModel);

            console.log('3D-Modell "microwave_model.glb" erfolgreich geladen!');
            console.log('Verfügbare Animationen (Three.js):', gltf.animations.map(a => a.name));

            redLightModelPart = microwaveModel.getObjectByName(redLightObjectName);
            if (redLightModelPart) {
                console.log(`Rotes Licht-Objekt "${redLightObjectName}" gefunden!`);
                redLightModelPart.visible = false;
            } else {
                console.warn(`Rotes Licht-Objekt "${redLightObjectName}" wurde im GLB-Modell nicht gefunden.`);
            }

            timerModelPart = microwaveModel.getObjectByName(timerObjectName);
            if (timerModelPart) {
                console.log(`Timer-Objekt "${timerObjectName}" gefunden!`);
            } else {
                console.warn(`Timer-Objekt "${timerObjectName}" wurde im GLB-Modell nicht gefunden.`);
            }

            mixer = new THREE.AnimationMixer(microwaveModel);

            const doorClip = THREE.AnimationClip.findByName(gltf.animations, doorAnimationName);
            if (doorClip) {
                doorAction = mixer.clipAction(doorClip);
                doorAction.loop = THREE.LoopOnce;
                doorAction.clampWhenFinished = true;
                doorAction.enabled = true;
                doorAction.play();
                doorAction.stop();

                console.log(`Animation "${doorAnimationName}" für die Tür initialisiert und pausiert.`);
                toggleDoorButton.disabled = false;
            } else {
                console.warn(`Animation "${doorAnimationName}" wurde im GLB-Modell nicht gefunden.`);
                alert(`Die Tür-Animation "${doorAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

            const timerClip = THREE.AnimationClip.findByName(gltf.animations, timerAnimationName);
            if (timerClip) {
                timerAction = mixer.clipAction(timerClip);
                timerAction.loop = THREE.LoopOnce;
                timerAction.clampWhenFinished = true;
                timerAction.enabled = true;
                timerAction.play();
                timerAction.stop();
                console.log(`Animation "${timerAnimationName}" für den Timer initialisiert und pausiert.`);
            } else {
                console.warn(`Animation "${timerAnimationName}" wurde im GLB-Modell nicht gefunden.`);
                alert(`Die Timer-Animation "${timerAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

            animate();
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% geladen');
        },
        (error) => {
            console.error('Fehler beim Laden des 3D-Modells:', error);
            alert('Fehler beim Laden des 3D-Modells. Bitte überprüfen Sie den Pfad und die Datei.');
        }
    );

    // Klick-Event-Listener für Maus und Touch
    canvas.addEventListener('click', onCanvasInteraction);
    canvas.addEventListener('touchstart', (event) => {
        //event.preventDefault(); // Vorsichtig verwenden, kann OrbitControls beeinflussen
        onCanvasInteraction(event);
    }, { passive: false });

    // Klick-Handler für den HTML-Button
    toggleDoorButton.addEventListener('click', () => {
        if (!isAnimating && doorAction && !processRunning) { // Kann Tür nicht manuell öffnen/schließen, wenn Prozess läuft
            toggleDoorAnimation();
        } else if (isAnimating) {
            console.log('Animation läuft bereits, bitte warten.');
        } else if (processRunning) {
            console.log('Prozess läuft, kann Tür nicht manuell öffnen/schließen.');
        } else {
            console.warn('Tür-Animation noch nicht verfügbar.');
        }
    });

    // *** HINZUGEFÜGT: Event Listener für die Item-Buttons ***
    itemButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // Nur laden, wenn kein Prozess läuft und Tür offen ist
            if (!processRunning && !isAnimating && doorOpen) {
                const itemType = event.target.dataset.item;
                loadItem(itemType);
            } else if (!doorOpen) {
                console.log('Tür muss offen sein, um ein Item zu platzieren.');
            } else if (processRunning || isAnimating) {
                console.log('Prozess läuft oder Animation aktiv, kann Item nicht wechseln.');
            }
        });
    });

    // *** HINZUGEFÜGT: Funktion zum Laden eines Items (v1) ***
    function loadItem(itemType) {
        if (currentLoadedItem) {
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
        }

        const modelPath = `models/${itemType}_v1.glb`; // Dateiname: z.B. pizza_v1.glb
        console.log(`Lade Item: ${itemType} (${modelPath})`);
        itemLoader.load(
            modelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene;
                currentLoadedItem.position.copy(itemPosition); // Positionieren
                // Optional: Skalierung anpassen, falls nötig
                // currentLoadedItem.scale.set(0.1, 0.1, 0.1);
                scene.add(currentLoadedItem);
                currentItemType = itemType; // Item-Typ speichern
                console.log(`Item "${itemType}" geladen.`);
            },
            (xhr) => {
                console.log(`Item ${itemType}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`Fehler beim Laden von Item "${itemType}" (${modelPath}):`, error);
                alert(`Fehler beim Laden von Item "${itemType}". Bitte überprüfen Sie die Datei und den Pfad.`);
            }
        );
    }

    // *** HINZUGEFÜGT: Funktion zum Ersetzen des Items durch v2-Version ***
    function replaceItemWithCookedVersion() {
        if (!currentItemType || !currentLoadedItem) {
            console.log('Kein Item geladen, um es zu kochen.');
            return;
        }

        // Entferne die aktuelle (v1) Version
        scene.remove(currentLoadedItem);
        currentLoadedItem = null;

        const cookedModelPath = `models/${currentItemType}_v2.glb`; // z.B. pizza_v2.glb
        console.log(`Lade gekochtes Item: ${currentItemType} (${cookedModelPath})`);
        itemLoader.load(
            cookedModelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene;
                currentLoadedItem.position.copy(itemPosition); // Position beibehalten
                // Optional: Skalierung anpassen, falls nötig
                // currentLoadedItem.scale.set(0.1, 0.1, 0.1);
                scene.add(currentLoadedItem);
                console.log(`Item "${currentItemType}" wurde zu "v2" gewechselt.`);
            },
            (xhr) => {
                console.log(`Gekochtes Item ${currentItemType}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`Fehler beim Laden der gekochten Version von Item "${currentItemType}" (${cookedModelPath}):`, error);
                alert(`Fehler beim Laden der gekochten Version von Item "${currentItemType}".`);
            }
        );
    }


    function onCanvasInteraction(event) {
        if (!microwaveModel) return;

        let clientX, clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
            if (event.touches.length > 1) {
                console.log("Mehrere Finger erkannt, ignoriere als Klick.");
                return;
            }
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = - ((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const interactableMeshes = [];
        microwaveModel.traverse(child => {
            if (child.isMesh && (child.name === doorMeshName || child.name === startButtonName || child.name === stopButtonName)) {
                interactableMeshes.push(child);
            }
        });

        const intersects = raycaster.intersectObjects(interactableMeshes);

        if (intersects.length > 0) {
            const firstHitObject = intersects[0].object;

            console.log(`Getroffen: ${firstHitObject.name}`);

            if (firstHitObject.name === doorMeshName) {
                if (!isAnimating && doorAction && !processRunning) { // Tür kann nicht manuell bewegt werden, wenn Prozess läuft
                    toggleDoorAnimation();
                } else if (isAnimating) {
                    console.log('Tür-Animation läuft bereits.');
                } else if (processRunning) {
                    console.log('Prozess läuft, kann Tür nicht manuell öffnen/schließen.');
                }
            } else if (firstHitObject.name === startButtonName) {
                // HINZUGEFÜGT: Prüfen, ob ein Item geladen ist
                if (!isAnimating && !processRunning && !doorOpen && currentLoadedItem) {
                    console.log('Start-Button gedrückt!');
                    closeDoorAndOpenAfterDelay();
                } else if (doorOpen) {
                    console.log('Tür muss geschlossen sein, um zu starten.');
                } else if (!currentLoadedItem) {
                    console.log('Kein Item in der Mikrowelle. Bitte wähle eines aus.');
                } else {
                    console.log('Kann nicht gestartet werden, Animation oder Prozess läuft bereits.');
                }
            } else if (firstHitObject.name === stopButtonName) {
                console.log('Stop-Button gedrückt!');
                abortMicrowaveProcess();
            }
        } else {
            console.log('Kein interaktives Objekt getroffen.');
        }
    }

    async function closeDoorAndOpenAfterDelay() {
        if (!doorAction) {
            console.warn('Tür-Animation nicht verfügbar.');
            return;
        }

        processRunning = true;
        toggleDoorButton.disabled = true;
        itemButtons.forEach(btn => btn.disabled = true); // Item-Buttons deaktivieren
        processAbortController = new AbortController();

        try {
            // 1. Tür schließen, falls offen
            if (doorOpen) {
                console.log('Tür ist offen, schließe sie...');
                toggleDoorAnimation();
                await waitForAnimationEnd();
                if (processAbortController.signal.aborted) throw new Error('Process aborted');
            } else {
                console.log('Tür ist bereits geschlossen.');
            }

            // Rotes Licht-Objekt einschalten
            if (redLightModelPart) {
                redLightModelPart.visible = true;
                console.log('Rotes Licht (Modell-Teil) an.');
            }

            // Timer-Animation starten
            if (timerAction) {
                timerAction.reset();
                timerAction.play();
                console.log('Timer-Animation gestartet.');
            }

            // 2. 10 Sekunden warten
            console.log('Warte 10 Sekunden...');
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
            const abortPromise = new Promise((_, reject) => {
                processAbortController.signal.addEventListener('abort', () => reject(new Error('Process aborted')), { once: true });
            });

            await Promise.race([timeoutPromise, abortPromise]);

            if (processAbortController.signal.aborted) {
                throw new Error('Process aborted');
            }

            console.log('10 Sekunden vorbei.');
            // *** HINZUGEFÜGT: Item durch gekochte Version ersetzen ***
            replaceItemWithCookedVersion();


            // 3. Tür öffnen
            if (!doorOpen) {
                console.log('Öffne die Tür...');
                toggleDoorAnimation();
                await waitForAnimationEnd();
            } else {
                console.log('Tür ist bereits offen, kann nicht erneut geöffnet werden.');
            }

        } catch (error) {
            if (error.message === 'Process aborted') {
                console.log('Mikrowellen-Prozess abgebrochen.');
            } else {
                console.error('Ein Fehler im Mikrowellen-Prozess ist aufgetreten:', error);
            }
        } finally {
            processRunning = false;
            toggleDoorButton.disabled = false;
            itemButtons.forEach(btn => btn.disabled = false); // Item-Buttons wieder aktivieren
            processAbortController = null;

            // Rotes Licht-Objekt ausschalten
            if (redLightModelPart) {
                redLightModelPart.visible = false;
                console.log('Rotes Licht (Modell-Teil) aus.');
            }

            // Timer-Animation stoppen und zurücksetzen
            if (timerAction) {
                timerAction.stop();
                timerAction.reset();
                console.log('Timer-animation gestoppt und zurückgesetzt.');
            }

            // Stelle sicher, dass die Tür geöffnet ist, falls der Prozess abgebrochen wurde
            if (!doorOpen && !isAnimating) {
                 console.log('Stopp-Befehl: Öffne Tür sofort.');
                 toggleDoorAnimation();
            } else if (doorOpen && !isAnimating) {
                console.log('Stopp-Befehl: Tür bereits offen.');
            }
        }
    }

    function abortMicrowaveProcess() {
        if (processRunning && processAbortController) {
            console.log('Abbruchsignal gesendet!');
            processAbortController.abort();
        } else {
            console.log('Kein Mikrowellen-Prozess zum Abbrechen aktiv.');
            if (!doorOpen && !isAnimating) {
                console.log('Tür ist geschlossen, aber kein Prozess läuft. Öffne Tür.');
                toggleDoorAnimation();
            }
        }
    }

    function waitForAnimationEnd() {
        return new Promise(resolve => {
            const onFinished = (e) => {
                if (e.action === doorAction) {
                    mixer.removeEventListener('finished', onFinished);
                    resolve();
                }
            };
            mixer.addEventListener('finished', onFinished);
        });
    }

    function toggleDoorAnimation() {
        if (!doorAction) return;

        isAnimating = true;
        toggleDoorButton.disabled = true;
        itemButtons.forEach(btn => btn.disabled = true); // Item-Buttons deaktivieren während Türanimation

        doorAction.loop = THREE.LoopOnce;
        doorAction.clampWhenFinished = true;

        if (doorOpen) {
            doorAction.timeScale = -1;
            doorAction.paused = false;
            doorAction.time = doorAction.getClip().duration;
            doorAction.play();
            console.log('Tür schließt sich...');
        } else {
            doorAction.timeScale = 1;
            doorAction.paused = false;
            doorAction.time = 0;
            doorAction.play();
            console.log('Tür öffnet sich...');
        }

        mixer.addEventListener('finished', onAnimationFinished);
    }

    function onAnimationFinished(e) {
        if (e.action === doorAction) {
            console.log('Animation beendet (Three.js Event).');

            isAnimating = false;
            toggleDoorButton.disabled = false;
            // Item-Buttons wieder aktivieren, wenn die Tür offen ist und kein Prozess läuft
            if (!processRunning && doorOpen) {
                itemButtons.forEach(btn => btn.disabled = false);
            }
            doorOpen = !doorOpen;

            mixer.removeEventListener('finished', onAnimationFinished);
        }
    }

    // Animations-Loop
    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        if (mixer) {
            mixer.update(delta);
        }

        controls.update();

        renderer.render(scene, camera);
    }

    // Responsivität des Canvas
    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });
});