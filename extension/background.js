// Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cast_to_lg_tv",
    title: "Cast link / page to LG TV 📺",
    contexts: ["page", "link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "cast_to_lg_tv") {
    const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
    if (!targetUrl) return;

    try {
      const res = await fetch("http://localhost:8765/api/browser/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl })
      });
      if (res.ok) {
        await chrome.action.setBadgeText({ text: "✓" });
        await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
        setTimeout(async () => {
          await chrome.action.setBadgeText({ text: "" });
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to cast to LG TV:", err);
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }
  }
});
