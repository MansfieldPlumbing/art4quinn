# Offline Magic Eraser (Android APK Guide)

This application is built as an offline-first Progressive Web App (PWA) using React, Vite, and Transformers.js. 

To convert this project into a native Android `.apk` file that runs completely offline with a local LaMa (Large Mask Inpainting) model:

## 1. Export Project
Use the AI Studio settings menu to **Export to ZIP** or GitHub.

## 2. Obtain the ONNX Model
Download a quantized ONNX version of LaMa (e.g., `lama.onnx` or `lama_fp32.onnx`).
Place the `.onnx` file inside the `public/` directory of this project.

## 3. Install Capacitor (Android Wrapper)
Run the following commands in your local terminal:
```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init "Magic Eraser" "com.magic.eraser"
npx cap add android
```

## 4. Build the Web App
Build the optimized HTML/JS/CSS assets which include everything needed to run offline:
```bash
npm run build
```

## 5. Sync to Android and Build APK
Sync the built web files into the Android project wrapper:
```bash
npx cap sync android
```

Finally, open the project in Android Studio to build the `.apk` file:
```bash
npx cap open android
```
In Android Studio, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## How it works offline
- **Service Workers**: `vite-plugin-pwa` caches the UI and logic so it launches without an internet connection.
- **Transformers.js & ONNXRuntime Web**: The app is configured to use WebAssembly (`wasm`) or WebGPU to run the model inference strictly on-device, meaning no images are sent to any server.
