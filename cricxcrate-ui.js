class FootXCrateUI extends HTMLElement {
  #root;
  #playerInstance = null;
  #shakaInstance = null;
  #engineStarted = false;
  #audioCtx = null;
  #animId = null;

  // Embedded TNT Sports Data
  #currentChannelIdx = 0;
  #tntChannels = [
    {
      name: "TNT Sports 1 UK",
      url: "https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/rhf2dwosdt/out/v1/ee550d2a68d846c797e6ce4de2e8b76d/cenc.mpd",
      keys: "69a5aa835a061ce64a630d1046727e40:d02feac8a999bd06bf4059bf33411749"
    },
    {
      name: "TNT Sports 2 UK",
      url: "https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/puehlftk5j/out/v1/f7f0da1ee112481ca0024e6d4dd97f4a/cenc.mpd",
      keys: "f3df7843080ae743bf865dc5fdf64c68:567c863bc12eb74788ea74888c042e1b"
    },
    {
      name: "TNT Sports 3 UK",
      url: "https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/dev1hjwzh9/out/v1/a5f0ee7ad7b24906b14f43bebbbe4678/cenc.mpd",
      keys: "cc91508324ce9dcaf425a43d58f1d9d4:643e5474d9edd87c7d9091c8c97994ca"
    },
    {
      name: "TNT Sports 4 UK",
      url: "https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/tdijwiga2k/out/v1/f5fde318678f4f7583bf27b7231bde1f/cenc.mpd",
      keys: "fa34fa8c90336dd528c7a23871cad1fe:552a78d1aeb74f1650d68255c5749408"
    }
  ];

  static get observedAttributes() {
    return ['telegram-link'];
  }

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'closed' });
  }

  async connectedCallback() {
    await this.#render();
    this.#initWarpField();
    this.#bindInteractions();
    this.#runBootSequence();
  }

  disconnectedCallback() {
    if (this.#animId) cancelAnimationFrame(this.#animId);
    if (this.#playerInstance) this.#playerInstance.destroy();
    if (this.#shakaInstance) this.#shakaInstance.destroy();
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
          --primary-rgb: 0, 85, 255;
          --secondary-rgb: 0, 200, 255;
          --cyber-blue-rgb: 255, 255, 255;
          --accent: rgb(var(--primary-rgb));
          --accent-secondary: rgb(var(--secondary-rgb));
          --accent-cyan: rgb(var(--cyber-blue-rgb));
          --accent-glow: rgba(var(--primary-rgb), 0.55);
          --accent-glow-intense: rgba(var(--primary-rgb), 0.85);
          --accent-glow-subtle: rgba(var(--primary-rgb), 0.15);
          --bg-pure: #00040a;
          --bg-card: rgba(4, 12, 28, 0.72);
          --bg-glass: rgba(8, 20, 42, 0.65);
          --border-glass: rgba(0, 200, 255, 0.15);
          --border-glass-bright: rgba(0, 200, 255, 0.35);
          --text-pure: #ffffff;
          --text-main: #f0f4f8;
          --text-muted: #8a9bb2;
          --text-dark: #415570;
          --btn-main-bg: #ffffff;
          --btn-main-text: #00122e;
          --player-shadow: 0 45px 120px -20px rgba(0, 10, 30, 0.95);
          --hud-bg: rgba(2, 8, 20, 0.85);
          --plyr-color-main: var(--accent);

          display: block;
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
          background: radial-gradient(circle at 50% 0%, rgba(var(--primary-rgb), 0.15) 0%, transparent 60%), var(--bg-pure);
          color: var(--text-main);
          overflow-x: hidden;
          font-size: clamp(13px, 0.75vw + 0.5rem, 20px);
        }

        :host([data-theme="light"]) {
          --accent: #0044cc;
          --accent-glow: rgba(0, 68, 204, 0.25);
          --accent-glow-intense: rgba(0, 68, 204, 0.55);
          --bg-pure: #f2f5f9;
          --bg-card: rgba(255, 255, 255, 0.9);
          --bg-glass: rgba(255, 255, 255, 0.8);
          --border-glass: rgba(0, 85, 255, 0.15);
          --border-glass-bright: rgba(0, 85, 255, 0.3);
          --text-pure: #000814;
          --text-main: #00122e;
          --text-muted: #526680;
          --text-dark: #9aaec7;
          --btn-main-bg: #00122e;
          --btn-main-text: #ffffff;
          --hud-bg: rgba(255, 255, 255, 0.9);
        }

        :host([data-theme="light"]) .hero-headline,
        :host([data-theme="light"]) .comm-heading,
        :host([data-theme="light"]) .brand-title,
        :host([data-theme="light"]) .stream-title-group strong,
        :host([data-theme="light"]) .hud-pill-data.live { color: #000814 !important; }
        :host([data-theme="light"]) .comm-heading span { color: #526680 !important; }
        :host([data-theme="light"]) .comm-btn-prime { background: #00122e; color: #ffffff; }
        :host([data-theme="light"]) .comm-btn-prime:hover { background: var(--accent); color: #ffffff; }
        :host([data-theme="light"]) .hud-pill-data.clickable-wm { background: rgba(255, 255, 255, 0.95); color: #00122e; border-color: var(--accent);}
        :host([data-theme="light"]) .hud-pill-data.clickable-wm:hover { background: var(--accent); color: #ffffff; }
        :host([data-theme="light"]) .channel-switcher { background: rgba(255,255,255,0.9); border-color: rgba(0,0,0,0.1); }
        :host([data-theme="light"]) .channel-btn { color: #526680; }
        :host([data-theme="light"]) .channel-btn:hover:not(.active) { background: rgba(0,0,0,0.05); color: #000; }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        #warpGridCanvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          opacity: 0.65;
          will-change: transform;
        }

        .noise-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0.025;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .container {
          width: min(1500px, 94vw);
          margin: 0 auto;
          padding: 0 0 clamp(50px, 6vw, 120px);
          position: relative;
          z-index: 10;
        }

        .boot-screen {
          position: fixed;
          inset: 0;
          z-index: 100000;
          background: #00040a;
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
        .boot-screen.fade-out {
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
          background: rgba(4, 12, 28, 0.7);
          border: 1px solid var(--border-glass-bright);
          box-shadow: 0 16px 45px rgba(0, 4, 10, 0.8), inset 0 0 20px rgba(var(--primary-rgb), 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          max-width: 95vw;
        }

        .hud-stat-box { display: flex; flex-direction: column; align-items: center; }
        .hud-stat-lbl { font-family: 'DM Mono', monospace; font-size: clamp(7px, 0.7vw, 10px); letter-spacing: 2px; color: var(--text-muted); text-transform: uppercase; }
        .hud-stat-val { font-family: 'Space Grotesk', sans-serif; font-size: clamp(14px, 1.8vw, 24px); font-weight: 800; color: #fff; }
        .hud-stat-val.accent { color: rgb(var(--secondary-rgb)); text-shadow: 0 0 12px rgba(var(--secondary-rgb), 0.6); }

        .shift-bank { display: flex; gap: clamp(2px, 0.4vw, 5px); margin-top: 4px; }
        .shift-led { width: clamp(5px, 0.7vw, 8px); height: clamp(9px, 1.2vw, 14px); border-radius: 2px; background: rgba(255, 255, 255, 0.06); transition: background 0.15s ease, box-shadow 0.15s ease; }
        .shift-led.cyan.on { background: #00c8ff; box-shadow: 0 0 12px #00c8ff; }
        .shift-led.blue.on { background: #0055ff; box-shadow: 0 0 12px #0055ff; }
        .shift-led.white.on { background: #ffffff; box-shadow: 0 0 16px #ffffff; }

        .gyro-badge-rig {
          position: relative;
          width: clamp(75px, 12vmin, 130px);
          height: clamp(75px, 12vmin, 130px);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: clamp(18px, 3.5vh, 40px);
          flex-shrink: 0;
        }
        .gyro-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1.5px dashed rgba(var(--secondary-rgb), 0.4);
          animation: gyroSpin 12s linear infinite;
          pointer-events: none;
        }
        .gyro-ring.outer {
          inset: -22px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-top-color: var(--accent);
          border-bottom-color: var(--accent);
          animation: gyroSpin 18s linear infinite reverse;
        }
        @keyframes gyroSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .gyro-aura {
          position: absolute;
          inset: -16px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--accent-glow-intense) 0%, transparent 75%);
          filter: blur(22px);
          animation: auraThrust 2s ease-in-out infinite alternate;
        }
        @keyframes auraThrust { 0% { opacity: 0.5; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1.08); } }
        .gyro-inner-media {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #000;
          overflow: hidden;
          position: relative;
          z-index: 5;
          border: 2px solid rgba(0, 200, 255, 0.4);
          box-shadow: 0 25px 70px rgba(0, 4, 10, 0.95);
        }
        .gyro-inner-media img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .boot-info-center { display: flex; flex-direction: column; align-items: center; text-align: center; width: min(520px, 92vw); }
        .boot-kicker { font-family: 'DM Mono', monospace; font-size: clamp(8px, 0.85vw, 12px); color: rgb(var(--secondary-rgb)); letter-spacing: 3.5px; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; }
        .boot-status-text { font-family: 'Space Grotesk', sans-serif; font-size: clamp(13px, 1.8vw, 22px); font-weight: 700; letter-spacing: -0.3px; color: #fff; min-height: 28px; display: flex; align-items: center; gap: 10px; margin-bottom: clamp(14px, 2.5vh, 26px); }
        .boot-progress-arena { position: relative; width: 100%; height: 36px; display: flex; align-items: flex-end; }
        .boot-track-rail { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255, 255, 255, 0.12); border-radius: 4px; }
        .boot-track-fill { position: absolute; top: 0; left: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, transparent, var(--accent) 50%, rgb(var(--secondary-rgb))); box-shadow: 0 0 16px var(--accent); border-radius: 4px; will-change: width; transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
        .boot-ball-pointer { position: absolute; bottom: -11px; left: 0%; transform: translate3d(-50%, 0, 0); display: flex; align-items: center; will-change: left; transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; z-index: 10; filter: drop-shadow(0 0 12px rgb(var(--secondary-rgb))); }
        .comet-tail { width: 24px; height: 3px; background: linear-gradient(90deg, transparent, rgb(var(--primary-rgb)), rgb(var(--secondary-rgb))); border-radius: 100px; margin-right: -10px; filter: blur(1px); animation: cometFlicker 0.1s infinite alternate; }
        @keyframes cometFlicker { 0% { transform: scaleX(0.8); opacity: 0.7; } 100% { transform: scaleX(1.3); opacity: 1; } }
        .football-vector { width: clamp(24px, 3.5vw, 32px); height: auto; display: block; animation: ballRoll 0.8s linear infinite; }
        @keyframes ballRoll { 100% { transform: rotate(360deg); } }

        .popup-modal-screen { position: fixed; inset: 0; z-index: 99998; background: radial-gradient(circle at 50% 30%, rgba(var(--primary-rgb), 0.25) 0%, rgba(0, 4, 10, 0.98) 75%), #00040a; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: clamp(24px, 4.5vh, 60px) clamp(16px, 3.5vw, 40px); text-align: center; opacity: 1; visibility: visible; transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s ease; overflow-y: auto; }
        .popup-modal-screen.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
        .fs-master-badge { position: relative; width: clamp(75px, 11vmin, 115px); height: clamp(75px, 11vmin, 115px); margin-bottom: clamp(16px, 3vh, 36px); display: flex; align-items: center; justify-content: center; animation: badgeLevitate 4s ease-in-out infinite alternate; flex-shrink: 0; }
        @keyframes badgeLevitate { 0% { transform: translateY(0px); } 100% { transform: translateY(-10px); } }
        .fs-master-halo { position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, var(--accent-glow-intense) 0%, transparent 70%); filter: blur(22px); animation: haloIntensify 2.5s ease-in-out infinite alternate; }
        @keyframes haloIntensify { 0% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1.15); } }
        .fs-laser-svg { position: absolute; inset: -6px; width: calc(100% + 12px); height: calc(100% + 12px); pointer-events: none; z-index: 4; }
        .fs-laser-bg { fill: none; stroke: rgba(0, 200, 255, 0.15); stroke-width: 2; rx: 50%; }
        .fs-laser-beam { fill: none; stroke: url(#laserModalGrad); stroke-width: 3.5; stroke-linecap: round; rx: 50%; stroke-dasharray: 90 280; stroke-dashoffset: 0; animation: laserCruise 2s linear infinite; filter: drop-shadow(0 0 12px rgb(var(--secondary-rgb))); }
        @keyframes laserCruise { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -370; } }
        
        .fs-media-frame { width: 100%; height: 100%; border-radius: 50%; background: #ffffff; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; box-shadow: 0 20px 60px rgba(0, 10, 30, 0.85); border: 2px solid rgba(0, 200, 255, 0.4); }
        .fs-media-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        
        .fs-master-kicker { font-family: 'DM Mono', monospace; font-size: clamp(8.5px, 0.8vw, 11.5px); color: rgb(var(--secondary-rgb)); letter-spacing: 3.5px; text-transform: uppercase; font-weight: 600; margin-bottom: clamp(8px, 1.4vh, 16px); animation: kickerPulse 2.8s ease-in-out infinite alternate; }
        @keyframes kickerPulse { 0% { text-shadow: 0 0 2px transparent; opacity: 0.85; } 100% { text-shadow: 0 0 14px rgb(var(--secondary-rgb)); opacity: 1; } }
        .fs-master-heading { font-family: 'Space Grotesk', sans-serif; font-size: clamp(30px, 5.8vw, 68px); line-height: 0.96; letter-spacing: -0.04em; font-weight: 800; color: #ffffff; margin-bottom: clamp(12px, 1.8vh, 20px); max-width: 600px; }
        .fs-master-desc { font-size: clamp(12px, 1.1vw, 16px); color: #8f9db0; line-height: 1.6; max-width: clamp(280px, 86vw, 460px); margin: 0 auto clamp(22px, 3.8vh, 38px); }
        .fs-action-stack { width: min(340px, 88vw); display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .fs-btn-apex { position: relative; width: 100%; height: clamp(48px, 6.2vh, 60px); border: 0; border-radius: 100px; background: linear-gradient(135deg, rgb(var(--primary-rgb)) 0%, rgb(var(--secondary-rgb)) 100%); color: #ffffff; font-family: 'Manrope', sans-serif; font-size: clamp(11px, 0.9vw, 13.5px); font-weight: 800; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; box-shadow: 0 14px 40px var(--accent-glow); transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, filter 0.25s ease; display: flex; align-items: center; justify-content: center; gap: 10px; overflow: hidden; }
        .fs-btn-apex::before { content: ""; position: absolute; inset: -2px; border-radius: 100px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent); transform: translateX(-100%); transition: transform 0.65s ease; }
        .fs-btn-apex:hover::before { transform: translateX(100%); }
        .fs-btn-apex:hover { transform: translateY(-2px); box-shadow: 0 22px 60px var(--accent-glow-intense); filter: brightness(1.12); }
        .fs-btn-apex:active { transform: scale(0.97); }
        .fs-btn-dismiss { background: transparent; border: 0; color: #687a90; font-family: 'DM Mono', monospace; font-size: clamp(8px, 0.75vw, 10px); letter-spacing: 2px; text-transform: uppercase; cursor: pointer; padding: 8px; transition: color 0.2s ease, text-shadow 0.2s ease; }
        .fs-btn-dismiss:hover { color: #ffffff; text-shadow: 0 0 10px rgba(255, 255, 255, 0.6); }
        .fs-master-footer { margin-top: clamp(24px, 4vh, 48px); font-family: 'DM Mono', monospace; font-size: clamp(7.5px, 0.7vw, 9.5px); letter-spacing: 2.5px; color: #4a5c73; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
        .fs-master-footer span { color: rgb(var(--secondary-rgb)); }

        .nav { height: clamp(68px, 8.5vh, 96px); display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 50; }
        .brand { display: inline-flex; align-items: center; gap: clamp(8px, 1.2vw, 16px); text-decoration: none; color: var(--text-main); }
        .brand-media-shell { width: clamp(38px, 3.5vw, 50px); height: clamp(38px, 3.5vw, 50px); border-radius: 50%; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-glass-bright); box-shadow: 0 6px 20px var(--accent-glow); flex-shrink: 0; transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .brand:hover .brand-media-shell { transform: scale(1.08) rotate(15deg); }
        .brand-media-shell img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .brand-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(15px, 1.35vw, 20px); font-weight: 800; letter-spacing: -0.4px; text-transform: uppercase; }
        .brand-title span { color: var(--text-muted); font-weight: 500; font-size: clamp(12px, 1.1vw, 15px); text-transform: uppercase; }
        .nav-actions { display: flex; align-items: center; gap: clamp(8px, 1vw, 14px); }
        .live-pill-badge { height: clamp(32px, 2.8vw, 40px); padding: 0 clamp(10px, 1.2vw, 16px); display: flex; align-items: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--border-glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 100px; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: clamp(8px, 0.7vw, 10px); letter-spacing: 1.4px; text-transform: uppercase; }
        .pulsing-live-dot { width: 6px; height: 6px; background: rgb(var(--secondary-rgb)); border-radius: 50%; box-shadow: 0 0 12px rgb(var(--secondary-rgb)); animation: liveSignal 1.8s ease-in-out infinite; }
        @keyframes liveSignal { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.8); } }
        .nav-join-btn { height: clamp(32px, 2.8vw, 40px); padding: 0 clamp(14px, 1.4vw, 22px); display: inline-flex; align-items: center; justify-content: center; border-radius: 100px; background: var(--btn-main-bg); color: var(--btn-main-text); text-decoration: none; font-size: clamp(10px, 0.8vw, 12px); font-weight: 800; letter-spacing: 1px; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12); }
        .nav-join-btn:hover { background: rgb(var(--secondary-rgb)); color: #000; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 200, 255, 0.4); }

        .hero { position: relative; padding: clamp(24px, 4vw, 60px) 0 clamp(16px, 2.8vw, 38px); }
        .hero-tag { display: inline-flex; align-items: center; gap: 12px; font-family: 'DM Mono', monospace; color: rgb(var(--secondary-rgb)); font-size: clamp(8.5px, 0.8vw, 11px); font-weight: 700; letter-spacing: 3.5px; text-transform: uppercase; }
        .hero-tag::before { content: ""; width: clamp(20px, 2.2vw, 34px); height: 2px; background: rgb(var(--secondary-rgb)); border-radius: 2px; }
        .hero-headline { margin-top: clamp(8px, 1.2vw, 18px); font-family: 'Syne', sans-serif; font-size: clamp(42px, 8vw, 110px); line-height: 0.88; letter-spacing: -0.04em; font-weight: 900; text-transform: uppercase; color: var(--text-pure); }
        .hero-headline .accent-txt { color: var(--accent); background: linear-gradient(135deg, rgb(var(--secondary-rgb)) 0%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-details { margin-top: clamp(14px, 1.6vw, 24px); display: flex; align-items: center; flex-wrap: wrap; gap: clamp(8px, 1vw, 12px); color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: clamp(7.5px, 0.75vw, 10px); letter-spacing: 1.6px; text-transform: uppercase; }
        .hero-details b { color: var(--text-main); font-weight: 600; }
        .meta-separator { width: 3px; height: 3px; border-radius: 50%; background: var(--text-dark); }

        .track-separator-beam { width: 100%; height: 1px; background: linear-gradient(90deg, var(--accent) 0%, var(--border-glass) 45%, transparent 100%); margin-bottom: clamp(14px, 1.8vw, 22px); }
        
        .player-rig-box { width: 100%; aspect-ratio: 16/9; position: relative; background: #000; overflow: hidden; border-radius: clamp(14px, 2vw, 28px); border: 1px solid var(--border-glass-bright); box-shadow: var(--player-shadow); isolation: isolate; }
        .player-rig-box::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: linear-gradient(90deg, transparent, rgb(var(--secondary-rgb)), transparent); opacity: 0.85; z-index: 12; }
        video#player { width: 100%; height: 100%; object-fit: contain; background: #000; }
        
        .player-hud-overlay { position: absolute; left: clamp(10px, 1.8vw, 24px); right: clamp(10px, 1.8vw, 24px); top: clamp(10px, 1.8vw, 22px); z-index: 25; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
        .hud-cluster { display: flex; align-items: center; gap: 8px; }
        .hud-pill-data { height: clamp(24px, 2.2vw, 32px); padding: 0 clamp(8px, 1vw, 14px); display: flex; align-items: center; gap: 6px; border-radius: 8px; background: var(--hud-bg); border: 1px solid var(--border-glass); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); font-family: 'DM Mono', monospace; font-size: clamp(7px, 0.65vw, 9.5px); color: var(--text-muted); letter-spacing: 1.2px; text-decoration: none; }
        .hud-pill-data.live { color: var(--text-main); font-weight: 600; }
        .hud-pill-data.live i { width: 5px; height: 5px; background: rgb(var(--secondary-rgb)); border-radius: 50%; box-shadow: 0 0 8px rgb(var(--secondary-rgb)); }
        .hud-pill-data.clickable-wm { pointer-events: auto; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(0, 200, 255, 0.4); background: rgba(4, 12, 28, 0.85); color: #fff; font-weight: 700; }
        .hud-pill-data.clickable-wm:hover { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 0 16px var(--accent-glow); transform: translateY(-1px); }

        .player-meta-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: clamp(14px, 1.6vw, 22px) 4px 0; flex-wrap: wrap; }
        .stream-title-group { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
        .stream-title-group strong { font-family: 'Space Grotesk', sans-serif; font-size: clamp(15px, 1.3vw, 20px); font-weight: 700; letter-spacing: -0.4px; }
        
        .channel-switcher { display: flex; flex-wrap: wrap; gap: 6px; background: var(--bg-card); padding: 6px; border-radius: 12px; border: 1px solid var(--border-glass); backdrop-filter: blur(12px); }
        .channel-btn { background: transparent; border: none; color: var(--text-muted); font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(11px, 0.85vw, 13px); padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all 0.25s ease; letter-spacing: -0.2px; }
        .channel-btn.active { background: var(--accent); color: #fff; box-shadow: 0 4px 12px var(--accent-glow); }
        .channel-btn:hover:not(.active) { color: var(--text-main); background: rgba(255,255,255,0.08); }
        
        .share-action-btn { height: clamp(38px, 3.2vw, 46px); padding: 0 clamp(18px, 1.8vw, 28px); display: inline-flex; align-items: center; gap: 10px; border-radius: 100px; background: linear-gradient(135deg, var(--bg-card) 0%, rgba(var(--primary-rgb), 0.2) 100%); border: 1px solid var(--accent); color: var(--text-main); font-family: 'DM Mono', monospace; font-size: clamp(8px, 0.75vw, 10.5px); font-weight: 600; letter-spacing: 1.6px; text-transform: uppercase; cursor: pointer; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 6px 25px var(--accent-glow); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0; }
        .share-action-btn svg { width: 14px; height: 14px; stroke: rgb(var(--secondary-rgb)); stroke-width: 2.2; }
        .share-action-btn:hover { background: var(--accent); color: #fff; transform: translateY(-2px); box-shadow: 0 12px 35px var(--accent-glow); }
        .share-action-btn:hover svg { stroke: #fff; }

        .community { margin-top: clamp(48px, 7vw, 100px); position: relative; }
        .comm-tag { font-family: 'DM Mono', monospace; color: rgb(var(--secondary-rgb)); font-size: clamp(10px, 0.9vw, 13px); font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: clamp(14px, 2vh, 22px); }
        .community-body { display: flex; flex-direction: column; gap: clamp(20px, 3vh, 32px); }
        .comm-heading { font-family: 'Space Grotesk', sans-serif; font-size: clamp(34px, 6.2vw, 68px); line-height: 0.96; letter-spacing: -0.04em; font-weight: 800; color: var(--text-pure); }
        .comm-heading span { display: block; color: var(--text-dark); }
        .comm-btn-prime { width: 100%; height: clamp(52px, 6.5vh, 64px); padding: 0 24px; display: flex; align-items: center; justify-content: center; border-radius: 100px; background: #ffffff; color: #00122e; text-decoration: none; font-family: 'Manrope', sans-serif; font-size: clamp(11.5px, 0.9vw, 13.5px); font-weight: 800; letter-spacing: 2px; text-transform: uppercase; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25); }
        .comm-btn-prime:hover { background: var(--accent); color: #ffffff; transform: translateY(-2px); box-shadow: 0 12px 35px var(--accent-glow); }

        .footer { margin-top: clamp(48px, 6vw, 80px); padding: 20px 0 calc(30px + env(safe-area-inset-bottom)); display: flex; align-items: center; justify-content: space-between; color: var(--text-dark); font-family: 'DM Mono', monospace; font-size: clamp(7.5px, 0.65vw, 9.5px); letter-spacing: 1.6px; text-transform: uppercase; }
        .footer strong { color: var(--text-muted); }

        .theme-switch-deck { position: fixed; right: clamp(14px, 2.2vw, 30px); bottom: clamp(14px, 2.2vw, 30px); z-index: 900; background: var(--bg-card); border: 1px solid var(--border-glass-bright); border-radius: 100px; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: 0 18px 50px rgba(0, 4, 10, 0.6); padding: 4px; display: flex; align-items: center; gap: 4px; }
        .mode-toggle-btn { height: clamp(28px, 2.4vw, 36px); padding: 0 clamp(10px, 1vw, 14px); display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: clamp(7.5px, 0.65vw, 9px); font-weight: 500; letter-spacing: 1.2px; text-transform: uppercase; border-radius: 100px; cursor: pointer; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .mode-toggle-btn i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .mode-toggle-btn.active { background: var(--accent); color: #ffffff; box-shadow: 0 4px 18px var(--accent-glow); }
        .mode-toggle-btn.active i { background: #ffffff; }
        .hidden-sprite { display: none; }
        @media (max-width: 680px) {
          .live-pill-badge { display: none; }
          .hud-cluster.hide-mobile { display: none; }
          .theme-switch-deck { right: 50%; transform: translateX(50%); bottom: 12px; }
          .player-meta-bar { justify-content: center; }
          .stream-title-group { text-align: center; width: 100%; align-items: center; }
          .channel-switcher { justify-content: center; }
        }
      </style>

      <div class="hidden-sprite">${plyrSvg}</div>
      <canvas id="warpGridCanvas"></canvas>
      <div class="noise-overlay"></div>

      <aside class="boot-screen" id="appBootScreen">
        <div class="boot-hud-card">
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">FORMATION</span>
            <span class="hud-stat-val accent" id="bootStat1">4-3-3</span>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">INTENSITY</span>
            <div class="shift-bank">
              <div class="shift-led cyan on" id="led1"></div>
              <div class="shift-led cyan on" id="led2"></div>
              <div class="shift-led blue" id="led3"></div>
              <div class="shift-led blue" id="led4"></div>
              <div class="shift-led white" id="led5"></div>
            </div>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">ATTENDANCE</span>
            <span class="hud-stat-val" id="bootStat2">0</span>
          </div>
        </div>

        <div class="gyro-badge-rig">
          <div class="gyro-aura"></div>
          <div class="gyro-ring outer"></div>
          <div class="gyro-ring"></div>
          <div class="gyro-inner-media">
            <!-- REPLACED: Static image instead of video -->
            <img src="https://files.catbox.moe/crndi2.jpg" alt="Boot Image">
          </div>
        </div>

        <div class="boot-info-center">
          <div class="boot-kicker">TNT SPORTS · MULTIPLEX LINK</div>
          <div class="boot-status-text" id="bootStatusText">INITIALIZING BROADCAST...</div>
          
          <div class="boot-progress-arena">
            <div class="boot-track-rail">
              <div class="boot-track-fill" id="bootProgress"></div>
              <div class="boot-ball-pointer" id="bootCarSprite">
                <div class="comet-tail"></div>
                <svg class="football-vector" viewBox="0 0 50 50" fill="none">
                  <circle cx="25" cy="25" r="23" stroke="#fff" stroke-width="2.5" fill="#001432"/>
                  <path d="M25 10 L35 18 L31 30 L19 30 L15 18 Z" fill="#fff"/>
                  <path d="M25 10 L25 2" stroke="#fff" stroke-width="2.5"/>
                  <path d="M35 18 L43 14" stroke="#fff" stroke-width="2.5"/>
                  <path d="M31 30 L38 38" stroke="#fff" stroke-width="2.5"/>
                  <path d="M19 30 L12 38" stroke="#fff" stroke-width="2.5"/>
                  <path d="M15 18 L7 14" stroke="#fff" stroke-width="2.5"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div id="tgPopup" class="popup-modal-screen hidden">
        <div class="fs-master-badge">
          <div class="fs-master-halo"></div>
          <svg class="fs-laser-svg" viewBox="0 0 112 112">
            <defs>
              <linearGradient id="laserModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="rgb(var(--secondary-rgb))" stop-opacity="0" />
                <stop offset="60%" stop-color="rgb(var(--secondary-rgb))" stop-opacity="1" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
              </linearGradient>
            </defs>
            <rect class="fs-laser-bg" x="4" y="4" width="104" height="104" />
            <rect class="fs-laser-beam" x="4" y="4" width="104" height="104" />
          </svg>
          <div class="fs-media-frame">
            <!-- REPLACED: Static image instead of video -->
            <img src="https://files.catbox.moe/crndi2.jpg" alt="Popup Image">
          </div>
        </div>

        <div class="fs-master-kicker">OFFICIAL FOOTXCRATE</div>
        <h2 class="fs-master-heading">The match starts here.</h2>
        <p class="fs-master-desc">Join the official FootxCrate Telegram community for live streams, goals, updates and many more.</p>

        <div class="fs-action-stack">
          <button class="fs-btn-apex" id="tgJoinBtn">
            <span>JOIN FOOTXCRATE</span>
          </button>
          <button class="fs-btn-dismiss" id="tgCloseBtn">CONTINUE TO BROADCAST</button>
        </div>

        <div class="fs-master-footer">
          <span>•</span> TNT SPORTS LIVE <span>•</span> LIVE BROADCAST <span>•</span> 2026 <span>•</span>
        </div>
      </div>

      <div class="container">
        <header class="nav">
          <a class="brand" id="brandLink" href="#" target="_blank" rel="noopener">
            <div class="brand-media-shell">
              <!-- REPLACED: Static image instead of video -->
              <img src="https://files.catbox.moe/crndi2.jpg" alt="Brand Image">
            </div>
            <div class="brand-title">
              FOOTXCRATE <span>— TNT</span>
            </div>
          </a>

          <div class="nav-actions">
            <div class="live-pill-badge">
              <i class="pulsing-live-dot"></i>
              MATCH LIVE
            </div>
            <a class="nav-join-btn" id="navJoinBtn" href="#" target="_blank" rel="noopener">
              JOIN
            </a>
          </div>
        </header>

        <section class="hero">
          <div class="hero-tag">FOOTXCRATE</div>
          <h1 class="hero-headline">
            TNT<br>
            <span class="accent-txt">SPORTS.</span>
          </h1>
          <div class="hero-details">
            <b>UK MULTIPLEX</b>
            <span class="meta-separator"></span>
            CHAMPIONS LEAGUE
            <span class="meta-separator"></span>
            PREMIER LEAGUE
            <span class="meta-separator"></span>
            TNT BROADCAST
          </div>
        </section>

        <main class="broadcast">
          <div class="track-separator-beam"></div>

          <div class="player-rig-box" id="playerContainer">
            <div class="player-hud-overlay">
              <div class="hud-cluster">
                <div class="hud-pill-data live"><i></i> LIVE</div>
                <a class="hud-pill-data clickable-wm" id="wmLink" href="#" target="_blank" rel="noopener" title="Join FootxCrate on Telegram">
                  ⚡ FOOTXCRATE
                </a>
              </div>
              <div class="hud-cluster hide-mobile">
                <div class="hud-pill-data" id="hudChannelText">TNT Sports 1 UK</div>
                <div class="hud-pill-data">ENGLISH FEED</div>
              </div>
            </div>
            <video id="player" playsinline crossorigin="anonymous"></video>
          </div>

          <div class="player-meta-bar">
            <div class="stream-title-group">
              <strong id="streamTitleText">TNT Sports 1 UK · Official Match Broadcast</strong>
              
              <!-- NEW: Channel Switcher -->
              <div class="channel-switcher" id="channelSwitcher">
                <button class="channel-btn active" data-idx="0">TNT 1</button>
                <button class="channel-btn" data-idx="1">TNT 2</button>
                <button class="channel-btn" data-idx="2">TNT 3</button>
                <button class="channel-btn" data-idx="3">TNT 4</button>
              </div>

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
          <div class="comm-tag">FOOTXCRATE</div>
          <div class="community-body">
            <h2 class="comm-heading">
              Stay close.
              <span>Never miss a goal.</span>
            </h2>
            <a class="comm-btn-prime" id="commJoinBtn" href="#" target="_blank" rel="noopener">
              JOIN FOOTXCRATE
            </a>
          </div>
        </section>

        <footer class="footer">
          <span>© 2026 <strong>FOOTXCRATE</strong></span>
          <span>TNT FEED · PITCH SUITE PRO</span>
        </footer>
      </div>

      <aside class="theme-switch-deck">
        <button class="mode-toggle-btn active" id="themeDarkBtn"><i></i> Obsidian</button>
        <button class="mode-toggle-btn" id="themeLightBtn"><i></i> Ceramic</button>
      </aside>
    `;
  }

  #getTelegramLink() {
    return this.getAttribute('telegram-link') || 'https://t.me/+W6YlSdXBttFjOGM1';
  }

  #playUIPing(baseFreq = 440, duration = 0.15) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.#audioCtx) this.#audioCtx = new AudioContext();
      if (this.#audioCtx.state === 'suspended') this.#audioCtx.resume();
      const osc = this.#audioCtx.createOscillator();
      const gain = this.#audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, this.#audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.#audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(0.05, this.#audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.#audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.#audioCtx.destination);
      osc.start();
      osc.stop(this.#audioCtx.currentTime + duration);
    } catch (e) {}
  }

  #initWarpField() {
    const canvas = this.#root.getElementById('warpGridCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = [];
    const STAR_COUNT = 85;
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
        length: Math.random() * 26 + 10,
        speed: Math.random() * 2.2 + 1.2,
        alpha: Math.random() * 0.5 + 0.15
      });
    }

    const render = (now) => {
      const dt = Math.min((now - lastFrameTime) / 16.67, 2.0);
      lastFrameTime = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < STAR_COUNT; i++) {
        const star = stars[i];
        ctx.strokeStyle = `rgba(0, 200, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x + star.length, star.y);
        ctx.stroke();
        star.x += star.speed * dt;
        if (star.x > canvas.width) {
          star.x = -star.length;
          star.y = Math.random() * canvas.height;
        }
      }
      this.#animId = requestAnimationFrame(render);
    };
    this.#animId = requestAnimationFrame(render);
  }

  #runBootSequence() {
    const appBootScreen = this.#root.getElementById("appBootScreen");
    const bootStatusText = this.#root.getElementById("bootStatusText");
    const bootProgress = this.#root.getElementById("bootProgress");
    const bootCarSprite = this.#root.getElementById("bootCarSprite");
    const bootStat1 = this.#root.getElementById("bootStat1");
    const bootStat2 = this.#root.getElementById("bootStat2");
    const popup = this.#root.getElementById("tgPopup");

    const telemetryFrames = [
      { pct: 15, text: "CONNECTING TO STADIUM FEED", stat1: "4-3-3", stat2: "22,500", leds: 2, pitch: 440 },
      { pct: 42, text: "CALIBRATING VAR CAMERAS", stat1: "4-2-3-1", stat2: "45,000", leds: 3, pitch: 520 },
      { pct: 75, text: "TUNING MATCH ATMOSPHERE", stat1: "3-4-3", stat2: "60,000", leds: 4, pitch: 660 },
      { pct: 100, text: "TNT BROADCAST SECURED", stat1: "MATCH", stat2: "75,000", leds: 5, pitch: 880 }
    ];

    let frameIdx = 0;
    const timer = setInterval(() => {
      if (frameIdx < telemetryFrames.length) {
        const f = telemetryFrames[frameIdx];
        bootProgress.style.width = f.pct + "%";
        bootCarSprite.style.left = f.pct + "%";
        bootStatusText.textContent = f.text;
        bootStat1.textContent = f.stat1;
        bootStat2.textContent = f.stat2;

        this.#playUIPing(f.pitch, 0.15);

        for (let i = 1; i <= 5; i++) {
          const led = this.#root.getElementById(`led${i}`);
          if (led) {
            if (i <= f.leds) led.classList.add("on");
            else led.classList.remove("on");
          }
        }
        frameIdx++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          appBootScreen.classList.add("fade-out");
          if (sessionStorage.getItem("crate_auth_pass") !== "true") {
            popup.classList.remove("hidden");
          } else {
            this.#startStreamingEngine();
          }
        }, 500);
      }
    }, 440);
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
      sessionStorage.setItem("crate_auth_pass", "true");
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
        title: "FootxCrate — TNT Sports Live Feed",
        text: "Watch TNT Sports multiplex live on FootxCrate!",
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

    // Theme Switcher
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

    // Channel Switcher Binding
    const channelButtons = this.#root.querySelectorAll(".channel-btn");
    channelButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        // Update active state
        channelButtons.forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        // Update UI info
        this.#currentChannelIdx = parseInt(e.currentTarget.getAttribute("data-idx"), 10);
        const channelInfo = this.#tntChannels[this.#currentChannelIdx];

        this.#root.getElementById("hudChannelText").textContent = channelInfo.name;
        this.#root.getElementById("streamTitleText").textContent = `${channelInfo.name} · Official Match Broadcast`;

        // Switch stream in Shaka
        this.#reloadStream();
      });
    });
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

      const currentChannel = this.#tntChannels[this.#currentChannelIdx];
      const [keyId, keyVal] = currentChannel.keys.split(':');

      const playerConfig = {
        manifest: {
          defaultPresentationDelay: 2,
          dash: { ignoreMinBufferTime: true }
        },
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 6,
          rebufferingGoal: 2,
          safeSeekOffset: 1,
          stallEnabled: true,
          jumpLargeGaps: true
        },
        drm: {
          clearKeys: { [keyId]: keyVal }
        }
      };

      player.configure(playerConfig);

      await player.load(currentChannel.url);
      await video.play().catch(() => {});
      this.#initPlyr(video, player);
    } catch (error) {
      this.#engineStarted = false;
      console.error("Player initiation failed:", error);
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
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        else if (screen.lockOrientation) screen.lockOrientation('landscape');
      } catch (e) {}
    });
    this.#playerInstance.on('exitfullscreen', () => {
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        else if (screen.lockOrientation) screen.unlockOrientation();
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
    if (!this.#shakaInstance) return;

    const targetChannel = this.#tntChannels[this.#currentChannelIdx];
    const [keyId, keyVal] = targetChannel.keys.split(':');

    try {
      // Re-configure DRM keys
      this.#shakaInstance.configure({
        drm: {
          clearKeys: { [keyId]: keyVal }
        }
      });
      // Load new URL
      await this.#shakaInstance.load(targetChannel.url);
      const video = this.#root.getElementById("player");
      if (video) await video.play().catch(() => {});
    } catch (err) {
      console.error("Stream reload error:", err);
    }
  }
}

customElements.define('footxcrate-ui', FootXCrateUI);