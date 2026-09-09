export function triggerHaptic(
  type: "light" | "medium" | "success" | "warning" | "error" = "light"
) {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    switch (type) {
      case "light":
        navigator.vibrate(15);
        break;
      case "medium":
        navigator.vibrate(30);
        break;
      case "success":
        navigator.vibrate([25, 40, 30]);
        break;
      case "warning":
        navigator.vibrate([40, 30, 40]);
        break;
      case "error":
        navigator.vibrate([70, 40, 70]);
        break;
    }
  } catch {}
}
