async function loadConfig() {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    return await response.json();
}

let config; // Global variable to store the config

// Load the config when the background script starts
loadConfig().then(loadedConfig => {
    config = loadedConfig;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.requestConfig) {
        if (config) {
            sendResponse({ config: config });
        } else {
            // Optionally handle the case where config hasn't loaded yet
            sendResponse({ error: "Config not loaded yet." });
        }
        return; // Don't try to summarize
    }

    if (message.text) {
        summarizeText(message.text, config.GOOGLE_AI_API_KEY) // Use config.GOOGLE_AI_API_KEY
            .then(summary => {
                sendResponse(summary);
            })
            .catch(error => {
                console.error("Error in background script:", error);
                sendResponse({ error: "Failed to summarize." });
            });
        return true;
    }

});

async function summarizeText(text, apiKey) {
    try {
        const prompt = `Summarize the following text in 50-100 words, focusing on the key arguments and findings, in a style suitable for Hacker News readers (developers and tech enthusiasts).  Provide a concise, informative summary.\n\n${text}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt,
                    }],
                }],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            let errorMessage = `API Error: ${response.status}`;
            if (errorData.error && errorData.error.message) {
                errorMessage += ` - ${errorData.error.message}`;
            }
            return { error: errorMessage };
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            return { summary: data.candidates[0].content.parts[0].text };
        } else {
            return { error: "Unexpected response format from Gemini API." };
        }

    } catch (error) {
        console.error("Summarization Error:", error);
        return { error: "An unexpected error occurred." };
    }
}