// public/microwave.js

import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('microwaveCanvas');
    const itemButtons = document.querySelectorAll('.itemButton');

    document.title = "interactive microwave3000";

    if (!canvas || itemButtons.length === 0) {
        console.error('FEHLER: HTML-Elemente nicht gefunden! Canvas oder Item-Buttons fehlen.');
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xFFFFFF, 1);

    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5).normalize();
    scene.add(directionalLight);

    camera.position.set(0, 1.5, 6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .25;

    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI * 1;
    controls.target.set(0, 1.5, 0); 
    controls.update(); 

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let microwaveModel;
    let mixer;
    let clock = new THREE.Clock();
    let doorAction;
    let isDoorOpen = false;
    let isAnimating = false;

    let processRunning = false;
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

    let fireParticlesGroup; 
    let microwaveFireTemplate; 
    
    const particleSpawnArea = {
        minX: -2,   
        maxX: 0.8,  
        minY: 0.6,  
        minZ: -1.1, 
        maxZ: 0.7   
    };

    const particleCount = 100;
    const particleMaxHeight = 2.0; 
    const particleMinLife = 1.0; 
    const particleMaxLife = 3.0; 
    const fireParticles = []; 
    const particleInitialScale = 1.0; 

    let currentLoadedItem = null;
    let currentItemType = null;
    let currentItemVersion = 1; 
    const itemLoader = new GLTFLoader();
    const itemPosition = new THREE.Vector3(-0.5, 0.45, 0);

    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    const rubberDucks = []; 

    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.y = 0.5; 
    world.addBody(groundBody);
    
    const physicsWalls = [];
    const backWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, 0, particleSpawnArea.minZ) });
    backWallBody.quaternion.setFromEuler(0, 0, 0);
    physicsWalls.push(backWallBody);
    const leftWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), position: new CANNON.Vec3(particleSpawnArea.minX, 0, 0) });
    leftWallBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
    physicsWalls.push(leftWallBody);
    const rightWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), position: new CANNON.Vec3(particleSpawnArea.maxX, 0, 0) });
    rightWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    physicsWalls.push(rightWallBody);
    const ceilingBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, 2.0, 0) });
    ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    physicsWalls.push(ceilingBody);

    const frontWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), position: new CANNON.Vec3(0, 0, particleSpawnArea.maxZ) });
    frontWallBody.quaternion.setFromEuler(0, Math.PI, 0); 
    
    togglePhysicsWalls(true);

    itemButtons.forEach(btn => btn.disabled = true); 

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
                console.warn(`[INIT] Animation "${timerAnimationName}" konnte nicht gefunden werden.`);
                alert(`Die Timer-Animation "${timerAnimationName}" konnte nicht gefunden werden. Bitte überprüfe den Namen in Blender.`);
            }

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

    canvas.addEventListener('click', onCanvasInteraction);
    canvas.addEventListener('touchstart', (event) => {
        onCanvasInteraction(event);
    }, { passive: false });

    itemButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const itemType = event.currentTarget.dataset.item; 
            console.log(`[HTML BUTTON] Item-Button "${itemType}" geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}`);

            if (!processRunning && !isAnimating && isDoorOpen) { 
                loadItem(itemType, 1);
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

    function loadItem(itemType, version) {
        console.log(`[ITEM LADEN] Versuche Item "${itemType}" Version ${version} zu laden.`);
        removeItem();

        const modelPath = `models/${itemType}_v${version}.glb`;
        console.log(`[ITEM LADEN] Lade: ${modelPath}`);
        itemLoader.load(
            modelPath,
            (gltf) => {
                currentItemType = itemType; 
                currentItemVersion = version;

                if (currentItemType === 'rubber_duck') {
                    const duckMesh = gltf.scene;
                    const duckSpawnPosition = new THREE.Vector3(itemPosition.x, itemPosition.y + 1.0, itemPosition.z);
                    addPhysicsToDuck(duckMesh, duckSpawnPosition);
                    console.log(`[ITEM LADEN] Erste Gummiente erfolgreich geladen und mit Physik versehen.`);
                } else if (currentItemType === 'ice') {
                    currentLoadedItem = gltf.scene;
                    currentLoadedItem.position.copy(itemPosition); 
                    scene.add(currentLoadedItem);
                    console.log(`[ITEM LADEN] Ice Item erfolgreich geladen und platziert.`);
                } else {
                    currentLoadedItem = gltf.scene;
                    currentLoadedItem.position.copy(itemPosition); 
                    scene.add(currentLoadedItem);
                    console.log(`[ITEM LADEN] Item "${itemType}" Version ${version} erfolgreich geladen und platziert.`);
                }
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
    
    function addPhysicsToDuck(duckMesh, position, impulse = null) {
        duckMesh.position.copy(position);
        scene.add(duckMesh);
        
        const duckShape = new CANNON.Box(new CANNON.Vec3(0.15, 0.15, 0.15));
        const duckBody = new CANNON.Body({
            mass: 0.5,
            shape: duckShape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
        });
        
        if (impulse) {
            duckBody.velocity.set(impulse.x, impulse.y, impulse.z);
        } else {
            duckBody.velocity.set(0, 0, 0); 
        }
        
        world.addBody(duckBody);
        duckMesh.cannonBody = duckBody;
        rubberDucks.push(duckMesh);
    }

    function replaceItemWithCookedVersion() {
        console.log(`[REPLACE ITEM] Starting for currentItemType: ${currentItemType}, currentLoadedItem present: ${!!currentLoadedItem}, currentItemVersion: ${currentItemVersion}`);

        if (!currentItemType) {
            console.log('[KOCHEN] Kein Item geladen, um es zu kochen. Überspringe Ersetzen.');
            return;
        }

        if (currentItemType === 'rubber_duck') {
            const ducksToDuplicate = [...rubberDucks];
            const originalDuckMesh = ducksToDuplicate[0]; 

            ducksToDuplicate.forEach(duck => {
                const newDuck = originalDuckMesh.clone();
                const newPosition = duck.position.clone().add(new THREE.Vector3(Math.random() * 0.2 - 0.1, 0.5, Math.random() * 0.2 - 0.1));
                const newImpulse = new CANNON.Vec3(Math.random() * 20 - 10, 15, Math.random() * 20 - 10);
                addPhysicsToDuck(newDuck, newPosition, newImpulse);
            });
            console.log(`[GUMMIENTE] ${ducksToDuplicate.length} Enten geklont. Die aktuelle Anzahl beträgt ${rubberDucks.length}.`);

        } else {
            let nextVersion = currentItemVersion + 1;

            if (nextVersion > 3) {
                console.log(`[REPLACE ITEM] Item "${currentItemType}" ist bereits auf der höchsten Version (V${currentItemVersion}). Kein weiteres Kochen möglich.`);
                return;
            }

            console.log(`[KOCHEN] Ersetze Item "${currentItemType}" Version ${currentItemVersion} durch Version ${nextVersion}.`);
            
            scene.remove(currentLoadedItem); 
            currentLoadedItem = null; 

            const cookedModelPath = `models/${currentItemType}_v${nextVersion}.glb`;
            console.log(`[KOCHEN] Lade gekochtes Item: ${cookedModelPath}`);
            itemLoader.load(
                cookedModelPath,
                (gltf) => {
                    currentLoadedItem = gltf.scene; 
                    currentLoadedItem.position.copy(itemPosition);
                    scene.add(currentLoadedItem); 
                    currentItemVersion = nextVersion;
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
    }

    function removeItem() {
        if (currentItemType === 'rubber_duck') {
            rubberDucks.forEach(duck => {
                world.removeBody(duck.cannonBody);
                scene.remove(duck);
            });
            rubberDucks.length = 0; 
            currentLoadedItem = null;
            currentItemType = null;
            console.log('[ITEM] Alle Gummienten aus der Mikrowelle entfernt.');
        } else if (currentLoadedItem) {
            console.log(`[REMOVE ITEM] Entferne Item:`, currentLoadedItem);
            scene.remove(currentLoadedItem);
            currentLoadedItem = null;
            currentItemType = null; 
            currentItemVersion = 1;
            console.log('[ITEM] Item aus Mikrowelle entfernt.');
        } else {
            console.log('[ITEM] Keine Item zum Entfernen gefunden.');
        }
        updateButtonStates();
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
                console.log(`[RAYCAST] Start-Button geklickt. Zustände: isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}, currentLoadedItem=${!!currentLoadedItem || rubberDucks.length > 0}`);
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
        
        if (!currentLoadedItem && rubberDucks.length === 0) {
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

            togglePhysicsWalls(true);

            if (fireParticlesGroup) {
                fireParticlesGroup.visible = true; 
                console.log('[PROZESS] Geklonte "microwave_fire" Partikel sichtbar gemacht.');
            }

            if (redLightModelPart) {
                 redLightModelPart.visible = true;
                 console.log('[PROZESS] Rotes Licht (Modell-Teil) an.');
            }

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
            if (currentLoadedItem || rubberDucks.length > 0) { 
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

            togglePhysicsWalls(false);

            if (fireParticlesGroup) {
                fireParticlesGroup.visible = false; 
                console.log('[PROZESS] Geklonte "microwave_fire" Partikel ausgeblendet.');
            }

            if (redLightModelPart) {
                redLightModelPart.visible = false;
                console.log('[PROZESS] Rotes Licht (Modell-Teil) aus.');
            }

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

    function togglePhysicsWalls(active) {
        if (active) {
            if (physicsWalls.some(wall => !world.bodies.includes(wall))) {
                physicsWalls.forEach(wall => world.addBody(wall));
                console.log('[PHYSIK-WÄNDE] Physik-Wände der Mikrowelle aktiviert.');
            }
        } else {
            if (physicsWalls.some(wall => world.bodies.includes(wall))) {
                physicsWalls.forEach(wall => world.removeBody(wall));
                console.log('[PHYSIK-WÄNDE] Physik-Wände der Mikrowelle deaktiviert.');
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

            world.addBody(frontWallBody); 
            console.log('[PHYSIK] Vordere Wand hinzugefügt.');

        } else { 
            doorAction.timeScale = 1; 
            doorAction.paused = false;
            doorAction.time = 0; 
            doorAction.play();
            console.log('[TÜR ANIMATION] Tür öffnet sich...');

            world.removeBody(frontWallBody); 
            console.log('[PHYSIK] Vordere Wand entfernt.');
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
        console.log(`[BUTTON UPDATE] Aktualisiere Button-Zustände. isAnimating=${isAnimating}, processRunning=${processRunning}, isDoorOpen=${isDoorOpen}, currentLoadedItem=${!!currentLoadedItem || rubberDucks.length > 0}`); 

        const hasItem = !!currentLoadedItem || rubberDucks.length > 0;
        itemButtons.forEach(btn => {
            btn.disabled = isAnimating || processRunning || hasItem;

            if (hasItem && btn.dataset.item !== currentItemType && currentItemType !== 'rubber_duck') {
                 btn.disabled = true;
            } else if (currentItemType === 'rubber_duck' && rubberDucks.length > 0) {
                 if (btn.dataset.item !== 'rubber_duck') {
                    btn.disabled = true;
                 }
            } else if (!hasItem) {
                 btn.disabled = isAnimating || processRunning;
            }
        });
    }

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        if (mixer) {
            mixer.update(delta);
        }

        world.step(1/60);
        rubberDucks.forEach(duck => {
            if (duck.cannonBody) {
                duck.position.copy(duck.cannonBody.position);
                duck.quaternion.copy(duck.cannonBody.quaternion);
            }
        });
        
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

        controls.update();

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });
});