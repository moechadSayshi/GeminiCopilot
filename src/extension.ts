import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';

// Output channel for logging and debugging
const outputChannel = vscode.window.createOutputChannel("Gemini Copilot");

function log(message: string) {
    outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function activate(context: vscode.ExtensionContext) {
    log("Gemini Copilot extension activated.");

    let cooldownUntil = 0;
    let cooldownTimer: NodeJS.Timeout | undefined;

    // Status bar item to display API Key status and quick configuration
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "geminiCopilot.setApiKey";
    context.subscriptions.push(statusBarItem);

    // Update status bar depending on API key configuration and cooldown
    async function updateStatusBar() {
        const apiKey = await context.secrets.get("geminiApiKey");
        const now = Date.now();
        if (now < cooldownUntil) {
            const secondsLeft = Math.ceil((cooldownUntil - now) / 1000);
            statusBarItem.text = `$(alert) Gemini Copilot (Rate Limited - ${secondsLeft}s)`;
            statusBarItem.tooltip = `API rate limit exceeded. Cooling down for ${secondsLeft} seconds. Click to configure API Key.`;
            statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        } else if (apiKey) {
            statusBarItem.text = "$(check) Gemini Copilot";
            statusBarItem.tooltip = "Gemini Copilot is active. Click to change Gemini API Key.";
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = "$(key) Gemini Copilot (Set API Key)";
            statusBarItem.tooltip = "Gemini API Key is not set. Click to configure.";
            statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        }
        statusBarItem.show();
    }

    function startCooldown(delaySeconds: number) {
        cooldownUntil = Date.now() + (delaySeconds * 1000);
        updateStatusBar();

        if (cooldownTimer) {
            clearInterval(cooldownTimer);
        }

        cooldownTimer = setInterval(() => {
            const now = Date.now();
            if (now >= cooldownUntil) {
                clearInterval(cooldownTimer!);
                cooldownTimer = undefined;
            }
            updateStatusBar();
        }, 1000);
    }

    // Register cleanup for the timer
    context.subscriptions.push({
        dispose: () => {
            if (cooldownTimer) {
                clearInterval(cooldownTimer);
            }
        }
    });

    // Call updateStatusBar immediately and watch for secrets change
    updateStatusBar();
    context.subscriptions.push(context.secrets.onDidChange(e => {
        if (e.key === "geminiApiKey") {
            updateStatusBar();
        }
    }));

    // Register Command: Set API Key
    const setApiKeyCommand = vscode.commands.registerCommand('geminiCopilot.setApiKey', async () => {
        const apiKey = await vscode.window.showInputBox({
            prompt: "Enter your Google Gemini API Key",
            password: true,
            placeHolder: "AIzaSy...",
            ignoreFocusOut: true
        });

        if (apiKey === undefined) {
            // User cancelled the prompt
            return;
        }

        if (!apiKey.trim()) {
            vscode.window.showErrorMessage("Gemini API Key cannot be empty.");
            return;
        }

        await context.secrets.store("geminiApiKey", apiKey.trim());
        vscode.window.showInformationMessage("Gemini API Key has been saved securely.");
    });
    context.subscriptions.push(setApiKeyCommand);

    // Register Command: Remove API Key
    const removeApiKeyCommand = vscode.commands.registerCommand('geminiCopilot.removeApiKey', async () => {
        await context.secrets.delete("geminiApiKey");
        vscode.window.showInformationMessage("Gemini API Key has been removed.");
    });
    context.subscriptions.push(removeApiKeyCommand);

    // Helper to implement debouncing delay using CancellationToken
    const delay = (ms: number, token: vscode.CancellationToken) => {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                disposable.dispose();
                resolve();
            }, ms);
            const disposable = token.onCancellationRequested(() => {
                clearTimeout(timer);
                reject(new vscode.CancellationError());
            });
        });
    };

    // Register Inline Completion Provider
    const provider: vscode.InlineCompletionItemProvider = {
        async provideInlineCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            contextInfo: vscode.InlineCompletionContext,
            token: vscode.CancellationToken
        ): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | undefined> {
            
            // Guard: Check rate limit cooldown
            const now = Date.now();
            if (now < cooldownUntil) {
                return undefined;
            }

            // Retrieve debouncing delay from configuration (default to 750ms)
            const config = vscode.workspace.getConfiguration("geminiCopilot");
            const debounceDelay = config.get<number>("debounceDelay", 750);

            // 1. Debouncing Safeguard (configurable delay)
            try {
                await delay(debounceDelay, token);
            } catch (err) {
                // Return immediately if user kept typing and cancelled this invocation
                return undefined;
            }

            // Guard: Check cancellation token again
            if (token.isCancellationRequested) {
                return undefined;
            }

            // Retrieve API key from secure storage
            const apiKey = await context.secrets.get("geminiApiKey");
            if (!apiKey) {
                log("Completions skipped: Gemini API Key is not configured. Run 'Gemini Copilot: Set Gemini API Key'.");
                return undefined;
            }

            // Extract context preceding the cursor (limit to last 10,000 characters for speed and token cost)
            const maxCharacters = 10000;
            const documentOffset = document.offsetAt(position);
            const startOffset = Math.max(0, documentOffset - maxCharacters);
            const textBefore = document.getText(new vscode.Range(
                document.positionAt(startOffset),
                position
            ));

            // Avoid triggering completion if preceding text is empty/whitespace
            if (!textBefore.trim()) {
                return undefined;
            }

            log(`Requesting completion for ${path.basename(document.fileName)} (${document.languageId})`);

            // Setup AbortController linked to CancellationToken
            const abortController = new AbortController();
            const cancelSubscription = token.onCancellationRequested(() => {
                log("Keystroke cancellation triggered. Aborting active Gemini API request.");
                abortController.abort();
            });

            try {
                const responseText = await fetchGeminiCompletion(apiKey, textBefore, document.languageId, abortController.signal);
                
                if (token.isCancellationRequested) {
                    return undefined;
                }

                if (responseText && responseText.trim()) {
                    log(`Success: Received suggestion of length ${responseText.length}`);
                    
                    // Create inline completion item starting at the current cursor position
                    const completionItem = new vscode.InlineCompletionItem(
                        responseText,
                        new vscode.Range(position, position)
                    );
                    
                    return [completionItem];
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    log("Gemini API call successfully aborted due to cancellation.");
                } else {
                    log(`Gemini API Request failed: ${error.message || error}`);
                    
                    // Detect HTTP 429 Rate Limiting
                    if (error.message && error.message.includes("HTTP 429")) {
                        let delaySeconds = 60;
                        try {
                            const errorJsonStr = error.message.substring(error.message.indexOf('{'));
                            const errorObj = JSON.parse(errorJsonStr);
                            const retryDelayStr = errorObj?.error?.details?.find(
                                (d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
                            )?.retryDelay;
                            if (retryDelayStr) {
                                delaySeconds = parseInt(retryDelayStr.replace('s', ''), 10);
                            }
                        } catch (e) {
                            // Ignore JSON parsing errors
                        }
                        log(`Rate limit reached. Entering cooldown for ${delaySeconds} seconds.`);
                        startCooldown(delaySeconds);
                    }
                }
            } finally {
                cancelSubscription.dispose();
            }

            return undefined;
        }
    };

    const providerRegistration = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        provider
    );
    context.subscriptions.push(providerRegistration);
}

export function deactivate() {
    log("Gemini Copilot extension deactivated.");
}

/**
 * Invokes the Gemini API using the global fetch API.
 * Uses gemini-3.6-flash for high-speed completions.
 */
async function fetchGeminiCompletion(
    apiKey: string,
    textBefore: string,
    languageId: string,
    signal: AbortSignal
): Promise<string | undefined> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const systemInstruction = 
        `You are an AI code completion assistant similar to GitHub Copilot.\n` +
        `Your task is to provide the inline code completion (ghost text) that should follow the user's current code context.\n` +
        `The programming language of the file is: "${languageId}".\n\n` +
        `Strict Rules:\n` +
        `1. Return ONLY the raw code continuation. Do NOT wrap code in markdown code blocks (such as \`\`\`${languageId} ... \`\`\`).\n` +
        `2. Do NOT add any explanations, introductory text, greetings, comments, or conversational notes.\n` +
        `3. Do NOT repeat any of the existing code context provided. Return ONLY the code characters that should follow immediately after the user's cursor position.\n` +
        `4. If no completion is appropriate or needed, return an empty string.`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: textBefore
                    }
                ]
            }
        ],
        systemInstruction: {
            parts: [
                {
                    text: systemInstruction
                }
            ]
        },
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256
        }
    };

    const bodyString = JSON.stringify(requestBody);

    const responseText = await new Promise<string>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options: https.RequestOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyString)
            },
            signal: signal
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(bodyString);
        req.end();
    });

    const data: any = JSON.parse(responseText);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        return undefined;
    }

    // Defensive parsing: Clean up markdown code blocks if the model overrides system instructions
    if (text.startsWith("```")) {
        const lines = text.split('\n');
        if (lines[0].startsWith("```")) {
            lines.shift(); // Remove starting ```
        }
        if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) {
            lines.pop(); // Remove ending ```
        }
        text = lines.join('\n');
    }

    return text;
}
