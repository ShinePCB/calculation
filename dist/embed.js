/* Optional host-page integration. GPL-3.0-or-later. */
if (window.parent !== window && new URLSearchParams(location.search).get("embed") === "1") {
  document.documentElement.dataset.embedded = "true";
  document.documentElement.dataset.theme = "light";
  let hostOrigin;
  let lastHeight = 0;
  let pending = false;

  function allowedHost(origin) {
    if (origin === "https://shinepcba.com" || origin === "https://www.shinepcba.com") return true;
    try {
      const url = new URL(origin);
      return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    } catch { return false; }
  }

  function reportSize() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!hostOrigin) return;
      const shell = document.querySelector(".shell");
      if (!shell) return;
      // Measure natural content, not scrollHeight, which includes the iframe's
      // current viewport and would prevent the frame from shrinking again.
      const openMenu = document.querySelector(".sidenav.is-open");
      const height = Math.max(240, Math.ceil(shell.getBoundingClientRect().height), Math.ceil(openMenu?.getBoundingClientRect().bottom ?? 0));
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: "shinepcb:calculator:resize", height }, hostOrigin);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !allowedHost(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "shinepcb:calculator:init") return;
    if (!Number.isFinite(data.viewportHeight) || data.viewportHeight < 240 || data.viewportHeight > 8000) return;
    if (!Number.isFinite(data.visibleTop) || data.visibleTop < 0 || data.visibleTop > 30000) return;
    if (!Number.isFinite(data.visibleHeight) || data.visibleHeight < 160 || data.visibleHeight > 8000) return;
    hostOrigin = event.origin;
    document.documentElement.style.setProperty("--embed-viewport-height", `${data.viewportHeight}px`);
    document.documentElement.style.setProperty("--embed-visible-top", `${data.visibleTop}px`);
    document.documentElement.style.setProperty("--embed-visible-height", `${data.visibleHeight}px`);
    reportSize();
  });

  const shell = document.querySelector(".shell");
  if (shell) new ResizeObserver(reportSize).observe(shell);
  const navigation = document.querySelector(".sidenav");
  if (navigation) {
    new ResizeObserver(reportSize).observe(navigation);
    new MutationObserver(reportSize).observe(navigation, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("load", reportSize);
  document.fonts.ready.then(reportSize);
  window.addEventListener("hashchange", () => {
    if (hostOrigin) window.parent.postMessage({ type: "shinepcb:calculator:navigate" }, hostOrigin);
    reportSize();
  });
}
