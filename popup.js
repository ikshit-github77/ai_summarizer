// === BUTTON: Summarize ===
document.getElementById("summarize").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

  const summaryType = document.getElementById("summary-type").value;

  // 1) Get your saved API key
  chrome.storage.sync.get(["geminiApiKey"], async ({ geminiApiKey }) => {
    if (!geminiApiKey) {
      resultDiv.innerText =
        "API key not found. Open the extension Options and save your Gemini API key.";
      return;
    }

    // 2) Get the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab || !tab.id) {
        resultDiv.innerText = "No active tab found.";
        return;
      }

      // Some pages cannot be read (chrome://, Chrome Web Store, PDFs, etc.)
      const url = tab.url || "";
      const blocked =
        /^chrome:|^edge:|^about:|chromewebstore\.google\.com|^chrome-extension:/.test(
          url
        ) || /\.pdf($|\?)/i.test(url);
      if (blocked) {
        resultDiv.innerText =
          "This page type can’t be summarized. Please open a normal web article.";
        return;
      }

      // 3) Ask the content script for page text
      chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }, async (res) => {
        if (chrome.runtime.lastError) {
          // Content script didn’t respond (e.g., page blocked)
          resultDiv.innerText =
            "Could not extract article text from this page. Try another page.";
          return;
        }

        let text = (res && res.text ? res.text : "").trim();

        // 4) Fallback: if nothing extracted, try the user's highlighted text
        if (!text) {
          const sel = await new Promise((resolve) =>
            chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTED_TEXT" }, resolve)
          );
          if (sel && sel.text) text = sel.text.trim();
        }

        if (!text) {
          resultDiv.innerText =
            "Could not extract article text from this page. Tip: select the article text and click Summarize again.";
          return;
        }

        // 5) Call Gemini to summarize
        try {
          const summary = await getGeminiSummary(text, summaryType, geminiApiKey);
          resultDiv.innerText = summary;
        } catch (error) {
          resultDiv.innerText = `Error: ${
            error?.message || "Failed to generate summary."
          }`;
        }
      });
    });
  });
});

// === BUTTON: Copy ===
document.getElementById("copy-btn").addEventListener("click", () => {
  const summaryText = document.getElementById("result").innerText || "";
  if (!summaryText.trim()) return;

  navigator.clipboard
    .writeText(summaryText)
    .then(() => {
      const btn = document.getElementById("copy-btn");
      const original = btn.innerText;
      btn.innerText = "Copied!";
      setTimeout(() => (btn.innerText = original), 2000);
    })
    .catch(() => {});
});

// === GEMINI CALL ===
async function getGeminiSummary(text, summaryType, apiKey) {
  // Keep text size reasonable
  const maxLength = 20000;
  const truncated =
    text.length > maxLength ? text.slice(0, maxLength) + "..." : text;

  let prompt;
  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${truncated}`;
      break;
    case "detailed":
      prompt = `Provide a detailed summary of the following article, covering all main points and key details:\n\n${truncated}`;
      break;
    case "bullets":
      prompt = `Summarize the following article in 5-7 key points. Format each point as "- " (dash + space):\n\n${truncated}`;
      break;
    default:
      prompt = `Summarize the following article:\n\n${truncated}`;
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.error || "API request failed. Check your key.";
    throw new Error(msg);
  }

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No summary available."
  );
}
