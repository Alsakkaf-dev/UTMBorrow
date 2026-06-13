// Shared Framer Motion variants & transitions — premium, consistent feel.
// Import these instead of redefining animations per-component, so motion stays uniform.

// ───────────────────────── Easing curves ──────────────────────────
// cubic-bezier control points reused as the `ease` value in transitions
export const easeOut      = [0.22, 1, 0.36, 1];      // fast start, gentle settle (default)
export const easeSmooth   = [0.4, 0, 0.2, 1];        // balanced, no overshoot (exits)
export const easeOvershoot= [0.34, 1.56, 0.64, 1];   // shoots past then back (bouncy)

// ───────────────────────── Spring presets ─────────────────────────
// Physics-based transitions; higher stiffness = snappier, higher damping = less bounce
export const spring      = { type: "spring", stiffness: 380, damping: 30, mass: 0.7 }; // default
export const softSpring  = { type: "spring", stiffness: 220, damping: 26 };            // gentle/loose
export const snappySpring= { type: "spring", stiffness: 500, damping: 36, mass: 0.6 }; // quick, tight
export const bouncySpring= { type: "spring", stiffness: 300, damping: 20, mass: 0.8 }; // visible bounce
export const slowSpring  = { type: "spring", stiffness: 160, damping: 24 };            // slow, heavy

// ───────────────────────── Page transitions ───────────────────────
// Variant shape (Framer Motion): `initial` = before mount, `animate` = visible,
// `exit` = while unmounting. Same convention applies to every variant below.
export const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: easeOut } },
  exit:    { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.2, ease: easeSmooth } },
};

// Directional page variants (for navigating between routes)
export const pageSlideLeft = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: easeOut } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.22, ease: easeSmooth } },
};
export const pageSlideRight = {
  initial: { opacity: 0, x: -32 },
  animate: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: easeOut } },
  exit:    { opacity: 0, x: 20,  transition: { duration: 0.22, ease: easeSmooth } },
};

// ───────────────────────── Stagger containers ─────────────────────
// Put on a parent so children animate one after another (staggerChildren = gap between each)
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};
export const staggerFast = {
  animate: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};
export const staggerSlow = {
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

// ───────────────────────── List items ─────────────────────────────
// Child variants for staggered lists: rise = fade up, slide = fade in from the side
export const riseItem = {
  initial: { opacity: 0, y: 18, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.4, ease: easeOut } },
  exit:    { opacity: 0, scale: 0.96,         transition: { duration: 0.18 } },
};
export const riseItemFast = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.28, ease: easeOut } },
  exit:    { opacity: 0,                      transition: { duration: 0.14 } },
};

// Cards floating in from the side (horizontal lists)
export const slideItem = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0,  transition: { duration: 0.36, ease: easeOut } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.18 } },
};

// ───────────────────────── Hero / header sections ─────────────────
export const heroVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};
export const heroChild = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: easeOut } },
};

// ───────────────────────── Scale / pop ────────────────────────────
export const popIn = {
  initial: { opacity: 0, scale: 0.88 },
  animate: { opacity: 1, scale: 1, transition: { ...bouncySpring } },
  exit:    { opacity: 0, scale: 0.92, transition: { duration: 0.15 } },
};
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: easeOut } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.18 } },
};
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

// ───────────────────────── Tap / hover feedback ───────────────────
// Pass to whileTap / whileHover props. tap* shrink on press; liftHover* raise on hover
export const tap      = { scale: 0.97 };
export const tapSmall = { scale: 0.96 };
export const tapMicro = { scale: 0.98 };
export const liftHover= { y: -4, transition: spring };
export const liftHoverSm = { y: -2, transition: softSpring };

// ───────────────────────── Modal / sheet ─────────────────────────
export const sheetVariants = {                 // bottom sheet: slides up from below
  initial: { opacity: 0, y: 48, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.34, ease: easeOut } },
  exit:    { opacity: 0, y: 28, scale: 0.97, transition: { duration: 0.22 } },
};
export const backdropVariants = {              // dim overlay behind a modal/sheet
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};
export const drawerVariants = {                // side panel sliding in from the right
  initial: { x: "100%", opacity: 0.6 },
  animate: { x: 0, opacity: 1, transition: { ...spring } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.24, ease: easeSmooth } },
};
export const drawerLeftVariants = {            // same, but from the left
  initial: { x: "-100%", opacity: 0.6 },
  animate: { x: 0, opacity: 1, transition: { ...spring } },
  exit:    { x: "-100%", opacity: 0, transition: { duration: 0.24, ease: easeSmooth } },
};

// ───────────────────────── Accordion / expand ─────────────────────
// Animates open/closed by tweening height to/from "auto" (collapsible sections)
export const expandVariants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { duration: 0.28, ease: easeOut } },
  exit:    { height: 0, opacity: 0, transition: { duration: 0.2,  ease: easeSmooth } },
};

// ───────────────────────── Count-up number ────────────────────────
export const numberVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { ...snappySpring } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};
