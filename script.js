/* =========================================================
   Hamid Ijaz — Portfolio
   - Name loader: light grey → white fill, then morphs to top-left logo
   - GSAP text reveal on load
   - Scroll-driven canvas frame sequence (rotating photo)
   - Lenis smooth scroll
   ========================================================= */

gsap.registerPlugin(ScrollTrigger, SplitText, Observer);

const FRAME_COUNT  = 150;
const FRAME_PREFIX = 'assets/video-frame/Photo_to_Degree_Rotating_Video__online-video-cutter_com__';
const FRAME_PAD    = 3;

// Frame ranges (0-indexed):
//   INTRO 0 → 47    — auto-plays after the loader (frames 001 → 048)
//   PIN   47 → 149  — driven by scroll while the hero is pinned (frames 048 → 150)
const INTRO_START_FRAME = 0;     // frame 001
const PIN_START_FRAME   = 47;    // frame 048
const PIN_END_FRAME     = 149;   // frame 150

const frameSrc = (i) =>
    FRAME_PREFIX + String(i).padStart(FRAME_PAD, '0') + '.png';

// Hide elements via body class until the reveal timeline runs
document.body.classList.add('is-prereveal');

/* ---------- Frame preloader -------------------------------- */
const images = [];
const frameState = { current: INTRO_START_FRAME };

const nameFillEl = document.getElementById('loaderNameFill');

let loaded   = 0;
let revealed = false;

function onFrameLoaded() {
    loaded += 1;
    const pct = loaded / FRAME_COUNT;
    // fill the name from left → right as frames load (light grey → white)
    gsap.to(nameFillEl, {
        clipPath: `inset(0 ${(1 - pct) * 100}% 0 0)`,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto'
    });
    if (loaded >= FRAME_COUNT) revealSite();
}

for (let i = 1; i <= FRAME_COUNT; i++) {
    const img = new Image();
    img.onload  = onFrameLoaded;
    img.onerror = onFrameLoaded; // don't stall the loader on a missing frame
    img.src = frameSrc(i);
    images.push(img);
}

// Warm the first work-panel background so it doesn't pop in when the
// user scrolls past the hero. Doesn't gate the reveal — fires in
// parallel with the frame preloader and will be in cache by the time
// the panel scrolls into view.
['assets/work/locumbridge.jpg'].forEach((src) => {
    const img = new Image();
    img.src = src;
});

// Safety net — never let the loader gate the page longer than 6s, even if the
// browser somehow swallows load events.
setTimeout(() => {
    if (!revealed) {
        gsap.set(nameFillEl, { clipPath: 'inset(0 0% 0 0)' });
        revealSite();
    }
}, 6000);

/* ---------- Canvas setup ----------------------------------- */
const canvas = document.getElementById('heroCanvas');
const ctx    = canvas.getContext('2d');

function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(frameState.current);
}

function drawFrame(index) {
    const img = images[Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(index)))];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;

    ctx.clearRect(0, 0, cw, ch);

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const isMobile = window.innerWidth <= 900;
    let dw, dh, dx, dy;
    if (isMobile) {
        // Mobile: fit by width then 2x zoom, centered both axes.
        const scale = (cw / iw) * 2;
        dw = iw * scale;
        dh = ih * scale;
        dx = (cw - dw) / 2;
        dy = (ch - dh) / 2;
    } else {
        // Desktop: fit by height, right-anchored.
        const scale = ch / ih;
        dw = iw * scale;
        dh = ch;
        dx = cw - dw;
        dy = 0;
    }

    ctx.drawImage(img, dx, dy, dw, dh);
}

// Computes the xPercent we need to apply to .hero-canvas to bring the
// right-anchored, height-fit photo to TRUE viewport center. Accounts for
// the canvas's `right: -170px` CSS offset (canvas extends past viewport).
// Re-evaluated on ScrollTrigger refresh via invalidateOnRefresh.
const CANVAS_RIGHT_OFFSET_PX = 170;
function getCenterXPercent() {
    // On mobile drawFrame already centers the image inside the canvas, and
    // CSS removes the right: -170px offset, so no extra GSAP shift is needed.
    if (window.innerWidth <= 900) return 0;
    const img = images[PIN_END_FRAME];
    if (!img || !img.complete || img.naturalWidth === 0) return -50;
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (cw === 0 || ch === 0) return -50;
    const dw = (img.naturalWidth / img.naturalHeight) * ch;
    // Image visual center in viewport (no transform):
    //   canvas.left (= 170) + (cw - dw/2)
    // Target: cw / 2  (true viewport center, since canvas spans full vw)
    // Shift in px = target - current = cw/2 - 170 - cw + dw/2
    //             = (dw - cw)/2 - 170
    const shiftPx = (dw - cw) / 2 - CANVAS_RIGHT_OFFSET_PX;
    return (shiftPx / cw) * 100;
}

window.addEventListener('resize', sizeCanvas);

/* ---------- Reveal site once frames are loaded ------------- */
function revealSite() {
    if (revealed) return;
    revealed = true;

    // Drop the prereveal class so reveal animations have somewhere to go to
    document.body.classList.remove('is-prereveal');

    sizeCanvas();
    drawFrame(INTRO_START_FRAME);

    const loaderNameEl = document.getElementById('loaderName');

    const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: initScrollFrames
    });

    // 1. Hold the fully-filled name briefly
    tl.to({}, { duration: 0.4 });

    // 2. Name collapses vertically into a sliver and fades — leaves the seam
    tl.to(loaderNameEl, {
        scaleY: 0.02,
        opacity: 0,
        duration: 0.45,
        ease: 'power2.inOut'
    });

    // 3. Both scanlines (top + bottom) stretch from the name's width to the
    //    full viewport width simultaneously — looks like a single bright line.
    tl.to(['#loaderLineTop', '#loaderLineBot'], {
        scaleX: 1,
        duration: 0.55,
        ease: 'power3.out'
    }, '<0.05');

    // 4. Hold the seam — the "CRT scanline" moment
    tl.to({}, { duration: 0.22 });

    // 5. Split: top half + its line slide UP, bottom half + its line slide DOWN.
    //    The single line visibly becomes two lines that ride the halves off-screen.
    tl.to('#loaderTop', {
        yPercent: -100,
        duration: 0.95,
        ease: 'expo.inOut'
    });
    tl.to('#loaderBot', {
        yPercent: 100,
        duration: 0.95,
        ease: 'expo.inOut'
    }, '<');

    // 6. As the halves separate, content fades/slides in one by one.

    // Hero photo: fades in first (it's the backdrop)
    tl.fromTo('.hero-canvas',
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' },
        '<0.15'
    );

    // Header logo
    tl.fromTo('#logoTarget',
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
        '<0.1'
    );

    // Headline lines stagger in one by one (PRIMARY only — secondary stays
    // hidden until the user scrolls and the layout-swap timeline reveals it)
    tl.fromTo('.hero-title--primary .line-inner',
        { yPercent: 110 },
        { yPercent: 0, duration: 0.95, stagger: 0.13, ease: 'power4.out' },
        '<0.1'
    );

    // Nav items + CV link slide up in sequence
    tl.fromTo('.reveal-inner',
        { yPercent: 110 },
        { yPercent: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' },
        '<0.2'
    );

    // 7. Auto-spin frame 001 → 048 while the page reveals, so when everything
    //    settles the photo is parked at 048 ready for scroll to take over.
    tl.to(frameState, {
        current: PIN_START_FRAME,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => drawFrame(frameState.current)
    }, '<-0.5');

    // 8. Tear down loader (halves are off-screen, lines went with them)
    tl.set('#loader', { display: 'none' });

    // 9. Scroll indicator
    tl.to('#scrollIndicator', {
        opacity: 1,
        duration: 0.5
    });
}

/* ---------- Scroll-driven frame playback + layout swap -----
   Original 900vh-pin timeline — restored to the version that felt right:
     0 → 0.10   primary headline exits as a block
     0 → 0.55   canvas slides right → CENTER while rotating 048 → 150
     0.55→0.70  secondary heading loads line-by-line on the right
     0.70→0.85  HOLD — read window
     0.85→1.00  image + bg slide UP, secondary block slides UP
   Curtain heading lives in its own dedicated section below — see
   initWorkIntro().
   ============================================================ */
function initScrollFrames() {
    const SPAN = PIN_END_FRAME - PIN_START_FRAME;

    gsap.set('.hero-secondary-wrap', { opacity: 0 });
    gsap.set('.hero-title--secondary .line-inner', { yPercent: 110 });

    const ROT_END_PROG = 0.55;

    const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end:   '+=900%',
            pin:   '#heroStage',
            pinSpacing: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
                const p   = Math.min(self.progress / ROT_END_PROG, 1);
                const idx = PIN_START_FRAME + p * SPAN;
                frameState.current = idx;
                drawFrame(idx);
            }
        }
    });

    // 0 → 0.10: primary headline exits up
    tl.to('.hero-title--primary', {
        yPercent: -200,
        duration: 0.10,
        ease: 'power2.in'
    }, 0);

    // 0 → 0.55: canvas slides from right anchor to TRUE center while
    //   rotating. Lands on last frame, centered, at progress 0.55.
    tl.to('.hero-canvas', {
        xPercent: () => getCenterXPercent(),
        duration: 0.55,
        ease: 'power2.inOut'
    }, 0);

    // 0.55 → 0.60: secondary block fades in
    tl.to('.hero-secondary-wrap', {
        opacity: 1,
        duration: 0.05
    }, 0.55);

    // 0.55 → 0.70: secondary headline loads line-by-line
    tl.to('.hero-title--secondary .line-inner', {
        yPercent: 0,
        stagger: 0.025,
        duration: 0.15,
        ease: 'power3.out'
    }, 0.55);

    // 0.70 → 0.85: HOLD — read window.

    // 0.85 → 1.00: image + bg slide UP, secondary block slides UP.
    tl.to(['.hero-canvas', '.hero-bg'], {
        yPercent: -100,
        duration: 0.15,
        ease: 'power3.inOut'
    }, 0.85);

    tl.to('.hero-secondary-wrap', {
        yPercent: -130,
        opacity: 0,
        duration: 0.15,
        ease: 'power3.inOut'
    }, 0.85);

    gsap.to('#scrollIndicator', {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end:   '+=20%',
            scrub: true
        }
    });

    initWorkIntro();
    initWorkStage();
    initAboutIntro();
    initAboutBars();
    initAboutGlitch();
}

/* ---------- About section: scroll-triggered glitch reveals ----
   Re-uses playGlitchReveal (the same scramble used by the menu hover
   and the work-stage panel titles) and fires it as the user scrolls
   into the about content. Multiple triggers fire at different points
   so the section keeps revealing as the user scrolls — name first,
   eyebrow + role just after, then experience heading when the
   timeline scrolls into view. */
function initAboutGlitch() {
    const triggers = [
        { sel: '.about-name',             start: 'top 70%' },
        { sel: '.about-eyebrow',          start: 'top 75%' },
        { sel: '.about-role',             start: 'top 78%' },
        { sel: '.about-experience-title', start: 'top 75%' },
        { sel: '.about-experience-eyebrow', start: 'top 80%' }
    ];

    triggers.forEach(({ sel, start }) => {
        const el = document.querySelector(sel);
        if (!el) return;

        // Hide the resolved text until the trigger fires — without this
        // the user would see the final text, then it'd scramble, which
        // looks like a regression. Caching the original via dataset
        // matches what playGlitchReveal does on first invocation.
        el.dataset.glitchOriginal = el.textContent;
        el.textContent = '';

        ScrollTrigger.create({
            trigger: el,
            start,
            once: true,
            onEnter: () => {
                el.textContent = el.dataset.glitchOriginal;
                playGlitchReveal(el, { stagger: 28, frame: 32, delay: 40 });
            }
        });
    });
}

/* ---------- About section: diagonal marquee bars entry ----------
   Two rotated ribbons across the top of the bio block. When the
   about section enters the viewport, the white bar slides in along
   its diagonal from the right, the red bar follows in from the left,
   and the marquee animation (CSS keyframes) takes over inside each
   bar from then on — icons scroll LTR on white, text scrolls RTL on
   red. */
function initAboutBars() {
    const whiteBar = document.getElementById('aboutBarWhite');
    const redBar   = document.getElementById('aboutBarRed');
    if (!whiteBar || !redBar) return;

    // GSAP owns the full transform (rotate + xPercent). fromTo with
    // immediateRender: true (default) parks them off-screen now; the
    // ScrollTrigger releases them when about scrolls into view. Rotate
    // is included in both from/to states so it never gets discarded.
    gsap.fromTo(whiteBar,
        { xPercent: 130, rotate: -10 },
        {
            xPercent: 0,
            rotate: -10,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: '#about', start: 'top 80%', once: true }
        }
    );
    gsap.fromTo(redBar,
        { xPercent: -130, rotate: -10 },
        {
            xPercent: 0,
            rotate: -10,
            duration: 1.1,
            ease: 'power3.out',
            delay: 0.55,
            scrollTrigger: { trigger: '#about', start: 'top 80%', once: true }
        }
    );
}

/* ---------- Intro section: pinned heading w/ stagger fill ----
   Shared init for any pinned intro section (work-intro, about-intro).
   Pins its inner stage while the user scrolls a fixed distance, fades
   words in with parallax stagger, brightens chars in sequence to red,
   then runs a red + black layer wipe to hand off to the next section.
   Pass the section's slug ("workIntro", "aboutIntro") and the same
   slug-prefixed IDs for stage/heading/layers in the markup. */
function initIntroSection(slug, wordClass, charClass) {
    const headingEl = document.getElementById(slug + 'Heading');
    if (!headingEl) {
        console.warn('[' + slug + '] heading not found');
        return;
    }

    let words            = [];
    let lineEls          = [];      // SplitText line wrappers, top → bottom
    let lineBrightSpans  = [];      // Bright spans grouped by line (parallel to lineEls)
    try {
        const split = new SplitText(headingEl, { type: 'lines, words, chars' });
        split.lines.forEach((l) => l.classList.add('intro-line'));
        split.words.forEach((w) => w.classList.add(wordClass));
        split.chars.forEach((c) => c.classList.add(charClass));
        words   = split.words;
        lineEls = split.lines;

        // Restructure each word into two stacked copies:
        //   <span class="intro-word-dim">…original chars…</span>
        //   <span class="intro-word-bright" aria-hidden>…clone of chars…</span>
        // The bright copy is absolute-positioned over the dim copy and
        // clipped from below; animating its clip-path inset reveals the
        // bright top → bottom, layering over the dim. clip-path is a
        // paint property that Chrome and Safari animate reliably — none
        // of the background-clip: text variants we tried did.
        words.forEach((word) => {
            const inner = word.innerHTML;
            word.innerHTML =
                '<span class="intro-word-dim">' + inner + '</span>' +
                '<span class="intro-word-bright" aria-hidden="true">' + inner + '</span>';
        });

        // Cache the bright spans grouped by line for the per-line wipe.
        lineBrightSpans = lineEls.map((line) =>
            Array.from(line.querySelectorAll('.intro-word-bright'))
        );

        // Initial state: every bright span fully clipped (invisible).
        lineBrightSpans.forEach((spans) => {
            for (let i = 0; i < spans.length; i++) {
                spans[i].style.clipPath        = 'inset(0 0 100% 0)';
                spans[i].style.webkitClipPath  = 'inset(0 0 100% 0)';
            }
        });
    } catch (err) {
        console.warn('[' + slug + '] SplitText failed:', err);
        return;
    }

    // Park each word below + invisible until scroll brings them in.
    gsap.set(words, { yPercent: 120, opacity: 0 });

    // Pin map (over the 400vh pin):
    //   0    → 0.30   words drop in one-by-one (parallax stagger)
    //   0.30 → 0.60   text wipes red, line by line, left → right
    //   0.60 → 0.65   brief hold while the heading reads
    //   0.65 → 0.82   red layer rises from below
    //   0.82 → 1.00   black layer rises over the red — pin ends on black
    const FILL_START_PROG = 0.30;
    const FILL_END_PROG   = 0.60;

    const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: '#' + slug,
            start: 'top top',
            end:   '+=400%',
            pin:   '#' + slug + 'Stage',
            pinSpacing: true,
            scrub: 0.4,
            onUpdate: (self) => {
                const fillP = Math.max(0, Math.min(1,
                    (self.progress - FILL_START_PROG) /
                    (FILL_END_PROG - FILL_START_PROG)
                ));
                // Per-line wipe via clip-path inset on the bright copy
                // of each word. fillP 0→1 is sliced into N equal segments
                // (one per line); each line's segment animates the
                // bottom-inset of every bright span on that line from
                // 100% (fully clipped, invisible) to 0% (no clip,
                // bright fully revealed) — top → bottom reveal.
                const lineCount = lineBrightSpans.length || 1;
                lineBrightSpans.forEach((spans, idx) => {
                    const segStart = idx / lineCount;
                    const lineP = Math.max(0, Math.min(1,
                        (fillP - segStart) * lineCount
                    ));
                    const bottomInset = (1 - lineP) * 100;
                    const clip = 'inset(0 0 ' + bottomInset + '% 0)';
                    for (let i = 0; i < spans.length; i++) {
                        spans[i].style.clipPath       = clip;
                        spans[i].style.webkitClipPath = clip;
                    }
                });
            }
        }
    });

    tl.to(words, {
        yPercent: 0,
        opacity: 1,
        stagger: 0.06,
        duration: 0.14,
        ease: 'power3.out'
    }, 0);

    tl.fromTo('#' + slug + 'LayerRed',
        { yPercent: 100 },
        { yPercent: 0, duration: 0.17, ease: 'power2.inOut' },
        0.65
    );

    tl.fromTo('#' + slug + 'LayerBlack',
        { yPercent: 100 },
        { yPercent: 0, duration: 0.18, ease: 'power2.inOut' },
        0.82
    );
}

function initWorkIntro() {
    initIntroSection('workIntro', 'work-intro-word', 'work-intro-char');
    initWorkIntroFloats();
}

/* ---------- Work-intro: floating decorative props ----------------
   Four PNGs from assets/intro-imgs sit around the heading. Same
   pattern as initAboutIntroFloats — floats hold below + hidden until
   the heading words have dropped in (~0.30 of pin progress), then
   enter one at a time staggered 0.06 apart, and drift upward +
   rotate through the rest of the pin for parallax depth. */
function initWorkIntroFloats() {
    const items = [
        { id: '#workIntroFloat1', yEnd: -260, rotStart: -8,  rotEnd: -22 },
        { id: '#workIntroFloat2', yEnd: -200, rotStart:  6,  rotEnd:  18 },
        { id: '#workIntroFloat3', yEnd: -320, rotStart:  10, rotEnd:  -8 },
        { id: '#workIntroFloat4', yEnd: -240, rotStart: -5,  rotEnd:  16 }
    ];

    items.forEach(({ id, rotStart }) => {
        const el = document.querySelector(id);
        if (el) gsap.set(el, { y: 120, opacity: 0, rotation: rotStart });
    });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '#workIntro',
            start: 'top top',
            end:   '+=400%',
            scrub: 0.6
        }
    });
    tl.to({}, { duration: 1 }, 0);   // pad timeline to length 1

    const ENTRY_START = 0.32;
    const STAGGER     = 0.06;
    const ENTRY_DUR   = 0.06;

    // Mobile fades floats back OUT near the end of the pin using the
    // same power2.out easing as the entrance — the section feels
    // "bookended" rather than littered with floats lingering at the top.
    const isMobile = window.innerWidth <= 900;
    const EXIT_START   = 0.78;
    const EXIT_STAGGER = 0.04;
    const EXIT_DUR     = 0.08;

    items.forEach((item, idx) => {
        const el = document.querySelector(item.id);
        if (!el) return;
        const start = ENTRY_START + idx * STAGGER;

        tl.to(el,
            { y: 0, opacity: 1, duration: ENTRY_DUR, ease: 'power2.out' },
            start
        );
        tl.to(el,
            { y: item.yEnd, rotation: item.rotEnd,
              duration: 1 - (start + ENTRY_DUR), ease: 'none' },
            start + ENTRY_DUR
        );

        if (isMobile) {
            tl.to(el,
                { opacity: 0, duration: EXIT_DUR, ease: 'power2.out' },
                EXIT_START + idx * EXIT_STAGGER
            );
        }
    });
}

function initAboutIntro() {
    initIntroSection('aboutIntro', 'about-intro-word', 'about-intro-char');
    initAboutIntroFloats();

    // Across the same 400% pin used by initIntroSection, hold the red
    // canvas for the first 60% (while the heading wipes black → white),
    // then fade the stage bg from red → black across the final 40%.
    // The end state matches the #about section below (also black), so
    // when the pin releases there's no visible seam — the colour change
    // is entirely scroll-driven within the intro.
    const stage = document.getElementById('aboutIntroStage');
    if (!stage) return;
    gsap.timeline({
        scrollTrigger: {
            trigger: '#aboutIntro',
            start: 'top top',
            end:   '+=400%',
            scrub: 0.6
        }
    })
    .to({}, { duration: 0.6 })
    .to(stage, { backgroundColor: '#000000', duration: 0.4, ease: 'none' });
}

/* ---------- About-intro: floating decorative props -----------
   Five props (camera, coffee, glasses, headphone, pen) sit around the
   heading. The heading itself assembles during the first 30% of the
   pin (words drop in, then wipe black → white 0.30→0.60). Floats
   hold off until the words are in place — they enter ONE BY ONE
   starting at 0.32 of the pin's scroll progress, staggered 0.06
   apart. After each float's entrance, it drifts upward and rotates
   through the rest of the pin for parallax depth (varied per-prop
   yEnd makes faster props feel closer). */
function initAboutIntroFloats() {
    const items = [
        { id: '#aboutIntroFloatCamera',    yEnd: -260, rotStart: -8,  rotEnd: -22 },
        { id: '#aboutIntroFloatCoffee',    yEnd: -180, rotStart:  6,  rotEnd:  20 },
        { id: '#aboutIntroFloatGlasses',   yEnd: -320, rotStart:  10, rotEnd:  -8 },
        { id: '#aboutIntroFloatHeadphone', yEnd: -220, rotStart: -5,  rotEnd:  16 },
        { id: '#aboutIntroFloatPen',       yEnd: -360, rotStart:  18, rotEnd:  38 }
    ];

    // Park all floats below + invisible at their start rotation BEFORE
    // the timeline runs, so they don't flash on first paint.
    items.forEach(({ id, rotStart }) => {
        const el = document.querySelector(id);
        if (el) gsap.set(el, { y: 120, opacity: 0, rotation: rotStart });
    });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: '#aboutIntro',
            start: 'top top',
            end:   '+=400%',
            scrub: 0.6
        }
    });
    tl.to({}, { duration: 1 }, 0);   // pad timeline to length 1

    // Hold until the heading's words are visible (≥0.30 of pin), then
    // bring floats in one at a time.
    const ENTRY_START = 0.32;
    const STAGGER     = 0.06;
    const ENTRY_DUR   = 0.06;

    // Mobile fades floats back OUT near the end of the pin using the
    // same power2.out easing as the entrance.
    const isMobile = window.innerWidth <= 900;
    const EXIT_START   = 0.78;
    const EXIT_STAGGER = 0.04;
    const EXIT_DUR     = 0.08;

    items.forEach((item, idx) => {
        const el = document.querySelector(item.id);
        if (!el) return;
        const start = ENTRY_START + idx * STAGGER;

        // Entrance: rise from y=120 to 0 + fade in.
        tl.to(el,
            { y: 0, opacity: 1, duration: ENTRY_DUR, ease: 'power2.out' },
            start
        );

        // Parallax: from end of entrance to end of pin, drift upward
        // and rotate. duration = remaining timeline length.
        tl.to(el,
            { y: item.yEnd, rotation: item.rotEnd,
              duration: 1 - (start + ENTRY_DUR), ease: 'none' },
            start + ENTRY_DUR
        );

        if (isMobile) {
            tl.to(el,
                { opacity: 0, duration: EXIT_DUR, ease: 'power2.out' },
                EXIT_START + idx * EXIT_STAGGER
            );
        }
    });
}

/* ---------- Typewriter reveal on a card description -------- */
function setupTypewriter(card) {
    const desc = card.querySelector('.work-card-desc');
    if (!desc || desc.dataset.typewriter === 'set') return;

    const text = desc.textContent;
    desc.textContent = '';
    desc.dataset.typewriter = 'set';

    // Wrap each character in a .work-char span so we can scrub their colors
    const chars = [];
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'work-char';
        // &nbsp; for spaces so layout doesn't collapse them visually
        span.textContent = text[i];
        desc.appendChild(span);
        chars.push(span);
    }

    let lastIdx          = 0;
    let bandWidth        = 1;       // current width of the active highlight band
    const MAX_BAND       = 80;      // upper bound (~16 words)
    const VELOCITY_MULT  = 8;       // delta * this = target band width on scroll
    const BAND_DECAY     = 0.92;    // multiplier per idle update — slower decay
                                    // so the band lingers visibly after fast scrolls

    // Scrub characters bright over the FIRST HALF of the card's sticky range.
    // Chars in the leading "band" are highlighted (.is-current), chars before
    // the band are fully revealed. The band's width grows with scroll velocity
    // and decays back when the user pauses. In the LAST slice of scroll the
    // band is forced down to zero so it exits cleanly at the final word
    // instead of leaving the trailing chars covered.
    const BAND_EXIT_START = 0.88;   // progress at which the band starts fading out

    ScrollTrigger.create({
        trigger: card,
        start:   'top top',
        end:     '+=50%',
        scrub:   0.4,
        onUpdate: (self) => {
            const idx   = Math.round(self.progress * chars.length);
            const delta = Math.abs(idx - lastIdx);

            if (delta > 0) {
                // small delta still produces a fat band (~6 words at delta 4)
                const target = Math.min(MAX_BAND, delta * VELOCITY_MULT);
                bandWidth = Math.max(bandWidth, target);
            } else {
                bandWidth = Math.max(1, bandWidth * BAND_DECAY);
            }

            // Override bandWidth in the exit zone — linearly down to 0 by
            // progress 1.0 so the band ends exactly at the last char.
            let effectiveBandWidth = bandWidth;
            if (self.progress > BAND_EXIT_START) {
                const exitP = (self.progress - BAND_EXIT_START) / (1 - BAND_EXIT_START);
                effectiveBandWidth = bandWidth * (1 - exitP);
            }

            const bandStart = Math.max(0, idx - Math.round(effectiveBandWidth));

            for (let i = 0; i < chars.length; i++) {
                const c = chars[i];
                const inBand    = i >= bandStart && i < idx;
                const isRevealed = i < bandStart;
                if (c.classList.contains('is-current')   !== inBand)    c.classList.toggle('is-current', inBand);
                if (c.classList.contains('is-revealed')  !== isRevealed) c.classList.toggle('is-revealed', isRevealed);
            }

            lastIdx = idx;
        }
    });
}

/* ---------- Work stage: horizontal track scroller ----------
   All 4 panels live side-by-side in one .work-panels flex row
   (total width = N × 100vw). ScrollTrigger pins the stage and
   tweens the row's x-translate from 0 to -(N-1) × 100vw as the
   user scrolls vertically — so vertical scroll becomes a smooth
   horizontal pan through the cards. Snap locks each card into
   place when the user stops scrolling. */
function initWorkStage() {
    const stageEl    = document.getElementById('workStage');
    const panelsRow  = document.getElementById('workPanels');
    if (!stageEl || !panelsRow) return;

    const panels = gsap.utils.toArray('.work-panel');
    if (panels.length === 0) return;

    const counterEl = document.getElementById('workStageCounter');
    const counterCurrent = counterEl
        ? counterEl.querySelector('.work-stage-counter-current')
        : null;

    let currentIndex = 0;

    function updateCounter(idx) {
        if (counterCurrent) {
            counterCurrent.textContent = String(idx + 1).padStart(2, '0');
        }
    }
    updateCounter(0);

    function activateTitleGlitch(idx) {
        const titleEl = panels[idx].querySelector('.work-panel-title');
        if (titleEl) playGlitchReveal(titleEl);
    }

    // Horizontal pan as a TIMELINE of alternating dwells + transitions:
    //   [dwell card 0]  [transition 0→1]  [dwell card 1]  [transition 1→2]  …
    // Each "unit" of timeline duration corresponds to UNIT_VH viewport
    // heights of scroll. Dwells are pure no-op tweens — the row stays
    // pinned at the current card's x position — so the user has time
    // to read each card before scrolling continues the move. Snap
    // points target the MIDDLE of every dwell so a quick stop lands
    // the user squarely on a card, not mid-transition.
    const TRANSITION_DUR = 1.0;   // duration units for a card-to-card slide
    const DWELL_DUR      = 1.5;   // duration units the row sits on a card
    const UNIT_VH        = 1.0;   // 1 timeline unit == 1 viewport height of scroll

    const N = panels.length;
    const totalDuration = N * DWELL_DUR + (N - 1) * TRANSITION_DUR;

    // Snap to the midpoint of each card's dwell phase.
    const snapPoints = panels.map((_, i) => {
        const dwellMid = i * (DWELL_DUR + TRANSITION_DUR) + DWELL_DUR / 2;
        return dwellMid / totalDuration;
    });

    const horizontalTween = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: stageEl,
            start: 'top top',
            end:   () => '+=' + (totalDuration * UNIT_VH * window.innerHeight),
            pin: true,
            pinSpacing: true,
            scrub: 1,
            snap: {
                snapTo: snapPoints,
                duration: { min: 0.3, max: 0.7 },
                delay: 0.08,
                ease: 'power3.inOut'
            },
            invalidateOnRefresh: true,
            onUpdate: () => {
                // Derive the active card directly from panelsRow.x —
                // unlike progress, x is always a clean multiple of
                // window.innerWidth at rest, so the counter and
                // glitch fire exactly on each card change.
                const x = parseFloat(gsap.getProperty(panelsRow, 'x')) || 0;
                const newIndex = Math.max(0, Math.min(N - 1,
                    Math.round(-x / window.innerWidth)));
                if (newIndex !== currentIndex) {
                    currentIndex = newIndex;
                    updateCounter(currentIndex);
                    activateTitleGlitch(currentIndex);
                }
            },
            onEnter:     () => activateTitleGlitch(currentIndex),
            onEnterBack: () => activateTitleGlitch(currentIndex)
        }
    });

    // Initial dwell on card 0 — row stays at x=0.
    horizontalTween.to({}, { duration: DWELL_DUR });

    // For each subsequent card: transition in, then dwell.
    for (let i = 1; i < N; i++) {
        horizontalTween.to(panelsRow, {
            x: () => -i * window.innerWidth,
            duration: TRANSITION_DUR,
            ease: 'power2.inOut'
        });
        horizontalTween.to({}, { duration: DWELL_DUR });
    }

    // Per-panel parallax — each layer drifts at its own rate as the
    // panel traverses the viewport. ScrollTriggers use the horizontal
    // tween as their "scroll source" via `containerAnimation`, so the
    // start/end positions ('left right' → 'right left') refer to the
    // panel's path through the viewport during the horizontal pan, not
    // to vertical page scroll. Larger magnitude = more pronounced lag.
    panels.forEach((panel) => {
        const bg      = panel.querySelector('.work-panel-bg');
        const content = panel.querySelector('.work-panel-content');
        const cta     = panel.querySelector('.work-panel-cta');

        const triggerCfg = {
            trigger: panel,
            start: 'left right',
            end:   'right left',
            scrub: true,
            containerAnimation: horizontalTween
        };

        // Background zooms OUT as the panel traverses the viewport —
        // starts magnified (scale 1.25) when entering from the right,
        // settles to natural size (1.0) by the time it exits on the
        // left. Replaces the previous horizontal x-drift; gives a
        // "pulling back to reveal" feel as each card finishes its
        // turn. Origin: center, so the zoom anchors at the card's
        // middle rather than a corner.
        if (bg) {
            gsap.set(bg, { transformOrigin: 'center center' });
            gsap.fromTo(bg,
                { scale: 1.25 },
                { scale: 1, ease: 'none', scrollTrigger: triggerCfg }
            );
        }

        // Content drifts FASTER — same-direction offset for a "pushed
        // ahead" feel. Vertical drift adds depth.
        if (content) {
            gsap.fromTo(content,
                { xPercent: 25, yPercent: 6 },
                { xPercent: -25, yPercent: -6, ease: 'none', scrollTrigger: triggerCfg }
            );
        }

        // CTA gets the strongest lag — nudges out of the bottom-right
        // corner as the panel exits to the left.
        if (cta) {
            gsap.fromTo(cta,
                { xPercent: 40, yPercent: 10 },
                { xPercent: -40, yPercent: -10, ease: 'none', scrollTrigger: triggerCfg }
            );
        }
    });
}

/* ---------- Lenis smooth scroll (darkroomengineering/lenis) -------------
   Drives the document scroll with eased smoothing. Hooked into the GSAP
   ticker so ScrollTrigger updates stay perfectly in sync with Lenis. */
if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.2,
        infinite: false
    });

    // Keep ScrollTrigger in lock-step with Lenis's eased scroll position
    lenis.on('scroll', ScrollTrigger.update);

    // Drive Lenis off the GSAP ticker (one rAF source for everything)
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Expose for debugging if needed
    window.lenis = lenis;
} else {
    console.warn('Lenis not loaded — falling back to native scroll');
}

/* ---------- Glitch reveal -------------------------------------
   Scrambles a text element through glitch chars (@#$%&*, digits,
   uppercase letters) and resolves them left-to-right at staggered
   times — looks like the text is being decoded. Used by both the
   menu hover (.nav-link / .cv-link) and the work-stage panel
   activation (.work-panel-title). Spaces are preserved. */
const GLITCH_CHARS = '@#$%&*0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function playGlitchReveal(el, opts = {}) {
    const stagger = opts.stagger ?? 38;
    const frame   = opts.frame   ?? 38;
    const delay   = opts.delay   ?? 70;

    // Cache the original text once per element so re-runs (e.g. user
    // toggling between panels repeatedly) always restore the right value.
    if (!el.dataset.glitchOriginal) {
        el.dataset.glitchOriginal = el.textContent;
    }
    const original = el.dataset.glitchOriginal;
    const len = original.length;

    // Cancel any in-flight glitch on the same element.
    if (el._glitchInterval) clearInterval(el._glitchInterval);
    if (el._glitchTimers)   el._glitchTimers.forEach(clearTimeout);

    const resolved = new Array(len).fill(false);
    const timers = [];
    for (let i = 0; i < len; i++) {
        if (original[i] === ' ') { resolved[i] = true; continue; }
        timers.push(setTimeout(() => { resolved[i] = true; },
            delay + i * stagger + Math.random() * 25));
    }

    const interval = setInterval(() => {
        el.textContent = original.split('').map((c, i) => {
            if (resolved[i] || c === ' ') return c;
            return GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0];
        }).join('');
    }, frame);

    timers.push(setTimeout(() => {
        clearInterval(interval);
        el.textContent = original;
        el._glitchInterval = null;
        el._glitchTimers   = null;
    }, delay + len * stagger + 140));

    el._glitchInterval = interval;
    el._glitchTimers   = timers;
}

/* Menu / CV / Download Resume / "let's go" hover — fires the glitch
   reveal on mouseenter for any link that wraps its text in
   `.reveal-inner`. */
function setupGlitchHover() {
    const selector = '.nav-link, .cv-link, .about-cv-btn, .contact-cta, .header-overlay-link, .header-overlay-cta';
    document.querySelectorAll(selector).forEach((link) => {
        const inner = link.querySelector('.reveal-inner');
        if (!inner) return;
        inner.addEventListener('mouseenter', () => playGlitchReveal(inner));
    });
}

/* Hero flag — elastic squish + scale on hover. The NZ flag chip in the
   secondary heading uses GSAP's elastic ease so it springs out, settles
   with a wobble, and feels like a soft physical object. While a tween
   is in flight, additional mouseenters are ignored so a fast back-and-
   forth doesn't restart it mid-bounce. */
function setupHeroFlagHover() {
    const flag = document.querySelector('.hero-flag');
    if (!flag || typeof gsap === 'undefined') return;

    let active = false;
    flag.addEventListener('mouseenter', () => {
        if (active) return;
        active = true;
        gsap.timeline({ onComplete: () => { active = false; } })
            .to(flag, {
                scaleX: 1.35,
                scaleY: 0.78,
                rotate: -6,
                duration: 0.18,
                ease: 'power2.out'
            })
            .to(flag, {
                scaleX: 1,
                scaleY: 1,
                rotate: 0,
                duration: 1.1,
                ease: 'elastic.out(1, 0.35)'
            });
    });
}

function initInteractiveHovers() {
    setupGlitchHover();
    setupHeroFlagHover();
    setupHeroNzCycle();
    initMouseScrollIndicator();
    initHeaderScroll();
    initAboutCvButton();
    setupContactCards();
    setupNavScrollSpy();
    setupWorkModal();
    setupHamburger();
}

/* ---------- Mobile hamburger menu ----------------------------------
   Toggles the full-screen overlay nav. Pauses Lenis while open so the
   page doesn't scroll behind the menu, and closes on link click so
   the in-page anchor still smooth-scrolls to its target. */
/* Rename id="…" attributes inside a cloned SVG (and update any
   url(#…) / href / xlink:href references that point to them) so the
   clone is self-contained and doesn't collide with the original's IDs.
   Without this, e.g. the Behance card's <clipPath id="cardClipBehance">
   ends up duplicated in the document and the icon stops rendering. */
function uniquifySvgIds(root, suffix) {
    const renamed = {};
    root.querySelectorAll('[id]').forEach(el => {
        const oldId = el.id;
        const newId = oldId + suffix;
        el.id = newId;
        renamed[oldId] = newId;
    });
    if (!Object.keys(renamed).length) return;
    const refAttrs = ['clip-path', 'mask', 'filter', 'fill', 'stroke', 'href', 'xlink:href'];
    root.querySelectorAll('*').forEach(el => {
        refAttrs.forEach(attr => {
            const v = el.getAttribute(attr);
            if (!v) return;
            const urlMatch = v.match(/^url\(#([^)]+)\)$/);
            if (urlMatch && renamed[urlMatch[1]]) {
                el.setAttribute(attr, 'url(#' + renamed[urlMatch[1]] + ')');
            } else if (v.startsWith('#') && renamed[v.slice(1)]) {
                el.setAttribute(attr, '#' + renamed[v.slice(1)]);
            }
        });
    });
}

function setupHamburger() {
    const burger  = document.getElementById('headerBurger');
    const overlay = document.getElementById('headerOverlay');
    if (!burger || !overlay) return;

    // Clone the footer's contact cards into the overlay so they stay
    // visually identical without duplicating SVG markup. Strip the
    // hover-only .contact-card-name and tag with .header-overlay-card
    // so CSS can disable hover-expand (user explicitly asked for no
    // hover behavior here). Cloned SVGs keep their internal IDs (e.g.
    // <clipPath id="cardClipBehance">), which would collide with the
    // originals — namespace them per clone so url(#…) refs resolve.
    const overlayCards = document.getElementById('headerOverlayCards');
    const sourceCards  = document.querySelectorAll('#contactCards .contact-card');
    if (overlayCards && sourceCards.length && !overlayCards.children.length) {
        sourceCards.forEach((src, idx) => {
            const clone = src.cloneNode(true);
            clone.removeAttribute('id');
            clone.classList.add('header-overlay-card');
            const name = clone.querySelector('.contact-card-name');
            if (name) name.remove();
            uniquifySvgIds(clone, '-mm' + idx);
            overlayCards.appendChild(clone);
        });
    }

    const links = overlay.querySelectorAll('[data-burger-link]');
    // All glitchable inner spans inside the overlay — nav links, contact
    // detail rows, and the "let's go" CTA. Played in sequence on open
    // so mobile users see the effect without needing to hover.
    const glitchTargets = overlay.querySelectorAll('.header-overlay-link .reveal-inner, .header-overlay-cta .reveal-inner');

    const open = () => {
        burger.classList.add('is-open');
        overlay.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true');
        overlay.setAttribute('aria-hidden', 'false');
        if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
        document.body.style.overflow = 'hidden';
        // Stagger the glitch reveal in sync with the CSS slide-in.
        glitchTargets.forEach((el, idx) => {
            setTimeout(() => playGlitchReveal(el), 120 + idx * 80);
        });
    };
    const close = () => {
        burger.classList.remove('is-open');
        overlay.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        overlay.setAttribute('aria-hidden', 'true');
        if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
        document.body.style.overflow = '';
    };

    burger.addEventListener('click', () => {
        if (burger.classList.contains('is-open')) close();
        else open();
    });

    links.forEach(a => a.addEventListener('click', () => {
        // Close first so Lenis is running when the anchor scroll fires.
        close();
    }));

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && burger.classList.contains('is-open')) close();
    });
}

/* ---------- Work project modal -------------------------------------
   Click any .work-panel-cta → open the modal with that project's
   data (looked up by data-project slug in WORK_PROJECTS). The shell
   slides up from below to its 85vh resting position, and JS rebuilds
   the inner scroll content per project so the same shell handles any
   number of images / colour swatches without breaking. Image reveals
   are wired with an IntersectionObserver scoped to the modal's own
   scroller, so they fire as the user scrolls inside the modal. */

const WORK_PROJECTS = {
    locumbridge: {
        title: 'LocumBridge',
        subtitle: 'Revolutionizing Healthcare Staffing',
        tags: ['Branding', 'UX/UI Admin Panel', 'UX/UI Mobile Design', 'Website Design'],
        challenge:
            'The healthcare industry struggles to fill temporary staffing gaps quickly and efficiently, ' +
            'impacting patient care. Finding qualified locum tenens (locums) is crucial during unexpected ' +
            'staff shortages.',
        tools: [
            'assets/technologies/Frame.svg',
            'assets/technologies/fi_5968520.svg',
            'assets/technologies/fi_5968525.svg',
            'assets/technologies/fi_5968482.svg',
            'assets/technologies/fi_5968559.svg'
        ],
        liveUrl: 'https://apps.apple.com/nz/app/locumbridge/id6461689669',
        // Each item: { src, mods? }. mods is an array of layout
        // modifiers — width: 'third' (~33%), 'half' (50%, default),
        // 'wide' (~67%), 'full' (100%); aspect: 'tall', 'pano',
        // 'square'. Mix freely. Add as many as you like — the 6-col
        // grid + grid-auto-flow: dense backfills gaps automatically.
        images: [
            { src: 'assets/work/locumbridge/logo.jpg',          mods: ['half'] },
            { src: 'assets/work/locumbridge/logo2.jpg',         mods: ['half'] },
            { src: 'assets/work/locumbridge/logo3.jpg',         mods: ['full'] },
            { src: 'assets/work/locumbridge/font-family.jpg',   mods: ['wide'] },
            { src: 'assets/work/locumbridge/locums-bridge1.jpg',mods: ['third'] }
        ],
        colors: [
            { name: 'Royal Purple', hex: '#5B127E' },
            { name: 'Light Purple', hex: '#CCADE1' },
            { name: 'Grey',         hex: '#B1B8C0' }
        ],
        imagesAfter: [
            { src: 'assets/work/locumbridge/locums-bridge2.jpg', mods: ['full'] },
            { src: 'assets/work/locumbridge/locums-bridge3.jpg', mods: ['third'] },
            { src: 'assets/work/locumbridge/locums-bridge6.jpg', mods: ['wide'] },
            { src: 'assets/work/locumbridge/locums-bridge5.webp', mods: ['full'] },
            { src: 'assets/work/locumbridge/locums-bridge4.webp', mods: ['full'] }
        ]
    },

    knockknockapp: {
        title: 'Knock Knock',
        subtitle: 'AI-powered networking platform',
        tags: ['Branding', 'UX/UI Mobile Design', 'Motion'],
        challenge:
            'Designing the end-to-end product experience for an AI-powered ' +
            'networking app — from brand identity through marketing motion ' +
            'pieces to the in-product flows that connect people in moments ' +
            'that matter.',
        tools: [
            'assets/technologies/fi_5968705.svg',
            'assets/technologies/fi_5968559.svg',
            'assets/technologies/fi_5968520.svg',
            'assets/technologies/fi_5968472.svg',
            'assets/technologies/claude-color 1.svg'
        ],
        liveUrl: 'https://knockknockapp.ai',
        // Sequence per request:
        //   1. logo1 + logo2 (two columns)
        //   2. kk1 full
        //   3. kk2 full
        //   4. kk3 + kk4 (two columns)
        //   5. KKPromo + MetaAd1 (two videos, two columns)
        //   6. kk5 + kk6 (two columns)
        //   7. kk7 full
        //   8. kk8 full
        images: [
            { src: 'assets/work/knocknockapp/logo1.webp',     mods: ['half'] },
            { src: 'assets/work/knocknockapp/logo2.webp',     mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk1.webp',       mods: ['full'] },
            { src: 'assets/work/knocknockapp/kk13.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk14.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk15.webp',       mods: ['wide'] },
            { src: 'assets/work/knocknockapp/kk16.webp',       mods: ['third'] },
            { src: 'assets/work/knocknockapp/kk2.webp',       mods: ['full'] },
            { src: 'assets/work/knocknockapp/kk3.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk4.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/KKPromo.mp4',   mods: ['wide'] },
            { src: 'assets/work/knocknockapp/MetaAd1.mp4',   mods: ['third'] },
            { src: 'assets/work/knocknockapp/kk5.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk6.webp',       mods: ['half'] },
            { src: 'assets/work/knocknockapp/kk7.webp',       mods: ['full'] },
            { src: 'assets/work/knocknockapp/kk8.webp',       mods: ['full'] }
        ],
        // Primary palette — pulled from kk10.jpg. Update the hex
        // codes below to match the colours shown in that source.
        colors: [
            { name: 'Brand Primary',   hex: '#163236' },
            { name: 'Brand Secondary', hex: '#2F2F2F' },
            { name: 'Accent',          hex: '#2FEAE2' }
        ],
        // After the colours strip — kk11 + kk12 in two columns.
        imagesAfter: [
            { src: 'assets/work/knocknockapp/kk11.webp', mods: ['full'] },
            { src: 'assets/work/knocknockapp/kk12.webp', mods: ['full'] }
        ]
    },

    tautoko: {
        title: 'Tautoko',
        subtitle: 'Te Reo Māori — language fundamentals',
        tags: ['Branding', 'Mobile App Design', 'Web Admin', 'Logo Design'],
        challenge:
            'An educational initiative introducing the fundamental elements ' +
            'of Te Reo Māori. The brand had to feel warm, approachable, and ' +
            'rooted in Māori visual identity while still working as a modern ' +
            'digital learning experience.',
        tools: [
            'assets/technologies/fi_5968705.svg',
            'assets/technologies/fi_5968559.svg',
            'assets/technologies/fi_5968472.svg',
            'assets/technologies/Visual_Studio_Icon_2022 1.svg'
            
        ],
        liveUrl: 'https://play.google.com/store/apps/details?id=com.tautoko.app&hl=en_NZ',
        images: [
            { src: 'assets/work/tautoko/logo1.webp',       mods: ['half'] },
            { src: 'assets/work/tautoko/logo2.webp',       mods: ['half'] },
            { src: 'assets/work/tautoko/logo3.webp',       mods: ['full'] },
            { src: 'assets/work/tautoko/font-family.webp', mods: ['full'] }
        ],
        colors: [
            { name: 'Primary',   hex: '#F18823' },
            { name: 'Secondary', hex: '#1996F4' },
            { name: 'Accent',     hex: '#280D32' },
            { name: 'Other',    hex: '#D10D24' }
        ],
        imagesAfter: [
            { src: 'assets/work/tautoko/tt1.webp', mods: ['third'] },
            { src: 'assets/work/tautoko/tt2.webp', mods: ['wide'] },
            { src: 'assets/work/tautoko/tt5.webp', mods: ['half'] },
            { src: 'assets/work/tautoko/tt4.webp', mods: ['half'] },
            { src: 'assets/work/tautoko/tt3.webp', mods: ['full'] }
        ]
    },

    orbit: {
        title: 'Kiwi Website Design',
        subtitle: 'Web design + digital marketing agency',
        tags: ['Branding', 'Web Design', 'Logo Design', 'Digital Marketing'],
        challenge:
            'Building a digital home for a New Zealand web + marketing agency. ' +
            'The brand needed to feel approachable to small-business owners ' +
            'while still reading as a confident, capable studio — a clean ' +
            'wordmark, a primary/secondary/accent palette borrowed from the ' +
            'logo dots, and a marketing site that turns service categories ' +
            'into clear, scannable stories.',
        tools: [
            'assets/technologies/fi_5968705.svg',
            'assets/technologies/fi_5968559.svg',
            'assets/technologies/fi_5968520.svg',
            'assets/technologies/fi_5968472.svg'
        ],
        liveUrl: 'https://kiwiwebsitedesign.nz/',
        images: [
            { src: 'assets/work/kiwiwebsitedesign/kwd2.webp', mods: ['full'] },
            { src: 'assets/work/kiwiwebsitedesign/kwd3.webp', mods: ['full'] },
            { src: 'assets/work/kiwiwebsitedesign/kwd4.webp', mods: ['third'] },
            { src: 'assets/work/kiwiwebsitedesign/kwd5.webp', mods: ['wide'] },
            { src: 'assets/work/kiwiwebsitedesign/kwd1.webp', mods: ['half'] },
            { src: 'assets/work/kiwiwebsitedesign/kwd6.webp', mods: ['half'] },
            { src: 'assets/work/kiwiwebsitedesign/logo-1.webp', mods: ['half'] },
            { src: 'assets/work/kiwiwebsitedesign/logo-2.webp', mods: ['half'] },
            { src: 'assets/work/kiwiwebsitedesign/logo-3.webp', mods: ['full'] },
            { src: 'assets/work/kiwiwebsitedesign/logo-4.webp', mods: ['full'] }
        ],
        colors: [
            { name: 'Primary',   hex: '#E53935' },
            { name: 'Secondary', hex: '#F5C518' },
            { name: 'Accent',    hex: '#1976D2' },
            { name: 'Wordmark',  hex: '#000000' }
        ],
        imagesAfter: [
            { src: 'assets/work/kiwiwebsitedesign/branding-1.webp', mods: ['full'] }
        ]
    },

    'email-branding': {
        title: 'Logos + Emails & Branding',
        subtitle: 'Selected logos and identity work',
        tags: ['Logo Design', 'Branding', 'Identity Systems', 'Email Marketing'],
        challenge:
            'A curated set of identity systems spanning wellness, healthcare, ' +
            'and lifestyle clients — each logo built around a single visual idea, ' +
            'then carried into a full brand palette so it could scale from a ' +
            'business card to a hero billboard without losing character.',
        tools: [
            'assets/technologies/fi_5968705.svg',
            'assets/technologies/fi_5968559.svg',
            'assets/technologies/fi_5968520.svg',
            'assets/technologies/fi_5968472.svg'
        ],
        liveUrl: '',
        sections: [
            {
                eyebrow: 'Massage Eden',
                images: [
                    { src: 'assets/work/selected-logos/me-1.webp', mods: ['half'] },
                    { src: 'assets/work/selected-logos/me-2.webp', mods: ['half'] },
                    { src: 'assets/work/selected-logos/me-3.webp', mods: ['half'] },
                    { src: 'assets/work/selected-logos/me-4.webp', mods: ['half'] }
                ],
                colors: [
                    { name: 'Primary',   hex: '#87AE73' },
                    { name: 'Secondary', hex: '#000000' },
                    { name: 'Accent', hex: '#FAF0DC' },
                    { name: 'Other',    hex: '#B2B2B2' }
                ],
                imagesAfter: [
                    { src: 'assets/work/selected-logos/me-5.webp', mods: ['full'] },
                    { src: 'assets/work/selected-logos/me-6.webp', mods: ['full'] }
                ]
            },
            {
                eyebrow: 'RHB+ Laboratories',
                images: [
                    { src: 'assets/work/selected-logos/rhb-1.webp',  mods: ['full'] },
                    { src: 'assets/work/selected-logos/rhb-1a.webp', mods: ['half'] },
                    { src: 'assets/work/selected-logos/rhb-2.webp',  mods: ['half'] },
                    { src: 'assets/work/selected-logos/rbh-3.webp',  mods: ['full'] },
                    { src: 'assets/work/selected-logos/rbh-4.webp',  mods: ['half'] },
                    { src: 'assets/work/selected-logos/rbh-5.webp',  mods: ['half'] }
                ],
                colors: [
                    { name: 'Primary',   hex: '#F39322' },
                    { name: 'Secondary', hex: '#4D4D4F' },
                    { name: 'Accent',    hex: '#939393' }
                ],
                imagesAfter: [
                    { src: 'assets/work/selected-logos/rhb-6.webp', mods: ['full'] },
                    { src: 'assets/work/selected-logos/rhb-7.webp', mods: ['full'] }
                ]
            }
        ]
    }
};

// Pick black/white text against a hex bg for legible swatch labels.
function pickContrastColor(hex) {
    const m = hex.replace('#', '');
    const v = m.length === 3
        ? m.split('').map((c) => c + c).join('')
        : m;
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    // Relative luminance per WCAG.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? '#111111' : '#ffffff';
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderProjectModal(slug) {
    const data = WORK_PROJECTS[slug];
    const scroll = document.getElementById('workModalScroll');
    if (!scroll) return null;

    if (!data) {
        scroll.innerHTML =
            '<div style="padding:40px;color:#111;font-size:14px">' +
            'Project details for "<strong>' + escapeHtml(slug) +
            '</strong>" are coming soon.</div>';
        return null;
    }

    const tagsHtml = (data.tags || [])
        .map((t) => '<li>' + escapeHtml(t) + '</li>').join('');

    const toolsHtml = (data.tools || [])
        .map((s) => '<img src="' + escapeHtml(s) + '" alt="" loading="lazy">').join('');

    function imageHtmlBlock(arr) {
        if (!arr || !arr.length) return '';
        const tiles = arr.map((item) => {
            const mods = (item.mods || [])
                .map((m) => 'is-' + m).join(' ');
            const cls = mods ? ' ' + mods : '';
            const src = escapeHtml(item.src);
            // Auto-detect video by file extension; render <video> with
            // autoplay/loop/muted/playsinline so it behaves like a
            // self-running clip alongside the still images.
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(item.src);
            const inner = isVideo
                ? '<video src="' + src + '" autoplay loop muted playsinline></video>'
                : '<img src="' + src + '" alt="" loading="lazy">';
            return '<div class="work-modal-image' + cls + '">' + inner + '</div>';
        }).join('');
        return '<div class="work-modal-images">' + tiles + '</div>';
    }
    const imagesHtml      = imageHtmlBlock(data.images);
    const imagesAfterHtml = imageHtmlBlock(data.imagesAfter);

    function colorsHtmlBlock(arr) {
        if (!arr || !arr.length) return '';
        const tiles = arr.map((c) => {
            const fg = pickContrastColor(c.hex);
            return '<div class="work-modal-color" ' +
                'style="background:' + c.hex + ';color:' + fg + ';">' +
                '<span class="name">' + escapeHtml(c.name) + '</span>' +
                '<span class="hex">' + escapeHtml(c.hex) + '</span>' +
                '</div>';
        }).join('');
        return '<div class="work-modal-colors">' + tiles + '</div>';
    }
    const colorsHtml = colorsHtmlBlock(data.colors);

    // Projects can either use the legacy flat shape (images / colors /
    // imagesAfter) or a `sections` array of { eyebrow?, images?, colors? }
    // — used when a project covers MULTIPLE sub-brands that each need
    // their own image grid + palette (see email-branding).
    let bodyHtml = '';
    if (Array.isArray(data.sections) && data.sections.length) {
        bodyHtml = data.sections.map((sec) => {
            const eyebrow = sec.eyebrow
                ? '<div class="work-modal-section-eyebrow">' + escapeHtml(sec.eyebrow) + '</div>'
                : '';
            return '<section class="work-modal-section">' +
                eyebrow +
                imageHtmlBlock(sec.images) +
                colorsHtmlBlock(sec.colors) +
                imageHtmlBlock(sec.imagesAfter) +
            '</section>';
        }).join('');
    } else {
        bodyHtml = imagesHtml +
            colorsHtml +
            imagesAfterHtml;
    }

    scroll.innerHTML =
        '<header class="work-modal-header">' +
            '<h2 class="work-modal-title" id="workModalTitle">' + escapeHtml(data.title) + '</h2>' +
            '<ul class="work-modal-tags">' + tagsHtml + '</ul>' +
            (data.subtitle ? '<p class="work-modal-subtitle">' + escapeHtml(data.subtitle) + '</p>' : '') +
        '</header>' +
        '<div class="work-modal-meta">' +
            '<div class="work-modal-meta-block">' +
                '<span class="work-modal-meta-label">Challenge</span>' +
                '<p class="work-modal-meta-text">' + escapeHtml(data.challenge || '') + '</p>' +
            '</div>' +
            (toolsHtml ?
                '<div class="work-modal-meta-block">' +
                    '<span class="work-modal-meta-label">My Tools</span>' +
                    '<div class="work-modal-tools">' + toolsHtml + '</div>' +
                '</div>'
                : '<div></div>') +
            (data.liveUrl ?
                '<a class="work-modal-live" href="' + escapeHtml(data.liveUrl) +
                '" target="_blank" rel="noopener">' +
                    '<span>View Live</span>' +
                    '<svg class="work-modal-live-arrow" width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                        '<path d="M14.0035 8.23725L6.47236 15.7684L5.23511 14.5311L12.7653 7H6.12848V5.25H15.7535V14.875H14.0035V8.23725Z" fill="currentColor"/>' +
                    '</svg>' +
                '</a>'
                : '') +
        '</div>' +
        bodyHtml +
        '<div class="work-modal-end">' +
            '<p>Continue exploring my work</p>' +
            '<button class="work-modal-end-btn" type="button" data-modal-close>View Other Projects</button>' +
        '</div>';

    return scroll;
}

let modalImageObserver = null;
let modalColorObserver = null;

// Lenis-style smooth scroll state for the modal scroller. Lives only
// while the modal is open. `target` is updated by the wheel listener
// (see setupWorkModal); the rAF loop eases `current` toward `target`
// and writes scrollTop. lerpFactor lower = slower / smoother.
let modalSmoothScroll = null;

function startModalSmoothScroll(scroll) {
    if (!scroll || modalSmoothScroll) return;
    // Touch / coarse-pointer devices use native momentum scrolling. The
    // rAF loop below writes scrollTop every frame, which on iOS overrides
    // finger drags and snaps the modal back to its last wheel-set target.
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    modalSmoothScroll = {
        scroll,
        target:  scroll.scrollTop,
        current: scroll.scrollTop,
        raf: 0,
        lerpFactor: 0.12
    };
    const tick = () => {
        if (!modalSmoothScroll) return;
        const s = modalSmoothScroll;
        const diff = s.target - s.current;
        s.current += diff * s.lerpFactor;
        // Snap when residual is sub-pixel — avoids forever-tiny ticks.
        if (Math.abs(diff) < 0.4) s.current = s.target;
        s.scroll.scrollTop = s.current;
        s.raf = requestAnimationFrame(tick);
    };
    modalSmoothScroll.raf = requestAnimationFrame(tick);
}

function stopModalSmoothScroll() {
    if (!modalSmoothScroll) return;
    if (modalSmoothScroll.raf) cancelAnimationFrame(modalSmoothScroll.raf);
    modalSmoothScroll = null;
}

/* Modal image load-in — each <img> starts scaled up (1.2) and faded
   out; when its wrapper enters the modal viewport an IntersectionObserver
   plays a one-shot zoom-out + fade-in via GSAP. No scroll-tied scrubbing
   — the animation runs once on first appearance and then stays put. */
function setupModalImageReveals(scroll) {
    if (!scroll || typeof gsap === 'undefined') return;

    if (modalImageObserver) {
        modalImageObserver.disconnect();
        modalImageObserver = null;
    }

    const wraps = scroll.querySelectorAll('.work-modal-image');
    if (!wraps.length) return;

    // Park each inner image / video at scale 1.2 and opacity 0 — both
    // wraps visible (so layout doesn't shift), media themselves hidden
    // and zoomed in until their wrapper crosses into view.
    wraps.forEach((wrap) => {
        const media = wrap.querySelector('img, video');
        if (media) gsap.set(media, { scale: 1.2, opacity: 0 });
    });

    modalImageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const media = entry.target.querySelector('img, video');
            if (media) {
                gsap.to(media, {
                    scale: 1,
                    opacity: 1,
                    duration: 1.1,
                    ease: 'power3.out'
                });
            }
            modalImageObserver.unobserve(entry.target);
        });
    }, { root: scroll, threshold: 0.15 });

    wraps.forEach((wrap) => modalImageObserver.observe(wrap));
}

/* Modal brand-colour reveal — when the .work-modal-colors row enters
   the modal viewport, each swatch tile rises up from below the row
   (yPercent: 100 → 0) with a left-to-right stagger. The parent
   .work-modal-colors has overflow: hidden so the off-position tiles
   are clipped, and there's no scroll-tied scrubbing — the reveal is
   a one-shot load-in like the image zooms. */
function setupModalColorReveals(scroll) {
    if (!scroll || typeof gsap === 'undefined') return;

    if (modalColorObserver) {
        modalColorObserver.disconnect();
        modalColorObserver = null;
    }

    const wrap = scroll.querySelector('.work-modal-colors');
    if (!wrap) return;
    const tiles = wrap.querySelectorAll('.work-modal-color');
    if (!tiles.length) return;

    gsap.set(tiles, { yPercent: 100, opacity: 0 });

    modalColorObserver = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        gsap.to(tiles, {
            yPercent: 0,
            opacity: 1,
            duration: 0.95,
            stagger: 0.12,
            ease: 'power3.out'
        });
        modalColorObserver.unobserve(entries[0].target);
    }, { root: scroll, threshold: 0.25 });

    modalColorObserver.observe(wrap);
}

function openWorkModal(slug) {
    const modal = document.getElementById('workModal');
    if (!modal) return;
    const scroll = renderProjectModal(slug);
    if (scroll) scroll.scrollTop = 0;

    const curtain1 = modal.querySelector('.work-modal-curtain--1');
    const curtain2 = modal.querySelector('.work-modal-curtain--2');

    document.body.classList.add('is-modal-open');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    // Pause Lenis so wheel/touch events fall through to native handling
    // — the modal's internal `.work-modal-scroll` (overflow-y: auto)
    // then receives them and scrolls. Without this, Lenis swallows the
    // wheel event and tries to scroll the (locked) body.
    if (window.lenis && typeof window.lenis.stop === 'function') {
        window.lenis.stop();
    }

    if (typeof gsap !== 'undefined') {
        const tl = gsap.timeline();

        // Park all three layers off-screen below.
        tl.set([curtain1, curtain2, scroll], { yPercent: 110 });

        // Layer 1 — red curtain rises first.
        tl.to(curtain1, {
            yPercent: 0,
            duration: 0.5,
            ease: 'power3.out'
        });

        // Layer 2 — black curtain rises just behind.
        tl.to(curtain2, {
            yPercent: 0,
            duration: 0.5,
            ease: 'power3.out'
        }, '-=0.3');

        // Layer 3 — white content scroll rises over both curtains.
        // onComplete clears the transform GSAP leaves behind. Safari
        // refuses to scroll an overflow:auto element while it has any
        // transform applied (even identity translate3d(0,0,0)) — the
        // wheel/trackpad just no-ops. Stripping the transform once the
        // entrance settles restores native + custom smooth scrolling.
        tl.to(scroll, {
            yPercent: 0,
            duration: 0.6,
            ease: 'power3.out',
            onComplete: () => {
                gsap.set(scroll, { clearProps: 'transform' });
            }
        }, '-=0.3');

        // Inner content sections stagger in from below as the white
        // panel finishes its rise. Excludes .work-modal-live — it
        // stays at its natural rendered state so the bold "View Live"
        // link is always visible.
        const sections = scroll.querySelectorAll(
            '.work-modal-header > *, .work-modal-meta > .work-modal-meta-block'
        );
        if (sections.length) {
            tl.from(sections, {
                y: 30,
                opacity: 0,
                duration: 0.5,
                stagger: 0.07,
                ease: 'power3.out'
            }, '-=0.35');
        }
    } else {
        modal.style.transform = 'translateY(0)';
    }

    // Wait a frame so the modal is laid out before we wire IO reveals.
    requestAnimationFrame(() => {
        setupModalImageReveals(scroll);
        setupModalColorReveals(scroll);
        startModalSmoothScroll(scroll);
    });
}

function closeWorkModal() {
    const modal = document.getElementById('workModal');
    if (!modal) return;
    const curtain1 = modal.querySelector('.work-modal-curtain--1');
    const curtain2 = modal.querySelector('.work-modal-curtain--2');
    const scroll   = document.getElementById('workModalScroll');

    if (typeof gsap !== 'undefined') {
        // Reverse the layered reveal — content scroll sinks first,
        // curtains follow.
        const tl = gsap.timeline({
            onComplete: () => {
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('is-modal-open');
                if (window.lenis && typeof window.lenis.start === 'function') {
                    window.lenis.start();
                }
                // Disconnect IntersectionObservers so they don't hold
                // references between opens.
                if (modalImageObserver) {
                    modalImageObserver.disconnect();
                    modalImageObserver = null;
                }
                if (modalColorObserver) {
                    modalColorObserver.disconnect();
                    modalColorObserver = null;
                }
                // Stop the modal-scroll rAF loop.
                stopModalSmoothScroll();
            }
        });
        tl.to(scroll,   { yPercent: 110, duration: 0.4, ease: 'power3.in' });
        tl.to(curtain2, { yPercent: 110, duration: 0.4, ease: 'power3.in' }, '-=0.25');
        tl.to(curtain1, { yPercent: 110, duration: 0.4, ease: 'power3.in' }, '-=0.25');
    } else {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('is-modal-open');
        if (window.lenis && typeof window.lenis.start === 'function') {
            window.lenis.start();
        }
    }
}

function setupWorkModal() {
    const modal = document.getElementById('workModal');
    if (!modal) return;
    const scroll = document.getElementById('workModalScroll');

    // Park the inner curtains + scroll off-screen below the modal's
    // bounding box so the first open animates from a clean state. The
    // shell itself stays at top: 5vh — only visibility toggles.
    if (typeof gsap !== 'undefined') {
        const curtain1 = modal.querySelector('.work-modal-curtain--1');
        const curtain2 = modal.querySelector('.work-modal-curtain--2');
        gsap.set([curtain1, curtain2, scroll], { yPercent: 110 });
    }

    // Custom Lenis-style smooth scrolling for the modal. The page
    // Lenis is paused while the modal is open (see openWorkModal),
    // and a rAF loop here eases the modal scroller's `scrollTop`
    // toward a wheel-driven `target` value — same idea as Lenis but
    // scoped to this one element. State lives in `modalSmoothScroll`
    // and is started/stopped in open/closeWorkModal.
    if (scroll) {
        scroll.addEventListener('wheel', (e) => {
            // Always stop bubbling so page Lenis (or any global
            // listener) never sees these events.
            e.stopPropagation();
            if (!modalSmoothScroll) return;
            // Take ownership of the scroll motion.
            e.preventDefault();
            modalSmoothScroll.target = Math.max(0, Math.min(
                modalSmoothScroll.target + e.deltaY,
                scroll.scrollHeight - scroll.clientHeight
            ));
        }, { passive: false });

        // Touch — let native handle it, but stop bubbling.
        scroll.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    // Delegated click handler — listens at the document level so it
    // catches clicks on .work-panel-cta no matter when the panels
    // are inserted, transformed, or restyled. Using `closest()` walks
    // up from whatever inner span was actually clicked (icon / text /
    // arrow) to the .work-panel-cta anchor, then opens its project.
    document.addEventListener('click', (e) => {
        const cta = e.target.closest('.work-panel-cta');
        if (cta) {
            e.preventDefault();
            const slug = cta.dataset.project || 'locumbridge';
            openWorkModal(slug);
            return;
        }
        // Close X / "View Other Projects" pill / [data-modal-close]
        if (e.target.closest('#workModalClose, [data-modal-close]')) {
            closeWorkModal();
        }
    });

    // Esc closes when modal is open.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            closeWorkModal();
        }
    });
}

/* ---------- Nav scroll-spy + smooth-scroll on click ----------
   Watches scroll position to flag whichever menu link's target
   section is currently in view (`.is-active` → bright white). Click
   on a link smooth-scrolls to the target via Lenis when present;
   falls back to native anchor scrolling otherwise.
     • #workIntro  covers work-intro + work-stage
     • #aboutIntro covers about-intro + about (bio + experience)
     • #contact    is fixed at the bottom; flagged when the user is
                   within ~half a viewport of the bottom of the page. */
function setupNavScrollSpy() {
    const links = document.querySelectorAll('.nav-link');
    if (!links.length) return;

    // Smooth scroll on click via Lenis (if loaded). Native anchor
    // scrolling still works when Lenis isn't there.
    links.forEach((link) => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            const target = document.querySelector(href);
            if (!target || !window.lenis) return;
            e.preventDefault();
            window.lenis.scrollTo(target);
        });
    });

    function update() {
        const y    = window.scrollY;
        const vh   = window.innerHeight;
        const docH = document.documentElement.scrollHeight;

        let activeHref = null;

        // Near bottom → contact is being revealed.
        if (y + vh > docH - vh * 0.5) {
            activeHref = '#contact';
        } else {
            // Use a probe at 40% viewport height — feels natural for
            // "the section the user is reading right now".
            const probe = y + vh * 0.4;

            // ABOUT — active across both about-intro AND about (bio +
            // experience). Link points at #about (the actual section,
            // not its intro).
            const aboutIntro = document.getElementById('aboutIntro');
            const aboutEl    = document.getElementById('about');
            if (aboutIntro && aboutEl) {
                const top    = aboutIntro.offsetTop;
                const bottom = aboutEl.offsetTop + aboutEl.offsetHeight;
                if (probe >= top && probe < bottom) activeHref = '#about';
            }

            // WORK — active across both work-intro AND work-stage.
            // Link points at #workStage (the panel scroller).
            if (!activeHref) {
                const workIntro = document.getElementById('workIntro');
                const workStage = document.getElementById('workStage');
                if (workIntro && workStage) {
                    const top    = workIntro.offsetTop;
                    const bottom = workStage.offsetTop + workStage.offsetHeight;
                    if (probe >= top && probe < bottom) activeHref = '#workStage';
                }
            }
        }

        links.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === activeHref);
        });
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
}

/* ---------- Hero NZ text ↔ flag auto-cycle ----------------
   The secondary heading's NZ slot alternates between the words
   "New Zealand" and the flag chip. On each cycle:
     1. The text is scrambled in-place for ~400ms (no resolve)
     2. Text is hidden, flag is shown, GSAP plays the elastic pop
     3. After ~2s the flag is hidden, text is shown and decoded via
        the standard playGlitchReveal scramble-decode
     4. After ~2s the loop repeats indefinitely
   The flag's regular hover-elastic still works (setupHeroFlagHover
   is unchanged) — this just runs on top automatically.            */
function setupHeroNzCycle() {
    const wrap = document.getElementById('heroNz');
    if (!wrap || typeof gsap === 'undefined') return;
    const textEl = wrap.querySelector('.hero-nz-text');
    const flagEl = wrap.querySelector('.hero-flag');
    if (!textEl || !flagEl) return;

    const ORIGINAL = 'New Zealand';
    textEl.dataset.glitchOriginal = ORIGINAL;
    textEl.textContent = ORIGINAL;

    // Initial state — text visible, flag hidden.
    flagEl.style.display = 'none';
    textEl.style.display = 'inline-block';

    function playFlagElastic() {
        gsap.timeline()
            .to(flagEl, {
                scaleX: 1.35,
                scaleY: 0.78,
                rotate: -6,
                duration: 0.18,
                ease: 'power2.out'
            })
            .to(flagEl, {
                scaleX: 1,
                scaleY: 1,
                rotate: 0,
                duration: 1.1,
                ease: 'elastic.out(1, 0.35)'
            });
    }

    // Pure-scramble (no resolve). Used to "noise out" the text just
    // before swapping in the flag. Calls cb when finished.
    function scrambleOut(durationMs, cb) {
        const len = ORIGINAL.length;
        let elapsed = 0;
        const FRAME = 32;
        const tick = setInterval(() => {
            elapsed += FRAME;
            const out = new Array(len);
            for (let i = 0; i < len; i++) {
                const c = ORIGINAL[i];
                out[i] = (c === ' ')
                    ? c
                    : GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0];
            }
            textEl.textContent = out.join('');
            if (elapsed >= durationMs) {
                clearInterval(tick);
                textEl.textContent = ORIGINAL;   // restore for next cycle
                if (cb) cb();
            }
        }, FRAME);
    }

    let cancelled = false;

    function loop() {
        if (cancelled) return;
        // 1. Hold text for a beat, then scramble out and swap to flag.
        setTimeout(() => {
            if (cancelled) return;
            scrambleOut(420, () => {
                if (cancelled) return;
                textEl.style.display = 'none';
                flagEl.style.display = 'inline-block';
                playFlagElastic();

                // 2. Flag stays for a beat, then swap back via decode.
                setTimeout(() => {
                    if (cancelled) return;
                    flagEl.style.display = 'none';
                    textEl.style.display = 'inline-block';
                    playGlitchReveal(textEl, {
                        stagger: 28, frame: 32, delay: 30
                    });
                    const len = ORIGINAL.length;
                    const decodeMs = 30 + len * 28 + 140;
                    setTimeout(loop, decodeMs + 1500);
                }, 1800);
            });
        }, 1500);
    }

    loop();
}

/* ---------- Contact cards: hover-to-expand with glitch name reveal
   Each card is a fixed-size square at rest with the icon centered.
   On mouseenter, GSAP grows the card BOTH wider (to fit the platform
   name) and taller (room for the icon-on-top + name-below layout) —
   meanwhile CSS handles the icon's slide to the top of the card and
   the name's fade in, and playGlitchReveal scrambles the name like
   the nav-link hovers do. The expanded dimensions are measured once
   up-front using a hidden temp span so repeated hovers don't reflow. */
function setupContactCards() {
    const cards = document.querySelectorAll('.contact-card');
    if (!cards.length || typeof gsap === 'undefined') return;

    cards.forEach((card) => {
        const nameEl = card.querySelector('.contact-card-name');
        if (!nameEl) return;

        // Resting (collapsed) dimensions — whatever CSS set.
        const collapsedWidth  = card.offsetWidth;
        const collapsedHeight = card.offsetHeight;

        // The name is position: absolute so it doesn't affect the
        // card's offsetWidth; measure its natural width via a hidden
        // inline clone styled identically.
        const cs = getComputedStyle(nameEl);
        const probe = document.createElement('span');
        probe.textContent = nameEl.textContent;
        probe.style.cssText =
            'position:absolute;visibility:hidden;white-space:nowrap;' +
            'font-size:'      + cs.fontSize      + ';' +
            'font-weight:'    + cs.fontWeight    + ';' +
            'letter-spacing:' + cs.letterSpacing + ';' +
            'font-family:'    + cs.fontFamily    + ';';
        document.body.appendChild(probe);
        const nameWidth = probe.offsetWidth;
        document.body.removeChild(probe);

        // On hover only WIDTH changes — height stays at the resting
        // value so the box doesn't grow taller. Icon-top + name-below
        // fit inside the same fixed height (CSS controls their
        // positions on :hover).
        const expandedWidth  = Math.max(collapsedWidth + 120, nameWidth + 56);
        const expandedHeight = collapsedHeight;

        // Lock resting dimensions so GSAP has numeric start values.
        gsap.set(card, { width: collapsedWidth, height: collapsedHeight });

        let tl = null;

        card.addEventListener('mouseenter', () => {
            if (tl) tl.kill();
            tl = gsap.timeline();
            tl.to(card, {
                width:  expandedWidth,
                height: expandedHeight,
                duration: 0.55,
                ease: 'power3.out'
            });
            tl.call(() => playGlitchReveal(nameEl, {
                stagger: 28, frame: 32, delay: 30
            }), null, 0.2);
        });

        card.addEventListener('mouseleave', () => {
            if (tl) tl.kill();
            tl = gsap.timeline();
            tl.to(card, {
                width:  collapsedWidth,
                height: collapsedHeight,
                duration: 0.4,
                ease: 'power3.inOut'
            });
        });
    });
}

/* ---------- About: Download Resume button reveal --------------
   Slide-up + fade in for the CV button when the about section's bio
   block scrolls into view. The hidden state is set via gsap.set (not
   CSS) so the button is always painted visible if JS or the trigger
   never runs — no permanent invisibility. */
function initAboutCvButton() {
    const btn = document.getElementById('aboutCvBtn');
    if (!btn || typeof gsap === 'undefined') return;

    gsap.set(btn, { y: 30, opacity: 0 });

    ScrollTrigger.create({
        trigger: btn,
        start: 'top 90%',
        once: true,
        onEnter: () => {
            gsap.to(btn, {
                y: 0,
                opacity: 1,
                duration: 0.9,
                ease: 'power3.out'
            });
        }
    });
}

/* ---------- Header scroll behaviour -----------------------
   Two scroll-driven states:
     • `.is-scrolled` — fades in the frosted-glass scrim once past a
       small threshold.
     • `.is-hidden`   — translates the whole header out of view while
       the user is scrolling DOWN, restores it when scrolling UP and
       when scrolling stops.
   "Stopped" is detected by a debounced timer: if no scroll events
   fire for ~180ms, the header re-shows. Near the top of the page
   (y < HIDE_FROM) the header always stays visible. */
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    const SCRIM_FROM   = 40;     // scrollY past which the glass scrim shows
    const HIDE_FROM    = 120;    // scrollY past which auto-hide kicks in
    const DIR_DEAD     = 2;      // px change to register a direction
    const STOP_MS      = 180;    // idle-time before "stopped" shows header

    let scrolled = false;
    let hidden   = false;
    let lastY    = window.scrollY;
    let stopTimer;

    const setHidden = (val) => {
        if (val !== hidden) {
            hidden = val;
            header.classList.toggle('is-hidden', val);
        }
    };

    const update = () => {
        const y = window.scrollY;
        const dy = y - lastY;

        // Glass scrim
        const nowScrolled = y > SCRIM_FROM;
        if (nowScrolled !== scrolled) {
            scrolled = nowScrolled;
            header.classList.toggle('is-scrolled', scrolled);
        }

        // Visibility — only auto-hide once we're past HIDE_FROM
        if (y < HIDE_FROM) {
            setHidden(false);
        } else if (dy > DIR_DEAD) {
            setHidden(true);          // scrolling down
        } else if (dy < -DIR_DEAD) {
            setHidden(false);         // scrolling up
        }

        lastY = y;

        // "Stopped" → show. Reset on every scroll event, fires when
        // the listener has been quiet for STOP_MS.
        clearTimeout(stopTimer);
        stopTimer = setTimeout(() => setHidden(false), STOP_MS);
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
}

/* ---------- Scroll-velocity mouse indicator -------------------
   The fixed bottom-right mouse icon's red wheel drifts in sync with
   the scroll direction: down when the user scrolls down, up when up,
   easing back to centre when motion stops. We read Lenis's `velocity`
   each frame, clamp & dampen it to a small SVG-unit offset, and apply
   it as the inner <g>'s y-translate. The framing — Lenis exposes
   velocity that's positive on downward scroll and decays naturally to
   zero — means we don't need a separate "is still" check; when the
   user stops scrolling, velocity → 0 and the dot returns to centre. */
function initMouseScrollIndicator() {
    const dot = document.getElementById('mouseScrollDot');
    if (!dot || typeof gsap === 'undefined') return;

    const MAX_OFFSET = 18;     // SVG units (viewBox is 0–288 tall)
    const VEL_TO_OFFSET = 0.5; // velocity → offset gain
    const FOLLOW = 0.18;       // ease-toward-target factor per frame

    const setY = gsap.quickSetter(dot, 'y', '');
    let currentY = 0;

    gsap.ticker.add(() => {
        const v = (window.lenis && typeof window.lenis.velocity === 'number')
            ? window.lenis.velocity
            : 0;
        let target = v * VEL_TO_OFFSET;
        if (target >  MAX_OFFSET) target =  MAX_OFFSET;
        if (target < -MAX_OFFSET) target = -MAX_OFFSET;

        currentY += (target - currentY) * FOLLOW;
        // Snap tiny residuals to 0 so the dot truly rests when idle.
        if (Math.abs(currentY) < 0.05 && Math.abs(target) < 0.05) currentY = 0;

        setY(currentY);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractiveHovers);
} else {
    initInteractiveHovers();
}
