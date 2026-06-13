/** @type {import('tailwindcss').Config} */
// ^ This special comment tells the code editor that the object below is a Tailwind
//   configuration. It enables auto-complete and type checking while we edit this file.

// This file is the central "design settings" for the whole frontend.
// Tailwind is a styling tool: instead of writing custom CSS, we use ready-made
// class names (like "p-4" or "text-ink"). Everything we define below becomes a
// reusable class we can apply directly in the React components.
module.exports = {
  // "content" tells Tailwind WHERE to look for the classes we actually use.
  // It scans every .js / .jsx file inside src, plus the main index.html.
  // This lets Tailwind delete any unused styles so the final website stays small/fast.
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],

  // "theme" is where we describe our design language: colors, spacing, fonts, etc.
  theme: {
    // "extend" means: KEEP all of Tailwind's built-in defaults, and ADD our own
    // custom values on top. (If we did NOT use extend, we would erase the defaults.)
    extend: {
      // ----------------------------------------------------------------------
      // SPACING: extra sizing steps for padding/margin/width/height.
      // Tailwind already has many sizes; here we add the "in-between" ones it lacks.
      // The key (e.g. '13') becomes the class name, the value is the real CSS size.
      // 1rem = 16px, so these are just precise pixel-perfect spacing options.
      // ----------------------------------------------------------------------
      spacing: {
        '4.5': '1.125rem', // 18px – a half-step between Tailwind's 4 (16px) and 5 (20px)
        '5.5': '1.375rem', // 22px – half-step between 5 (20px) and 6 (24px)
        '13': '3.25rem',   // 52px
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '26': '6.5rem',    // 104px
        '30': '7.5rem',    // 120px
      },

      // ----------------------------------------------------------------------
      // FONT FAMILIES: the typefaces (font styles) used across the site.
      // Each entry becomes a class, e.g. "font-outfit" or "font-plex".
      // The second value ('sans-serif') is a fallback if the main font fails to load.
      // ----------------------------------------------------------------------
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],          // main modern font for general text
        head: ['Outfit', 'sans-serif'],            // same font, named "head" for headings
        plex: ['"IBM Plex Sans"', 'sans-serif'],   // secondary font (IBM Plex Sans)
      },

      // ----------------------------------------------------------------------
      // COLORS: our full color palette.
      // Each name becomes usable as text color ("text-ink"), background ("bg-brand-600"),
      // border ("border-line"), etc. Values are hex codes (#RRGGBB).
      // ----------------------------------------------------------------------
      colors: {
        // Text / neutral ink
        ink: '#0F172A',                // primary dark text color (near-black navy)
        inkhover: '#1E293B',           // slightly lighter dark, used on hover states
        canvas: '#F8FAFC',             // the page background (very light grey)
        surface: '#FFFFFF',            // pure white, used for cards/panels
        'surface-2': '#F8FAFC',        // a second, faintly grey surface for contrast
        'surface-elevated': '#FFFFFF', // white surface for "raised" elements
        line: '#E4E7F2',               // default border / divider line color (light)
        'line-strong': '#CBD0E8',      // a darker border for stronger separation
        muted: '#64748B',              // muted grey for secondary/less-important text
        'muted-light': '#94A3B8',      // even lighter grey for hints/placeholders

        // Deep blue brand (academic trust)
        // A full shade scale from 50 (lightest) to 900 (darkest).
        // This is our main identity color – blue suggests trust/education.
        brand: {
          50:  '#EFF6FF', // lightest – subtle backgrounds/tints
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6', // the "main" brand blue
          600: '#2563EB', // common button color
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A', // darkest – deep navy
        },

        // STATUS COLORS: each one signals the state of a borrow request,
        // so the user instantly understands the situation by color.
        status: {
          pending:   '#F59E0B', // amber/orange – waiting for approval
          borrowed:  '#10B981', // green – item successfully borrowed
          cancelled: '#EF4444', // red – request was cancelled
          overdue:   '#EF4444', // red – item is late / past due date
          completed: '#3B82F6', // blue – request finished/closed
          available: '#10B981', // green – item is free to borrow
        },

        // Semantic elevation surfaces (for depth layering)
        // Used to fake "height" – higher elevation = lighter/different background,
        // which helps stacked elements feel separated.
        elevation: {
          1: '#FFFFFF', // base layer (white)
          2: '#F8FAFC', // one step up (slight grey)
          3: '#EFF6FF', // higher up (faint blue tint)
        },
      },

      // ----------------------------------------------------------------------
      // BOX SHADOWS: pre-made shadow styles to give elements depth.
      // Each becomes a class like "shadow-card" or "shadow-glow".
      // The numbers are: x-offset y-offset blur spread color(with transparency).
      // rgba(...) the 4th value (e.g. 0.06) is opacity – how see-through the shadow is.
      // ----------------------------------------------------------------------
      boxShadow: {
        // Base layers – normal, neutral shadows for cards and surfaces
        soft:    '0 2px 8px rgba(15,23,42,0.06)',                                            // very light, subtle lift
        card:    '0 1px 2px rgba(15,23,42,0.04), 0 12px 28px -16px rgba(15,23,42,0.16)',     // standard card shadow (two layers)
        'card-hover': '0 2px 4px rgba(15,23,42,0.06), 0 20px 40px -16px rgba(15,23,42,0.24)', // stronger shadow when hovering a card
        pop:     '0 24px 60px -24px rgba(15,23,42,0.30)',                                     // big shadow for popovers/modals
        float:   '0 8px 32px -8px rgba(15,23,42,0.22)',                                       // for floating elements
        elevated:'0 32px 80px -32px rgba(15,23,42,0.38)',                                     // the most "lifted" / highest shadow

        // Brand glows – colored shadows that make elements appear to glow
        glow:    '0 10px 30px -8px rgba(37,99,235,0.45)',     // blue glow (brand color)
        'glow-sm':'0 6px 18px -6px rgba(37,99,235,0.38)',     // small blue glow
        'glow-lg':'0 16px 48px -12px rgba(37,99,235,0.55)',   // large blue glow
        'glow-warm':'0 10px 30px -8px rgba(245,158,11,0.45)', // amber/warm glow
        'glow-success':'0 10px 30px -8px rgba(16,185,129,0.40)', // green glow (success)
        'glow-danger':'0 10px 30px -8px rgba(239,68,68,0.40)',   // red glow (danger/error)

        // Inner shadows – the shadow sits INSIDE the element (note "inset"),
        // giving a slightly pressed / recessed look.
        'inner-brand':'inset 0 1px 3px rgba(30,58,138,0.15)', // subtle blue inner shadow
        'inner-soft': 'inset 0 1px 2px rgba(15,23,42,0.06)',  // subtle neutral inner shadow
      },

      // ----------------------------------------------------------------------
      // BORDER RADIUS: how rounded the corners of elements are.
      // Each becomes a class like "rounded-4xl". Bigger value = rounder corners.
      // Tailwind already has small/medium sizes; here we add larger ones.
      // ----------------------------------------------------------------------
      borderRadius: {
        '2.5xl': '1.25rem', // 20px
        '4xl':   '2rem',    // 32px
        '5xl':   '2.5rem',  // 40px
        '6xl':   '3rem',    // 48px
      },

      // ----------------------------------------------------------------------
      // BACKGROUND IMAGES: reusable gradients (smooth color blends) and overlays.
      // "linear-gradient" blends colors in a straight line (135deg = diagonal).
      // "radial-gradient" blends outward from a point (like a glow/spotlight).
      // Each becomes a class like "bg-brand-gradient".
      // ----------------------------------------------------------------------
      backgroundImage: {
        'brand-gradient':   'linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)',                         // diagonal blue→navy (main brand gradient)
        'brand-glow':       'radial-gradient(120% 120% at 0% 0%, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)', // soft blue glow from top-left
        'brand-warm':       'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',                         // blue→purple
        'brand-cool':       'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',                         // blue→cyan
        'success-gradient': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',                         // green gradient (success states)
        'danger-gradient':  'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',                         // red gradient (errors/danger)
        'amber-gradient':   'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',                         // amber/orange gradient (warnings)
        'dark-gradient':    'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',                         // dark navy gradient (dark sections)
        // "mesh" gradients layer several soft radial glows for a modern, textured background:
        'mesh-brand':       'radial-gradient(at 40% 20%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(37,99,235,0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(30,58,138,0.10) 0px, transparent 50%)', // multi-spot blue glow background
        'mesh-warm':        'radial-gradient(at 40% 20%, rgba(245,158,11,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(217,119,6,0.12) 0px, transparent 50%)', // multi-spot warm/amber glow background
        // "hero-overlay" is a dark fade placed over hero images so white text stays readable:
        'hero-overlay':     'linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.12) 100%)',  // dark-to-clear fade going upward
        'hero-overlay-lg':  'linear-gradient(to top, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.55) 45%, transparent 100%)',         // stronger version of the same fade
        'card-shine':       'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)',              // a diagonal white streak used for a "shine" sweep effect
      },

      // ----------------------------------------------------------------------
      // KEYFRAMES: the step-by-step definitions of animations.
      // A keyframe describes HOW an element looks at different moments in time
      // (0% = start, 100% = end). Below in "animation" we attach timing/speed.
      // Common values:
      //   opacity   = how visible (0 = invisible, 1 = fully visible)
      //   transform = movement/size: translateX/Y (slide), scale (size), rotate (spin)
      // ----------------------------------------------------------------------
      keyframes: {
        // Fade in while sliding UP slightly (content gently rising into view)
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' }, // start: invisible, 10px lower
          '100%': { opacity: '1', transform: 'translateY(0)' },    // end: visible, in place
        },
        // Fade in while sliding DOWN slightly
        'fade-down': {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' }, // start: invisible, 10px higher
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Simple fade from invisible to visible (no movement)
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // "Pop" in: grows from slightly small, overshoots a touch, then settles (bouncy feel)
        'pop-in': {
          '0%':   { opacity: '0', transform: 'scale(0.92)' }, // start small + invisible
          '60%':  { transform: 'scale(1.03)' },               // briefly a bit bigger than normal
          '100%': { opacity: '1', transform: 'scale(1)' },    // settle at normal size
        },
        // Gentle scale-in (subtler than pop-in, no overshoot)
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Slide in from the RIGHT while fading in
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(24px)' }, // start 24px to the right
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Slide in from the LEFT while fading in
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' }, // start 24px to the left
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Slide up + fade + slight grow (combined entrance effect)
        'slide-up-fade': {
          '0%':   { opacity: '0', transform: 'translateY(20px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // A line that travels top→bottom (like a scanner/loading effect)
        'scan-line': {
          '0%':   { top: '0%' },
          '100%': { top: '100%' },
        },
        // Shimmer: slides a highlight across (often used for loading skeletons)
        shimmer: {
          '100%': { transform: 'translateX(100%)' }, // moves fully to the right
        },
        // Softer shimmer that moves a background highlight left→right
        'shimmer-soft': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      
      
      
        // Float: gently moves up and back down forever (subtle hovering motion)
        float: {
          '0%,100%': { transform: 'translateY(0)' },     // at start & end: in place
          '50%':     { transform: 'translateY(-8px)' },  // mid-point: lifted 8px up
        },
        // A more organic float that also tilts slightly while bobbing
        'float-gentle': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '33%':     { transform: 'translateY(-4px) rotate(0.5deg)' },
          '66%':     { transform: 'translateY(-2px) rotate(-0.5deg)' },
        },
        // Pulse: fades opacity in and out (gentle "breathing" attention effect)
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.45' },
        },
        // Branded pulse: an expanding blue ring of shadow that fades out (ripple)
        'pulse-brand': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.4)' },   // tight, visible ring
          '50%':     { boxShadow: '0 0 0 8px rgba(37,99,235,0)' },   // expanded, fully faded
        },
        // Pans a gradient background left↔right (used with animated gradients)
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        // A ring that grows outward and fades (notification/attention pop)
        'ring-pop': {
          '0%':   { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        // A gentle bounce; the cubic-bezier values control the easing feel of each half
        'bounce-gentle': {
          '0%,100%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
          '50%':     { transform: 'translateY(-6px)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
        },
        // Slowly rotates a full circle (good for spinners/decorative spin)
        'rotate-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }, // 360deg = one full turn
        },
        // Tilt back and forth slightly (playful wobble)
        'tilt': {
          '0%,100%': { transform: 'rotate(-1deg)' },
          '50%':     { transform: 'rotate(1deg)' },
        },
        // Draws an SVG circle outline (used for animated progress/check rings).
        // strokeDashoffset animates the visible length of the line from hidden to full.
        'draw-circle': {
          '0%':   { strokeDashoffset: '283' }, // 283 ≈ circumference, so line is hidden
          '100%': { strokeDashoffset: '0' },   // fully drawn
        },
        // Starting state for a "trust ring" SVG outline (begins hidden)
        'trust-ring': {
          '0%':   { strokeDashoffset: '283' },
        },
        // A quick scale bump used when a counter/number updates (draws the eye)
        'count-pulse': {
          '0%,100%': { transform: 'scale(1)' },
          '50%':     { transform: 'scale(1.12)' },
        },
        // Notification "ping": expands and fades (like the ring around a new alert)
        'notification-ping': {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        // "Ken Burns" effect: slowly zooms/pans a hero image for a cinematic feel
        'hero-ken-burns': {
          '0%':   { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.08) translate(-1%, -1%)' }, // slight zoom + drift
        },
        // Moves a shiny gradient across text/elements (shine sweep)
        'shine': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        // A waving-hand style rotation (used for friendly greeting icons)
        'wave': {
          '0%':   { transform: 'rotate(0deg)' },
          '20%':  { transform: 'rotate(14deg)' },
          '40%':  { transform: 'rotate(-8deg)' },
          '60%':  { transform: 'rotate(14deg)' },
          '80%':  { transform: 'rotate(-4deg)' },
          '100%': { transform: 'rotate(10deg)' },
        },
      },




      
      // ----------------------------------------------------------------------
      // ANIMATION: ties each keyframe (above) to timing settings, creating a class.
      // Format: 'keyframe-name  duration  easing  fill/repeat'.
      //   duration   = how long one cycle takes (s = seconds)
      //   easing     = speed curve (ease, linear, or a custom cubic-bezier)
      //   infinite   = repeat forever; "both"/"alternate" control fill & direction
      // Example: use "animate-fade-up" in a component to apply the fade-up animation.
      // ----------------------------------------------------------------------
      animation: {
        'fade-up':         'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',       // smooth rise-in, plays once
        'fade-down':       'fade-down 0.35s cubic-bezier(0.22,1,0.36,1) both',     // smooth drop-in, plays once
        'fade-in':         'fade-in 0.3s ease both',                               // quick fade-in
        'pop-in':          'pop-in 0.32s cubic-bezier(0.22,1,0.36,1) both',        // bouncy pop entrance
        'scale-in':        'scale-in 0.28s cubic-bezier(0.22,1,0.36,1) both',      // gentle grow-in
        'scan-line':       'scan-line 2s ease-in-out infinite alternate',         // scanner line, loops back & forth
       
        shimmer:           'shimmer 1.6s infinite',                               // loading shimmer, repeats
        'shimmer-soft':    'shimmer-soft 2.4s linear infinite',                   // slow continuous shimmer
        'slide-in-right':  'slide-in-right 0.35s cubic-bezier(0.22,1,0.36,1) both', // enter from right
        'slide-in-left':   'slide-in-left 0.35s cubic-bezier(0.22,1,0.36,1) both',  // enter from left
        'slide-up-fade':   'slide-up-fade 0.4s cubic-bezier(0.22,1,0.36,1) both',   // combined slide-up + fade
       
        float:             'float 6s ease-in-out infinite',                       // endless gentle bob
        'float-gentle':    'float-gentle 8s ease-in-out infinite',                // slower, tilting bob
        'pulse-soft':      'pulse-soft 1.8s ease-in-out infinite',                // fading "breathing" pulse
        'pulse-brand':     'pulse-brand 2s ease-in-out infinite',                 // expanding blue ring pulse
        'gradient-pan':    'gradient-pan 8s ease infinite',                       // animated moving gradient
        'ring-pop':        'ring-pop 1s ease-out infinite',                       // repeating outward ring
        'bounce-gentle':   'bounce-gentle 1.4s infinite',                         // soft repeating bounce
        'rotate-slow':     'rotate-slow 12s linear infinite',                     // slow endless spin
       
        tilt:              'tilt 3s ease-in-out infinite',                        // repeating wobble
        'count-pulse':     'count-pulse 0.3s ease',                               // one quick bump (on number change)
        'notif-ping':      'notification-ping 1.2s ease-out infinite',            // repeating notification ping
        'hero-ken-burns':  'hero-ken-burns 14s ease-in-out infinite alternate',   // slow cinematic zoom, back & forth
       
        shine:             'shine 2.4s linear infinite',                          // repeating shine sweep
       
        wave:              'wave 1.5s ease-in-out',                               // waving hand, plays once
        'draw-circle':     'draw-circle 1s cubic-bezier(0.22,1,0.36,1) both',     // draws the SVG circle once
      },

      // ----------------------------------------------------------------------
      // TRANSITION TIMING FUNCTIONS: named "speed curves" for transitions.
      // A timing function controls how fast/slow a change happens over time.
      // cubic-bezier(...) is a custom curve; these give our motion a consistent feel.
      // Use as classes like "ease-spring".
      // ----------------------------------------------------------------------
      transitionTimingFunction: {
        'ease-spring':   'cubic-bezier(0.22, 1, 0.36, 1)',    // fast then settles smoothly (springy)
        'ease-overshoot':'cubic-bezier(0.34, 1.56, 0.64, 1)', // goes slightly past then back (bouncy)
        'ease-smooth':   'cubic-bezier(0.4, 0, 0.2, 1)',      // standard balanced smooth curve
      },

      // ----------------------------------------------------------------------
      // BACKDROP BLUR: extra small blur amounts for "frosted glass" effects
      // (blurring whatever is BEHIND an element). Used with backdrop-blur classes.
      // ----------------------------------------------------------------------
      backdropBlur: {
        xs: '2px',   // very small blur
        '2xs': '1px', // even smaller blur
      },
    },
  },

  // "plugins" is where extra Tailwind add-ons would go. We are not using any,
  // so this list is intentionally empty.
  plugins: [],
};
