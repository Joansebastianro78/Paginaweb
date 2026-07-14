// js/main.js
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ==========================================================================
   1. HERO — red de telemetría 3D (Three.js)
   Un campo de nodos conectados que reacciona al cursor: representa
   visualmente "flujos de datos" sin recurrir a un modelo 3D importado.
   ========================================================================== */
function initHero() {
  const container = document.getElementById("hero-canvas");
  if (!container || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 26;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // --- Nodos ---
  const NODE_COUNT = window.innerWidth < 768 ? 70 : 150;
  const RADIUS = 15;
  const positions = new Float32Array(NODE_COUNT * 3);
  const velocities = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    const r = RADIUS * (0.4 + Math.random() * 0.6);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01
      )
    );
  }

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const nodeMaterial = new THREE.PointsMaterial({
    color: 0x4f7cff,
    size: 0.22,
    transparent: true,
    opacity: 0.9,
  });
  const points = new THREE.Points(nodeGeometry, nodeMaterial);
  scene.add(points);

  // --- Conexiones dinámicas entre nodos cercanos ---
  const MAX_CONNECTIONS = 400;
  const linePositions = new Float32Array(MAX_CONNECTIONS * 2 * 3);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x2a3550,
    transparent: true,
    opacity: 0.45,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  const CONNECT_DIST = 6.5;

  function updateConnections() {
    let vertexIndex = 0;
    const posAttr = nodeGeometry.attributes.position.array;
    for (let i = 0; i < NODE_COUNT && vertexIndex < MAX_CONNECTIONS; i++) {
      for (let j = i + 1; j < NODE_COUNT && vertexIndex < MAX_CONNECTIONS; j++) {
        const dx = posAttr[i * 3] - posAttr[j * 3];
        const dy = posAttr[i * 3 + 1] - posAttr[j * 3 + 1];
        const dz = posAttr[i * 3 + 2] - posAttr[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < CONNECT_DIST) {
          linePositions[vertexIndex * 3] = posAttr[i * 3];
          linePositions[vertexIndex * 3 + 1] = posAttr[i * 3 + 1];
          linePositions[vertexIndex * 3 + 2] = posAttr[i * 3 + 2];
          vertexIndex++;
          linePositions[vertexIndex * 3] = posAttr[j * 3];
          linePositions[vertexIndex * 3 + 1] = posAttr[j * 3 + 1];
          linePositions[vertexIndex * 3 + 2] = posAttr[j * 3 + 2];
          vertexIndex++;
        }
      }
    }
    lineGeometry.setDrawRange(0, vertexIndex);
    lineGeometry.attributes.position.needsUpdate = true;
  }

  // --- Interacción con el mouse (paralaje de cámara) ---
  const mouse = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    const posAttr = nodeGeometry.attributes.position.array;
    for (let i = 0; i < NODE_COUNT; i++) {
      posAttr[i * 3] += velocities[i].x;
      posAttr[i * 3 + 1] += velocities[i].y;
      posAttr[i * 3 + 2] += velocities[i].z;
      const r = Math.sqrt(
        posAttr[i * 3] ** 2 + posAttr[i * 3 + 1] ** 2 + posAttr[i * 3 + 2] ** 2
      );
      if (r > RADIUS || r < RADIUS * 0.35) {
        velocities[i].multiplyScalar(-1);
      }
    }
    nodeGeometry.attributes.position.needsUpdate = true;

    if (Math.floor(t * 30) % 3 === 0) updateConnections();

    points.rotation.y = t * 0.03;
    lines.rotation.y = t * 0.03;

    camera.position.x += (mouse.x * 4 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.y * 3 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }
  animate();
}

/* ==========================================================================
   2. HUD — lecturas de telemetría ambientales (refuerzan el tema de datos)
   ========================================================================== */
function initTelemetry() {
  const latencyEl = document.getElementById("hud-latency");
  const nodesEl = document.getElementById("hud-nodes");
  const nodesElMobile = document.getElementById("hud-nodes-m");
  if (!nodesEl && !nodesElMobile) return;
  setInterval(() => {
    const nodes = `${120 + Math.floor(Math.random() * 14)}`;
    if (latencyEl) latencyEl.textContent = `${(8 + Math.random() * 9).toFixed(1)}ms`;
    if (nodesEl) nodesEl.textContent = nodes;
    if (nodesElMobile) nodesElMobile.textContent = nodes;
  }, 1800);
}

/* ==========================================================================
   3. Scroll reveal
   ========================================================================== */
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((item) => observer.observe(item));
}

/* ==========================================================================
   4. Contenido dinámico desde Firestore (editable sin tocar código)
   Documento: siteContent/home
   ========================================================================== */
async function hydrateContent() {
  try {
    const snap = await getDoc(doc(db, "siteContent", "home"));
    if (!snap.exists()) return;
    const data = snap.data();

    document.querySelectorAll("[data-content-key]").forEach((el) => {
      const key = el.getAttribute("data-content-key");
      if (data[key] !== undefined && data[key] !== "") {
        el.textContent = data[key];
      }
    });

    document.querySelectorAll("[data-content-image]").forEach((el) => {
      const key = el.getAttribute("data-content-image");
      if (data[key]) {
        el.style.backgroundImage = `url("${data[key]}")`;
      }
    });

    // Nombre del sitio: además de rellenar los [data-content-key="siteName"],
    // actualiza el <title> de la pestaña.
    if (data.siteName) {
      document.title = data.siteName;
    }

    // Favicon: es un <link rel="icon">, no un elemento con background, así
    // que se maneja aparte.
    if (data.faviconUrl) {
      let iconLink = document.querySelector("link[rel~='icon']");
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = data.faviconUrl;
    }
  } catch (err) {
    // Si Firestore no responde, el sitio se queda con el contenido por defecto del HTML.
    console.warn("No se pudo cargar contenido dinámico:", err.message);
  }
}

/* ==========================================================================
   5. Formulario de contacto (EmailJS)
   Configura tu propio Service ID / Template ID / Public Key en EmailJS
   (ver README.md). No requiere backend propio.
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const EMAILJS_SERVICE_ID = "service_l9tixob";
  const EMAILJS_TEMPLATE_ID = "template_frhjc48";
  const EMAILJS_PUBLIC_KEY = "Z6vLRPyY5acB0iee5";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button[type='submit']");
    const statusEl = document.getElementById("contact-status");
    const originalLabel = button.textContent;

    button.disabled = true;
    button.textContent = "Enviando...";
    statusEl.textContent = "";
    document.getElementById("contact-technical-detail")?.remove();

    try {
      if (typeof emailjs === "undefined") {
        // Motivo más común: un bloqueador de rastreadores (Brave Shields, uBlock Origin,
        // AdGuard...) impidió cargar el script de EmailJS porque su nombre de archivo
        // ("email.min.js") coincide con patrones de listas de bloqueo de marketing.
        throw new Error("SDK_BLOCKED");
      }
      await emailjs.sendForm(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        form,
        EMAILJS_PUBLIC_KEY
      );
      statusEl.textContent = "Mensaje enviado. Te responderemos pronto.";
      statusEl.className = "hud-label mt-4 text-[13px] !text-emerald-400";
      form.reset();
    } catch (err) {
      console.error("Error al enviar el formulario de contacto:", err);

      let reason =
        "No se pudo enviar el mensaje. Escríbenos directamente a sebastian.lukas78@gmail.com.";

      if (err.message === "SDK_BLOCKED") {
        reason =
          "Tu navegador bloqueó el sistema de envío (probablemente un bloqueador de anuncios/rastreadores). Desactívalo para este sitio, o escríbenos directo a sebastian.lukas78@gmail.com.";
      } else if (err?.status === 0 || err?.text?.includes("Failed to fetch")) {
        reason =
          "No hay conexión con el servidor de correo (revisa tu conexión o un bloqueador activo). Escríbenos a sebastian.lukas78@gmail.com.";
      } else if (err?.status === 400 || err?.status === 422) {
        reason =
          "Hay un error de configuración en el formulario. Por favor escríbenos a sebastian.lukas78@gmail.com mientras lo resolvemos.";
      }

      statusEl.textContent = reason;
      statusEl.className = "hud-label mt-4 text-[13px] !text-red-400";

      if (err?.text) {
        const detail = document.createElement("p");
        detail.id = "contact-technical-detail";
        detail.className = "hud-label mt-2 text-[11px] !text-red-400/60";
        detail.textContent = `Detalle técnico (envíamelo si necesitas ayuda): ${err.status} — ${err.text}`;
        statusEl.after(detail);
      }
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
}

/* ==========================================================================
   Init
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initHero();
  initTelemetry();
  initScrollReveal();
  hydrateContent();
  initContactForm();

  const year = document.getElementById("current-year");
  if (year) year.textContent = new Date().getFullYear();
});
