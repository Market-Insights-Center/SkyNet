# SkyNet Desktop App (Electron)

This folder (`electron/`) enables SkyNet to run as a **Native Desktop Application**. This unlocks "Full Capabilities" (Global Mouse/Keyboard Control) without needing to run separate Python scripts.

## Prerequisite: Update Frontend
Before building the app, make sure your Frontend on the VPS is updated with the latest changes (which hide the SkyNet button for web users).

```bash
# On your VPS / Development Machine
git pull
npm run build
```

## How to Build the App (Windows)

1.  **Install App Dependencies**:
    Navigate to the `electron` folder and install the native libraries.
    ```powershell
    cd electron
    npm install
    ```
    *Note: If you see errors about `robotjs` or `node-gyp`, you may need Windows Build Tools. Try running this as Admin if the above fails:*
    `npm install --global --production windows-build-tools`

2.  **Test Run (Optional)**:
    You can run the app without building an .exe to test it.
    ```powershell
    npm start
    ```
    *This should open a window loading "marketinsightscenter.com". Raise your hand to test the cursor.*

3.  **Build the EXE**:
    Generate the installable `.exe` file.
    ```powershell
    npm run build
    ```
    *The output (setup file) will be in the `dist` folder inside `electron/`.*

## Troubleshooting
- **Webcam Access**: The first time you run the app, it may ask for Camera permissions. Allow it.
- **Mouse Not Moving?**: Ensure the app is running as Administrator if you are trying to control Admin windows (like Task Manager).
- **"Initialize System" Button Missing?**: The button only appears if the website detects it is running inside the SkyNet App. If you open Chrome, it will say "Desktop App Required".
