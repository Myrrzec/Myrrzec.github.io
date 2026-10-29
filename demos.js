// project previews: each card plays a short scripted walkthrough of its app in a loop.
// The clock only runs while the card is on screen, so a demo picks up where it left off.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STICKER = { W: "#f4f4f0", Y: "#f2d22e", R: "#c8262f", O: "#f07a1a", B: "#1f5fbf", G: "#1f9a4c" };
  const fill = (el, count) => { el.innerHTML = "<i></i>".repeat(count); return [...el.children]; };

  function player(demo, script) {
    const screen = demo.querySelector(".demo-screen");
    const cursor = demo.querySelector(".demo-cursor");
    let visible = false;

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.2 }).observe(demo);

    // waits `ms` of on-screen time
    const wait = (ms) => new Promise((resolve) => {
      let last = performance.now();
      const tick = (now) => {
        if (visible) ms -= now - last;
        last = now;
        if (ms <= 0) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const pointAt = (el) => {
      const box = screen.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const scale = box.width / screen.offsetWidth || 1;
      const x = (rect.left - box.left + rect.width * 0.55) / scale;
      const y = (rect.top - box.top + rect.height * 0.6) / scale;
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    };
    const rest = () => { cursor.style.transform = ""; };

    async function click(el) {
      pointAt(el);
      await wait(900);
      cursor.classList.add("is-click");
      el.classList.add("is-pressed");
      await wait(160);
      cursor.classList.remove("is-click");
      el.classList.remove("is-pressed");
    }

    const tools = { wait, click, rest, pointAt };
    (async () => { for (;;) await script(tools); })();
  }

  function countUp(els) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      els.forEach((el) => { el.textContent = Math.round(Number(el.dataset.to) * eased); });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Macros Tracker ----------
  function macros(demo) {
    const name = demo.querySelector(".mt-name");
    const choose = demo.querySelector(".mt-choose");
    const analyze = demo.querySelector(".mt-analyze");
    const stats = [...demo.querySelectorAll("[data-to]")];
    const states = ["is-chosen", "is-analyzing", "is-result"];

    const reset = () => {
      demo.classList.remove(...states);
      name.textContent = "No file chosen";
      analyze.textContent = "Analyze photo";
      stats.forEach((el) => { el.textContent = "0"; });
    };

    if (reduced) {
      demo.classList.add("is-chosen", "is-result");
      name.textContent = "breakfast.jpg";
      stats.forEach((el) => { el.textContent = el.dataset.to; });
      return;
    }

    player(demo, async ({ wait, click, rest }) => {
      reset();
      rest();
      await wait(1000);
      await click(choose);
      demo.classList.add("is-chosen");
      name.textContent = "breakfast.jpg";
      await wait(700);
      await click(analyze);
      demo.classList.add("is-analyzing");
      analyze.textContent = "Analyzing...";
      await wait(1700);
      demo.classList.replace("is-analyzing", "is-result");
      analyze.textContent = "Analyze photo";
      countUp(stats);
      rest();
      await wait(4200);
    });
  }

  // ---------- Make Solve ----------
  const FACES = [ // what the camera reads, center sticker in the middle
    "GWRBGYOGR", "YRWOWBGWB", "ROGYRWBOY", "BYOGBRWYG", "OBYROGRWO", "WGBYYOYRB",
  ];
  const MOVES = [
    ["R", "Turn the right face clockwise"],
    ["U", "Turn the top face clockwise"],
    ["R'", "Turn the right face back"],
    ["U'", "Turn the top face back"],
    ["F2", "Turn the front face twice"],
    ["D", "Turn the bottom face clockwise"],
    ["L'", "Turn the left face back"],
    ["U2", "Turn the top face twice"],
  ];
  const SCRAMBLED = { top: "YWOWWGWBW", front: "GRGGGYBGO", right: "RORWRBRYR" };
  const SOLVED = { top: "W", front: "G", right: "R" };

  function solver(demo) {
    const face = demo.querySelector(".ms-face");
    const frame = face.querySelector(".ms-frame");
    const faceCells = fill(face, 9);
    face.append(frame); // the lock frame sits over the cells
    const cam = demo.querySelector(".ms-cam");
    const chips = demo.querySelector(".ms-chips");
    chips.innerHTML = '<span class="ms-chip"></span>'.repeat(6);
    const chipCells = [...chips.children].map((chip) => fill(chip, 9));
    fill(demo.querySelector(".ms-icon"), 9);
    const count = demo.querySelector(".ms-n");
    const heading = demo.querySelector(".ms-scan .ms-h");
    const hint = demo.querySelector(".ms-hint");
    const button = demo.querySelector(".ms-btn");

    const sides = Object.fromEntries(["top", "front", "right"].map((key) => [key, fill(demo.querySelector(`.ms-${key}`), 9)]));
    const strip = demo.querySelector(".ms-strip");
    strip.innerHTML = MOVES.map(([move]) => `<i>${move}</i>`).join("");
    const chipsOfMoves = [...strip.children];
    const of = demo.querySelector(".ms-of");
    const move = demo.querySelector(".ms-move");
    const say = demo.querySelector(".ms-say");
    const note = demo.querySelector(".ms-note");
    // the order stickers settle into place as the moves go by
    const settle = Array.from({ length: 27 }, (_, i) => (i * 11) % 27);

    const paintCube = (done) => {
      Object.entries(sides).forEach(([key, cells], side) => cells.forEach((cell, i) => {
        const solved = settle[side * 9 + i] < (done / MOVES.length) * 27 || i === 4;
        cell.style.background = STICKER[solved ? SOLVED[key] : SCRAMBLED[key][i]];
      }));
    };
    const showMove = (index) => {
      chipsOfMoves.forEach((chip, i) => {
        chip.classList.toggle("is-done", i < index);
        chip.classList.toggle("is-now", i === index);
      });
      if (index >= MOVES.length) {
        of.textContent = `${MOVES.length} moves`;
        move.textContent = "Done";
        say.textContent = "Cube solved";
        note.textContent = "Every face is one color again.";
        return;
      }
      of.textContent = `Move ${index + 1} of ${MOVES.length}`;
      [move.textContent, say.textContent] = MOVES[index];
      note.textContent = index === 0 ? "Keep the green center facing you." : "";
    };
    const reset = () => {
      demo.classList.remove("is-scanned", "is-solving");
      faceCells.forEach((cell) => { cell.style.background = ""; });
      chipCells.flat().forEach((cell) => { cell.style.background = ""; });
      count.textContent = "0";
      heading.textContent = "Show the cube to the camera";
      hint.textContent = "Hold the face steady for a second.";
      paintCube(0);
      showMove(0);
    };

    if (reduced) {
      demo.classList.add("is-scanned", "is-solving");
      paintCube(MOVES.length);
      showMove(MOVES.length);
      return;
    }

    player(demo, async ({ wait, click, rest }) => {
      reset();
      rest();
      await wait(700);
      for (let f = 0; f < FACES.length; f++) {
        faceCells.forEach((cell) => { cell.style.background = ""; });
        await wait(250);
        for (let i = 0; i < 9; i++) {
          faceCells[i].style.background = STICKER[FACES[f][i]];
          await wait(45);
        }
        cam.classList.add("is-locked");
        await wait(380);
        cam.classList.remove("is-locked");
        chipCells[f].forEach((cell, i) => { cell.style.background = STICKER[FACES[f][i]]; });
        count.textContent = String(f + 1);
      }
      demo.classList.add("is-scanned");
      heading.textContent = "All six faces captured";
      hint.textContent = "Look over the net, then run the cube check.";
      await wait(500);
      await click(button);
      demo.classList.add("is-solving");
      rest();
      await wait(1200);
      for (let m = 1; m <= MOVES.length; m++) {
        paintCube(m);
        showMove(m);
        await wait(m === MOVES.length ? 3600 : 820);
      }
    });
  }

  document.querySelectorAll("[data-demo=macros]").forEach(macros);
  document.querySelectorAll("[data-demo=solver]").forEach(solver);
})();
