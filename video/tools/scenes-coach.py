"""
Writes the scenes of the film "From the chat to the calendar" (video/scenes/*.html).
Each scene shares the same frame: a camera over captured screens, captions, a cursor.
Only the camera script and the captions differ: they are below, scene by scene.
Run from video/: python tools/scenes-coach.py, then node tools/build.mjs.
"""
import io
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

CURSOR = """        <div id="{id}-click" class="f-click"></div>
        <div id="{id}-cursor" class="f-cursor">
          <svg viewBox="0 0 28 28" width="56" height="56" aria-hidden="true">
            <path
              d="M4 3l17 9.5-7.4 1.6L10 21.6z"
              fill="#fff"
              stroke="#16161a"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </div>"""


def scene(sid, snaps, captions, script, cursor=True):
    snap_lines = "\n".join(f"            <!-- snap:{name} -->" for name in snaps)
    cap_lines = "\n".join(
        f'        <p id="{sid}-cap{i + 1}" class="f-cap">\n          <span>{text}</span>\n        </p>'
        for i, text in enumerate(captions)
    )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <template>
      <style>
        #root {{
          position: absolute;
          inset: 0;
        }}
      </style>
      <div id="{sid}" data-composition-id="{sid}" data-width="1920" data-height="1200">
        <div class="f-win">
          <div id="{sid}-cam" class="f-cam">
{snap_lines}
          </div>
        </div>
{cap_lines}
{CURSOR.format(id=sid) if cursor else ""}
      </div>
      <script>
        (() => {{
          const F = FILM;
          F.theme();
          const tl = gsap.timeline({{ paused: true }});
          const cam = document.querySelector("#{sid}-cam");
          const snaps = [...document.querySelectorAll("#{sid}-cam .snap")];
          if (snaps.length > 1) tl.set(snaps.slice(1), {{ opacity: 0 }}, 0);
{script}
          window.__timelines["{sid}"] = tl;
        }})();
      </script>
    </template>
  </body>
</html>
"""


SCENES = {
    # 0.0-6.0: Today with its chat; the message types itself in, Send
    "ask": (
        ["c01-ask"],
        ["Tell it <em>what is going on</em>"],
        """          const [s] = snaps;
          F.chat(tl, s, "c01-ask");
          const input = F.r("c01-ask", "input");
          const send = F.r("c01-ask", "send");
          const vInput = F.view({ x: input.x, y: input.y - 60, w: input.w, h: input.h + 60 }, 2.3, 0.5, 0.45);
          tl.set(cam, F.home, 0);
          F.cap(tl, "#ask-cap1", 0.4, 5.2);
          F.move(tl, cam, vInput, 0.8, 0.7);
          F.typeIn(tl, s, 1.5, 2.2);
          const pSend = F.aim(vInput, send, 0.5, 0.55);
          tl.fromTo("#ask-cursor", { x: 1960, y: 1240 }, { x: pSend.x, y: pSend.y, duration: 0.9, ease: "power2.inOut" }, 3.9);
          F.click(tl, "#ask-cursor", "#ask-click", pSend, 5.3);
          tl.to("#ask-cursor", { opacity: 0, duration: 0.2 }, 5.6);""",
    ),
    # 6.0-14.0: the search and its sources, then a slow pan down the plan
    "answer": (
        ["c02-answer"],
        ["It <em>looks it up</em>", "and lays out <em>a plan</em>"],
        """          const [s] = snaps;
          F.chat(tl, s, "c02-answer");
          const chat = F.r("c02-answer", "chat");
          const vTop = F.view({ x: chat.x, y: 120, w: chat.w, h: 280 }, 2.35, 0.5, 0.42);
          const vBottom = F.view({ x: chat.x, y: 860, w: chat.w, h: 220 }, 2.35, 0.5, 0.5);
          tl.set(cam, vTop, 0);
          F.cap(tl, "#answer-cap1", 0.3, 3.0);
          tl.to(cam, { x: vBottom.x, y: vBottom.y, scale: vBottom.scale, duration: 3.6, ease: "power1.inOut" }, 3.2);
          F.cap(tl, "#answer-cap2", 4.0);""",
        False,
    ),
    # 14.0-20.0: the yes; the roadmap card waits on Do it
    "card": (
        ["c03-card"],
        ["Nothing changes <em>without your yes</em>"],
        """          const [s] = snaps;
          F.chat(tl, s, "c03-card");
          const doit = F.r("c03-card", "doit");
          const vCard = F.view({ x: 1040, y: doit.y - 300, w: 400, h: 340 }, 2.25, 0.5, 0.45);
          tl.set(cam, vCard, 0);
          F.cap(tl, "#card-cap1", 0.5, 5.6);
          const pDo = F.aim(vCard, doit, 0.5, 0.55);
          tl.fromTo("#card-cursor", { x: 1960, y: 1240 }, { x: pDo.x, y: pDo.y, duration: 1.0, ease: "power2.inOut" }, 2.6);
          F.click(tl, "#card-cursor", "#card-click", pDo, 4.4);""",
    ),
    # 20.0-24.0: saved; the coach says what is on the calendar
    "saved": (
        ["c04-saved"],
        ["<em>50 sessions</em> on your calendar"],
        """          const [s] = snaps;
          F.chat(tl, s, "c04-saved");
          const list = F.r("c04-saved", "list");
          const vEnd = F.view({ x: list.x, y: list.y + list.h - 400, w: list.w, h: 400 }, 2.25, 0.5, 0.45);
          tl.set(cam, vEnd, 0);
          F.cap(tl, "#saved-cap1", 0.4, 3.6);""",
        False,
    ),
    # 24.0-31.0: Goals; what a session of the first phase holds, with the guide links
    "goals": (
        ["c05-goals", "c06-notes"],
        ["Each one <em>says what to do</em>"],
        """          const [plain, open] = snaps;
          F.chat(tl, plain, "c05-goals");
          F.chat(tl, open, "c06-notes");
          const roadmap = F.r("c05-goals", "roadmap");
          const toggle = F.r("c05-goals", "toggle");
          const link = F.r("c06-notes", "links");
          const vRoad = F.view(roadmap, 1.65, 0.5, 0.48);
          const vNotes = F.view({ x: 272, y: link.y - 90, w: 728, h: 220 }, 2.0, 0.5, 0.5);
          tl.set(cam, F.home, 0);
          F.move(tl, cam, vRoad, 0.3, 0.7);
          const pToggle = F.aim(vRoad, toggle, 0.5, 0.5);
          tl.fromTo("#goals-cursor", { x: 1960, y: 1240 }, { x: pToggle.x, y: pToggle.y, duration: 1.1, ease: "power2.inOut" }, 1.4);
          F.click(tl, "#goals-cursor", "#goals-click", pToggle, 3.2);
          tl.set(open, { opacity: 1 }, 3.28);
          tl.to("#goals-cursor", { opacity: 0, duration: 0.2 }, 3.5);
          F.move(tl, cam, vNotes, 3.6, 0.7);
          F.cap(tl, "#goals-cap1", 4.2);""",
    ),
    # 31.0-36.0: 9:11, the first session runs; then the composer: "Done, it went well. A 9."
    "run": (
        ["c07-running"],
        ["<em>9:00</em>. The first session"],
        """          const [s] = snaps;
          F.chat(tl, s, "c07-running");
          const card = F.r("c07-running", "card");
          const input = F.r("c07-running", "input");
          const vCard = F.view(card, 1.75, 0.5, 0.46);
          const vInput = F.view({ x: input.x, y: input.y - 60, w: input.w, h: input.h + 60 }, 2.3, 0.5, 0.45);
          tl.set(cam, vCard, 0);
          F.cap(tl, "#run-cap1", 0.3, 2.6);
          F.move(tl, cam, vInput, 2.8, 0.7);
          F.typeIn(tl, s, 3.4, 1.4);""",
        False,
    ),
    # 36.0-40.0: the close card and its tempos; Do it; the coach confirms
    "close": (
        ["c08-close", "c09-earned"],
        ["Closed honestly, <em>in a sentence</em>"],
        """          const [waiting, done] = snaps;
          F.chat(tl, waiting, "c08-close");
          F.chat(tl, done, "c09-earned");
          const doit = F.r("c08-close", "doit");
          const vCard = F.view({ x: 1029, y: doit.y - 260, w: 411, h: 300 }, 2.25, 0.5, 0.45);
          tl.set(cam, vCard, 0);
          F.cap(tl, "#close-cap1", 0.3);
          const pDo = F.aim(vCard, doit, 0.5, 0.55);
          tl.fromTo("#close-cursor", { x: 1960, y: 1240 }, { x: pDo.x, y: pDo.y, duration: 0.9, ease: "power2.inOut" }, 0.5);
          F.click(tl, "#close-cursor", "#close-click", pDo, 1.6);
          tl.set(done, { opacity: 1 }, 1.68);
          tl.to("#close-cursor", { opacity: 0, duration: 0.2 }, 1.9);
          F.move(tl, cam, F.home, 2.2, 0.7);""",
    ),
}

for sid, spec in SCENES.items():
    snaps, captions, script = spec[0], spec[1], spec[2]
    cursor = spec[3] if len(spec) > 3 else True
    path = os.path.join(ROOT, "scenes", f"{sid}.html")
    io.open(path, "w", encoding="utf-8", newline="\n").write(scene(sid, snaps, captions, script, cursor))
    print("wrote", path)
