/**
 * Camera, cursor, caption and counter helpers shared by the scenes.
 * Everything is a function of timeline time: no timers, no randomness.
 *
 * The app was captured at 1440 x 1200 and fills the 1920-wide frame at 4/3:
 * home shows its top 900 px, and the camera pushes in from there.
 */
window.FILM = (() => {
  const FW = 1920;
  const FH = 1200;
  const APP_W = 1440;
  const APP_H = 1200;

  /** The edition: the app's tokens switch on <html data-theme>, from the `theme` variable. */
  function theme() {
    const value = window.__hyperframes?.getVariables?.().theme;
    if (value === "dark" || value === "light") document.documentElement.dataset.theme = value;
  }

  /** A rect measured at capture time (capture/rects.json): RECTS[screen][key][index]. */
  function r(screen, key, index = 0) {
    const hit = window.RECTS?.[screen]?.[key]?.[index];
    if (!hit) throw new Error(`FILM.r: no rect for ${screen}.${key}[${index}]`);
    return hit;
  }

  /** Elements under `scope` whose text is exactly `text`. */
  function withText(scope, selector, text) {
    return [...scope.querySelectorAll(selector)].filter((el) => el.textContent.trim() === text);
  }

  const home = { x: 0, y: 0, scale: FW / APP_W };

  /** A camera that puts the rect's centre at (ax, ay) of the frame, kept inside the app. */
  function view(rect, scale, ax = 0.5, ay = 0.5, appH = APP_H) {
    let x = FW * ax - scale * (rect.x + rect.w / 2);
    let y = FH * ay - scale * (rect.y + rect.h / 2);
    x = Math.min(0, Math.max(FW - scale * APP_W, x));
    y = Math.min(0, Math.max(FH - scale * appH, y));
    return { x, y, scale };
  }

  /** Where the cursor's hotspot goes to point at a rect (fx, fy inside it) under a camera. */
  function aim(cam, rect, fx = 0.5, fy = 0.5) {
    return {
      x: cam.x + cam.scale * (rect.x + rect.w * fx) - 8,
      y: cam.y + cam.scale * (rect.y + rect.h * fy) - 6,
    };
  }

  function move(tl, cam, to, t, d = 0.6) {
    tl.to(cam, { x: to.x, y: to.y, scale: to.scale, duration: d, ease: "expo.inOut" }, t);
  }

  /** A press: the cursor dips and a ring opens where it points. */
  function click(tl, cursor, ring, at, t) {
    tl.to(cursor, { scale: 0.86, duration: 0.08, ease: "power2.in" }, t);
    tl.to(cursor, { scale: 1, duration: 0.12, ease: "power2.out" }, t + 0.08);
    tl.fromTo(
      ring,
      { x: at.x + 8 - 36, y: at.y + 6 - 36, scale: 0.4, opacity: 0.9 },
      { scale: 1.5, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false },
      t
    );
  }

  /** A caption pill at the bottom: rises 12 px into place, leaves with a fade. */
  function cap(tl, el, t0, t1) {
    tl.fromTo(
      el,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" },
      t0
    );
    if (t1 !== undefined) tl.to(el, { opacity: 0, duration: 0.3, ease: "power2.in" }, t1);
  }

  /** Text that counts from one number to another. */
  function count(
    tl,
    els,
    from,
    to,
    t,
    d,
    format = (n) => String(Math.round(n)),
    ease = "power2.out"
  ) {
    const list = Array.isArray(els) ? els : [els];
    const state = { n: from };
    const paint = () => list.forEach((el) => (el.textContent = format(state.n)));
    paint();
    tl.fromTo(state, { n: from }, { n: to, duration: d, ease, onUpdate: paint }, t);
  }

  /** A line wiped in from the left. */
  function wipe(tl, el, t, d = 0.45) {
    tl.fromTo(
      el,
      { clipPath: "inset(0% 100% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: d, ease: "expo.out" },
      t
    );
  }

  /**
   * The chat as it was scrolled when captured: a cloned page starts at its
   * top, so the list is put back where it was (capture/rects.json).
   */
  function chat(tl, snap, screen) {
    // The page has a chat for each layout (the desktop column, the phone sheet): all of them
    const lists = [...snap.querySelectorAll('section[aria-label="Chat"] [aria-live="polite"]')];
    const saved = window.RECTS?.[screen] ?? {};
    const atBottom = (saved.chatScrollMax ?? 0) > 0 && saved.chatScroll >= saved.chatScrollMax - 2;
    for (const list of lists) {
      if (atBottom) {
        // Anchored to its bottom by layout, not by a scroll position: the renderer sets a
        // scroll before a scene is shown, and a hidden list drops it; and the fonts may
        // still change the height after this runs
        list.style.overflow = "hidden";
        list.style.justifyContent = "flex-end";
      } else {
        list.scrollTop = saved.chatScroll ?? 0;
      }
    }
  }

  /**
   * Where an element of a captured screen is, measured in the film itself (in
   * the capture's 1440-wide pixels): text can wrap a little differently here
   * than in the browser that captured it. The last visible match.
   */
  function live(snap, selector, text) {
    const all = [...snap.querySelectorAll(selector)].filter(
      (el) => text === undefined || el.textContent.trim() === text
    );
    const el = all[all.length - 1];
    if (!el) throw new Error(`FILM.live: nothing matches ${selector}${text ? `|${text}` : ""}`);
    const box = snap.getBoundingClientRect();
    const k = box.width / APP_W;
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - box.left) / k,
      y: (r.top - box.top) / k,
      w: r.width / k,
      h: r.height / k,
    };
  }

  /** The composer's text, revealed left to right as if typed. */
  function typeIn(tl, snap, t, d = 2.2) {
    const box = snap.querySelector('section[aria-label="Chat"] textarea');
    if (!box) return;
    tl.set(box, { clipPath: "inset(0% 100% 0% 0%)" }, 0);
    tl.to(box, { clipPath: "inset(0% 0% 0% 0%)", duration: d, ease: "none" }, t);
  }

  return { theme, r, withText, home, view, aim, move, click, cap, count, wipe, chat, live, typeIn };
})();
