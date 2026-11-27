// Manual photo cropper: drag to reposition, slider or mouse wheel to zoom, circular preview.
// Resolves with a 320x320 JPEG data URL, null if cancelled, or undefined if the image could not be read.
export function openCropper(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    img.onload = () => {
      const S = 300, root = document.createElement("div"); root.className = "modal"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Crop your photo");
      root.innerHTML = `<div class="mbox"><h3 style="margin-top:0">Crop your photo</h3><canvas width="${S}" height="${S}" class="cv"></canvas><label>Zoom<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label><p class="mu"><small>Drag the photo to reposition it.</small></p><div class="nav2"><button type="button" class="g" data-k="x">Cancel</button><button type="button" data-k="ok">Use photo</button></div></div>`;
      document.body.appendChild(root);
      const cv = root.querySelector("canvas"), zm = root.querySelector("input"), ctx = cv.getContext("2d"), base = Math.max(S / img.width, S / img.height);
      let zoom = 1, ox = 0, oy = 0, drag = null;
      const clampOff = () => { const mx = Math.max(0, (img.width * base * zoom - S) / 2), my = Math.max(0, (img.height * base * zoom - S) / 2); ox = Math.min(mx, Math.max(-mx, ox)); oy = Math.min(my, Math.max(-my, oy)); };
      function paint(c, size, guide) {
        const k = size / S, w = img.width * base * zoom * k, h = img.height * base * zoom * k;
        c.fillStyle = "#fff"; c.fillRect(0, 0, size, size); c.drawImage(img, size / 2 + ox * k - w / 2, size / 2 + oy * k - h / 2, w, h);
        if (guide) { c.save(); c.fillStyle = "rgba(0,0,0,.55)"; c.beginPath(); c.rect(0, 0, size, size); c.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2, true); c.fill("evenodd"); c.restore(); c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); c.stroke(); }
      }
      const draw = () => { clampOff(); paint(ctx, S, true); };
      const onKey = e => { if (e.key === "Escape") done(null); };
      const done = v => { document.removeEventListener("keydown", onKey); root.remove(); URL.revokeObjectURL(url); resolve(v); };
      cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => { if (!drag) return; const r = cv.getBoundingClientRect(); ox = drag.ox + (e.clientX - drag.x) * (S / r.width); oy = drag.oy + (e.clientY - drag.y) * (S / r.height); draw(); });
      cv.addEventListener("pointerup", () => (drag = null)); cv.addEventListener("pointercancel", () => (drag = null));
      cv.addEventListener("wheel", e => { e.preventDefault(); zm.value = Math.min(4, Math.max(1, +zm.value - e.deltaY * 0.002)); zoom = +zm.value; draw(); }, { passive: false });
      zm.addEventListener("input", () => { zoom = +zm.value; draw(); });
      root.addEventListener("click", e => {
        const k = e.target.dataset && e.target.dataset.k;
        if (k === "x" || e.target === root) done(null);
        if (k === "ok") { const out = document.createElement("canvas"); out.width = out.height = 320; paint(out.getContext("2d"), 320, false); done(out.toDataURL("image/jpeg", 0.88)); }
      });
      document.addEventListener("keydown", onKey); draw(); root.querySelector("[data-k=ok]").focus();
    };
    img.src = url;
  });
}
