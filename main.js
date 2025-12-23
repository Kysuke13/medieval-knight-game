import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';


/* =========================
   SCENE
========================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 10, 40);

/* =========================
   CAMERA
========================= */
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

/* =========================
   RENDERER
========================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

/* =========================
   LABEL RENDERER (Pour les bulles de dialogue)
========================= */
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

/* =========================
   LIGHTS
========================= */
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff1c1, 1.2);
dirLight.position.set(5, 10, 2);
dirLight.castShadow = true;
scene.add(dirLight);

/* =========================
   GROUND
========================= */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(150, 150),
  new THREE.MeshStandardMaterial({ color: 0x1f7a1f })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* =========================
   GRASS (InstancedMesh - Optimisé)
========================= */
const bladeGeometry = new THREE.PlaneGeometry(0.15, 0.6);
const bladeMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a7d3a,
  side: THREE.DoubleSide
});

const grassCount = 3000;
const grass = new THREE.InstancedMesh(
  bladeGeometry,
  bladeMaterial,
  grassCount
);

const dummy = new THREE.Object3D();

// Taille de la map
const mapSize = 150;

for (let i = 0; i < grassCount; i++) {
  dummy.position.set(
    (Math.random() - 0.5) * mapSize,
    0.3, // Hauteur du centre du brin (la moitié de la hauteur du plan)
    (Math.random() - 0.5) * mapSize
  );
  
  // Rotation aléatoire autour de l'axe Y
  dummy.rotation.y = Math.random() * Math.PI * 2;
  
  // Légère inclinaison aléatoire pour plus de réalisme
  dummy.rotation.x = (Math.random() - 0.5) * 0.2;
  dummy.rotation.z = (Math.random() - 0.5) * 0.2;
  
  dummy.updateMatrix();
  grass.setMatrixAt(i, dummy.matrix);
}

grass.instanceMatrix.needsUpdate = true;

// Configurer les ombres (l'herbe ne projette pas d'ombres mais en reçoit)
grass.castShadow = false;
grass.receiveShadow = true;

scene.add(grass);

/* =========================
   PLAYER (AZRI RUN ANIMATION)
========================= */
const loader = new GLTFLoader();
let player = null;
let playerMixer = null;
let playerAction = null;
let defaultBoneRotations = new Map(); // Stocker les rotations par défaut des os

loader.load(
  '/assets/azri_run_animation/scene.gltf',
  (gltf) => {
    player = gltf.scene;

    // Ajuster l'échelle (réduire la taille pour correspondre au décor)
    player.scale.set(0.017, 0.017, 0.017);

    // Ombres
    player.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    // Calculer la bounding box pour aligner le personnage au sol
    const box = new THREE.Box3().setFromObject(player);
    const playerMinY = box.min.y;
    
    // Ajuster la position Y pour que le point le plus bas soit au niveau du sol (y=0)
    // Positionner le personnage devant la tour (la tour est à 5, 0, -5)
    player.position.set(5, -playerMinY, -2);

    // Sauvegarder les rotations par défaut des os (pose d'idle)
    player.traverse((child) => {
      if (child.isBone || child.type === 'Bone') {
        defaultBoneRotations.set(child, {
          rotation: child.rotation.clone(),
          quaternion: child.quaternion.clone()
        });
      }
    });

    // Animation
    if (gltf.animations && gltf.animations.length > 0) {
      playerMixer = new THREE.AnimationMixer(player);
      // Préparer l'animation de course (ne pas la jouer automatiquement)
      playerAction = playerMixer.clipAction(gltf.animations[0]);
      playerAction.setLoop(THREE.LoopRepeat);
    }

    scene.add(player);
  },
  undefined,
  (error) => console.error('GLTF error:', error)
);

/* =========================
   CHINA TOWER
========================= */
let tower = null;
const towerPosition = new THREE.Vector3(15, 0, -15);
const towerCollisionRadius = 2.5; // Rayon de collision de la tour
const towerPlatformHeight = 0.5; // Hauteur approximative de la plateforme de la tour

loader.load(
  '/assets/the_china_tower/scene.gltf',
  (gltf) => {
    tower = gltf.scene;

    // Ajuster l'échelle si nécessaire
    tower.scale.set(1, 1, 1);

    // Positionner temporairement la tour pour calculer la bounding box
    tower.position.set(0, 0, 0);

    // Ombres
    tower.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Calculer la bounding box pour aligner le sol de la tour avec le sol du jeu
    // D'abord positionner temporairement à l'origine pour calculer
    tower.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(tower);
    const towerMinY = box.min.y;
    
    // Ajuster la position Y pour enfoncer la tour dans le sol
    // Si minY est négatif, on doit le remonter de cette valeur
    // Si minY est positif, on doit le descendre
    // Enfoncer de 2 unités dans le sol
    towerPosition.y = -towerMinY - 2;
    
    // Positionner la tour sur la carte (à côté du joueur)
    tower.position.set(towerPosition.x, towerPosition.y, towerPosition.z);

    scene.add(tower);
  },
  undefined,
  (error) => console.error('China Tower GLTF error:', error)
);

/* =========================
   MAPLE TREES
========================= */
const treeCount = 2; // Nombre d'arbres à placer (près de la tour)
const trees = [];

loader.load(
  '/assets/maple_tree/scene.gltf',
  (gltf) => {
    const treeModel = gltf.scene;
    
    // Ajuster l'échelle des arbres si nécessaire
    treeModel.scale.set(1, 1, 1);
    
    // Calculer la bounding box pour aligner les arbres au sol
    const box = new THREE.Box3().setFromObject(treeModel);
    const treeMinY = box.min.y;
    
    // Placer 2 arbres près de la tour
    for (let i = 0; i < treeCount; i++) {
      const tree = treeModel.clone();
      
      // Position très loin de la tour (à une distance de 25-35 unités)
      const angle = (i / treeCount) * Math.PI * 2; // Répartir autour de la tour
      const distance = 25 + Math.random() * 10; // Distance entre 25 et 35 unités
      const x = towerPosition.x + Math.cos(angle) * distance;
      const z = towerPosition.z + Math.sin(angle) * distance;
      
      // Enfoncer l'arbre dans le sol (ajuster la position Y)
      tree.position.set(x, -treeMinY - 1.5, z);
      
      // Rotation aléatoire
      tree.rotation.y = Math.random() * Math.PI * 2;
      
      // Échelle réduite de 10 fois (les arbres étaient trop gros)
      const scale = (0.8 + Math.random() * 0.4) / 10;
      tree.scale.set(scale, scale, scale);
      
      // Ombres
      tree.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(tree);
      trees.push(tree);
    }
  },
  undefined,
  (error) => console.error('Maple Tree GLTF error:', error)
);

/* =========================
   TOTORO
========================= */
let totoro = null;
let totoroLabel = null;
const totoroDialogDistance = 4; // Distance très proche à laquelle la bulle apparaît
let totoroDialogTimer = null; // Timer pour la bulle de dialogue
let wasNearTotoro = false; // Pour détecter quand on s'approche

loader.load(
  '/assets/totoros/scene.gltf',
  (gltf) => {
    console.log('Totoro loaded successfully');
    totoro = gltf.scene;
    
    // S'assurer que le totoro est visible
    totoro.visible = true;
    
    // Ajuster l'échelle du totoro (agrandi)
    totoro.scale.set(2, 2, 2);
    
    // Calculer la bounding box pour aligner le totoro au sol
    const box = new THREE.Box3().setFromObject(totoro);
    const totoroMinY = box.min.y;
    console.log('Totoro bounding box:', box.min, box.max, 'minY:', totoroMinY);
    
    // Positionner le totoro près d'un arbre
    // Les arbres sont autour de la tour à (15, 0, -15) à une distance de 25-35 unités
    // On place le totoro près d'un arbre (même angle que le premier arbre mais un peu plus proche)
    const treeAngle = 0; // Angle du premier arbre
    const treeDistance = 25; // Distance des arbres
    const totoroDistance = treeDistance - 3; // Un peu plus proche que l'arbre
    const totoroX = towerPosition.x + Math.cos(treeAngle) * totoroDistance;
    const totoroZ = towerPosition.z + Math.sin(treeAngle) * totoroDistance;
    
    // Enfoncer le totoro un peu dans le sol
    totoro.position.set(totoroX, -totoroMinY - 0.3, totoroZ);
    console.log('Totoro positioned at:', totoroX, -totoroMinY, totoroZ);
    
    // Rotation
    totoro.rotation.y = 0;
    
    // S'assurer que tous les meshes sont visibles
    totoro.traverse((child) => {
      if (child.isMesh) {
        child.visible = true;
        child.castShadow = true;
        child.receiveShadow = true;
        // Forcer le matériau à être visible
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      }
    });
    
    scene.add(totoro);
    
    // Créer la bulle de dialogue pour totoro
    const dialogDiv = document.createElement('div');
    dialogDiv.className = 'totoro-dialog';
    dialogDiv.textContent = 'Bonjour !';
    dialogDiv.style.display = 'none'; // Cachée par défaut - IMPORTANT
    dialogDiv.style.visibility = 'hidden'; // Double sécurité
    dialogDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    dialogDiv.style.padding = '10px 15px';
    dialogDiv.style.borderRadius = '10px';
    dialogDiv.style.fontSize = '16px';
    dialogDiv.style.fontFamily = 'Arial, sans-serif';
    dialogDiv.style.color = '#000';
    dialogDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    dialogDiv.style.whiteSpace = 'nowrap';
    dialogDiv.style.pointerEvents = 'none';
    
    // Ajouter une flèche pointant vers totoro
    const arrow = document.createElement('div');
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderLeft = '10px solid transparent';
    arrow.style.borderRight = '10px solid transparent';
    arrow.style.borderTop = '10px solid rgba(255, 255, 255, 0.9)';
    arrow.style.position = 'absolute';
    arrow.style.bottom = '-10px';
    arrow.style.left = '50%';
    arrow.style.transform = 'translateX(-50%)';
    dialogDiv.appendChild(arrow);
    
    totoroLabel = new CSS2DObject(dialogDiv);
    totoroLabel.position.set(0, 3, 0); // Au-dessus de totoro
    totoro.add(totoroLabel);
    
    console.log('Totoro added to scene');
  },
  (progress) => {
    if (progress.lengthComputable) {
      console.log('Loading totoro:', (progress.loaded / progress.total * 100) + '%');
    }
  },
  (error) => {
    console.error('Totoro GLTF error:', error);
  }
);

/* =========================
   WALKING INDOMINUS REX (Se balade sur la map)
========================= */
let rex = null;
let rexMixer = null;
let rexAction = null;
let rexTargetPosition = new THREE.Vector3();
let rexSpeed = 0.05; // Vitesse de déplacement
let rexWanderRadius = 40; // Rayon de balade autour du centre
const rexFollowDistance = 15; // Distance à laquelle le dinosaure commence à suivre le joueur

loader.load(
  '/assets/walking_indominus_rex/scene.gltf',
  (gltf) => {
    console.log('Indominus Rex loaded successfully');
    rex = gltf.scene;
    
    // S'assurer que le dinosaure est visible
    rex.visible = true;
    
    // Ajuster l'échelle du dinosaure (agrandi de 10 fois)
    rex.scale.set(5, 5, 5);
    
    // Calculer la bounding box pour aligner le dinosaure au sol
    const box = new THREE.Box3().setFromObject(rex);
    const rexMinY = box.min.y;
    console.log('Rex bounding box:', box.min, box.max, 'minY:', rexMinY);
    
    // Positionner le dinosaure près du joueur pour être visible
    // Le joueur est à (5, 0, -2)
    const startX = 7;
    const startZ = -2;
    rex.position.set(startX, -rexMinY, startZ);
    console.log('Rex positioned at:', startX, -rexMinY, startZ);
    
    // Position cible initiale (près de la position de départ)
    rexTargetPosition.set(
      startX + (Math.random() - 0.5) * 10,
      -rexMinY,
      startZ + (Math.random() - 0.5) * 10
    );
    
    // Rotation initiale
    rex.rotation.y = 0;
    
    // S'assurer que tous les meshes sont visibles
    rex.traverse((child) => {
      if (child.isMesh) {
        child.visible = true;
        child.castShadow = true;
        child.receiveShadow = true;
        // Forcer le matériau à être visible
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      }
    });
    
    // Animation de marche
    if (gltf.animations && gltf.animations.length > 0) {
      rexMixer = new THREE.AnimationMixer(rex);
      rexAction = rexMixer.clipAction(gltf.animations[0]);
      rexAction.setLoop(THREE.LoopRepeat);
      rexAction.play();
      console.log('Rex animation playing');
    } else {
      console.log('No animations found for Rex');
    }
    
    scene.add(rex);
    console.log('Indominus Rex added to scene');
  },
  (progress) => {
    if (progress.lengthComputable) {
      console.log('Loading Rex:', (progress.loaded / progress.total * 100) + '%');
    }
  },
  (error) => {
    console.error('Walking Indominus Rex GLTF error:', error);
  }
);

/* =========================
   CAMERA FOLLOW
========================= */
const cameraOffset = new THREE.Vector3(0, 2.8, 5);
const cameraLookOffset = new THREE.Vector3(0, 1.2, 0);

// Angles de la caméra (sphériques)
let cameraYaw = 0; // Rotation horizontale
let cameraPitch = 0.5; // Rotation verticale (0.5 = angle par défaut)
const cameraDistance = 5; // Distance de la caméra au joueur
const cameraHeight = 2.8; // Hauteur de la caméra
let isMouseDown = false; // État du clic gauche
let isRightMouseDown = false; // État du clic droit

/* =========================
   CONTROLS
========================= */
const keys = {};
const speed = 0.12;
const rotationSpeed = 0.03; // Vitesse de rotation

/* =========================
   JUMP SYSTEM
========================= */
let velocityY = 0; // Vélocité verticale
const gravity = -0.02; // Force de gravité
const jumpForce = 0.25; // Force du saut
const groundLevel = 0; // Niveau du sol

/* =========================
   COLLISION SYSTEM
========================= */
const playerRadius = 0.5; // Rayon de collision du joueur
const raycaster = new THREE.Raycaster();

function checkCollision(newPosition, currentPlayerY) {
  if (!tower) return false;
  
  // Calculer la distance entre le joueur et la tour
  const distance = Math.sqrt(
    Math.pow(newPosition.x - towerPosition.x, 2) +
    Math.pow(newPosition.z - towerPosition.z, 2)
  );
  
  // Si le joueur est dans le rayon de collision de la tour
  if (distance < (playerRadius + towerCollisionRadius)) {
    // Vérifier si le joueur est vraiment sur la plateforme de la tour
    // La plateforme est à une hauteur spécifique
    const isOnPlatform = currentPlayerY >= towerPlatformHeight - 0.1 && 
                         currentPlayerY <= towerPlatformHeight + 0.5;
    
    // Si le joueur est sur la plateforme, permettre le mouvement horizontal
    if (isOnPlatform) {
      return false; // Pas de collision, mouvement autorisé sur la plateforme
    }
    
    // Utiliser le raycasting pour vérifier les collisions avec les murs
    // Créer un raycast depuis la position actuelle vers la nouvelle position
    const direction = new THREE.Vector3()
      .subVectors(newPosition, player.position)
      .normalize();
    
    raycaster.set(player.position, direction);
    raycaster.far = player.position.distanceTo(newPosition) + playerRadius;
    
    // Tester la collision avec la tour
    const intersects = raycaster.intersectObject(tower, true);
    
    if (intersects.length > 0) {
      const intersectionDistance = intersects[0].distance;
      const movementDistance = player.position.distanceTo(newPosition);
      
      // Si l'intersection est plus proche que la distance de mouvement, bloquer
      if (intersectionDistance < movementDistance + playerRadius) {
        return true; // Collision détectée avec les murs
      }
    }
    
    // Si le joueur n'est pas sur la plateforme et qu'il n'y a pas d'intersection,
    // bloquer quand même pour éviter de passer à travers la base
    return true;
  }
  
  // Si le joueur est en dehors du rayon, pas de collision
  return false;
}

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

/* =========================
   MOUSE CONTROLS
========================= */
// Clic gauche pour activer/désactiver le contrôle de caméra
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Clic gauche
    isMouseDown = true;
    renderer.domElement.style.cursor = 'grabbing';
  }
  if (e.button === 2) { // Clic droit
    isRightMouseDown = true;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) { // Clic gauche
    isMouseDown = false;
    if (!isRightMouseDown) {
      renderer.domElement.style.cursor = 'default';
    }
  }
  if (e.button === 2) { // Clic droit
    isRightMouseDown = false;
    if (!isMouseDown) {
      renderer.domElement.style.cursor = 'default';
    }
  }
});

// Mouvement de la souris pour contrôler la caméra
window.addEventListener('mousemove', (e) => {
  if (isMouseDown) {
    const sensitivity = 0.008;
    
    // Rotation horizontale (yaw)
    cameraYaw -= e.movementX * sensitivity;
    
    // Rotation verticale (pitch) avec limites (inversé)
    cameraPitch += e.movementY * sensitivity;
    cameraPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraPitch)); // Limite entre -60° et 60°
  }
});

// Empêcher le menu contextuel au clic droit
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

/* =========================
   RESET BONES TO DEFAULT POSE
========================= */
function resetBonesToDefault() {
  if (!player) return;
  
  player.traverse((child) => {
    if (child.isBone || child.type === 'Bone') {
      const defaultRot = defaultBoneRotations.get(child);
      if (defaultRot) {
        child.rotation.copy(defaultRot.rotation);
        child.quaternion.copy(defaultRot.quaternion);
      }
    }
  });
}

/* =========================
   RESIZE
========================= */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (labelRenderer) {
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }
});

/* =========================
   GAME LOOP
========================= */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Mettre à jour l'animation du joueur
  if (playerMixer) {
    playerMixer.update(delta);
  }

  // Mettre à jour l'animation et le déplacement du dinosaure
  if (rexMixer) {
    rexMixer.update(delta);
  }

  if (rex && player) {
    // Calculer la distance entre le dinosaure et le joueur
    const distanceToPlayer = rex.position.distanceTo(player.position);
    
    // Si le joueur est proche, le dinosaure le suit
    if (distanceToPlayer < rexFollowDistance) {
      // Suivre le joueur
      const directionToPlayer = new THREE.Vector3()
        .subVectors(player.position, rex.position)
        .normalize();
      
      // Se déplacer vers le joueur
      rex.position.add(directionToPlayer.multiplyScalar(rexSpeed));
      
      // Faire regarder le dinosaure vers le joueur
      if (directionToPlayer.length() > 0) {
        rex.rotation.y = Math.atan2(directionToPlayer.x, directionToPlayer.z);
      }
    } else {
      // Sinon, continuer à se balader normalement
      const direction = new THREE.Vector3()
        .subVectors(rexTargetPosition, rex.position)
        .normalize();
      
      // Distance jusqu'à la cible
      const distanceToTarget = rex.position.distanceTo(rexTargetPosition);
      
      // Si le dinosaure est proche de sa cible, choisir une nouvelle cible
      if (distanceToTarget < 2) {
        // Nouvelle position cible aléatoire
        rexTargetPosition.set(
          (Math.random() - 0.5) * mapSize,
          rex.position.y,
          (Math.random() - 0.5) * mapSize
        );
      } else {
        // Se déplacer vers la cible
        rex.position.add(direction.multiplyScalar(rexSpeed));
        
        // Faire regarder le dinosaure dans la direction de mouvement
        if (direction.length() > 0) {
          rex.rotation.y = Math.atan2(direction.x, direction.z);
        }
      }
    }
  }

  if (player) {
    /* --- Saut et gravité avec détection du sol de la tour --- */
    // Vérifier si le joueur est au-dessus de la plateforme de la tour
    const distanceToTower = Math.sqrt(
      Math.pow(player.position.x - towerPosition.x, 2) +
      Math.pow(player.position.z - towerPosition.z, 2)
    );
    const isOnTowerPlatform = distanceToTower < (playerRadius + towerCollisionRadius) && 
                               player.position.y >= groundLevel && 
                               player.position.y <= towerPlatformHeight + 0.5;
    
    // Déterminer la hauteur du sol actuel
    let currentGroundHeight = groundLevel;
    if (isOnTowerPlatform) {
      currentGroundHeight = towerPlatformHeight;
    }
    
    const isGrounded = player.position.y <= currentGroundHeight + 0.1;
    
    if (keys[' '] && isGrounded && velocityY <= 0) {
      // Espace pour sauter (seulement si au sol)
      velocityY = jumpForce;
    }
    
    // Appliquer la gravité
    velocityY += gravity;
    
    // Mettre à jour la position Y
    player.position.y += velocityY;
    
    // Empêcher le joueur de passer sous le sol (sol normal ou plateforme de la tour)
    if (player.position.y < currentGroundHeight) {
      player.position.y = currentGroundHeight;
      velocityY = 0;
    }

    /* --- Rotation --- */
    if (keys['q']) player.rotation.y += rotationSpeed; // Pivoter à gauche
    if (keys['d']) player.rotation.y -= rotationSpeed; // Pivoter à droite

    /* --- Movement (dans la direction du chevalier) --- */
    const direction = new THREE.Vector3();
    player.getWorldDirection(direction);
    
    let isMoving = false;
    
    if (keys['z']) {
      // Avancer
      const newPosition = player.position.clone().add(direction.clone().multiplyScalar(speed));
      if (!checkCollision(newPosition, player.position.y)) {
        player.position.copy(newPosition);
        isMoving = true;
      }
    }
    if (keys['s']) {
      // Reculer
      const newPosition = player.position.clone().add(direction.clone().multiplyScalar(-speed));
      if (!checkCollision(newPosition, player.position.y)) {
        player.position.copy(newPosition);
      }
    }

    /* --- Avancer dans la direction de la caméra (clic gauche + droit) --- */
    if (isMouseDown && isRightMouseDown) {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      // Projeter la direction sur le plan horizontal (ignorer la composante Y)
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const newPosition = player.position.clone().add(cameraDirection.multiplyScalar(speed));
      if (!checkCollision(newPosition, player.position.y)) {
        player.position.copy(newPosition);
        isMoving = true;
      }
      
      // Faire tourner le chevalier pour qu'il regarde dans la direction de la caméra
      if (cameraDirection.length() > 0) {
        const targetAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
        player.rotation.y = targetAngle;
      }
    }

    /* --- Contrôle de l'animation de course --- */
    if (playerAction) {
      if (isMoving) {
        // Jouer l'animation de course si le personnage avance
        if (!playerAction.isRunning()) {
          playerAction.play();
        }
      } else {
        // Arrêter l'animation si le personnage ne bouge pas
        if (playerAction.isRunning()) {
          playerAction.stop();
          // Réinitialiser les os à leur position par défaut (jambes collées)
          resetBonesToDefault();
        }
      }
    }

    /* --- Camera follow avec contrôle souris --- */
    // Calculer la position de la caméra en coordonnées sphériques
    const cameraX = player.position.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance;
    const cameraY = player.position.y + cameraHeight + Math.sin(cameraPitch) * cameraDistance;
    const cameraZ = player.position.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance;
    
    const desiredCameraPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
    camera.position.lerp(desiredCameraPosition, 0.1);
    camera.lookAt(player.position.clone().add(cameraLookOffset));
  }

  // Gérer l'affichage de la bulle de dialogue de totoro
  if (totoro && totoroLabel && player) {
    const distanceToTotoro = player.position.distanceTo(totoro.position);
    const isNearTotoro = distanceToTotoro < totoroDialogDistance;
    
    // Détecter quand on s'approche (transition de loin à proche)
    if (isNearTotoro && !wasNearTotoro) {
      // Afficher la bulle de dialogue quand on s'approche très près
      if (totoroLabel && totoroLabel.element) {
        totoroLabel.element.style.display = 'block';
        totoroLabel.element.style.visibility = 'visible';
        
        // Annuler le timer précédent s'il existe
        if (totoroDialogTimer) {
          clearTimeout(totoroDialogTimer);
        }
        
        // Cacher la bulle après exactement 3 secondes
        totoroDialogTimer = setTimeout(() => {
          if (totoroLabel && totoroLabel.element) {
            totoroLabel.element.style.display = 'none';
            totoroLabel.element.style.visibility = 'hidden';
          }
          totoroDialogTimer = null;
        }, 3000); // 3 secondes
      }
    }
    
    // Si on s'éloigne, cacher immédiatement la bulle et annuler le timer
    if (!isNearTotoro) {
      if (totoroDialogTimer) {
        clearTimeout(totoroDialogTimer);
        totoroDialogTimer = null;
      }
      // Cacher la bulle immédiatement si on s'éloigne
      if (totoroLabel && totoroLabel.element) {
        totoroLabel.element.style.display = 'none';
        totoroLabel.element.style.visibility = 'hidden';
      }
    }
    
    // Mettre à jour l'état précédent
    wasNearTotoro = isNearTotoro;
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
