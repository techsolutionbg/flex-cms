function animateGalleryImage(image, direction = 1) {
  if (!image?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  image.getAnimations?.().forEach((animation) => animation.cancel());
  image.animate(
    [
      { transform: `translateX(${direction * 100}%)` },
      { transform: "translateX(0)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}

// Shared public image viewer. Text is inserted with textContent, never HTML.
const stylesheet = new URL("./flex-lightbox.css", import.meta.url).href;
if (!document.querySelector("link[data-flex-lightbox-style]")) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = stylesheet;
  link.dataset.flexLightboxStyle = "1";
  document.head.append(link);
}
export function openLightbox({
  images,
  position = 0,
  title = "Изображения",
  opener,
  zoom: zoomEnabledOption = true,
  maxZoom = 3,
}) {
  if (
    !images?.length ||
    typeof HTMLDialogElement === "undefined" ||
    !HTMLDialogElement.prototype.showModal
  )
    return;
  position = Math.max(0, Math.min(images.length - 1, position));
  const dialog = document.createElement("dialog");
  dialog.className = "flex-lightbox";
  dialog.setAttribute("aria-label", title);
  const bar = document.createElement("div");
  bar.className = "flex-lightbox-bar";
  const heading = document.createElement("span");
  heading.textContent = title;
  const back = document.createElement("button"),
    forward = document.createElement("button"),
    close = document.createElement("button");
  back.textContent = "‹";
  back.setAttribute("aria-label", "Предишно изображение");
  forward.textContent = "›";
  forward.setAttribute("aria-label", "Следващо изображение");
  close.textContent = "✕";
  close.setAttribute("aria-label", "Затвори прегледа");
  const icon = (control, path) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", path);
    svg.append(line);
    control.replaceChildren(svg);
    control.type = "button";
  };
  icon(back, "m15 18-6-6 6-6");
  icon(forward, "m9 18 6-6-6-6");
  icon(close, "m6 6 12 12M18 6 6 18");
  back.className = "flex-lightbox-prev";
  forward.className = "flex-lightbox-next";
  const stage = document.createElement("div");
  stage.className = "flex-lightbox-stage";
  const footer = document.createElement("div");
  footer.className = "flex-lightbox-footer";
  const counter = document.createElement("span");
  counter.className = "flex-lightbox-counter";
  counter.setAttribute("aria-live", "polite");
  const thumbnails = document.createElement("div");
  thumbnails.className = "flex-lightbox-thumbnails";
  thumbnails.setAttribute("aria-label", "Избор на изображение");
  const image = document.createElement("img"),
    caption = document.createElement("p");
  caption.className = "flex-lightbox-caption";
  let current = position;
  image.draggable = false;
  let lastShown = current;
  let direction = 1;
  const media = document.createElement("div");
  media.className = "flex-lightbox-media";
  const zoomEnabled = zoomEnabledOption;
  const zoomMax = Math.max(2, Math.min(5, Number(maxZoom) || 3));
  let zoom = 1,
    panX = 0,
    panY = 0;
  const zoomControls = document.createElement("div");
  zoomControls.className = "flex-lightbox-zoom";
  const zoomOut = document.createElement("button"),
    zoomIn = document.createElement("button"),
    zoomReset = document.createElement("button");
  icon(zoomOut, "M5 12h14");
  icon(zoomIn, "M5 12h14M12 5v14");
  zoomOut.setAttribute("aria-label", "Намали изображението");
  zoomIn.setAttribute("aria-label", "Увеличи изображението");
  zoomReset.type = "button";
  zoomReset.setAttribute("aria-label", "Върни оригиналния размер");
  const applyZoom = (value) => {
    zoom = zoomEnabled ? Math.max(1, Math.min(zoomMax, value)) : 1;
    const maxX = (media.clientWidth * (zoom - 1)) / 2,
      maxY = (media.clientHeight * (zoom - 1)) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
    if (zoom === 1) panX = panY = 0;
    image.getAnimations?.().forEach((animation) => animation.cancel());
    image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomReset.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom === 1;
    zoomIn.disabled = zoom === zoomMax;
    stage.classList.toggle("is-zoomed", zoom > 1);
  };
  zoomOut.onclick = () => applyZoom(zoom - 0.5);
  zoomIn.onclick = () => applyZoom(zoom + 0.5);
  zoomReset.onclick = () => applyZoom(1);
  zoomControls.append(zoomOut, zoomReset, zoomIn);
  if (zoomEnabled) {
    stage.classList.add("has-zoom");
    media.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        applyZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
      },
      { passive: false },
    );
    media.addEventListener("dblclick", () =>
      applyZoom(zoom === 1 ? Math.min(2, zoomMax) : 1),
    );
  }
  const body = document.createElement("div");
  body.className = "flex-lightbox-body";
  const fitImage = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const padding = getComputedStyle(stage);
    const width = Math.max(
      0,
      stage.clientWidth -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight),
    );
    const available = Math.max(0, body.clientHeight - footer.offsetHeight - 12);
    stage.style.height = `${Math.min(available, (width * image.naturalHeight) / image.naturalWidth)}px`;
  };
  let outgoing = null;
  image.onload = () => {
    fitImage();
    const previous = outgoing;
    outgoing = null;
    if (!previous) return;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !image.animate
    ) {
      previous.remove();
      return;
    }
    animateGalleryImage(image, direction);
    previous
      .animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(${-direction * 100}%)` },
        ],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      )
      .finished.then(() => previous.remove())
      .catch(() => previous.remove());
  };
  const show = () => {
    direction = Math.sign(current - lastShown);
    lastShown = current;
    media.querySelectorAll("img").forEach((node) => {
      if (node !== image) node.remove();
    });
    image.getAnimations?.().forEach((animation) => animation.cancel());
    applyZoom(1);
    outgoing = direction && image.src ? image.cloneNode() : null;
    if (outgoing) {
      outgoing.setAttribute("aria-hidden", "true");
      media.append(outgoing);
    }
    const source = images[current];
    image.src = source.src;
    image.alt = source.alt;
    counter.textContent = `${current + 1} / ${images.length}`;
    caption.textContent =
      [source.caption, source.description].filter(Boolean).join(" — ") ||
      source.alt;
    caption.hidden = !caption.textContent;
    [...thumbnails.children].forEach((thumb, i) =>
      thumb.setAttribute("aria-pressed", String(i === current)),
    );
    const activeThumb = thumbnails.children[current];
    if (activeThumb)
      thumbnails.scrollTo({
        left:
          activeThumb.offsetLeft -
          thumbnails.offsetLeft -
          (thumbnails.clientWidth - activeThumb.offsetWidth) / 2,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    back.disabled = current === 0;
    forward.disabled = current === images.length - 1;
  };
  back.onclick = () => {
    if (current > 0) current--;
    show();
  };
  forward.onclick = () => {
    if (current < images.length - 1) current++;
    show();
  };
  close.onclick = () => dialog.close();
  images.forEach((source, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.setAttribute("aria-label", `Изображение ${index + 1}`);
    const preview = document.createElement("img");
    preview.src = source.thumbnail || source.src;
    preview.alt = "";
    preview.loading = "lazy";
    thumb.append(preview);
    thumb.onclick = () => {
      current = index;
      show();
    };
    thumbnails.append(thumb);
  });
  let swipe = null;
  const pointers = new Map();
  let pinch = null;
  const distance = () => {
    const points = [...pointers.values()];
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (zoomEnabled && pointers.size === 2) {
      pinch = { distance: distance(), zoom };
      swipe = null;
    } else
      swipe = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        panX,
        panY,
        moved: false,
      };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      applyZoom((pinch.zoom * distance()) / Math.max(1, pinch.distance));
      return;
    }
    if (zoom > 1 && swipe?.id === event.pointerId) {
      panX = swipe.panX + event.clientX - swipe.x;
      panY = swipe.panY + event.clientY - swipe.y;
      swipe.moved = true;
      applyZoom(zoom);
    }
  });
  stage.addEventListener("pointerup", (event) => {
    pointers.delete(event.pointerId);
    if (pinch) {
      pinch = null;
      swipe = null;
      return;
    }
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    if (
      zoom === 1 &&
      !swipe.moved &&
      Math.abs(dx) > 35 &&
      Math.abs(dx) > Math.abs(event.clientY - swipe.y)
    )
      (dx < 0 ? forward : back).click();
    swipe = null;
  });
  stage.addEventListener("pointercancel", () => {
    swipe = null;
    pointers.clear();
    pinch = null;
  });
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.addEventListener("keydown", (event) => {
    if (zoomEnabled && ["+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault();
      applyZoom(
        event.key === "0" ? 1 : zoom + (event.key === "-" ? -0.5 : 0.5),
      );
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      back.click();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      forward.click();
    }
  });
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    },
    { once: true },
  );
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  bar.append(heading);
  const actions = document.createElement("div");
  actions.className = "flex-lightbox-actions";
  if (zoomEnabled) actions.append(zoomControls);
  actions.append(close);
  bar.append(actions);
  media.append(image);
  stage.append(media);
  if (images.length > 1) stage.append(back, forward);
  if (images.length > 1) footer.append(thumbnails, counter);
  footer.append(caption);
  body.append(stage, footer);
  dialog.append(bar, body);
  document.body.append(dialog);
  show();
  dialog.showModal();
  const resize = new ResizeObserver(fitImage);
  resize.observe(body);
  resize.observe(footer);
  dialog.addEventListener("close", () => resize.disconnect(), {
    once: true,
  });
  fitImage();
  close.focus();

  return dialog;
}
