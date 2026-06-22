import { useEffect, useState } from "react";

export default function ScreenshotGuard() {
  const [masked, setMasked] = useState(false);

  useEffect(() => {
    let timer;
    function flashMask() {
      setMasked(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMasked(false), 1500);
    }

    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      const protectedCombo = event.key === "PrintScreen"
        || (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key))
        || (event.ctrlKey && ["p", "s"].includes(key));
      if (protectedCombo) {
        event.preventDefault();
        flashMask();
      }
    }

    function onContextMenu(event) {
      event.preventDefault();
      flashMask();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", flashMask);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", flashMask);
    };
  }, []);

  return masked ? (
    <div className="screenshot-mask" aria-hidden="true">
      <div>Protected TravelShare content</div>
    </div>
  ) : null;
}
