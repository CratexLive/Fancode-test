class FootXCrateUI extends HTMLElement {
  #root;
  #playerInstance = null;
  #shakaInstance = null;
  #engineStarted = false;
  #audioCtx = null;
  #animId = null;

  static get observedAttributes() {
    return ['stream-url', 'clearkey-id', 'clearkey-val'];
  }

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'closed' });
  }

  async connectedCallback() {
    await this.#render();
    this.#initConstellationField();
    this.#bindInteractions();
    this.#runBootSequence();
  }

  disconnectedCallback() {
    if (this.#animId) cancelAnimationFrame(this.#animId);
    if (this.#playerInstance) this.#playerInstance.destroy();
    if (this.#shakaInstance) this.#shakaInstance.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue && oldValue !== newValue && this.#shakaInstance && name === 'stream-url') {
      this.#reloadStream();
    }
  }

  async #render() {
    let plyrSvg = '';
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.svg');
      plyrSvg = await res.text();
    } catch (e) {
      console.warn('Could not load Plyr icons into Shadow DOM:', e);
    }

    this.#root.innerHTML = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700;800;900&family=Syne:wght@700;800;900&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css">

      <style>
        :host {
          /* UEFA Champions League Nocturne Palette */
          --primary-rgb: 0, 240, 255;          /* Electric Cyan */
          --secondary-rgb: 0, 102, 255;        /* Starball Royal Blue */
          --ucl-deep-rgb: 5, 12, 38;           /* Deep Midnight Navy */
          --accent: rgb(var(--primary-rgb));
          --accent-secondary: rgb(var(--secondary-rgb));
          --accent-glow: rgba(var(--primary-rgb), 0.45);
          --accent-glow-intense: rgba(var(--primary-rgb), 0.85);
          --accent-glow-subtle: rgba(var(--primary-rgb), 0.12);
          --bg-pure: #030712;
          --bg-card: rgba(8, 16, 36, 0.76);
          --bg-glass: rgba(10, 22, 50, 0.65);
          --border-glass: rgba(0, 240, 255, 0.14);
          --border-glass-bright: rgba(0, 240, 255, 0.32);
          --text-pure: #ffffff;
          --text-main: #f0f6fc;
          --text-muted: #8ba2c4;
          --text-dark: #3a4b68;
          --btn-main-bg: #00f0ff;
          --btn-main-text: #020617;
          --player-shadow: 0 45px 120px -20px rgba(0, 20, 60, 0.95);
          --hud-bg: rgba(4, 10, 26, 0.88);
          --plyr-color-main: var(--accent);

          display: block;
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          background: radial-gradient(circle at 50% 0%, rgba(0, 102, 255, 0.22) 0%, transparent 65%), var(--bg-pure);
          color: var(--text-main);
          overflow-x: hidden;
          font-size: clamp(13px, 0.75vw + 0.5rem, 20px);
        }

        :host([data-theme="light"]) {
          --accent: #0066ff;
          --accent-glow: rgba(0, 102, 255, 0.25);
          --accent-glow-intense: rgba(0, 102, 255, 0.55);
          --bg-pure: #f2f6fc;
          --bg-card: rgba(255, 255, 255, 0.92);
          --bg-glass: rgba(255, 255, 255, 0.85);
          --border-glass: rgba(0, 102, 255, 0.15);
          --border-glass-bright: rgba(0, 102, 255, 0.28);
          --text-pure: #050b1a;
          --text-main: #0c1833;
          --text-muted: #4e6282;
          --text-dark: #899ab4;
          --btn-main-bg: #0066ff;
          --btn-main-text: #ffffff;
          --hud-bg: rgba(255, 255, 255, 0.92);
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        #starGridCanvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          opacity: 0.85;
          will-change: transform;
        }

        .noise-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0.03;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .container {
          width: min(1500px, 94vw);
          margin: 0 auto;
          padding: 0 0 clamp(50px, 6vw, 120px);
          position: relative;
          z-index: 10;
        }

        /* UCL Match Intro Overlay */
        .ucl-boot-screen {
          position: fixed;
          inset: 0;
          z-index: 100000;
          background: radial-gradient(circle at 50% 35%, #081636 0%, #020612 85%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 3vh, 36px) clamp(16px, 3vw, 40px);
          opacity: 1;
          visibility: visible;
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.5s ease;
          overflow-y: auto;
        }

        .ucl-boot-screen.fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .boot-hud-card {
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 36px);
          margin-bottom: clamp(16px, 3.5vh, 40px);
          padding: clamp(8px, 1.5vh, 14px) clamp(16px, 2.5vw, 30px);
          border-radius: 16px;
          background: rgba(8, 16, 40, 0.75);
          border: 1px solid var(--border-glass-bright);
          box-shadow: 0 16px 45px rgba(0, 10, 30, 0.8), inset 0 0 20px rgba(0, 240, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          max-width: 95vw;
        }

        .hud-stat-box { display: flex; flex-direction: column; align-items: center; }
        .hud-stat-lbl {
          font-family: 'DM Mono', monospace;
          font-size: clamp(7px, 0.7vw, 10px);
          letter-spacing: 2px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .hud-stat-val {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(14px, 1.8vw, 24px);
          font-weight: 800;
          color: #fff;
        }
        .hud-stat-val.accent {
          color: var(--accent);
          text-shadow: 0 0 12px var(--accent-glow);
        }

        .ucl-stage-stars { display: flex; gap: clamp(3px, 0.5vw, 6px); margin-top: 4px; }
        .ucl-star-node {
          width: clamp(6px, 0.8vw, 10px);
          height: clamp(6px, 0.8vw, 10px);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          background: rgba(255, 255, 255, 0.15);
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .ucl-star-node.on { background: #00f0ff; transform: scale(1.15); box-shadow: 0 0 10px #00f0ff; }

        .ucl-badge-rig {
          position: relative;
          width: clamp(80px, 12vmin, 130px);
          height: clamp(80px, 12vmin, 130px);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: clamp(18px, 3.5vh, 40px);
          flex-shrink: 0;
        }
        .ucl-star-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px dashed rgba(0, 240, 255, 0.45);
          animation: ringSpin 12s linear infinite;
          pointer-events: none;
        }
        .ucl-star-ring.outer {
          inset: -22px;
          border: 1px solid rgba(0, 102, 255, 0.35);
          border-top-color: var(--accent);
          animation: ringSpin 18s linear infinite reverse;
        }
        @keyframes ringSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ucl-badge-aura {
          position: absolute;
          inset: -16px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--accent-glow-intense) 0%, transparent 70%);
          filter: blur(24px);
          animation: auraGlow 2.2s ease-in-out infinite alternate;
        }
        @keyframes auraGlow {
          0% { opacity: 0.35; transform: scale(0.94); }
          100% { opacity: 0.9; transform: scale(1.1); }
        }
        .ucl-inner-img {
          width: 100%;
          height: 100%;
          border-radius: clamp(20px, 3vmin, 34px);
          background: #020718;
          overflow: hidden;
          position: relative;
          z-index: 5;
          border: 1.5px solid var(--border-glass-bright);
          box-shadow: 0 25px 70px rgba(0, 15, 50, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ucl-inner-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .boot-info-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: min(520px, 92vw);
        }
        .boot-kicker {
          font-family: 'DM Mono', monospace;
          font-size: clamp(8px, 0.85vw, 12px);
          color: var(--accent);
          letter-spacing: 3.5px;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .boot-status-text {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(13px, 1.8vw, 22px);
          font-weight: 700;
          letter-spacing: -0.3px;
          color: #fff;
          min-height: 28px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: clamp(14px, 2.5vh, 26px);
        }
        .boot-progress-arena {
          position: relative;
          width: 100%;
          height: 36px;
          display: flex;
          align-items: flex-end;
        }
        .boot-track-rail {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .boot-track-fill {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 0%;
          background: linear-gradient(90deg, transparent, #0066ff 50%, var(--accent) 100%);
          box-shadow: 0 0 16px var(--accent);
          border-radius: 4px;
          will-change: width;
          transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .boot-ball-pointer {
          position: absolute;
          bottom: -7px;
          left: 0%;
          transform: translate3d(-50%, 0, 0);
          display: flex;
          align-items: center;
          will-change: left;
          transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
          z-index: 10;
          filter: drop-shadow(0 0 14px var(--accent));
        }
        .ucl-ball-svg {
          width: clamp(24px, 3.2vw, 34px);
          height: clamp(24px, 3.2vw, 34px);
          animation: ballRotate 1.2s linear infinite;
        }
        @keyframes ballRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Popup Telegram Community */
        .popup-modal-screen {
          position: fixed;
          inset: 0;
          z-index: 99998;
          background: radial-gradient(circle at 50% 30%, rgba(0, 102, 255, 0.25) 0%, rgba(2, 6, 18, 0.98) 75%), #020612;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(24px, 4.5vh, 60px) clamp(16px, 3.5vw, 40px);
          text-align: center;
          opacity: 1;
          visibility: visible;
          transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s ease;
          overflow-y: auto;
        }
        .popup-modal-screen.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .fs-master-badge {
          position: relative;
          width: clamp(80px, 11vmin, 120px);
          height: clamp(80px, 11vmin, 120px);
          margin-bottom: clamp(16px, 3vh, 36px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: badgeFloat 4s ease-in-out infinite alternate;
          flex-shrink: 0;
        }
        @keyframes badgeFloat {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }
        .fs-master-halo {
          position: absolute;
          inset: -14px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--accent-glow-intense) 0%, transparent 70%);
          filter: blur(22px);
        }
        .fs-img-frame {
          width: 100%;
          height: 100%;
          border-radius: clamp(18px, 2.8vmin, 30px);
          background: #020718;
          overflow: hidden;
          position: relative;
          z-index: 2;
          box-shadow: 0 20px 60px rgba(0, 20, 60, 0.85);
          border: 1.5px solid var(--border-glass-bright);
        }
        .fs-img-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fs-master-kicker {
          font-family: 'DM Mono', monospace;
          font-size: clamp(8.5px, 0.8vw, 11.5px);
          color: var(--accent);
          letter-spacing: 3.5px;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: clamp(8px, 1.4vh, 16px);
        }
        .fs-master-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(28px, 5.4vw, 64px);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: clamp(12px, 1.8vh, 20px);
          max-width: 650px;
        }
        .fs-master-desc {
          font-size: clamp(12px, 1.1vw, 16px);
          color: #8da4c4;
          line-height: 1.6;
          max-width: clamp(280px, 86vw, 480px);
          margin: 0 auto clamp(22px, 3.8vh, 38px);
        }
        .fs-action-stack {
          width: min(340px, 88vw);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .fs-btn-apex {
          position: relative;
          width: 100%;
          height: clamp(48px, 6.2vh, 60px);
          border: 0;
          border-radius: 100px;
          background: linear-gradient(135deg, #0066ff 0%, #00f0ff 100%);
          color: #020617;
          font-family: 'Manrope', sans-serif;
          font-size: clamp(11px, 0.9vw, 13.5px);
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 14px 40px var(--accent-glow);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          overflow: hidden;
        }
        .fs-btn-apex:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 60px var(--accent-glow-intense);
          filter: brightness(1.1);
        }
        .fs-btn-apex:active { transform: scale(0.97); }
        .fs-btn-dismiss {
          background: transparent;
          border: 0;
          color: #6d82a3;
          font-family: 'DM Mono', monospace;
          font-size: clamp(8px, 0.75vw, 10px);
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          padding: 8px;
          transition: color 0.2s ease;
        }
        .fs-btn-dismiss:hover { color: #ffffff; }
        .fs-master-footer {
          margin-top: clamp(24px, 4vh, 48px);
          font-family: 'DM Mono', monospace;
          font-size: clamp(7.5px, 0.7vw, 9.5px);
          letter-spacing: 2.5px;
          color: #3e506e;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fs-master-footer span { color: var(--accent); }

        /* Navigation */
        .nav {
          height: clamp(68px, 8.5vh, 96px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 50;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: clamp(8px, 1.2vw, 16px);
          text-decoration: none;
          color: var(--text-main);
        }
        .brand-logo-shell {
          width: clamp(40px, 3.8vw, 52px);
          height: clamp(40px, 3.8vw, 52px);
          border-radius: 14px;
          overflow: hidden;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-glass-bright);
          box-shadow: 0 6px 20px rgba(0, 102, 255, 0.35);
          flex-shrink: 0;
          padding: 4px;
        }
        .brand-logo-shell img { width: 100%; height: 100%; object-fit: contain; }
        .brand-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(15px, 1.35vw, 20px);
          font-weight: 800;
          letter-spacing: -0.4px;
          text-transform: uppercase;
        }
        .brand-title span {
          color: var(--text-muted);
          font-weight: 600;
          font-size: clamp(12px, 1.1vw, 15px);
        }
        .nav-actions { display: flex; align-items: center; gap: clamp(8px, 1vw, 14px); }
        .live-pill-badge {
          height: clamp(32px, 2.8vw, 40px);
          padding: 0 clamp(10px, 1.2vw, 16px);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-card);
          border: 1px solid var(--border-glass);
          backdrop-filter: blur(16px);
          border-radius: 100px;
          color: var(--text-muted);
          font-family: 'DM Mono', monospace;
          font-size: clamp(8px, 0.7vw, 10px);
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .pulsing-live-dot {
          width: 6px;
          height: 6px;
          background: #00f0ff;
          border-radius: 50%;
          box-shadow: 0 0 12px #00f0ff;
          animation: livePulse 1.6s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.75); }
        }
        .nav-join-btn {
          height: clamp(32px, 2.8vw, 40px);
          padding: 0 clamp(14px, 1.4vw, 22px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 100px;
          background: var(--btn-main-bg);
          color: var(--btn-main-text);
          text-decoration: none;
          font-size: clamp(10px, 0.8vw, 12px);
          font-weight: 800;
          letter-spacing: 1px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 18px rgba(0, 240, 255, 0.25);
        }
        .nav-join-btn:hover {
          background: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px var(--accent-glow);
        }

        /* Hero */
        .hero { position: relative; padding: clamp(24px, 4vw, 60px) 0 clamp(16px, 2.8vw, 38px); }
        .hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: 'DM Mono', monospace;
          color: var(--accent);
          font-size: clamp(8.5px, 0.8vw, 11px);
          font-weight: 700;
          letter-spacing: 3.5px;
          text-transform: uppercase;
        }
        .hero-tag::before {
          content: "★";
          color: var(--accent);
          font-size: 11px;
        }
        .hero-headline {
          margin-top: clamp(8px, 1.2vw, 18px);
          font-family: 'Syne', sans-serif;
          font-size: clamp(40px, 8.5vw, 124px);
          line-height: 0.88;
          letter-spacing: -0.05em;
          font-weight: 900;
          text-transform: uppercase;
          color: var(--text-pure);
        }
        .hero-headline .accent-txt {
          background: linear-gradient(135deg, #00f0ff 0%, #0066ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-details {
          margin-top: clamp(14px, 1.6vw, 24px);
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: clamp(8px, 1vw, 12px);
          color: var(--text-muted);
          font-family: 'DM Mono', monospace;
          font-size: clamp(7.5px, 0.75vw, 10px);
          letter-spacing: 1.6px;
          text-transform: uppercase;
        }
        .hero-details b { color: var(--text-main); font-weight: 600; }
        .meta-separator { width: 3px; height: 3px; border-radius: 50%; background: var(--text-dark); }

        .track-separator-beam {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, var(--accent) 0%, rgba(0, 102, 255, 0.4) 40%, transparent 100%);
          margin-bottom: clamp(14px, 1.8vw, 22px);
        }

        /* Player Box */
        .player-rig-box {
          width: 100%;
          aspect-ratio: 16/9;
          position: relative;
          background: #000;
          overflow: hidden;
          border-radius: clamp(14px, 2vw, 28px);
          border: 1px solid var(--border-glass-bright);
          box-shadow: var(--player-shadow);
          isolation: isolate;
        }
        .player-rig-box::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00f0ff, transparent);
          opacity: 0.9;
          z-index: 12;
        }
        video#player {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }
        .player-hud-overlay {
          position: absolute;
          left: clamp(10px, 1.8vw, 24px);
          right: clamp(10px, 1.8vw, 24px);
          top: clamp(10px, 1.8vw, 22px);
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }
        .hud-cluster { display: flex; align-items: center; gap: 8px; }
        .hud-pill-data {
          height: clamp(24px, 2.2vw, 32px);
          padding: 0 clamp(8px, 1vw, 14px);
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          background: var(--hud-bg);
          border: 1px solid var(--border-glass);
          backdrop-filter: blur(14px);
          font-family: 'DM Mono', monospace;
          font-size: clamp(7px, 0.65vw, 9.5px);
          color: var(--text-muted);
          letter-spacing: 1.2px;
          text-decoration: none;
        }
        .hud-pill-data.live { color: var(--text-main); font-weight: 600; }
        .hud-pill-data.live i {
          width: 5px;
          height: 5px;
          background: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--accent);
        }
        .hud-pill-data.clickable-wm {
          pointer-events: auto;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(0, 240, 255, 0.35);
          background: rgba(8, 20, 48, 0.85);
          color: #fff;
          font-weight: 700;
        }
        .hud-pill-data.clickable-wm:hover {
          background: var(--accent);
          color: #020617;
          border-color: var(--accent);
          box-shadow: 0 0 16px var(--accent-glow);
          transform: translateY(-1px);
        }

        .player-meta-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: clamp(14px, 1.6vw, 22px) 4px 0;
          flex-wrap: wrap;
        }
        .stream-title-group { display: flex; align-items: center; gap: 12px; }
        .channel-thumb {
          width: clamp(34px, 3vw, 44px);
          height: clamp(34px, 3vw, 44px);
          background: #000;
          border: 1px solid var(--border-glass);
          border-radius: 10px;
          padding: 3px;
        }
        .channel-thumb img { width: 100%; height: 100%; object-fit: contain; }
        .stream-title-group strong {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(15px, 1.3vw, 20px);
          font-weight: 700;
          letter-spacing: -0.4px;
        }
        .share-action-btn {
          height: clamp(38px, 3.2vw, 46px);
          padding: 0 clamp(18px, 1.8vw, 28px);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 100px;
          background: linear-gradient(135deg, var(--bg-card) 0%, rgba(0, 240, 255, 0.16) 100%);
          border: 1px solid var(--accent);
          color: var(--text-main);
          font-family: 'DM Mono', monospace;
          font-size: clamp(8px, 0.75vw, 10.5px);
          font-weight: 600;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          cursor: pointer;
          backdrop-filter: blur(16px);
          box-shadow: 0 6px 25px var(--accent-glow);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .share-action-btn svg { width: 14px; height: 14px; stroke: var(--accent); stroke-width: 2.2; }
        .share-action-btn:hover {
          background: var(--accent);
          color: #020617;
          transform: translateY(-2px);
          box-shadow: 0 12px 35px var(--accent-glow);
        }
        .share-action-btn:hover svg { stroke: #020617; }

        /* Community */
        .community { margin-top: clamp(48px, 7vw, 100px); position: relative; }
        .comm-tag {
          font-family: 'DM Mono', monospace;
          color: var(--accent);
          font-size: clamp(10px, 0.9vw, 13px);
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          margin-bottom: clamp(14px, 2vh, 22px);
        }
        .community-body { display: flex; flex-direction: column; gap: clamp(20px, 3vh, 32px); }
        .comm-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(34px, 6.2vw, 68px);
          line-height: 0.96;
          letter-spacing: -0.055em;
          font-weight: 800;
          color: var(--text-pure);
        }
        .comm-heading span { display: block; color: var(--text-dark); }
        .comm-btn-prime {
          width: 100%;
          height: clamp(52px, 6.5vh, 64px);
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 100px;
          background: linear-gradient(135deg, #00f0ff 0%, #0066ff 100%);
          color: #020617;
          text-decoration: none;
          font-family: 'Manrope', sans-serif;
          font-size: clamp(11.5px, 0.9vw, 13.5px);
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 30px rgba(0, 102, 255, 0.35);
        }
        .comm-btn-prime:hover {
          filter: brightness(1.15);
          transform: translateY(-2px);
          box-shadow: 0 12px 35px var(--accent-glow);
        }

        .footer {
          margin-top: clamp(48px, 6vw, 80px);
          padding: 20px 0 calc(30px + env(safe-area-inset-bottom));
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--text-dark);
          font-family: 'DM Mono', monospace;
          font-size: clamp(7.5px, 0.65vw, 9.5px);
          letter-spacing: 1.6px;
          text-transform: uppercase;
        }
        .footer strong { color: var(--text-muted); }

        /* Mode Switch */
        .theme-switch-deck {
          position: fixed;
          right: clamp(14px, 2.2vw, 30px);
          bottom: clamp(14px, 2.2vw, 30px);
          z-index: 900;
          background: var(--bg-card);
          border: 1px solid var(--border-glass-bright);
          border-radius: 100px;
          backdrop-filter: blur(24px);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
          padding: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .mode-toggle-btn {
          height: clamp(28px, 2.4vw, 36px);
          padding: 0 clamp(10px, 1vw, 14px);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 0;
          background: transparent;
          color: var(--text-muted);
          font-family: 'DM Mono', monospace;
          font-size: clamp(7.5px, 0.65vw, 9px);
          font-weight: 500;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mode-toggle-btn i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .mode-toggle-btn.active {
          background: var(--accent);
          color: #020617;
          box-shadow: 0 4px 18px var(--accent-glow);
        }
        .mode-toggle-btn.active i { background: #020617; }

        .hidden-sprite { display: none; }

        @media (max-width: 680px) {
          .live-pill-badge { display: none; }
          .hud-cluster.hide-mobile { display: none; }
          .theme-switch-deck { right: 50%; transform: translateX(50%); bottom: 12px; }
        }
      </style>

      <div class="hidden-sprite">${plyrSvg}</div>

      <canvas id="starGridCanvas"></canvas>
      <div class="noise-overlay"></div>

      <!-- UCL Stadium Match Sequence Overlay -->
      <aside class="ucl-boot-screen" id="uclBootScreen">
        <div class="boot-hud-card">
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">MATCH NIGHT</span>
            <span class="hud-stat-val accent" id="bootStage">UCL 26</span>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">STARBALL SYNC</span>
            <div class="ucl-stage-stars">
              <div class="ucl-star-node on" id="star1"></div>
              <div class="ucl-star-node on" id="star2"></div>
              <div class="ucl-star-node" id="star3"></div>
              <div class="ucl-star-node" id="star4"></div>
              <div class="ucl-star-node" id="star5"></div>
            </div>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">BITRATE</span>
            <span class="hud-stat-val" id="bootBitrate">1080p 50FPS</span>
          </div>
        </div>

        <div class="ucl-badge-rig">
          <div class="ucl-badge-aura"></div>
          <div class="ucl-star-ring outer"></div>
          <div class="ucl-star-ring"></div>
          <div class="ucl-inner-img">
            <img src="https://files.catbox.moe/crndi2.jpg" alt="FootxCrate UCL Preview" />
          </div>
        </div>

        <div class="boot-info-center">
          <div class="boot-kicker">UEFA CHAMPIONS LEAGUE · BROADCAST RELAY</div>
          <div class="boot-status-text" id="bootStatusText">CONNECTING ENCRYPTED SATELLITE...</div>
          
          <div class="boot-progress-arena">
            <div class="boot-track-rail">
              <div class="boot-track-fill" id="bootProgress"></div>
              
              <div class="boot-ball-pointer" id="bootBallSprite">
                <svg class="ucl-ball-svg" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="16" stroke="#00f0ff" stroke-width="2" fill="#04102c"/>
                  <!-- Starball Pattern -->
                  <polygon points="18,6 21,14 29,14 22,19 25,27 18,22 11,27 14,19 7,14 15,14" fill="#ffffff"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Telegram Community Modal -->
      <div id="tgPopup" class="popup-modal-screen hidden">
        <div class="fs-master-badge">
          <div class="fs-master-halo"></div>
          <div class="fs-img-frame">
            <img src="https://files.catbox.moe/crndi2.jpg" alt="FootxCrate UCL Badge" />
          </div>
        </div>

        <div class="fs-master-kicker">OFFICIAL FOOTXCRATE</div>
        <h2 class="fs-master-heading">The Champions League lives here.</h2>
        <p class="fs-master-desc">Join FootxCrate on Telegram for live HD match feeds, multi-audio streams, goal replays and UCL matchday fixtures.</p>

        <div class="fs-action-stack">
          <button class="fs-btn-apex" id="tgJoinBtn">
            <span>JOIN FOOTXCRATE</span>
          </button>
          <button class="fs-btn-dismiss" id="tgCloseBtn">CONTINUE TO BROADCAST</button>
        </div>

        <div class="fs-master-footer">
          <span>★</span> TNT SPORTS 2 <span>★</span> 1080P PRO <span>★</span> 2026 <span>★</span>
        </div>
      </div>

      <div class="container">
        <header class="nav">
          <a class="brand" id="brandLink" href="#" target="_blank" rel="noopener">
            <div class="brand-logo-shell">
              <img src="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-2-uk.png" alt="TNT Sports 2" />
            </div>
            <div class="brand-title">
              FOOTXCRATE <span>— TNT 2</span>
            </div>
          </a>

          <div class="nav-actions">
            <div class="live-pill-badge">
              <i class="pulsing-live-dot"></i>
              UCL BROADCAST
            </div>
            <a class="nav-join-btn" id="navJoinBtn" href="#" target="_blank" rel="noopener">
              JOIN
            </a>
          </div>
        </header>

        <section class="hero">
          <div class="hero-tag">FOOTXCRATE MATCHDAY</div>
          <h1 class="hero-headline">
            CHAMPIONS<br>
            <span class="accent-txt">LEAGUE.</span>
          </h1>
          <div class="hero-details">
            <b>TNT SPORTS 2 UK</b>
            <span class="meta-separator"></span>
            UEFA CHAMPIONS LEAGUE
            <span class="meta-separator"></span>
            LIVE 50FPS
            <span class="meta-separator"></span>
            EUROPEAN NIGHTS
          </div>
        </section>

        <main class="broadcast">
          <div class="track-separator-beam"></div>

          <div class="player-rig-box" id="playerContainer">
            <div class="player-hud-overlay">
              <div class="hud-cluster">
                <div class="hud-pill-data live"><i></i> LIVE</div>
                <a class="hud-pill-data clickable-wm" id="wmLink" href="#" target="_blank" rel="noopener" title="Join FootxCrate on Telegram">
                  ★ FOOTXCRATE
                </a>
              </div>
              <div class="hud-cluster hide-mobile">
                <div class="hud-pill-data">TNT SPORTS 2 UK</div>
                <div class="hud-pill-data">UCL HIGH-BITRATE FEED</div>
              </div>
            </div>

            <video id="player" playsinline crossorigin="anonymous"></video>
          </div>

          <div class="player-meta-bar">
            <div class="stream-title-group">
              <div class="channel-thumb">
                <img src="https://raw.githubusercontent.com/tv-logo/tv-logos/refs/heads/main/countries/united-kingdom/tnt-sports-2-uk.png" alt="TNT 2 Logo">
              </div>
              <strong>TNT Sports 2 · UEFA Champions League Live</strong>
            </div>

            <button class="share-action-btn" id="btnShare">
              <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
              <span id="shareBtnText">SHARE MATCH</span>
            </button>
          </div>
        </main>

        <section class="community">
          <div class="comm-tag">FOOTXCRATE TELEGRAM</div>
          <div class="community-body">
            <h2 class="comm-heading">
              European nights.
              <span>Every goal in real-time.</span>
            </h2>

            <a class="comm-btn-prime" id="commJoinBtn" href="#" target="_blank" rel="noopener">
              JOIN FOOTXCRATE COMMUNITY
            </a>
          </div>
        </section>

        <footer class="footer">
          <span>© 2026 <strong>FOOTXCRATE</strong></span>
          <span>TNT SPORTS 2 UK · STARBALL EDITION</span>
        </footer>
      </div>

      <aside class="theme-switch-deck">
        <button class="mode-toggle-btn active" id="themeDarkBtn"><i></i> Midnight</button>
        <button class="mode-toggle-btn" id="themeLightBtn"><i></i> Daybreak</button>
      </aside>
    `;
  }

  #getTelegramLink() {
    return this.getAttribute('telegram-link') || 'https://t.me/+td-BEF1c2B1kMjk1';
  }

  #playChimeTone(frequency = 440, duration = 0.28) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.#audioCtx) this.#audioCtx = new AudioContext();
      if (this.#audioCtx.state === 'suspended') this.#audioCtx.resume();

      const osc = this.#audioCtx.createOscillator();
      const gain = this.#audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.#audioCtx.currentTime);
      gain.gain.setValueAtTime(0.03, this.#audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.#audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.#audioCtx.destination);

      osc.start();
      osc.stop(this.#audioCtx.currentTime + duration);
    } catch (e) {}
  }

  #initConstellationField() {
    const canvas = this.#root.getElementById('starGridCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = [];
    const STAR_COUNT = 70;
    let lastFrameTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize, { passive: true });
    resize();

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.8,
        speed: Math.random() * 0.4 + 0.15,
        alpha: Math.random() * 0.7 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005
      });
    }

    const render = (now) => {
      const dt = Math.min((now - lastFrameTime) / 16.67, 2.0);
      lastFrameTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < STAR_COUNT; i++) {
        const star = stars[i];
        star.alpha += Math.sin(now * star.twinkleSpeed) * 0.01;
        const clampedAlpha = Math.max(0.1, Math.min(0.85, star.alpha));

        ctx.fillStyle = `rgba(0, 240, 255, ${clampedAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y -= star.speed * dt;
        if (star.y < 0) {
          star.y = canvas.height;
          star.x = Math.random() * canvas.width;
        }
      }

      this.#animId = requestAnimationFrame(render);
    };
    this.#animId = requestAnimationFrame(render);
  }

  #runBootSequence() {
    const uclBootScreen = this.#root.getElementById("uclBootScreen");
    const bootStatusText = this.#root.getElementById("bootStatusText");
    const bootProgress = this.#root.getElementById("bootProgress");
    const bootBallSprite = this.#root.getElementById("bootBallSprite");
    const bootStage = this.#root.getElementById("bootStage");
    const bootBitrate = this.#root.getElementById("bootBitrate");
    const popup = this.#root.getElementById("tgPopup");

    const matchTelemetry = [
      { pct: 20, text: "UCL SATELLITE BEACON SYNCED", stage: "LINK 1", bitrate: "720p 50FPS", stars: 2, freq: 523.25 },
      { pct: 50, text: "DECRYPTING TNT SPORTS 2 DRM", stage: "DECRYPT", bitrate: "1080p 50FPS", stars: 3, freq: 659.25 },
      { pct: 80, text: "STARBALL MULTI-AUDIO READY", stage: "LIVE-FEED", bitrate: "1080p HEVC", stars: 4, freq: 783.99 },
      { pct: 100, text: "TRANSMISSION LOCKED · MATCHDAY LIVE", stage: "ON-AIR", bitrate: "1080p 50FPS", stars: 5, freq: 1046.50 }
    ];

    let frameIdx = 0;
    const timer = setInterval(() => {
      if (frameIdx < matchTelemetry.length) {
        const f = matchTelemetry[frameIdx];
        bootProgress.style.width = f.pct + "%";
        bootBallSprite.style.left = f.pct + "%";
        bootStatusText.textContent = f.text;
        bootStage.textContent = f.stage;
        bootBitrate.textContent = f.bitrate;

        this.#playChimeTone(f.freq, 0.28);

        for (let i = 1; i <= 5; i++) {
          const star = this.#root.getElementById(`star${i}`);
          if (star) {
            if (i <= f.stars) star.classList.add("on");
            else star.classList.remove("on");
          }
        }
        frameIdx++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          uclBootScreen.classList.add("fade-out");
          if (sessionStorage.getItem("footx_auth_pass") !== "true") {
            popup.classList.remove("hidden");
          } else {
            this.#startStreamingEngine();
          }
        }, 500);
      }
    }, 450);
  }

  #bindInteractions() {
    const tgUrl = this.#getTelegramLink();
    ['brandLink', 'navJoinBtn', 'wmLink', 'commJoinBtn'].forEach(id => {
      const el = this.#root.getElementById(id);
      if (el) el.href = tgUrl;
    });

    const popup = this.#root.getElementById("tgPopup");
    const closePopup = () => {
      popup.classList.add("hidden");
      sessionStorage.setItem("footx_auth_pass", "true");
    };

    this.#root.getElementById("tgJoinBtn").addEventListener("click", () => {
      window.open(tgUrl, "_blank", "noopener");
      closePopup();
      this.#startStreamingEngine();
    });

    this.#root.getElementById("tgCloseBtn").addEventListener("click", () => {
      closePopup();
      this.#startStreamingEngine();
    });

    this.#root.getElementById("btnShare").addEventListener("click", async () => {
      const btnText = this.#root.getElementById("shareBtnText");
      const shareData = {
        title: "FootxCrate — UEFA Champions League on TNT Sports 2",
        text: "Watch UEFA Champions League live on TNT Sports 2 via FootxCrate!",
        url: window.location.href
      };

      try {
        if (navigator.share && /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent)) {
          await navigator.share(shareData);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          const orig = btnText.textContent;
          btnText.textContent = "COPIED!";
          setTimeout(() => { btnText.textContent = orig; }, 1800);
        }
      } catch (err) {}
    });

    const darkBtn = this.#root.getElementById("themeDarkBtn");
    const lightBtn = this.#root.getElementById("themeLightBtn");

    const setTheme = (mode) => {
      if (mode === "dark") {
        this.removeAttribute("data-theme");
        darkBtn.classList.add("active");
        lightBtn.classList.remove("active");
      } else {
        this.setAttribute("data-theme", "light");
        lightBtn.classList.add("active");
        darkBtn.classList.remove("active");
      }
    };

    darkBtn.addEventListener("click", () => setTheme("dark"));
    lightBtn.addEventListener("click", () => setTheme("light"));
  }

  async #startStreamingEngine() {
    if (this.#engineStarted) return;
    this.#engineStarted = true;

    try {
      if (!window.shaka || !window.Plyr) return;
      window.shaka.polyfill.installAll();

      if (!window.shaka.Player.isBrowserSupported()) return;

      const video = this.#root.getElementById("player");
      video.muted = true;
      video.autoplay = true;

      const player = new window.shaka.Player(video);
      this.#shakaInstance = player;

      const streamManifest = this.getAttribute("stream-url");
      const keyId = this.getAttribute("clearkey-id");
      const keyVal = this.getAttribute("clearkey-val");

      const playerConfig = {
        manifest: {
          defaultPresentationDelay: 2,
          dash: { ignoreMinBufferTime: true }
        },
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 8,
          rebufferingGoal: 2,
          safeSeekOffset: 1,
          stallEnabled: true,
          jumpLargeGaps: true
        }
      };

      if (keyId && keyVal) {
        playerConfig.drm = {
          clearKeys: { [keyId]: keyVal }
        };
      }

      player.configure(playerConfig);

      if (streamManifest) {
        await player.load(streamManifest);
      }
      await video.play().catch(() => {});
      this.#initPlyr(video, player);
    } catch (error) {
      this.#engineStarted = false;
    }
  }

  #initPlyr(videoEl, shakaPlayer) {
    if (this.#playerInstance) return;

    const getQualityOptions = () => {
      if (!shakaPlayer) return [1080, 720, 480, 360];
      const tracks = shakaPlayer.getVariantTracks();
      const heights = [...new Set(tracks.filter(t => t.type === "video" && t.height).map(t => t.height))];
      return heights.length ? heights.sort((a, b) => b - a) : [1080, 720, 480, 360];
    };

    this.#playerInstance = new window.Plyr(videoEl, {
      autoplay: true,
      muted: true,
      loadSprite: false,
      iconUrl: '',
      controls: ["play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
      settings: ["quality"],
      quality: {
        default: 720,
        options: getQualityOptions(),
        forced: true,
        onChange: (newQuality) => {
          if (!shakaPlayer) return;
          if (newQuality === 0) {
            shakaPlayer.configure({ abr: { enabled: true } });
            return;
          }
          shakaPlayer.configure({ abr: { enabled: false } });
          const tracks = shakaPlayer.getVariantTracks();
          const targetTrack = tracks.find(t => t.type === "video" && t.height === newQuality);
          if (targetTrack) shakaPlayer.selectVariantTrack(targetTrack, true);
        }
      }
    });

    this.#playerInstance.on('enterfullscreen', () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {}
    });

    this.#playerInstance.on('exitfullscreen', () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (e) {}
    });

    const triggerAudio = () => {
      videoEl.muted = false;
      videoEl.volume = 1;
      this.#root.removeEventListener("click", triggerAudio);
      this.#root.removeEventListener("touchstart", triggerAudio);
    };
    this.#root.addEventListener("click", triggerAudio, { passive: true });
    this.#root.addEventListener("touchstart", triggerAudio, { passive: true });
  }

  async #reloadStream() {
    const newManifest = this.getAttribute("stream-url");
    if (!this.#shakaInstance || !newManifest) return;
    try {
      await this.#shakaInstance.load(newManifest);
      const video = this.#root.getElementById("player");
      if (video) await video.play().catch(() => {});
    } catch (err) {
      console.error("Stream reload error:", err);
    }
  }
}

customElements.define('footxcrate-ui', FootXCrateUI);
