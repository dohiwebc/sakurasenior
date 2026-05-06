/**
 * アコーディオン本体の開閉（max-height + opacity）。
 * index.html / goals.html / analytics.html および今後追加する画面で共通利用。
 * @param {HTMLElement | null} bodyEl 開閉するパネル要素
 * @param {HTMLElement | null} [iconEl] ＋/− を表示する要素（省略可）
 */
function toggleAccordionAnimated(bodyEl, iconEl) {
  if (!bodyEl) return;

  const setIcon = (nextText) => {
    if (!iconEl) return;
    iconEl.classList.add("is-changing");
    window.setTimeout(() => {
      iconEl.textContent = nextText;
      iconEl.classList.remove("is-changing");
    }, 110);
  };

  const isHidden = bodyEl.classList.contains("hidden");
  bodyEl.style.overflow = "hidden";
  bodyEl.style.transition = "max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease";

  if (isHidden) {
    bodyEl.classList.remove("hidden");
    bodyEl.style.opacity = "0";
    bodyEl.style.maxHeight = "0px";
    window.requestAnimationFrame(() => {
      bodyEl.style.opacity = "1";
      bodyEl.style.maxHeight = `${bodyEl.scrollHeight}px`;
    });
    const onOpenEnd = (event) => {
      if (event.propertyName !== "max-height") {
        return;
      }
      bodyEl.style.maxHeight = "none";
      bodyEl.style.overflow = "visible";
      bodyEl.removeEventListener("transitionend", onOpenEnd);
    };
    bodyEl.addEventListener("transitionend", onOpenEnd);
    setIcon("−");
    return;
  }

  if (bodyEl.style.maxHeight === "none" || !bodyEl.style.maxHeight) {
    bodyEl.style.maxHeight = `${bodyEl.scrollHeight}px`;
  }
  bodyEl.style.overflow = "hidden";
  bodyEl.getBoundingClientRect();
  bodyEl.style.opacity = "0";
  bodyEl.style.maxHeight = "0px";
  const onCloseEnd = (event) => {
    if (event.propertyName !== "max-height") {
      return;
    }
    bodyEl.classList.add("hidden");
    bodyEl.style.maxHeight = "";
    bodyEl.style.opacity = "";
    bodyEl.style.overflow = "";
    bodyEl.style.transition = "";
    bodyEl.removeEventListener("transitionend", onCloseEnd);
  };
  bodyEl.addEventListener("transitionend", onCloseEnd);
  setIcon("＋");
}
