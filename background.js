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
      sendResponse({ error: "Config not loaded yet." });
    }
    return; // Don't try to summarize
  }

  if (message.text) {
    if (!config) {
      sendResponse({ error: "Configuration not loaded. Cannot summarize." });
      return true;
    }
    summarizeText(message.text, config) // Pass the entire config object
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

async function summarizeText(text, config) {
  const { API_ENDPOINT_URL, API_KEY, MODEL_NAME, SYSTEM_PROMPT } = config;

  try {
    const response = await fetch(API_ENDPOINT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.5,
        max_tokens: 150
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error:", errorData);
      let errorMessage = `API Error: ${response.status}`;
      if (errorData.error && errorData.error.message) {
        errorMessage += ` - ${errorData.error.message}`;
      }
      return { error: errorMessage };
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      return { summary: data.choices[0].message.content.trim() };
    } else {
      // Log the problematic response for easier debugging
      console.error("Unexpected response format from API:", data);
      return { error: "Unexpected response format from API." };
    }

  } catch (error) {
    console.error("Summarization Fetch Error:", error);
    return { error: "An unexpected network error occurred." };
  }
}
