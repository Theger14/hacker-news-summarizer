async function fetchAndExtractText(url) {
    // Proxy URL will be sent from background.js
    try {
        const response = await fetch(url); // No proxy here yet
        if (!response.ok) {
            console.error("Proxy Fetch Error:", response.status);
            try {
                const errorText = await response.text();
                console.error("Proxy Error Response Body:", errorText);
            } catch (e) {
                console.error("Error reading proxy response body:", e);
            }
            return null;
        }
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let mainContent = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('.article-content') || doc.querySelector('#content');
        let textContent = "";

        if (mainContent) {
            textContent = mainContent.textContent;
        } else {
            const paragraphs = doc.querySelectorAll('p');
            paragraphs.forEach(p => {
                textContent += p.textContent + " ";
            });
        }

        const maxLength = 8000; // Adjust as needed
        textContent = textContent.substring(0, maxLength);
        return textContent;

    } catch (error) {
        console.error("Fetch and Extract Error:", error);
        return null;
    }
}

function addSummaryElement(linkElement, summary) {
    const summaryElement = document.createElement('div');
    summaryElement.style.fontSize = '0.8em';
    summaryElement.style.color = '#888';
    summaryElement.style.marginTop = '5px';
    summaryElement.style.marginLeft = '20px';

    if (summary.error) {
        summaryElement.textContent = `Summary unavailable: ${summary.error}`;
    } else {
        const textNode = document.createTextNode(summary.summary);
        summaryElement.appendChild(textNode);
    }

    linkElement.parentNode.insertBefore(summaryElement, linkElement.nextSibling);
}

async function processBatch(linkElements, startIndex, batchSize, proxyUrl) { // Add proxyUrl parameter
    for (let i = startIndex; i < Math.min(startIndex + batchSize, linkElements.length); i++) {
        const linkElement = linkElements[i];
        const url = linkElement.href;

        if (url.startsWith('http') && !url.startsWith('https://news.ycombinator.com/item')) {
            if (linkElement.dataset.processed === 'true') {
                continue;
            }
            linkElement.dataset.processed = 'true';

            const proxiedUrl = proxyUrl + encodeURIComponent(url); // Construct proxied URL here
            const text = await fetchAndExtractText(proxiedUrl); // Pass proxied URL
            if (text) {
                chrome.runtime.sendMessage({ text: text }, (response) => {
                    if (response) {
                        addSummaryElement(linkElement, response);
                    } else {
                        addSummaryElement(linkElement, { error: 'No response from background script.' });
                    }
                });
            } else {
                addSummaryElement(linkElement, { error: 'Failed to fetch or extract content.' });
            }
        }
    }
}

async function processHackerNewsLinks() {
    const linkElements = document.querySelectorAll('.titleline > a');
    const batchSize = 15;
    const pauseDuration = 60000; // in milliseconds

    // Request config from background script
    chrome.runtime.sendMessage({ requestConfig: true }, async (response) => {
        if (response && response.config) {
            const proxyUrl = response.config.CORS_PROXY_URL;
            let startIndex = 0;
            while (startIndex < linkElements.length) {
                await processBatch(linkElements, startIndex, batchSize, proxyUrl); // Pass proxy URL
                startIndex += batchSize;
                if (startIndex < linkElements.length) {
                    await new Promise(resolve => setTimeout(resolve, pauseDuration));
                }
            }
        } else {
            console.error("Failed to get config from background script.");
            // Handle the case where config is not available (e.g., display an error message)
        }

    });
}
processHackerNewsLinks();