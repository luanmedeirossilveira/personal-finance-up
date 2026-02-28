export type ToastOptions = {
  duration?: number;
};

export function showToast(message: string, opts: ToastOptions = {}) {
  if (typeof document === "undefined") return;
  const duration = opts.duration ?? 3000;
  const containerId = "app-toast-container";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    Object.assign(container.style, {
      position: "fixed",
      right: "16px",
      top: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      zIndex: "9999",
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  Object.assign(toast.style, {
    background: "rgba(0,0,0,0.75)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
    maxWidth: "320px",
    fontSize: "14px",
    opacity: "0",
    transform: "translateY(-6px)",
    transition: "opacity 180ms ease, transform 180ms ease",
  });
  toast.textContent = message;

  container.appendChild(toast);

  // trigger show
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  const hide = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => {
      try {
        container?.removeChild(toast);
      } catch {}
      // cleanup container if empty
      if (container && container.childElementCount === 0) {
        try {
          container.parentElement?.removeChild(container);
        } catch {}
      }
    }, 200);
  };

  const to = setTimeout(hide, duration);

  toast.addEventListener("click", () => {
    clearTimeout(to);
    hide();
  });
}

export default showToast;
