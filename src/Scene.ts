import * as THREE from "three";

import { FontLoader } from "./FontLoader";
import { TextGeometry } from "./TextGeometry";
import { OrbitControls } from "./OrbitControls";
import svgPathToShapePath from "./svgPathToShapePath";

import fontData from "./fonts/droid_sans_regular.typeface.json";

const BACKGROUND_COLOR = "lightblue";
const SHAPES_COLOR = "#f9fc21";

const LIGHTNING_SVG_PATH = `
  m325.662,3.768
  c-1.337,-2.331 -3.818,-3.768 -6.505,-3.768
  l-154.602,0
  c-3.218,0 -6.078,2.053 -7.107,5.102
  l-66.258,196.319
  c-0.772,2.289 -0.394,4.81 1.014,6.772
  c1.409,1.962 3.677,3.126 6.093,3.126
  l62.812,0
  l-72.292,193.557
  c-1.278,3.422 0.096,7.268 3.254,9.106
  c1.18,0.686 2.48,1.018 3.769,1.018
  c2.16,0 4.287,-0.932 5.756,-2.687
  l201.228,-240.49
  c1.869,-2.234 2.276,-5.348 1.043,-7.987
  c-1.232,-2.639 -3.882,-4.326 -6.795,-4.326
  l-58.094,0
  l86.654,-148.224
  c1.356,-2.32 1.368,-5.187 0.03,-7.518
  z
`;

export default class Scene {
  static FIELD_OF_VIEW = 30;
  static Z_NEAR = 1;
  static Z_FAR = 10000;

  static CAMERA_CHANGE_INTERVAL_MS = 5000;

  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3;
  private renderer: THREE.WebGLRenderer;
  private textMesh: THREE.Mesh;
  private textGeometry: TextGeometry;
  private lightningBolt: THREE.Group;

  private controls: OrbitControls;
  private lastRender: DOMHighResTimeStamp = 0;
  private lastCameraChange: DOMHighResTimeStamp = 0;
  private cameraVelocity = new THREE.Vector3();

  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    THREE.Cache.enabled = true;

    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(0, 250, 1400);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.125);
    directionalLight.position.set(0, 0, 1).normalize();
    this.scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(SHAPES_COLOR, 1);
    pointLight1.position.set(120, 120, 90);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(SHAPES_COLOR, 1);
    pointLight2.position.set(-120, 120, 90);
    this.scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(SHAPES_COLOR, 1.5);
    pointLight3.position.set(0, 120, -90);
    this.scene.add(pointLight3);

    this.camera = new THREE.PerspectiveCamera(
      Scene.FIELD_OF_VIEW,
      canvas.clientWidth / canvas.clientHeight,
      Scene.Z_NEAR,
      Scene.Z_FAR
    );
    this.cameraTarget = new THREE.Vector3(0, 150, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    const loader = new FontLoader();
    const font = loader.parse(fontData);
    this.textGeometry = new TextGeometry("FACTS", {
      font: font,

      size: 70,
      height: 20,
      curveSegments: 4,

      bevelEnabled: true,
      bevelThickness: 2,
      bevelSize: 1.5,
    });

    const materials = [
      new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
      new THREE.MeshPhongMaterial({ color: 0xffffff }), // side
    ];
    this.textMesh = new THREE.Mesh(this.textGeometry, materials);

    const textBoundingBox = new THREE.Box3().setFromObject(this.textMesh);
    const textSize = textBoundingBox.getSize(new THREE.Vector3());

    const centerOffset = -0.5 * textSize.x;

    this.textMesh.position.x = centerOffset;
    this.textMesh.position.y = 30 + 100;
    this.textMesh.position.z = 0;
    this.scene.add(this.textMesh);

    // Lightning Bolt
    this.lightningBolt = new THREE.Group();
    this.lightningBolt.scale.set(0.25, 0.25, 1);
    this.scene.add(this.lightningBolt);

    const path = svgPathToShapePath(LIGHTNING_SVG_PATH);
    const shapes = path.toShapes(true);
    shapes.forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 20,
        bevelEnabled: true,
      });

      const mesh = new THREE.Mesh(geometry, materials);
      this.lightningBolt.add(mesh);
    });

    const lightningBoundingBox = new THREE.Box3().setFromObject(
      this.lightningBolt
    );
    const lightningSize = lightningBoundingBox.getSize(new THREE.Vector3());

    this.lightningBolt.translateY(
      this.textMesh.getWorldPosition(new THREE.Vector3()).y +
        textSize.y / 2 -
        lightningSize.y / 2 +
        // Add the height because the lightning bolt will be rotated
        lightningSize.y
    );
    this.lightningBolt.translateX(-textSize.x / 2);
    this.lightningBolt.rotateZ(Math.PI);

    window.addEventListener("resize", this.onWindowResize);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.randomizeCamera();
    this.render(0);
  }

  randomizeCamera() {
    this.camera.position.x = THREE.MathUtils.randInt(-200, 200);
    this.camera.position.y = THREE.MathUtils.randInt(300, 500);
    this.camera.position.z = THREE.MathUtils.randInt(-1000, 1000);

    this.cameraVelocity.x = THREE.MathUtils.randFloat(0, 1);
    this.cameraVelocity.y = THREE.MathUtils.randFloat(0, 1);
    this.cameraVelocity.z = THREE.MathUtils.randFloat(0, 1);

    this.lastCameraChange = window.performance.now();
  }

  destroy() {
    this.destroyed = true;
    this.controls.dispose();
    window.removeEventListener("resize", this.onWindowResize);
  }

  onWindowResize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  render = (time: DOMHighResTimeStamp) => {
    const delta = time - this.lastRender;
    this.lastRender = time;

    this.camera.position.x += this.cameraVelocity.x * 0.1 * delta;
    this.camera.position.y += this.cameraVelocity.y * 0.1 * delta;
    this.camera.position.z += this.cameraVelocity.z * 0.1 * delta;

    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);

    if (time - this.lastCameraChange > Scene.CAMERA_CHANGE_INTERVAL_MS) {
      this.randomizeCamera();
    }

    if (this.destroyed) {
      return;
    }

    requestAnimationFrame(this.render);
  };
}
