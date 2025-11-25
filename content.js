// content.js  (replace file)
function longestBlockText(roots) {
  let best = "";
  for (const el of roots) {
    if (!el) continue;
    const txt = Array.from(el.querySelectorAll("p, h1, h2, h3, li"))
      .map(n => n.innerText.trim())
      .filter(Boolean)
      .join("\n");
    if (txt.length > best.length) best = txt;
  }
  return best.trim();
}

function getArticleText() {
  // 1) Direct <article>
  const article = document.querySelector("article");
  if (article?.innerText?.trim()?.length > 200) return article.innerText.trim();

  // 2) Common “main” containers
  const selectors = [
    "main", '[role=main]',
    'div[id*="content"]', 'div[class*="content"]',
    'div[class*="article"]', 'section[id*="article"]', 'section[class*="article"]'
  ];
  const mainCandidates = document.querySelectorAll(selectors.join(","));
  const mainTxt = longestBlockText(mainCandidates);
  if (mainTxt.length > 200) return mainTxt;

  // 3) Generic: pick the parent with the most paragraph text
  const paraParents = Array.from(document.querySelectorAll("p"))
    .map(p => p.closest("section,article,main,div"))
    .filter(Boolean);
  const genericTxt = longestBlockText(paraParents);
  if (genericTxt.length > 200) return genericTxt;

  // 4) Last resort: body text
  const bodyTxt = document.body?.innerText?.trim() || "";
  return bodyTxt.length > 150 ? bodyTxt : "";
}

function getSelectedText() {
  const sel = window.getSelection();
  const t = sel ? sel.toString().trim() : "";
  return t && t.length > 50 ? t : "";
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  try {
    if (req.type === "GET_ARTICLE_TEXT") {
      const text = getArticleText();
      sendResponse({ text });
      return;
    }
    if (req.type === "GET_SELECTED_TEXT") {
      const text = getSelectedText();
      sendResponse({ text });
      return;
    }
  } catch (e) {
    sendResponse({ text: "" });
  }
});
