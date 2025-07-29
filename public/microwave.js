// public/microwave.js

import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('microwaveCanvas');
    const itemButtons = document.querySelectorAll('.itemButton');

    // WICHTIG: Titel des Dokuments ändern
    document.title = "interactive microwave3000";

    if (!canvas || itemButtons.length === 0) {
        console.error('FEHLER: HTML-Elemente nicht gefunden! Canvas oder Item-Buttons fehlen.');
        return;
    }

    // Szene, Kamera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xCCCCCC, 1); // Farbe auf Weiß (0xFFFFFF), Opazität auf 1 (vollständig deckend)

    // --- FARBEN ANPASSEN: Tone Mapping und Output Encoding für Blender-ähnlichen Look ---
    // Diese Einstellungen sind entscheidend, um die Farbsättigung zu kontrollieren!
    renderer.outputEncoding = THREE.sRGBEncoding; // Stellt sicher, dass die Ausgabe im sRGB-Farbraum erfolgt
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Wendet den ACES Filmic Tone Mapping-Algorithmus an
    renderer.toneMappingExposure = 0.9; // Reguliert die Belichtung vor dem Tone Mapping (Standard 1.0, niedriger = dezenter)
    // --- ENDE FARBEN ANPASSEN ---

    // Beleuchtung (wieder heller gestellt)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Wieder auf 0.7
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Wieder auf 0.8
    directionalLight.position.set(5, 5, 5).normalize();
    scene.add(directionalLight);

    // Kamera-Position (Anfangsbetrachtung)
    camera.position.set(0, 1.5, 6);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .25;

    // Kamerasteuerung: Drehen, nicht bewegen, Zoomen, Blick unter die Mikrowelle
    controls.enablePan = false; // Deaktiviert das Verschieben der Kamera
    controls.enableZoom = true; // Ermöglicht das Zoomen
    controls.minPolarAngle = 0; // Erlaubt Blick nach oben
    controls.maxPolarAngle = Math.PI * 1; // Erlaubt Blick nach unten (ca. 180 Grad, direkter Blick nach unten)

    // Den Mittelpunkt, auf den die Kamera schaut, höher setzen (anpassen, wenn nötig)
    controls.target.set(0, 1.5, 0); 
    controls.update(); 

    // Raycasting-Variablen
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Variablen für 3D-Modell und Animation
    let microwaveModel;
    let mixer;
    let clock = new THREE.Clock();
    let doorAction;
    let isDoorOpen = false; // True = Tür offen, False = Tür geschlossen (initial geschlossen)
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
    const resetButtonName = "reset_button"; 

    let redLightModelPart;
    let timerModelPart;
    let timerAction;

    // Variablen für dynamische Feuer-Partikel
    let fireParticlesGroup; 
    let microwaveFireTemplate; 
    
    // Fester Bereich für die Partikelgenerierung (Anpassen an den Innenraum deiner Mikrowelle!)
    const particleSpawnArea = {
        minX: -2,   
        maxX: 0.8,  
        minY: 0.6,  
        minZ: -1.1, 
        maxZ: 0.7   
    };

    const particleCount = 100; // Anzahl der Partikel
    const particleMaxHeight = 2.0; 
    const particleMinLife = 1.0; 
    const particleMaxLife = 3.0; 
    const fireParticles = []; 
    const particleInitialScale = 1.0; 

    // Item-Verwaltung
    let currentLoadedItem = null;
    let currentItemType = null;
    let currentItemVersion = 1; // Neue Variable zur Speicherung der aktuellen Item-Version (initial 1)
    const itemLoader = new GLTFLoader();
    // Passe diese Position an, damit die Items in deiner Mikrowelle richtig liegen
    const itemPosition = new THREE.Vector3(-0.5, 0.45, 0); // Neue Item-Position

    // Initialisiere den Zustand der HTML-Buttons
    itemButtons.forEach(btn => btn.disabled = true); 

    // GLTF-Loader für Mikrowelle
    const loader = new GLTFLoader();
    loader.load(
        'models/microwave_model.glb',
        (gltf) => {
            microwaveModel = gltf.scene;
            scene.add(microwaveModel);

            console.log('[INIT] 3D-Modell "microwave_model.glb" erfolgreich geladen!');
            console.log("Alle verfügbaren Animationen im GLB-Modell:", gltf.animations);

            redLightModelPart = microwaveModel.getObjectByName(redLightObjectName);
            if (redLightModelPart) {
                console.log(`[INIT] Rotes Licht-Objekt "${redLightObjectName}" gefunden!`);
                redLightModelPart.visible = false;
            } else {
                console.warn(`[INIT] Rotes Licht-Objekt "${redLightObjectName}" wurde im GLB-Modell NICHT gefunden.`);
            }

            timerModelPart = microwaveModel.getObjectByName(timerObjectName);
            if (timerModelPart) {
                console.log(`[INIT] Timer-objekt "${timerObjectName}" gefunden!`);
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
                doorAction.play(); 
                doorAction.stop(); 
                console.log(`[INIT] Animation "${doorAnimationName}" für die Tür initialisiert und pausiert im ZUSTAND "GESCHLOSSEN".`);
                isDoorOpen = false; 
                updateButtonStates(); 
            } else {
                console.warn(`[INIT] Animation "${doorAnimationName}" wurde im GLB-Modell NICHT gefunden.`);
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
                console.log(`[INIT] Animation "${timerAnimationName}" für den Timer initialisiert und pausiert.`);
            } else {
                console.warn(`[INIT] Animation "${timerAnimationName}" wurde im GLB-Modell NICHT gefunden.`);
                alert(`Die Timer-Animation "${timerAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

            // Bereich für dynamische Feuer-Partikel (Klonen) START
            microwaveFireTemplate = microwaveModel.getObjectByName('microwave_fire');
            if (microwaveFireTemplate) {
                console.log('[INIT] "microwave_fire" Template-Objekt gefunden!');
                microwaveFireTemplate.parent.remove(microwaveFireTemplate); 

                microwaveFireTemplate.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.transparent = true;
                                mat.opacity = 0.5; 
                                mat.needsUpdate = true;
                            });
                        } else {
                            child.material.transparent = true;
                            child.material.opacity = 0.5; 
                            child.material.needsUpdate = true;
                        }
                    }
                });

            } else {
                console.error('[INIT] "microwave_fire" Objekt NICHT im GLB-Modell gefunden! Das Klonen der Partikel ist nicht möglich.');
                alert('Das "microwave_fire" Objekt wurde im GLB-Modell nicht gefunden. Bitte stelle sicher, dass es in Blender existiert und genau so benannt ist.');
                return; 
            }

            fireParticlesGroup = new THREE.Group();
            scene.add(fireParticlesGroup);
            fireParticlesGroup.visible = false; 

            createFireParticles(); 
            // ENDE Bereich für dynamische Feuer-Partikel

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

    // Funktion: Erstellt die geklonten "microwave_fire" Objekte
    function createFireParticles() {
        if (!microwaveFireTemplate) {
            console.warn('[PARTIKEL] Template fehlt. Partikel können nicht erstellt werden.');
            return;
        }

        const spawnWidth = particleSpawnArea.maxX - particleSpawnArea.minX;
        const spawnDepth = particleSpawnArea.maxZ - particleSpawnArea.minZ;
        const spawnBaseY = particleSpawnArea.minY; 

        for (let i = 0; i < particleCount; i++) {
            const particle = microwaveFireTemplate.clone(); 
            
            particle.traverse(child => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(mat => mat.clone());
                    } else {
                        child.material = child.material.clone();
                    }

                    if (child.material.color) {
                        const baseColor = new THREE.Color(0xFF6600); 

                        const hsl = { h: 0, s: 0, l: 0 };
                        baseColor.getHSL(hsl);

                        const hueOffset = (Math.random() - 0.5) * 0.1;   
                        const saturationOffset = (Math.random() - 0.5) * 0.2; 
                        const lightnessOffset = (Math.random() - 0.5) * 0.1; 

                        hsl.h = (hsl.h + hueOffset + 1) % 1; 
                        hsl.s = Math.max(0.6, Math.min(1, hsl.s + saturationOffset)); 
                        hsl.l = Math.max(0.4, Math.min(0.8, hsl.l + lightnessOffset)); 

                        child.material.color.setHSL(hsl.h, hsl.s, hsl.l);
                    }
                    child.material.needsUpdate = true; 
                }
            });
            
            particle.position.x = particleSpawnArea.minX + Math.random() * spawnWidth;
            particle.position.y = spawnBaseY; 
            particle.position.z = particleSpawnArea.minZ + Math.random() * spawnDepth;
            
            particle._initialY = particle.position.y;
            particle._lifeSpan = particleMinLife + Math.random() * (particleMaxLife - particleMinLife); 
            particle._currentAge = Math.random() * particle._lifeSpan; 
            particle._initialScale = new THREE.Vector3(particleInitialScale, particleInitialScale, particleInitialScale); 
            particle.scale.copy(particle._initialScale); 
            
            fireParticlesGroup.add(particle);
            fireParticles.push(particle);
        }
        console.log(`[PARTIKEL] ${particleCount} "microwave_fire" Partikel geklont und erstellt.`);
    }

    // Klick-Event-Listener für Maus und Touch
    canvas.addEventListener('click', onCanvasInteraction);
    canvas.addEventListener('touchstart', (event) => {
        onCanvasInteraction(event);
    }, { passive: false });

    // Event Listener für die Item-Buttons
    itemButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const itemType = event.currentTarget.dataset.item; 
            console.log(`[HTML BUTTON] Item-Button "${itemType}" geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}`);

            if (!processRunning && !isAnimating && isDoorOpen) { 
                loadItem(itemType, 1); // Lade immer Version 1, wenn der Button geklickt wird
            } else {
                if (!isDoorOpen) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Tür ist geschlossen.');
                } else if (processRunning) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Prozess läuft bereits.');
                } else if (isAnimating) {
                    console.log('[ITEM BUTTON] Item kann nicht platziert werden: Animation läuft bereits.');
                }
            }
        });
    });

    // loadItem Funktion angepasst, um eine spezifische Version zu laden
    function loadItem(itemType, version) {
        console.log(`[ITEM LADEN] Versuche Item "${itemType}" Version ${version} zu laden.`);
        if (currentLoadedItem) {
            console.log('[ITEM LADEN] Entferne vorheriges Item.');
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
        }

        const modelPath = `models/${itemType}_v${version}.glb`;
        console.log(`[ITEM LADEN] Lade: ${modelPath}`);
        itemLoader.load(
            modelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene;
                currentLoadedItem.position.copy(itemPosition); 
                scene.add(currentLoadedItem);
                currentItemType = itemType; 
                currentItemVersion = version; // Aktualisiere die aktuelle Version des Items
                console.log(`[ITEM LADEN] Item "${itemType}" Version ${version} erfolgreich geladen und platziert.`);
            },
            (xhr) => {
                console.log(`[ITEM LADE FORTSCHRITT] Item ${itemType} v${version}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`[FEHLER] Fehler beim Laden von Item "${itemType}" Version ${version} (${modelPath}):`, error);
                alert(`Fehler beim Laden von Item "${itemType}" Version ${version}. Überprüfen Sie die Datei und den Pfad in "models/${itemType}_v${version}.glb".`);
            }
        );
    }

    // Funktion angepasst, um von V2 auf V3 zu wechseln
    function replaceItemWithCookedVersion() {
        console.log(`[REPLACE ITEM] Starting for currentItemType: ${currentItemType}, currentLoadedItem present: ${!!currentLoadedItem}, currentItemVersion: ${currentItemVersion}`);

        if (!currentItemType || !currentLoadedItem) {
            console.log('[KOCHEN] Kein Item geladen, um es zu kochen. Überspringe Ersetzen.');
            return;
        }

        let nextVersion = currentItemVersion + 1; // Erhöhe die Version um 1

        // Stelle sicher, dass du nicht über die maximale Version hinausgehst (hier 3)
        // Du kannst dies anpassen, wenn du mehr Versionen hast.
        if (nextVersion > 3) { 
            console.log(`[REPLACE ITEM] Item "${currentItemType}" ist bereits auf der höchsten Version (V${currentItemVersion}). Kein weiteres Kochen möglich.`);
            return;
        }

        console.log(`[KOCHEN] Ersetze Item "${currentItemType}" Version ${currentItemVersion} durch Version ${nextVersion}.`);
        
        scene.remove(currentLoadedItem); 
        currentLoadedItem = null; // Setzt es temporär auf null, bevor das neue geladen wird

        const cookedModelPath = `models/${currentItemType}_v${nextVersion}.glb`;
        console.log(`[KOCHEN] Lade gekochtes Item: ${cookedModelPath}`);
        itemLoader.load(
            cookedModelPath,
            (gltf) => {
                currentLoadedItem = gltf.scene; 
                currentLoadedItem.position.copy(itemPosition);
                scene.add(currentLoadedItem); 
                currentItemVersion = nextVersion; // Aktualisiere die Versionsnummer nach dem Laden
                console.log(`[KOCHEN] Item "${currentItemType}" erfolgreich auf "v${currentItemVersion}" gewechselt.`);
            },
            (xhr) => {
                console.log(`[KOCHEN LADE FORTSCHRITT] Gekochtes Item ${currentItemType} v${nextVersion}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% geladen`);
            },
            (error) => {
                console.error(`[REPLACE ITEM ERROR] Fehler beim Laden der gekochten Version von Item "${currentItemType}" v${nextVersion} (${cookedModelPath}):`, error); 
                alert(`Fehler beim Laden der gekochten Version von Item "${currentItemType}". Überprüfen Sie die Datei und den Pfad in "models/${currentItemType}_v${nextVersion}.glb".`);
            }
        );
    }

    function removeItem() {
        if (currentLoadedItem) {
            console.log(`[REMOVE ITEM] Entferne Item:`, currentLoadedItem);
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
            currentItemType = null; 
            currentItemVersion = 1; // Setze die Version zurück, wenn Item entfernt wird
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
            if (child.isMesh && (child.name === doorMeshName || child.name === startButtonName || child.name === stopButtonName || child.name === resetButtonName)) {
                interactableMeshes.push(child);
            }
        });

        const intersects = raycaster.intersectObjects(interactableMeshes);

        if (intersects.length > 0) {
            const firstHitObject = intersects[0].object;
            console.log(`[RAYCAST] Getroffen: ${firstHitObject.name}`);

            if (firstHitObject.name === doorMeshName) {
                console.log(`[RAYCAST] Tür geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}`);
                if (!isAnimating && doorAction && !processRunning) {
                    toggleDoorAnimation();
                } else {
                    if (isAnimating) console.log('[RAYCAST] Tür-Animation läuft bereits.');
                    if (processRunning) console.log('[RAYCAST] Prozess läuft, kann Tür nicht manuell öffnen/schließen.');
                }
            } else if (firstHitObject.name === startButtonName) {
                console.log(`[RAYCAST] Start-Button geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}, currentLoadedItem=${!!currentLoadedItem}`);
                if (!isAnimating && !processRunning) { 
                    console.log('[RAYCAST] Starte Mikrowellen-Prozess!');
                    closeDoorAndOpenAfterDelay(); 
                } else {
                    if (isAnimating) console.log('[RAYCAST] Start nicht möglich: Animation läuft.');
                    if (processRunning) console.log('[RAYCAST] Start nicht möglich: Prozess läuft bereits.');
                }
            } else if (firstHitObject.name === stopButtonName) {
                console.log(`[RAYCAST] Stop-Button geklickt. Zustände: processRunning=${processRunning}`);
                abortMicrowaveProcess();
            } else if (firstHitObject.name === resetButtonName) { 
                console.log(`[RAYCAST] Reset-Button geklickt. Zustände: processRunning=${processRunning}`);
                removeItem(); 
            }
        } else {
            console.log('[RAYCAST] Kein interaktives Objekt getroffen.');
        }
    }

    async function closeDoorAndOpenAfterDelay(delayInSeconds = 10) { 
        if (!doorAction) {
            console.warn('[PROZESS] Tür-Animation nicht verfügbar. Prozess abgebrochen.');
            return;
        }
        
        if (!currentLoadedItem) {
            console.log('[PROZESS] Kein Item in der Mikrowelle gefunden. Der Mikrowellenzyklus läuft trotzdem ab.');
        }

        processRunning = true;
        updateButtonStates(); 

        processAbortController = new AbortController();

        try {
            if (isDoorOpen) { 
                console.log('[PROZESS] Tür ist offen (isDoorOpen=true), schließe sie...');
                toggleDoorAnimation(); 
                await waitForAnimationEnd(); 
                if (processAbortController.signal.aborted) throw new Error('Process aborted');
            } else {
                console.log('[PROZESS] Tür ist bereits geschlossen (isDoorOpen=false).'); 
            }

            // Bereich für dynamische Feuer-Partikel START
            if (fireParticlesGroup) {
                fireParticlesGroup.visible = true; 
                console.log('[PROZESS] Geklonte "microwave_fire" Partikel sichtbar gemacht.');
            }
            // ENDE Bereich für dynamische Feuer-Partikel

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

            console.log(`[PROZESS] Warte ${delayInSeconds} Sekunden...`);
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000)); 
            const abortPromise = new Promise((_, reject) => {
                processAbortController.signal.addEventListener('abort', () => reject(new Error('Process aborted')), { once: true });
            });

            await Promise.race([timeoutPromise, abortPromise]);

            if (processAbortController.signal.aborted) {
                throw new Error('Process aborted');
            }

            console.log(`[PROZESS] ${delayInSeconds} Sekunden vorbei.`);
            // Hier wird replaceItemWithCookedVersion() aufgerufen, die nun die nächste Version lädt
            if (currentLoadedItem) { 
                replaceItemWithCookedVersion();
            } else {
                console.log('[PROZESS] Kein Item geladen, daher kein Austausch auf nächste Version.');
            }

            if (!isDoorOpen && !isAnimating) { 
                 console.log('[PROZESS] Öffne die Tür...');
                 toggleDoorAnimation(); 
                 await waitForAnimationEnd(); 
            } else {
                console.log('[PROZESS] Tür ist bereits offen oder wird animiert.');
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

            // Bereich für dynamische Feuer-Partikel STOP
            if (fireParticlesGroup) {
                fireParticlesGroup.visible = false; 
                console.log('[PROZESS] Geklonte "microwave_fire" Partikel ausgeblendet.');
            }
            // ENDE Bereich für dynamische Feuer-Partikel

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

            if (!isDoorOpen && !isAnimating) { 
                 console.log('[PROZESS] Tür war geschlossen oder wurde geschlossen und ist jetzt nicht animiert, öffne sie am Ende des Prozesses.');
                 toggleDoorAnimation(); 
            } else if (isDoorOpen && !isAnimating) { 
                console.log('[PROZESS] Tür ist bereits offen und nicht animiert.');
            } else if (isAnimating) {
                console.log('[PROZESS] Tür-Animation läuft noch, warte auf Ende, um Endzustand zu setzen (wird durch onAnimationFinished behandelt).');
            }
            updateButtonStates(); 
        }
    }

    function abortMicrowaveProcess() {
        console.log(`[ABORT] Abort-funktion aufgerufen. processRunning=${processRunning}, processAbortController=${!!processAbortController}`);
        if (processRunning && processAbortController) {
            console.log('[ABORT] Abbruchsignal gesendet, da Prozess läuft!');
            processAbortController.abort();
        } else {
            console.log('[ABORT] Kein Mikrowellen-Prozess zum Abbrechen aktiv.');
            if (!isDoorOpen && !isAnimating) { 
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

        console.log(`[TÜR ANIMATION] toggleDoorAnimation aufgerufen. Aktueller isDoorOpen=${isDoorOpen}`); 
        isAnimating = true;
        updateButtonStates(); 

        doorAction.loop = THREE.LoopOnce;
        doorAction.clampWhenFinished = true;

        if (isDoorOpen) { 
            doorAction.timeScale = -1; 
            doorAction.paused = false;
            doorAction.time = doorAction.getClip().duration; 
            doorAction.play();
            console.log('[TÜR ANIMATION] Tür schließt sich...');
        } else { 
            doorAction.timeScale = 1; 
            doorAction.paused = false;
            doorAction.time = 0; 
            doorAction.play();
            console.log('[TÜR ANIMATION] Tür öffnet sich...');
        }

        mixer.addEventListener('finished', onAnimationFinished);
    }

    function onAnimationFinished(e) {
        if (e.action === doorAction) {
            console.log('[TÜR ANIMATION] Animation beendet (Three.js Event).');

            isAnimating = false;
            isDoorOpen = !isDoorOpen; 
            console.log(`[TÜR ANIMATION] Tür-Zustand ist jetzt: ${isDoorOpen ? 'OFFEN' : 'GESCHLOSSEN'}`); 
            updateButtonStates(); 

            mixer.removeEventListener('finished', onAnimationFinished);
        }
    }

    function updateButtonStates() {
        console.log(`[BUTTON UPDATE] Aktualisiere Button-Zustände. isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}, currentLoadedItem=${!!currentLoadedItem}`); 

        itemButtons.forEach(btn => {
            btn.disabled = isAnimating || processRunning || !isDoorOpen; 
            console.log(`[BUTTON UPDATE] Item Button (${btn.dataset.item}).disabled = ${btn.disabled} (Basierend auf isDoorOpen=${isDoorOpen})`); 
        });
    }

    // Animations-Loop
    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        if (mixer) {
            mixer.update(delta);
        }

        // Bereich für dynamische Feuer-Partikel Animation START
        if (fireParticlesGroup && fireParticlesGroup.visible) { 
            fireParticles.forEach(particle => {
                particle._currentAge += delta; 

                if (particle._currentAge > particle._lifeSpan) {
                    particle._currentAge = 0;
                    const spawnWidth = particleSpawnArea.maxX - particleSpawnArea.minX;
                    const spawnDepth = particleSpawnArea.maxZ - particleSpawnArea.minZ;
                    particle.position.x = particleSpawnArea.minX + Math.random() * spawnWidth;
                    particle.position.y = spawnBaseY; 
                    particle.position.z = particleSpawnArea.minZ + Math.random() * spawnDepth;
                    particle.scale.copy(particle._initialScale); 
                }

                const progress = particle._currentAge / particle._lifeSpan; 

                particle.position.y = particle._initialY + progress * particleMaxHeight;

                const currentScale = particle._initialScale.clone().multiplyScalar(1 - progress);
                particle.scale.copy(currentScale);

                const fluctuation = 0.01; 
                const speed = 5; 
                particle.position.x += Math.sin(particle._currentAge * speed + particle.id) * fluctuation * delta;
                particle.position.z += Math.cos(particle._currentAge * speed * 0.8 + particle.id) * fluctuation * delta;
            });
        }
        // ENDE Bereich für dynamische Feuer-Partikel Animation

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