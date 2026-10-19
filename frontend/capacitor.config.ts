import type { CapacitorConfig } from "@capacitor/cli";

/* Configuración de la app de Android (Capacitor).
   La app web se compila con "npm run build:app" (a dist-app, sin service worker)
   y "npx cap sync android" la copia adentro del proyecto Android.
   El identificador de la app (appId) no se puede cambiar sin reinstalar. */
const config: CapacitorConfig = {
  appId: "com.palacios.vitra",
  appName: "Vitra",
  webDir: "dist-app",
};

export default config;
