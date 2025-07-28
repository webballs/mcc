// public/microwave.js

import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('microwaveCanvas');
    const toggleDoorButton = document.getElementById('toggleDoorButton');
    const itemButtons = document.querySelectorAll('.itemButton');

    if (!canvas || !toggleDoorButton || itemButtons.length === 0) {
        console.error('FEHLER: HTML-Elemente nicht gefunden! Canvas, Toggle-Door-Button oder Item-Buttons fehlen.');
        return;
    }

    // Szene, Kamera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // HINTERGRUNDFARBE AUF WEISS GEÄNDERT
    renderer.setClearColor(0xCCCCCC, 1); // Farbe auf Weiß (0xFFFFFF), Opazität auf 1 (vollständig deckend)

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
    let doorOpen = false; // WICHTIG: True = Tür offen, False = Tür geschlossen (initial geschlossen)
    let isAnimating = false; // Ist eine Three.js Animation aktiv?

    // Globale Variable für den Zustand des Mikrowellenprozesses
    let processRunning = false; // Ist der 10-Sekunden-Prozess aktiv?
    let processAbortController = null;

    const doorAnimationName = "DoorOpenCloseAnimation";
    const doorMeshName = "microwave_door";
    const startButtonName = "start_button";
    const stopButtonName = "stop_button";
    const redLightObjectName = "microwave_red";
    const timerObjectName = "microwave_timer";
    const timerAnimationName = "timer_animation";
    // NEU: Name für den Reset-Button im 3D-Modell
    const resetButtonName = "reset_button"; 

    let redLightModelPart;
    let timerModelPart;
    let timerAction;

    // Item-Verwaltung
    let currentLoadedItem = null;
    let currentItemType = null;
    const itemLoader = new GLTFLoader();
    // Passe diese Position an, damit die Items in deiner Mikrowelle richtig liegen
    const itemPosition = new THREE.Vector3(0, 0.8, 0.4); 

    // Initialisiere den Zustand der HTML-Buttons
    toggleDoorButton.disabled = true; // Deaktiviert, bis Mikrowelle geladen ist
    itemButtons.forEach(btn => btn.disabled = true); // Item-Buttons initial deaktiviert

    // GLTF-Loader für Mikrowelle
    const loader = new GLTFLoader();
    loader.load(
        'models/microwave_model.glb',
        (gltf) => {
            microwaveModel = gltf.scene;
            scene.add(microwaveModel);

            console.log('[INIT] 3D-Modell "microwave_model.glb" erfolgreich geladen!');
            console.log('[INIT] Verfügbare Animationen (Three.js):', gltf.animations.map(a => a.name));

            redLightModelPart = microwaveModel.getObjectByName(redLightObjectName);
            if (redLightModelPart) {
                console.log(`[INIT] Rotes Licht-Objekt "${redLightObjectName}" gefunden!`);
                redLightModelPart.visible = false;
            } else {
                console.warn(`[INIT] Rotes Licht-Objekt "${redLightObjectName}" wurde im GLB-Modell NICHT gefunden.`);
            }

            timerModelPart = microwaveModel.getObjectByName(timerObjectName);
            if (timerModelPart) {
                console.log(`[INIT] Timer-Objekt "${timerObjectName}" gefunden!`);
            } else {
                console.warn(`[INIT] Timer-Objekt "${timerObjectName}" wurde im GLB-Modell NICHT gefunden.`);
            }

            mixer = new THREE.AnimationMixer(microwaveModel);

            const doorClip = THREE.AnimationClip.findByName(gltf.animations, doorAnimationName);
            if (doorClip) {
                doorAction = mixer.clipAction(doorClip);
                doorAction.loop = THREE.LoopOnce;
                doorAction.clampWhenFinished = true;
                doorAction.enabled = true;
                doorAction.play(); // Wichtig: Animation einmal kurz abspielen, um sie im Startzustand (geschlossen) zu parken
                doorAction.stop(); // Und sofort stoppen
                console.log(`[INIT] Animation "${doorAnimationName}" für die Tür initialisiert und pausiert im ZUSTAND "GESCHLOSSEN".`);
                doorOpen = false; // Explizit auf geschlossen setzen, falls es im Blender default offen wäre
                updateButtonStates(); // Aktualisiere Button-Zustände nach Initialisierung der Mikrowelle
            } else {
                console.warn(`[INIT] Animation "${doorAnimationName}" wurde im GLB-Modell NICHT gefunden.`);
                alert(`Die Tür-Animation "${doorAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

            const timerClip = THREE.AnimationClip.findByName(gltf.animations, timerAnimationName);
            if (timerClip) {
                timerAction = mixer.clipAction(timerClip);
                timerAction.loop = THREE.LoopOnce; // Oder THREE.LoopRepeat, je nachdem wie deine Animation aufgebaut ist
                timerAction.clampWhenFinished = true;
                timerAction.enabled = true;
                timerAction.play();
                timerAction.stop();
                console.log(`[INIT] Animation "${timerAnimationName}" für den Timer initialisiert und pausiert.`);
            } else {
                console.warn(`[INIT] Animation "${timerAnimationName}" wurde im GLB-Modell NICHT gefunden.`);
                alert(`Die Timer-Animation "${timerAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

            animate();
        },
        (xhr) => {
            console.log(`[LADE FORTSCHRITT] Mikrowelle: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
        },
        (error) => {
            console.error('[FEHLER] Fehler beim Laden des 3D-Modells der Mikrowelle:', error);
            alert('Fehler beim Laden des 3D-Modells der Mikrowelle. Bitte überprüfen Sie den Pfad und die Datei.');
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
        console.log(`[HTML BUTTON] Tür-Button geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, doorOpen=${doorOpen}`);
        if (!isAnimating && doorAction && !processRunning) {
            toggleDoorAnimation();
        } else if (isAnimating) {
            console.log('[HTML BUTTON] Tür-Animation läuft bereits, bitte warten.');
        } else if (processRunning) {
            console.log('[HTML BUTTON] Prozess läuft, kann Tür nicht manuell öffnen/schließen.');
        } else {
            console.warn('[HTML BUTTON] Tür-Animation noch nicht verfügbar.');
        }
    });

    // Event Listener für die Item-Buttons
    itemButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const itemType = event.target.dataset.item;
            console.log(`[HTML BUTTON] Item-Button "${itemType}" geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, doorOpen=${doorOpen}`);

            // Ein Item kann nur geladen werden, wenn die Tür offen ist und kein Prozess/Animation läuft
            if (!processRunning && !isAnimating && doorOpen) { // HIER WICHTIG: doorOpen MUSS TRUE sein
                loadItem(itemType);
            } else {
                if (!doorOpen) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Tür ist geschlossen.');
                } else if (processRunning) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Prozess läuft bereits.');
                } else if (isAnimating) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Animation läuft bereits.');
                }
            }
        });
    });

    function loadItem(itemType) {
        console.log(`[ITEM LADEN] Versuche Item "${itemType}" zu laden.`);
        if (currentLoadedItem) {
            console.log('[ITEM LADEN] Entferne vorheriges Item.');
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
        }

        const modelPath = `models/${itemType}_v1.glb`;
        console.log(`[ITEM LADEN] Lade: ${modelPath}`);
        itemLoader.load(
            modelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene;
                currentLoadedItem.position.copy(itemPosition); // Positionieren
                // Optional: Skalierung anpassen, falls nötig
                // currentLoadedItem.scale.set(0.1, 0.1, 0.1);
                scene.add(currentLoadedItem);
                currentItemType = itemType; // Item-Typ speichern
                console.log(`[ITEM LADEN] Item "${itemType}" erfolgreich geladen und platziert. currentLoadedItem ist jetzt:`, currentLoadedItem);
            },
            (xhr) => {
                console.log(`[ITEM LADE FORTSCHRITT] Item ${itemType}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`[FEHLER] Fehler beim Laden von Item "${itemType}" (${modelPath}):`, error);
                alert(`Fehler beim Laden von Item "${itemType}". Überprüfen Sie die Datei und den Pfad in "models/${itemType}_v1.glb".`);
            }
        );
    }

    function replaceItemWithCookedVersion() {
        if (!currentItemType || !currentLoadedItem) {
            console.log('[KOCHEN] Kein Item geladen, um es zu kochen. Überspringe Ersetzen.');
            return;
        }

        console.log(`[KOCHEN] Ersetze Item "${currentItemType}" durch gekochte Version.`);
        scene.remove(currentLoadedItem);
        currentLoadedItem = null;

        const cookedModelPath = `models/${currentItemType}_v2.glb`;
        console.log(`[KOCHEN] Lade gekochtes Item: ${cookedModelPath}`);
        itemLoader.load(
            cookedModelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene;
                currentLoadedItem.position.copy(itemPosition);
                // Optional: Skalierung anpassen, falls nötig
                // currentLoadedItem.scale.set(0.1, 0.1, 0.1);
                scene.add(currentLoadedItem);
                console.log(`[KOCHEN] Item "${currentItemType}" erfolgreich zu "v2" gewechselt.`);
            },
            (xhr) => {
                console.log(`[KOCHEN LADE FORTSCHRITT] Gekochtes Item ${currentItemType}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`[FEHLER] Fehler beim Laden der gekochten Version von Item "${currentItemType}" (${cookedModelPath}):`, error);
                alert(`Fehler beim Laden der gekochten Version von Item "${currentItemType}". Überprüfen Sie die Datei und den Pfad in "models/${currentItemType}_v2.glb".`);
            }
        );
    }

    // NEU: Funktion zum Entfernen des Items
    function removeItem() {
        if (currentLoadedItem) {
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
            currentItemType = null; // Auch den Typ zurücksetzen
            console.log('[ITEM] Item aus Mikrowelle entfernt.');
        } else {
            console.log('[ITEM] Keine Item zum Entfernen gefunden.');
        }
    }

    function onCanvasInteraction(event) {
        if (!microwaveModel) {
            console.log('[INTERACTION] Mikrowellenmodell noch nicht geladen, Interaktion ignoriert.');
            return;
        }

        let clientX, clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
            if (event.touches.length > 1) {
                console.log("[INTERACTION] Mehrere Finger erkannt, ignoriere als Klick.");
                return;
            }
            console.log(`[INTERACTION] Touch-Event bei X:${clientX}, Y:${clientY}`);
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
            console.log(`[INTERACTION] Maus-Event bei X:${clientX}, Y:${clientY}`);
        }

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = - ((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const interactableMeshes = [];
        microwaveModel.traverse(child => {
            // NEU: resetButtonName zu den interaktiven Meshes hinzugefügt
            if (child.isMesh && (child.name === doorMeshName || child.name === startButtonName || child.name === stopButtonName || child.name === resetButtonName)) {
                interactableMeshes.push(child);
            }
        });

        const intersects = raycaster.intersectObjects(interactableMeshes);

        if (intersects.length > 0) {
            const firstHitObject = intersects[0].object;
            console.log(`[RAYCAST] Getroffen: ${firstHitObject.name}`);

            if (firstHitObject.name === doorMeshName) {
                console.log(`[RAYCAST] Tür geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, doorOpen=${doorOpen}`);
                if (!isAnimating && doorAction && !processRunning) {
                    toggleDoorAnimation();
                } else {
                    if (isAnimating) console.log('[RAYCAST] Tür-Animation läuft bereits.');
                    if (processRunning) console.log('[RAYCAST] Prozess läuft, kann Tür nicht manuell öffnen/schließen.');
                }
            } else if (firstHitObject.name === startButtonName) {
                console.log(`[RAYCAST] Start-Button geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, doorOpen=${doorOpen}, currentLoadedItem=${!!currentLoadedItem}`);
                // Start-Button Bedingungen: Keine Animation, kein Prozess. Die Tür wird ggf. automatisch geschlossen.
                if (!isAnimating && !processRunning) { 
                    console.log('[RAYCAST] Starte Mikrowellen-Prozess!');
                    closeDoorAndOpenAfterDelay();
                } else {
                    if (isAnimating) console.log('[RAYCAST] Start nicht möglich: Animation läuft.');
                    if (processRunning) console.log('[RAYCAST] Start nicht möglich: Prozess läuft bereits.');
                    // Die Zeile "Start nicht möglich: Tür ist offen. Bitte schließen." wurde entfernt.
                }
            } else if (firstHitObject.name === stopButtonName) {
                console.log(`[RAYCAST] Stop-Button geklickt. Zustände: processRunning=${processRunning}`);
                abortMicrowaveProcess();
            } else if (firstHitObject.name === resetButtonName) { // NEU: Reset Button Handling
                console.log(`[RAYCAST] Reset-Button geklickt. Zustände: processRunning=${processRunning}`);
                // Item entfernen, ohne den Prozess zu beeinflussen
                removeItem(); 
            }
        } else {
            console.log('[RAYCAST] Kein interaktives Objekt getroffen.');
        }
    }

    async function closeDoorAndOpenAfterDelay() {
        if (!doorAction) {
            console.warn('[PROZESS] Tür-Animation nicht verfügbar. Prozess abgebrochen.');
            return;
        }
        
        // HINWEIS: Prozess läuft auch ohne Item ab, es wird nur nichts ausgetauscht.
        if (!currentLoadedItem) {
            console.log('[PROZESS] Kein Item in der Mikrowelle gefunden. Der Mikrowellenzyklus läuft trotzdem ab.');
        }


        processRunning = true;
        updateButtonStates(); // Aktualisiere alle Button-Zustände

        processAbortController = new AbortController();

        try {
            // 1. Tür schließen, falls offen
            if (doorOpen) { // Wenn Tür aktuell als offen registriert
                console.log('[PROZESS] Tür ist offen (doorOpen=true), schließe sie...');
                toggleDoorAnimation(); // Dies startet die Schließanimation
                await waitForAnimationEnd(); // Warte, bis die Tür geschlossen ist
                // Hier prüfen, ob in der Zwischenzeit abgebrochen wurde
                if (processAbortController.signal.aborted) throw new Error('Process aborted');
            } else {
                console.log('[PROZESS] Tür ist bereits geschlossen (doorOpen=false).');
            }

            // Rotes Licht-Objekt einschalten
            if (redLightModelPart) {
                redLightModelPart.visible = true;
                console.log('[PROZESS] Rotes Licht (Modell-Teil) an.');
            }

            // Timer-Animation starten
            if (timerAction) {
                timerAction.reset();
                timerAction.play();
                console.log('[PROZESS] Timer-Animation gestartet.');
            }

            // 2. 10 Sekunden warten
            console.log('[PROZESS] Warte 10 Sekunden...');
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
            const abortPromise = new Promise((_, reject) => {
                processAbortController.signal.addEventListener('abort', () => reject(new Error('Process aborted')), { once: true });
            });

            await Promise.race([timeoutPromise, abortPromise]);

            if (processAbortController.signal.aborted) {
                throw new Error('Process aborted');
            }

            console.log('[PROZESS] 10 Sekunden vorbei.');
            // Item durch gekochte Version ersetzen (nur wenn nicht abgebrochen UND ein Item vorhanden ist)
            if (currentLoadedItem) { // Nur ersetzen, wenn auch ein Item geladen ist
                replaceItemWithCookedVersion();
            } else {
                console.log('[PROZESS] Kein Item geladen, daher kein Austausch auf V2-Version.');
            }


            // 3. Tür öffnen
            // Wir müssen hier prüfen, ob die Tür ZU diesem Zeitpunkt geschlossen ist.
            // Durch den finally-Block wird die Tür auf jeden Fall geöffnet, wenn sie geschlossen ist.
            // Derzeitige Logik ist: wenn !doorOpen (also geschlossen), dann öffne.
            if (!doorOpen) { // Wenn Tür aktuell als geschlossen registriert
                 console.log('[PROZESS] Öffne die Tür...');
                 toggleDoorAnimation(); // Dies startet die Öffnungsanimation
                 await waitForAnimationEnd(); // Warte, bis die Öffnungsanimation abgeschlossen ist
            } else {
                console.log('[PROZESS] Tür ist bereits offen (doorOpen=true).');
            }

        } catch (error) {
            if (error.message === 'Process aborted') {
                console.log('[PROZESS] Mikrowellen-Prozess abgebrochen.');
            } else {
                console.error('[FEHLER] Ein Fehler im Mikrowellen-Prozess ist aufgetreten:', error);
            }
        } finally {
            processRunning = false;
            processAbortController = null;

            // Rotes Licht-Objekt ausschalten
            if (redLightModelPart) {
                redLightModelPart.visible = false;
                console.log('[PROZESS] Rotes Licht (Modell-Teil) aus.');
            }

            // Timer-Animation stoppen und zurücksetzen
            if (timerAction) {
                timerAction.stop();
                timerAction.reset();
                console.log('[PROZESS] Timer-animation gestoppt und zurückgesetzt.');
            }

            // Stelle sicher, dass die Tür geöffnet ist, falls der Prozess abgebrochen wurde
            // und sie nicht schon offen ist oder eine Animation läuft.
            // Diese Logik muss sicherstellen, dass die Tür am Ende des Prozesses (egal ob Erfolg oder Abbruch) offen ist.
            if (!doorOpen && !isAnimating) { // Wenn die Tür geschlossen ist UND keine Animation läuft
                 console.log('[PROZESS] Tür war geschlossen oder wurde geschlossen und ist jetzt nicht animiert, öffne sie am Ende des Prozesses.');
                 toggleDoorAnimation(); // Öffne die Tür
            } else if (doorOpen && !isAnimating) {
                console.log('[PROZESS] Tür ist bereits offen und nicht animiert.');
            } else if (isAnimating) {
                console.log('[PROZESS] Tür-Animation läuft noch, warte auf Ende, um Endzustand zu setzen (wird durch onAnimationFinished behandelt).');
            }
            updateButtonStates(); // Aktualisiere alle Button-Zustände nach Abschluss
        }
    }

    function abortMicrowaveProcess() {
        console.log(`[ABORT] Abort-funktion aufgerufen. processRunning=${processRunning}, processAbortController=${!!processAbortController}`);
        if (processRunning && processAbortController) {
            console.log('[ABORT] Abbruchsignal gesendet, da Prozess läuft!');
            processAbortController.abort();
        } else {
            console.log('[ABORT] Kein Mikrowellen-Prozess zum Abbrechen aktiv.');
            // Falls die Tür geschlossen und kein Prozess läuft, aber Stop gedrückt wird,
            // soll sie trotzdem aufgehen.
            if (!doorOpen && !isAnimating) {
                console.log('[ABORT] Tür ist geschlossen, aber kein Prozess läuft. Öffne Tür als Reaktion auf Stop.');
                toggleDoorAnimation();
            } else {
                console.log('[ABORT] Tür ist bereits offen oder es läuft eine Animation, keine Aktion erforderlich.');
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

        console.log(`[TÜR ANIMATION] toggleDoorAnimation aufgerufen. Aktueller doorOpen=${doorOpen}`);
        isAnimating = true;
        updateButtonStates(); // Deaktiviere Buttons während Animation

        doorAction.loop = THREE.LoopOnce;
        doorAction.clampWhenFinished = true;

        if (doorOpen) { // Wenn Tür gerade offen ist, soll sie schließen
            doorAction.timeScale = -1; // Animation rückwärts abspielen
            doorAction.paused = false;
            doorAction.time = doorAction.getClip().duration; // Start am Ende der Animation
            doorAction.play();
            console.log('[TÜR ANIMATION] Tür schließt sich...');
        } else { // Wenn Tür gerade geschlossen ist, soll sie öffnen
            doorAction.timeScale = 1; // Animation vorwärts abspielen
            doorAction.paused = false;
            doorAction.time = 0; // Start am Anfang der Animation
            doorAction.play();
            console.log('[TÜR ANIMATION] Tür öffnet sich...');
        }

        mixer.addEventListener('finished', onAnimationFinished);
    }

    function onAnimationFinished(e) {
        if (e.action === doorAction) {
            console.log('[TÜR ANIMATION] Animation beendet (Three.js Event).');

            isAnimating = false;
            doorOpen = !doorOpen; // Zustand der Tür wechseln
            console.log(`[TÜR ANIMATION] Tür-Zustand ist jetzt: ${doorOpen ? 'OFFEN' : 'GESCHLOSSEN'}`);
            updateButtonStates(); // Aktualisiere Button-Zustände nach Tür-Animation

            mixer.removeEventListener('finished', onAnimationFinished);
        }
    }

    // Zentrale Funktion zur Aktualisierung der Button-Zustände
    function updateButtonStates() {
        console.log(`[BUTTON UPDATE] Aktualisiere Button-Zustände. isAnimating=${isAnimating}, processRunning=${processRunning}, doorOpen=${doorOpen}, currentLoadedItem=${!!currentLoadedItem}`);

        // HTML-Tür-Button
        toggleDoorButton.disabled = isAnimating || processRunning;
        console.log(`[BUTTON UPDATE] toggleDoorButton.disabled = ${toggleDoorButton.disabled}`);

        // HTML-Item-Auswahl-Buttons
        itemButtons.forEach(btn => {
            // Item-Buttons sollen nur klickbar sein, wenn:
            // - Keine Animation läuft (isAnimating ist false)
            // - Kein Prozess läuft (processRunning ist false)
            // - Die Tür offen ist (doorOpen ist true)
            // `!doorOpen` bedeutet "Tür ist geschlossen", was den Button deaktivieren sollte.
            btn.disabled = isAnimating || processRunning || !doorOpen;
            console.log(`[BUTTON UPDATE] Item Button (${btn.dataset.item}).disabled = ${btn.disabled} (Basierend auf doorOpen=${doorOpen})`);
        });

        // 3D Start/Stop/Reset Buttons werden nicht direkt im JS disabled,
        // ihre Interaktivität hängt von den Bedingungen in onCanvasInteraction ab.
        // Die Konsolenmeldungen dort geben Aufschluss, warum sie nicht reagieren.
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