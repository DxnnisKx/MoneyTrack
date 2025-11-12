const supabase = window.supabase.createClient(
  "https://siatsmslhjzqttdxfshe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0"
);

window.addEventListener("DOMContentLoaded", async function () {
  const session = await supabase.auth.getSession();

  if (session.data.session) {
    window.location.href = "index.html";
  }

  const googleBtn = document.querySelector("#googleBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleLogin);
  }
});

async function handleGoogleLogin() {
  const btn = document.querySelector("#googleBtn");
  const errorMsg = document.querySelector("#errorMsg");

  btn.innerHTML = "Lädt...";
  btn.disabled = true;

  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href.replace("auth.html", "index.html"),
      },
    });

    if (result.error) {
      errorMsg.textContent = result.error.message;
      errorMsg.classList.remove("d-none");

      btn.innerHTML =
        '<img src="google-icon.png" width="20" height="20" class="me-2"> Mit Google anmelden';
      btn.disabled = false;
    }
  } catch (error) {
    errorMsg.textContent = "Ein Fehler ist aufgetreten";
    errorMsg.classList.remove("d-none");

    btn.innerHTML =
      '<img src="google-icon.png" width="20" height="20" class="me-2"> Mit Google anmelden';
    btn.disabled = false;
  }
}
