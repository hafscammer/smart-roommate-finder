// Manual profile-photo cropper with drag, fine keyboard positioning, zoom and a live circular preview.
// Resolves with a 320x320 JPEG data URL, null if cancelled, or undefined if the image could not be read.
export function openCropper(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    img.onload = () => {
      const S = 300, root = document.createElement("div"); root.className = "modal"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Position your profile photo");
      root.innerHTML = `<div class="mbox"><h3 style="margin-top:0">Position your photo</h3><canvas width="${S}" height="${S}" class="cv" tabindex="0" aria-label="Photo crop area. Drag to position, or use arrow keys for fine adjustments."></canvas><label>Zoom<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label><p class="mu"><small>Drag to center your face. Use arrow keys for fine adjustments, or reset the crop to start again.</small></p><div class="crop-actions"><button type="button" class="g sm" data-k="reset">Reset crop</button><span class="crop-spacer"></span><button type="button" class="g" data-k="x">Cancel</button><button type="button" data-k="ok">Use photo</button></div></div>`;
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
      const reset = () => { zoom = 1; ox = 0; oy = 0; zm.value = "1"; draw(); };
      const done = v => { document.removeEventListener("keydown", onKey); root.remove(); URL.revokeObjectURL(url); resolve(v); };
      const onKey = e => {
        if (e.key === "Escape") { e.preventDefault(); done(null); return; }
        if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key) && root.isConnected && document.activeElement === cv) { e.preventDefault(); const step = e.shiftKey ? 12 : 3; if (e.key === "ArrowUp") oy += step; if (e.key === "ArrowDown") oy -= step; if (e.key === "ArrowLeft") ox += step; if (e.key === "ArrowRight") ox -= step; draw(); }
      };
      cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); cv.focus(); });
      cv.addEventListener("pointermove", e => { if (!drag) return; const r = cv.getBoundingClientRect(); ox = drag.ox + (e.clientX - drag.x) * (S / r.width); oy = drag.oy + (e.clientY - drag.y) * (S / r.height); draw(); });
      cv.addEventListener("pointerup", () => (drag = null)); cv.addEventListener("pointercancel", () => (drag = null));
      cv.addEventListener("dblclick", reset);
      cv.addEventListener("wheel", e => { e.preventDefault(); zm.value = Math.min(4, Math.max(1, +zm.value - e.deltaY * 0.002)); zoom = +zm.value; draw(); }, { passive: false });
      zm.addEventListener("input", () => { zoom = +zm.value; draw(); });
      root.addEventListener("click", e => {
        const k = e.target.dataset && e.target.dataset.k;
        if (k === "x" || e.target === root) done(null);
        if (k === "reset") reset();
        if (k === "ok") { const out = document.createElement("canvas"); out.width = out.height = 320; paint(out.getContext("2d"), 320, false); done(out.toDataURL("image/jpeg", 0.88)); }
      });
      document.addEventListener("keydown", onKey); draw(); cv.focus();
    };
    img.src = url;
  });
}
