<!-- SOLO TE PONGO LA PARTE CORREGIDA DEL SCRIPT (lo demás déjalo igual) -->

<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBXh-P0oMtMiDjyz9PObuJ8DNfROlXvhLE",
  authDomain: "tecnocontrol-1c42f.firebaseapp.com",
  projectId: "tecnocontrol-1c42f"
});

const auth = getAuth(app);


// 🔥 LOGIN CORREGIDO
window.doLogin = async () => {
  const email = document.getElementById('le').value.trim();
  const password = document.getElementById('lp').value;
  const errorBox = document.getElementById('lerr');

  errorBox.textContent = '';

  if (!email || !password) {
    errorBox.textContent = "Ingresa correo y contraseña";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);

    if (err.code === 'auth/invalid-credential') {
      errorBox.textContent = "Correo o contraseña incorrectos";
    } else if (err.code === 'auth/user-not-found') {
      errorBox.textContent = "Usuario no registrado";
    } else {
      errorBox.textContent = "Error al iniciar sesión";
    }
  }
};


// 🔥 LOGOUT
window.doLogout = () => {
  signOut(auth);
};


// 🔥 CONTROL DE SESIÓN
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }
});
</script>
