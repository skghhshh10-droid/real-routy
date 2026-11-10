// Routy 앱 내 대화상자 (브라우저 기본 confirm/prompt 대체)
(function () {
  function dialog({ title = "", message = "", input = null, okText = "확인", cancelText = "취소", danger = false }) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "ui-dialog-overlay";
      overlay.innerHTML = `
        <div class="ui-dialog" role="dialog" aria-modal="true">
          ${title ? `<h3 class="ui-dialog-title"></h3>` : ""}
          ${message ? `<p class="ui-dialog-message"></p>` : ""}
          ${input ? `<input class="ui-dialog-input" type="text" autocomplete="off">` : ""}
          <div class="ui-dialog-actions">
            ${cancelText ? `<button type="button" class="ui-dialog-btn" data-r="cancel"></button>` : ""}
            <button type="button" class="ui-dialog-btn ${danger ? "danger" : "primary"}" data-r="ok"></button>
          </div>
        </div>`;
      if (title) overlay.querySelector(".ui-dialog-title").textContent = title;
      if (message) overlay.querySelector(".ui-dialog-message").textContent = message;
      overlay.querySelector('[data-r="ok"]').textContent = okText;
      if (cancelText) overlay.querySelector('[data-r="cancel"]').textContent = cancelText;
      const field = overlay.querySelector(".ui-dialog-input");
      if (field) {
        field.value = input.value || "";
        field.placeholder = input.placeholder || "";
      }

      const close = (result) => {
        overlay.classList.remove("open");
        document.removeEventListener("keydown", onKey);
        setTimeout(() => overlay.remove(), 180);
        resolve(result);
      };
      const ok = () => close(field ? field.value.trim() : true);
      const cancel = () => close(field ? null : false);
      const onKey = (e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && (field || document.activeElement === document.body)) {
          e.preventDefault();
          ok();
        }
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cancel();
        const r = e.target.closest("[data-r]");
        if (r) r.getAttribute("data-r") === "ok" ? ok() : cancel();
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => {
        overlay.classList.add("open");
        if (field) {
          field.focus();
          field.select();
        }
      });
    });
  }

  window.uiConfirm = (message, opts = {}) => dialog(Object.assign({ message }, opts));
  window.uiPrompt = (title, value, opts = {}) => dialog(Object.assign({ title, input: { value, placeholder: opts.placeholder } }, opts));
  window.uiAlert = (message, opts = {}) => dialog(Object.assign({ message, cancelText: "" }, opts));
})();
