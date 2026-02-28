export function showConfirm(message: string): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const containerId = "app-confirm-container";
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      Object.assign(container.style, {
        position: "fixed",
        left: "0",
        right: "0",
        top: "0",
        bottom: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "99999",
        pointerEvents: "none",
      });
      document.body.appendChild(container);
    }

    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.5)",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#0f1a16",
      color: "#fff",
      padding: "16px",
      borderRadius: "10px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      maxWidth: "520px",
      width: "100%",
      pointerEvents: "auto",
    });

    const msg = document.createElement("div");
    msg.textContent = message;
    Object.assign(msg.style, { marginBottom: "12px", color: "#e6f7ef" });

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Cancelar";
    Object.assign(btnCancel.style, {
      background: "#1c2b22",
      color: "#8dcdb0",
      border: "none",
      padding: "8px 12px",
      borderRadius: "8px",
      cursor: "pointer",
    });

    const btnOk = document.createElement("button");
    btnOk.textContent = "Remover";
    Object.assign(btnOk.style, {
      background: "#ef4444",
      color: "#fff",
      border: "none",
      padding: "8px 12px",
      borderRadius: "8px",
      cursor: "pointer",
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    box.appendChild(msg);
    box.appendChild(actions);
    backdrop.appendChild(box);
    container.appendChild(backdrop);

    const cleanup = () => {
      try {
        container?.removeChild(backdrop);
      } catch {}
      if (container && container.childElementCount === 0) {
        try {
          container.parentElement?.removeChild(container);
        } catch {}
      }
    };

    btnCancel.addEventListener("click", () => {
      cleanup();
      resolve(false);
    });
    btnOk.addEventListener("click", () => {
      cleanup();
      resolve(true);
    });
  });
}

export default showConfirm;
