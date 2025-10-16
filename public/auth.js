const supabase = window.supabase.createClient(
  "https://siatsmslhjzqttdxfshe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0"
);

window.addEventListener("DOMContentLoaded", async function () {
  console.log("Anmeldeseite geladen");

  const session = await supabase.auth.getSession();

  if (session.data.session) {
    console.log("Benutzer bereits angemeldet");
    window.location.href = "index.html";
  }

  const googleBtn = document.querySelector("#googleBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleLogin);
  }
});

async function handleGoogleLogin() {
  console.log("Google Anmeldung gestartet");

  const btn = document.querySelector("#googleBtn");
  const errorMsg = document.querySelector("#errorMsg");

  btn.textContent = "Lädt...";
  btn.disabled = true;

  try {
    let redirectUrl = window.location.href.replace("auth.html", "index.html");

    console.log("Weiterleitung zu:", redirectUrl);

    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (result.error) {
      console.error("Anmeldefehler:", result.error);
      errorMsg.textContent = result.error.message;
      errorMsg.classList.remove("d-none");

      btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" class="me-2 google-logo">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Mit Google anmelden
            `;
      btn.disabled = false;
    }
  } catch (error) {
    console.error("Unerwarteter Fehler:", error);
    errorMsg.textContent = "Ein Fehler ist aufgetreten";
    errorMsg.classList.remove("d-none");
    btn.textContent = "Mit Google anmelden";
    btn.disabled = false;
  }
}
