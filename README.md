# 🤖 Gemini Copilot

> A lightweight, high-performance Visual Studio Code extension that provides AI-powered inline code completions (ghost text) using Google Gemini 3.6 Flash.

---

## 🚀 Features

*   **🔒 Secure API Key Management (BYOK)**: Prompts for and securely stores your own Gemini API key using VS Code's `SecretStorage` API. The key is persisted in your operating system's native keychain (such as Windows Credential Manager or macOS Keychain), not in plain text files.
*   **⚡ Configurable Keystroke Debouncing**: Restricts API calls using a configurable delay (default `750ms`) to avoid calling the Gemini API on every single keystroke.
*   **🛑 In-Flight Request Cancellation**: Automatically detects when you resume typing while a network request is still active and aborts the Gemini API call immediately using an `AbortController`, saving network bandwidth and rate limit quota.
*   **🎯 Smart Code Continuation**: Uses system instructions to guide `gemini-3.6-flash` to output ONLY raw code continuation. It automatically post-processes the model response to strip unwanted markdown formatting, notes, or conversational text.
*   **⏳ Visual Rate Limit Cooldown**: Captures `HTTP 429` (Rate Limit Exceeded) errors, parses the suggested retry delay, and displays a real-time countdown timer in your status bar: `$(alert) Gemini Copilot (Rate Limited - 45s)`.

---

## 🛠️ Tech Stack

*   **TypeScript** - Primary development language.
*   **VS Code Extension API** - Integrates directly with editor inline suggestion APIs.
*   **Node.js https Module** - High-speed API queries using native network modules for maximum compatibility across different VS Code client versions.
*   **esbuild** - Lightning-fast bundling and minification.

---

## ⚙️ Getting Started

### Prerequisites

- **VS Code**: Version `1.75.0` or newer.
- **Node.js**: Version `18.x` or newer (we recommend using Node.js `20.x` or newer).
- **Gemini API Key**: Retrieve your own key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/gemini-copilot.git
    cd gemini-copilot
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run the Extension Locally**:
    - Open the cloned directory in VS Code.
    - Press **`F5`** (or go to **Run and Debug** > **Run Extension**). This compiles the TypeScript code in the background and opens a new **Extension Development Host** window.

### Environment Setup (Secure BYOK)

Instead of environment variables or `settings.json`, your API key is managed securely inside VS Code:
1.  Inside the new Extension Development Host window, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2.  Search and run the command: **`Gemini Copilot: Set Gemini API Key`**.
3.  Paste your Gemini API key and press `Enter`.
4.  The status bar in the bottom-right corner will update to show **`✓ Gemini Copilot`**.

---

## 💡 Usage Examples

### Inline Completion (Ghost Text)
1. Open any source code file (e.g., Python, JavaScript, TypeScript, Go).
2. Start typing a function definition or a logic block. For example:
    ```python
    def find_prime_numbers(limit):
    ```
3. Pause typing for `750ms` (or your configured debounce time).
4. The Gemini API returns the completion suggestion in grey ghost text:
    ```python
    def find_prime_numbers(limit):
        # Ghost text begins here:
        primes = []
        for num in range(2, limit + 1):
            if all(num % i != 0 for i in range(2, int(num ** 0.5) + 1)):
                primes.append(num)
        return primes
    ```
5. Press **`Tab`** to accept the suggestion, or keep typing to cancel.

### Custom Configuration
Adjust the extension behaviour by adding the following settings to your VS Code `settings.json` (or via the Settings UI):
```json
{
  "geminiCopilot.debounceDelay": 1000
}
```
*   `geminiCopilot.debounceDelay` (default `750`): The amount of time in milliseconds to wait after the last keystroke before sending the request. Increase this if you frequently hit free-tier rate limits.

---

## 🧪 Running Tests & Inspection

Since inline completions are asynchronous, you can trace the extension behavior and logs in real-time:
1.  Open the **Output** panel in the bottom of your VS Code workspace (`Ctrl+Shift+U` / `Cmd+Shift+U`).
2.  In the dropdown menu at the top-right of the Output panel, select **Gemini Copilot**.
3.  Here you will see live trace statements showing:
    - Live debounce timer start/stop events.
    - Active request aborts due to keystroke cancellation.
    - API request statuses, execution latencies, and suggestions.
    - Cool-down countdown progression when rate-limited.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have ideas for improvements, bug fixes, or new features.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
