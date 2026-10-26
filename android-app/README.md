# Segundo Cerebro - Native Android App (Kotlin + Jetpack Compose)

Esta es la aplicación nativa en Android para **Segundo Cerebro** (`app.kubbonet.com`), conectada directamente a la instancia de backend de **InsForge** (`https://insforge.kora.ovh`).

## 📁 Arquitectura del Proyecto

```
android-app/
├── app/
│   ├── build.gradle.kts                      # Dependencias: Ktor, Compose, Serialization, Security-Crypto
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/com/kubbonet/segundocerebro/
│           ├── SegundoCerebroApp.kt           # Inicialización de Ktor y TokenManager
│           ├── MainActivity.kt                # Scaffold raíz y NavHost Jetpack Compose
│           ├── data/
│           │   ├── local/
│           │   │   └── TokenManager.kt        # Almacenamiento seguro de JWT con EncryptedSharedPreferences (AES-256)
│           │   ├── model/
│           │   │   ├── Models.kt              # AppNotebook, AppNote, AppTask, AppProject, AppArea, AppHabit, AppObject, etc.
│           │   │   └── AuthModels.kt          # AuthUser, AuthSession, SignInRequest, SignUpRequest
│           │   └── remote/
│           │       ├── InsForgeApiConfig.kt   # Base URL, Anon Key y configuración del cliente HTTP Ktor
│           │       └── InsForgeApiService.kt  # Endpoints de Auth (/auth/v1) y PostgREST (/rest/v1)
│           ├── ui/
│           │   ├── theme/
│           │   │   └── Theme.kt               # Paleta de color oscura (#13131A, #191924, #3B82F6) idéntica a la web
│           │   ├── components/
│           │   │   ├── AppBottomBar.kt        # Barra inferior de 5 puntos táctiles (+ central)
│           │   │   ├── QuickCreateBottomSheet.kt # Menú modal para crear Nota, Tarea, Voz, etc.
│           │   │   └── AuthDialog.kt          # Diálogo nativo de inicio de sesión / registro
│           │   └── screens/
│           │       ├── HomeScreen.kt          # Dashboard principal con captura rápida y hábitos
│           │       ├── TasksScreen.kt         # Tablero Kanban horizontal interactivo
│           │       ├── NotebooksScreen.kt     # Rejilla de Cuadernos
│           │       └── MoreDrawerScreen.kt    # Menú extendido (Proyectos, Áreas, Archivo, CRM)
│           └── viewmodel/
│               └── MainViewModel.kt           # StateFlows reactivos, corrutinas y mutaciones en tiempo real
├── build.gradle.kts
└── settings.gradle.kts
```

## 🔐 Seguridad y Autenticación
- **JWT Storage:** El token de acceso y refresh token se cifran en reposo con hardware Keystore mediante `androidx.security.crypto.EncryptedSharedPreferences`.
- **Interceptors:** Cada petición HTTP inyecta automáticamente el header `apikey` y el header `Authorization: Bearer <jwt>`.
- **Normalización de usuario:** Soporta tanto emails como usuarios simples (`admin` $\to$ `admin@segundocerebro.local`).

## 🚀 Cómo compilar y ejecutar
1. Abre la carpeta `android-app` en **Android Studio Hedgehog / Iguana / Jellyfish**.
2. Sincroniza Gradle (`Sync Project with Gradle Files`).
3. Ejecuta en tu dispositivo o emulador Android (API 26+).
