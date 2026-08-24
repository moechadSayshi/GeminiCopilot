# Gemini Copilot VS Code Extension

An AI-powered inline code completion (ghost text) extension for Visual Studio Code, powered by Google Gemini 3.6 Flash.

## Features

- **Inline Code Completions**: Automatically provides ghost text suggestions as you type, matching GitHub Copilot.
- **Bring Your Own Key (BYOK)**: Prompts for and securely stores your own Gemini API key using VS Code's `SecretStorage` API (key is stored in your OS keychain/credential manager, not in settings).
- **Debounced Requests**: Avoids calling the Gemini API on every keystroke by debouncing requests by 400ms.
- **Active Cancellation Support**: Automatically cancels in-flight Gemini API requests if you keep typing before a network request completes, saving your token quota and bandwidth.
- **Status Bar Integration**: Visually indicates if the API key is active or needs to be set.
- **Custom Log Output**: Logs extension activity to a dedicated output channel (`Gemini Copilot`) for easy debugging.

## Setup Instructions

1. **Get a Gemini API Key**: Visit Google AI Studio to retrieve your API key.
2. **Configure Key in VS Code**:
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Run the command: `Gemini Copilot: Set Gemini API Key`.
   - Paste your API key and press `Enter`.
   - The status bar item at the bottom right should change to a checkmark: `✓ Gemini Copilot`.
3. **Remove Key**:
   - If you ever need to clear the key, run `Gemini Copilot: Remove Gemini API Key`.

## Development & Building

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run and Debug**:
   - Press `F5` in VS Code.
   - This starts the TypeScript compilation task (`npm run watch`) and opens a new **Extension Development Host** window.
   - Set your API key in the new window and start typing in any file to see ghost text suggestions.
3. **Packaging / Production Build**:
   To generate a minified, standalone production bundle using `esbuild`:
   ```bash
   npm run package
   ```
