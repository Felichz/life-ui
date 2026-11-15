/* Helpers for the LifeUI film. Everything is a function of timeline time: no timers, no randomness, and every
 * tween that starts later than 0 is created with immediateRender:false so seeking anywhere gives the same frame. */
window.LF = (() => {
  /** The edition: the app's tokens switch on <html data-theme>, from the `theme` variable. */
  function theme() {
    const v = (window.__hyperframes?.getVariables?.() ?? {}).theme ?? (window.__hfVariables ?? {}).theme;
    if (v === 'dark' || v === 'light') document.documentElement.dataset.theme = v;
  }

  const IR = { immediateRender: false };

  /** Text written into `el` as if typed, from 0 to all its characters between t and t + d.
   *  Nothing is painted at build time: before t the element shows what its markup says. */
  function type(tl, el, text, t, d) {
    const s = { n: 0 };
    const paint = () => (el.textContent = text.slice(0, Math.round(s.n)));
    tl.fromTo(s, { n: 0 }, { n: text.length, duration: d, ease: 'none', onUpdate: paint, ...IR }, t);
  }

  /** A number counting between two values, written by `fmt`. Several counts may share an element: none
   *  paints at build time, and seeking back renders each one's start value. */
  function count(tl, els, from, to, t, d, fmt = (n) => String(Math.round(n)), ease = 'power2.out') {
    const list = Array.isArray(els) ? els : [els];
    const s = { n: from };
    const paint = () => list.forEach((e) => (e.textContent = fmt(s.n)));
    tl.fromTo(s, { n: from }, { n: to, duration: d, ease, onUpdate: paint, ...IR }, t);
  }

  /** A text that changes at t, and changes back if the timeline is sought before t. */
  function text(tl, el, before, after, t) {
    const s = { v: 0 };
    tl.fromTo(s, { v: 0 }, { v: 1, duration: 0.01, ease: 'none', onUpdate: () => (el.textContent = s.v < 0.5 ? before : after), ...IR }, t);
  }

  /** A class that is on from t (and off again if the timeline is sought before t). */
  function cls(tl, el, name, on, t) {
    const s = { v: 0 };
    tl.fromTo(s, { v: 0 }, { v: 1, duration: 0.01, ease: 'none', onUpdate: () => el.classList.toggle(name, s.v < 0.5 ? !on : on), ...IR }, t);
  }

  /** Natural height of a hidden block, measured once at build time (display restored after). */
  function height(el, display = 'block') {
    const prev = el.style.display;
    el.style.display = display;
    const h = el.offsetHeight;
    el.style.display = prev;
    return h;
  }

  /**
   * A message joins the chat: the feed is anchored to the bottom, so the new block would shove everything up
   * at once. The feed is put back down by the block's height at that instant and eased up, like a chat that
   * scrolls, while the block fades in.
   */
  function join(tl, feed, el, t, gap = 14, display = 'block') {
    const h = height(el, display) + gap;
    tl.set(el, { display }, t);
    tl.fromTo(feed, { y: h }, { y: 0, duration: 0.55, ease: 'power3.out', ...IR }, t);
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out', ...IR }, t + 0.05);
  }

  /** Words revealed one after another between t and t + d, each fading in quickly. */
  function stream(tl, words, t, d) {
    const step = d / Math.max(1, words.length);
    words.forEach((w, i) => tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none', ...IR }, t + i * step));
  }

  /** Wrap every word of `el` (text nodes only, keeping <b> and the rest) in a span; returns them in order. */
  function words(el) {
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            frag.appendChild(s);
            out.push(s);
          }
        });
        n.replaceWith(frag);
      } else [...n.childNodes].forEach(walk);
    };
    walk(el);
    return out;
  }

  /** The pointer glides from an offset onto its target (it lives inside the target), presses, and leaves. */
  function press(tl, cursor, ring, tIn, tPress, from = [-170, -90]) {
    tl.fromTo(cursor, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', ...IR }, tIn);
    tl.fromTo(cursor, { x: from[0], y: from[1] }, { x: 0, y: 0, duration: tPress - tIn - 0.1, ease: 'power3.inOut', ...IR }, tIn);
    tl.fromTo(cursor, { scale: 1 }, { scale: 0.86, duration: 0.08, ease: 'power2.in', ...IR }, tPress);
    tl.fromTo(cursor, { scale: 0.86 }, { scale: 1, duration: 0.14, ease: 'power2.out', ...IR }, tPress + 0.08);
    tl.fromTo(ring, { scale: 0.4, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', ...IR }, tPress);
    tl.fromTo(cursor, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power1.in', ...IR }, tPress + 0.55);
  }

  return { theme, type, count, text, cls, height, join, stream, words, press, IR };
})();
