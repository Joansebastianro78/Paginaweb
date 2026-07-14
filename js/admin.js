// js/admin.js
import { auth, googleProvider, db, storage } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const deniedView = document.getElementById("denied-view");
const loginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deniedLogoutBtn = document.getElementById("denied-logout-btn");
const adminEmailEl = document.getElementById("admin-email");
const saveStatusEl = document.getElementById("save-status");
const form = document.getElementById("content-form");

const CONTENT_DOC = doc(db, "siteContent", "home");

/* ---------------------------------------------------------------------
   Autenticación: Google Sign-In + verificación de rol en Firestore
   Un usuario es admin si existe el documento admins/{uid} con role:"admin"
   (exactamente como está configurado hoy en tu colección "admins").
   --------------------------------------------------------------------- */
function showView(view) {
  [loginView, dashboardView, deniedView].forEach((v) => v.classList.add("hidden"));
  view.classList.remove("hidden");
}

loginBtn?.addEventListener("click", async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = "Conectando...";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    alert("No se pudo iniciar sesión: " + err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Continuar con Google";
  }
});

logoutBtn?.addEventListener("click", () => signOut(auth));
deniedLogoutBtn?.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showView(loginView);
    return;
  }

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    const isAdmin = adminSnap.exists() && adminSnap.data().role === "admin";

    if (!isAdmin) {
      showView(deniedView);
      return;
    }

    adminEmailEl.textContent = user.email;
    showView(dashboardView);
    await loadContentIntoForm();
  } catch (err) {
    console.error(err);
    showView(deniedView);
  }
});

/* ---------------------------------------------------------------------
   Cargar contenido actual en el formulario
   --------------------------------------------------------------------- */
async function loadContentIntoForm() {
  const snap = await getDoc(CONTENT_DOC);
  if (!snap.exists()) return;
  const data = snap.data();

  form.querySelectorAll("[data-field]").forEach((input) => {
    const key = input.getAttribute("data-field");
    if (data[key] !== undefined) input.value = data[key];
  });

  document.querySelectorAll("[data-preview]").forEach((img) => {
    const key = img.getAttribute("data-preview");
    if (data[key]) img.src = data[key];
  });
}

/* ---------------------------------------------------------------------
   Subida de imágenes a Firebase Storage
   Ruta: media/{seccion}-{timestamp}-{nombreArchivo}
   --------------------------------------------------------------------- */
async function uploadImageIfSelected(fileInput, fieldKey) {
  const file = fileInput.files?.[0];
  if (!file) return null;

  const path = `media/${fieldKey}-${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/* ---------------------------------------------------------------------
   Guardar cambios (textos + imágenes) en Firestore
   --------------------------------------------------------------------- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Guardando...";
  saveStatusEl.textContent = "";

  try {
    const payload = { updatedAt: serverTimestamp() };

    form.querySelectorAll("[data-field]").forEach((input) => {
      payload[input.getAttribute("data-field")] = input.value.trim();
    });

    const imageInputs = form.querySelectorAll("[data-image-field]");
    for (const input of imageInputs) {
      const fieldKey = input.getAttribute("data-image-field");
      const url = await uploadImageIfSelected(input, fieldKey);
      if (url) {
        payload[fieldKey] = url;
        const preview = document.querySelector(`[data-preview="${fieldKey}"]`);
        if (preview) preview.src = url;
        input.value = "";
      }
    }

    await setDoc(CONTENT_DOC, payload, { merge: true });

    saveStatusEl.textContent = "Cambios publicados en el sitio.";
    saveStatusEl.className = "hud-label text-[13px] !text-emerald-400";
  } catch (err) {
    console.error(err);
    saveStatusEl.textContent = "Error al guardar: " + err.message;
    saveStatusEl.className = "hud-label text-[13px] !text-red-400";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar y publicar";
  }
});
