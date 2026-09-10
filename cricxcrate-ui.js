(function () {
  class CricXCrateUI extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'closed' });
      this.config = window.CRICXCRATE_CONFIG || {};
      this.channels = [];
      this.currentActiveChannel = null;
      this.playerInstance = null;
      this.controlsInstance = null;
      this.switchCount = 0;
    }

    async connectedCallback() {
      const workerUrl = this.config.WORKER_URL || "https://football.freeshow.fun";

      try {
        // Fetch channels securely from the worker
        const res = await fetch(workerUrl, {
          method: 'GET',
          mode: 'cors'
        });

        if (res.status === 403 || !res.ok) {
          this.renderLockout();
          return;
        }
        this.channels = await res.json();
      } catch (err) {
        this.renderLockout();
        return;
      }

      // Prepend custom attribute feed if present
      const customUrl = this.getAttribute('stream-url');
      if (customUrl && customUrl !== "YOUR_VIDEO_LINK_HERE" && customUrl.trim() !== "") {
        this.channels.unshift({
          id: "custom_feed",
          channel_name: "Main Match Event",
          stream_url: customUrl.trim(),
          stream_keys: ""
        });
      }

      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('ch');
      if (targetId) {
        const found = this.channels.find(ch => ch.id === targetId);
        if (found) this.currentActiveChannel = found;
      }
      if (!this.currentActiveChannel && this.channels.length > 0) {
        this.currentActiveChannel = this.channels[0];
      }

      this.render();
      this.initPlayer();
      this.initEventListeners();
      this.initWarpField();

      setTimeout(() => this.initPopup(), 400);

      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(() => {});
      }
    }

    renderLockout() {
      this._shadow.innerHTML = `
        <div style="height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; background: #050a0f; color: #ff2a2a; font-family: monospace; font-size: 24px; text-align: center; padding: 20px; box-sizing: border-box;">
          sorry bro you're not smart enough
        </div>
      `;
    }

    render() {
      const tg = this.config.TELEGRAM_URL || "#";
      this._shadow.innerHTML = `
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/shaka-player@latest/dist/controls.css" crossorigin="anonymous">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700;800;900&family=Syne:wght@700;800;900&display=swap');

          :host {
            --primary-rgb: 0, 255, 204;
            --accent: rgb(var(--primary-rgb));
            --accent-glow: rgba(var(--primary-rgb), 0.45);
            --accent-glow-intense: rgba(var(--primary-rgb), 0.85);
            --bg-pure: #050a0f; 
            --bg-card: rgba(10, 22, 30, 0.82);
            --border-glass: rgba(0, 255, 204, 0.2);
            --border-glass-bright: rgba(0, 255, 204, 0.45);
            --heading-dynamic: #ffffff;
            --text-main: #e0f2f1;
            --text-muted: #78909c;
            --text-dark: #455a64;
            --btn-main-bg: #ffffff;
            --btn-main-text: #050a0f;
            --player-shadow: 0 45px 120px -20px rgba(0, 255, 204, 0.25);
            display: block;
            background-color: var(--bg-pure); 
            color: var(--text-main); 
            font-family: 'Manrope', sans-serif; 
            overflow-x: hidden; 
            min-height: 100vh;
            background: radial-gradient(circle at 50% 0%, rgba(var(--primary-rgb), 0.12) 0%, transparent 60%), var(--bg-pure);
            transition: background 0.3s ease, color 0.3s ease;
            position: relative;
          }

          :host([data-theme="light"]) {
            --primary-rgb: 0, 200, 180;
            --accent: #00c8b4;
            --accent-glow: rgba(0, 200, 180, 0.35);
            --bg-pure: #f0f7f7;
            --bg-card: rgba(255, 255, 255, 0.88);
            --border-glass: rgba(0, 0, 0, 0.1);
            --border-glass-bright: rgba(0, 200, 180, 0.4);
            --heading-dynamic: #000000;
            --text-main: #0a0f12;
            --text-muted: #546e7a;
            --text-dark: #90a4ae;
            --btn-main-bg: #091015;
            --btn-main-text: #ffffff;
          }

          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          
          .sweep { position: fixed; inset: 0; pointer-events: none; z-index: 1; background: linear-gradient(115deg, transparent 40%, rgba(var(--primary-rgb), 0.04) 48%, rgba(var(--primary-rgb), 0.08) 50%, rgba(var(--primary-rgb), 0.04) 52%, transparent 60%); background-size: 250% 250%; animation: floodlightsSweep 12s ease-in-out infinite alternate; }
          @keyframes floodlightsSweep { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }

          #warpGridCanvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.85; }
          .container { width: min(1500px, 92vw); margin: 0 auto; padding: 0 0 clamp(40px, 6vw, 100px); position: relative; z-index: 10; }

          .nav { height: clamp(64px, 8.5vh, 96px); display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 50; }
          .brand { display: inline-flex; align-items: center; gap: clamp(10px, 1.2vw, 16px); text-decoration: none; }
          .brand-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(20px, 2.2vw, 28px); font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: var(--heading-dynamic); }

          .nav-actions { display: flex; align-items: center; gap: clamp(8px, 1vw, 14px); }
          .live-pill-badge { height: clamp(32px, 2.8vw, 40px); padding: 0 clamp(12px, 1.2vw, 16px); display: flex; align-items: center; gap: 6px; background: var(--bg-card); border: 1px solid var(--border-glass); backdrop-filter: blur(16px); border-radius: 100px; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: clamp(8px, 0.7vw, 10px); letter-spacing: 1.2px; text-transform: uppercase; }
          .pulsing-live-dot { width: 6px; height: 6px; background: #ff2a2a; border-radius: 50%; box-shadow: 0 0 12px #ff2a2a; animation: heartbeatSignal 1.4s ease-in-out infinite; }
          @keyframes heartbeatSignal { 0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 8px #ff2a2a; } 15% { transform: scale(1.4); opacity: 1; box-shadow: 0 0 18px #ff2a2a; } 30% { transform: scale(0.95); opacity: 0.7; box-shadow: 0 0 5px #ff2a2a; } 45% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 16px #ff2a2a; } 60%, 100% { transform: scale(1); opacity: 0.4; box-shadow: 0 0 5px #ff2a2a; } }

          .nav-join-btn { height: clamp(32px, 2.8vw, 40px); padding: 0 clamp(16px, 1.5vw, 24px); display: inline-flex; align-items: center; justify-content: center; border-radius: 100px; background: var(--btn-main-bg); color: var(--btn-main-text); text-decoration: none; font-family: 'Space Grotesk', sans-serif; font-size: clamp(10.5px, 0.85vw, 13px); font-weight: 800; letter-spacing: 1px; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
          .nav-join-btn:hover { background: var(--accent); color: #000; box-shadow: 0 0 20px var(--accent-glow); transform: translateY(-2px); }

          .theme-switch-deck { background: var(--bg-card); border: 1px solid var(--border-glass-bright); border-radius: 100px; backdrop-filter: blur(24px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); padding: 3px; display: flex; align-items: center; gap: 3px; }
          .mode-toggle-btn { height: clamp(26px, 2.2vw, 34px); padding: 0 clamp(8px, 0.9vw, 12px); display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--text-muted); font-family: 'DM Mono', monospace; font-size: clamp(7px, 0.6vw, 8.5px); font-weight: 500; letter-spacing: 1px; text-transform: uppercase; border-radius: 100px; cursor: pointer; transition: all 0.3s ease; }
          .mode-toggle-btn i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; transition: all 0.3s ease; }
          .mode-toggle-btn.active { background: var(--accent); color: #000; box-shadow: 0 0 15px var(--accent-glow); }
          .mode-toggle-btn.active i { background: #000; }

          .hero { position: relative; padding: clamp(10px, 2vw, 30px) 0 clamp(10px, 1.5vw, 20px); }
          .hero-tag { display: inline-flex; align-items: center; gap: 10px; font-family: 'Space Grotesk', sans-serif; color: var(--accent); font-size: clamp(12px, 1.1vw, 15px); font-weight: 800; letter-spacing: 3px; text-transform: uppercase; animation: levitateTag 4s ease-in-out infinite; }
          @keyframes levitateTag { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          .hero-tag::before { content: ""; width: clamp(20px, 2.2vw, 34px); height: 2px; background: var(--accent); border-radius: 2px; }
          .hero-headline { margin-top: clamp(6px, 1vw, 14px); font-family: 'Syne', sans-serif; font-size: clamp(26px, 4.5vw, 65px); line-height: 0.95; letter-spacing: -0.04em; font-weight: 900; text-transform: uppercase; color: var(--heading-dynamic); word-break: break-word; }
          .hero-headline .accent-txt { color: var(--accent); background: linear-gradient(135deg, #00ffcc 0%, #0096ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

          .controls-header-bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
          .channel-search-input { width: 100%; max-width: 320px; background: var(--bg-card); border: 1px solid var(--border-glass-bright); color: var(--text-main); padding: 8px 16px; border-radius: 100px; font-family: 'Manrope', sans-serif; font-size: clamp(11px, 0.8vw, 13px); outline: none; backdrop-filter: blur(12px); transition: all 0.3s ease; }
          .channel-search-input:focus { border-color: var(--accent); box-shadow: 0 0 15px var(--accent-glow); }

          .channel-selector-bar { display: flex; gap: 10px; overflow-x: auto; padding: 6px 0 16px 0; white-space: nowrap; scrollbar-width: thin; scrollbar-color: var(--accent) var(--bg-card); }
          .channel-selector-bar::-webkit-scrollbar { height: 4px; }
          .channel-selector-bar::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 4px; }

          .channel-btn { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-glass); padding: 8px 18px; border-radius: 100px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; font-size: clamp(11px, 0.8vw, 13px); font-weight: 700; letter-spacing: 0.5px; backdrop-filter: blur(12px); transition: all 0.3s ease; flex-shrink: 0; position: relative; overflow: hidden; }
          .channel-btn:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
          .channel-btn.active { background: var(--accent); color: #000; border-color: var(--accent); animation: neonBreathe 2.5s ease-in-out infinite; }
          @keyframes neonBreathe { 0%, 100% { box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.35); } 50% { box-shadow: 0 0 25px rgba(var(--primary-rgb), 0.85); } }

          .kick-ripple { position: absolute; border-radius: 50%; background: rgba(0, 255, 204, 0.4); transform: scale(0); animation: rippleEffect 0.6s linear forwards; pointer-events: none; }
          @keyframes rippleEffect { to { transform: scale(4); opacity: 0; } }

          .track-separator-beam { width: 100%; height: 1px; background: linear-gradient(90deg, var(--accent) 0%, var(--border-glass) 45%, transparent 100%); margin-bottom: clamp(14px, 1.6vw, 22px); }

          .player-rig-box { width: 100%; aspect-ratio: 16/9; position: relative; background: #000; overflow: hidden; border-radius: clamp(14px, 1.8vw, 26px); border: 1px solid var(--border-glass-bright); box-shadow: var(--player-shadow); z-index: 1; }
          #player-wrap, .shaka-video-container { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; }
          video#video { width: 100%; height: 100%; object-fit: contain; }
          .shaka-spinner-container, .shaka-buffering-spinner { display: none !important; }

          .player-meta-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: clamp(14px, 1.6vw, 22px) 2px 0; flex-wrap: wrap; }
          .stream-title-group { display: flex; align-items: center; gap: 12px; }
          .audio-equalizer { display: inline-flex; align-items: flex-end; gap: 3px; height: 16px; width: 20px; }
          .audio-equalizer span { display: block; width: 3px; background: var(--accent); border-radius: 2px; animation: eqPulse 0.8s ease-in-out infinite alternate; box-shadow: 0 0 8px var(--accent-glow); }
          .audio-equalizer span:nth-child(1) { height: 100%; animation-delay: 0.1s; }
          .audio-equalizer span:nth-child(2) { height: 60%; animation-delay: 0.4s; }
          .audio-equalizer span:nth-child(3) { height: 85%; animation-delay: 0.2s; }
          @keyframes eqPulse { 0% { height: 30%; } 100% { height: 100%; } }
          .stream-text-details { display: flex; flex-direction: column; gap: 2px; }
          .stream-text-details strong { font-family: 'Space Grotesk', sans-serif; font-size: clamp(15px, 1.35vw, 20px); font-weight: 700; letter-spacing: -0.3px; color: var(--heading-dynamic); }
          .stream-text-details span { font-family: 'Space Grotesk', sans-serif; color: var(--text-muted); font-size: clamp(9px, 0.75vw, 11px); letter-spacing: 1.2px; font-weight: 600; text-transform: uppercase; }

          .share-action-btn { height: clamp(38px, 3.2vw, 46px); padding: 0 clamp(18px, 1.8vw, 26px); display: inline-flex; align-items: center; gap: 8px; border-radius: 100px; background: linear-gradient(135deg, var(--bg-card) 0%, rgba(var(--primary-rgb), 0.16) 100%); border: 1px solid var(--accent); color: var(--text-main); font-family: 'Space Grotesk', sans-serif; font-size: clamp(9px, 0.75vw, 11px); font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; backdrop-filter: blur(16px); box-shadow: 0 6px 25px var(--accent-glow); transition: all 0.3s ease; }
          .share-action-btn svg { width: 14px; height: 14px; stroke: var(--accent); stroke-width: 2.2; transition: stroke 0.3s ease; }
          .share-action-btn:hover { background: var(--accent); color: #000; box-shadow: 0 10px 30px var(--accent-glow-intense); transform: translateY(-2px); }
          .share-action-btn:hover svg { stroke: #000; }

          .community { margin-top: clamp(48px, 7vw, 110px); position: relative; }
          .community-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border-glass); }
          .comm-tag { font-family: 'Space Grotesk', sans-serif; color: var(--accent); font-size: clamp(12px, 1.1vw, 15px); font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
          .community-body { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; padding: clamp(24px, 3.5vw, 42px) 0; }
          .comm-heading { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 4.8vw, 72px); line-height: 0.94; letter-spacing: -0.06em; font-weight: 700; max-width: 720px; color: var(--heading-dynamic); }
          .comm-heading span { color: var(--text-dark); }
          .comm-btn-prime { height: clamp(44px, 3.8vw, 54px); padding: 0 clamp(22px, 2.2vw, 34px); display: inline-flex; align-items: center; gap: 12px; border-radius: 100px; background: var(--btn-main-bg); color: var(--btn-main-text); text-decoration: none; font-family: 'Space Grotesk', sans-serif; font-size: clamp(11px, 0.85vw, 13px); font-weight: 800; letter-spacing: 1.1px; white-space: nowrap; transition: all 0.3s ease; }
          .comm-btn-prime:hover { background: var(--accent); color: #000; box-shadow: 0 0 25px var(--accent-glow); transform: translateY(-2px); }

          .footer { margin-top: clamp(44px, 6vw, 80px); border-top: 1px solid var(--border-glass); padding: 20px 0 calc(20px + env(safe-area-inset-bottom)); display: flex; align-items: center; justify-content: space-between; color: var(--text-dark); font-family: 'Space Grotesk', sans-serif; font-size: clamp(8.5px, 0.7vw, 10.5px); letter-spacing: 1.2px; text-transform: uppercase; font-weight: 600; }
          .footer strong { color: var(--text-muted); }

          #tg-overlay { position: fixed; inset: 0; z-index: 99998; background: rgba(2, 6, 12, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); opacity: 0; pointer-events: none; transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1); }
          #tg-overlay.show { opacity: 1; pointer-events: all; }
          #tg-popup { position: fixed; left: 50%; top: 50%; z-index: 99999; width: min(420px, 90vw); background: var(--bg-card); border: 1px solid var(--border-glass-bright); border-radius: 28px; padding: clamp(28px, 4.5vw, 40px); color: var(--text-main); text-align: center; box-shadow: 0 40px 100px rgba(0,0,0,0.85), 0 0 30px rgba(0,255,204,0.2); transform: translate(-50%, -46%) scale(0.92); opacity: 0; pointer-events: none; transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
          #tg-popup.show { opacity: 1; pointer-events: all; transform: translate(-50%, -50%) scale(1); }
          #tg-popup.hiding { opacity: 0 !important; pointer-events: none !important; transform: translate(-50%, -54%) scale(0.9) !important; transition: opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1), transform 1.5s cubic-bezier(0.16, 1, 0.3, 1) !important; }
          #tg-overlay.hiding { opacity: 0 !important; pointer-events: none !important; transition: opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1) !important; }
          .tg-modal-icon { width: 68px; height: 68px; margin: 0 auto 20px; background: rgba(0, 255, 204, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0, 255, 204, 0.25); box-shadow: 0 0 25px rgba(0, 255, 204, 0.25); }
          .tg-modal-icon svg { width: 34px; height: 34px; fill: var(--accent); }
          #tg-popup h3 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(20px, 2.5vw, 24px); font-weight: 800; color: #fff; margin-bottom: 8px; text-transform: uppercase; }
          #tg-popup p { font-size: clamp(13px, 1.1vw, 15px); color: var(--text-main); line-height: 1.5; margin-bottom: 24px; font-weight: 600; }
          #tg-join { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 52px; border-radius: 100px; background: linear-gradient(135deg, #00ffcc 0%, #0096ff 100%); color: #000; font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(0, 255, 204, 0.3); cursor: pointer; margin-bottom: 12px; }
          #tg-join:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0, 255, 204, 0.5); filter: brightness(1.1); }
          #tg-close { background: transparent; border: 1px solid var(--border-glass-bright); color: var(--text-muted); font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px 20px; border-radius: 100px; cursor: pointer; transition: all 0.3s ease; }
          #tg-close:hover { border-color: var(--accent); color: var(--text-main); }
          #status { position: fixed; left: 16px; bottom: 16px; z-index: 1000; color: #fff; background: rgba(5, 10, 15, 0.85); border: 1px solid rgba(0, 255, 204, 0.3); border-radius: 10px; padding: 10px 16px; font-size: 12px; backdrop-filter: blur(10px); }
          #status:empty { display: none; }

          @media (max-width: 680px) {
            .live-pill-badge { display: none; }
            .community-body { grid-template-columns: 1fr; gap: 18px; }
            .comm-btn-prime { width: 100%; justify-content: center; }
            .player-meta-bar { flex-direction: column; align-items: flex-start; }
            .share-action-btn { width: 100%; justify-content: center; }
          }
        </style>

        <div class="sweep"></div>
        <canvas id="warpGridCanvas"></canvas>

        <div class="container">
          <header class="nav">
            <a class="brand" href="${tg}" target="_blank" rel="noopener"><div class="brand-title">CRICXCRATE</div></a>
            <div class="nav-actions">
              <div class="live-pill-badge"><i class="pulsing-live-dot"></i>ON AIR</div>
              <aside class="theme-switch-deck">
                <button class="mode-toggle-btn active" id="themeDarkBtn"><i></i> Obs</button>
                <button class="mode-toggle-btn" id="themeLightBtn"><i></i> Cer</button>
              </aside>
              <a class="nav-join-btn" href="${tg}" target="_blank" rel="noopener">JOIN</a>
            </div>
          </header>

          <section class="hero">
            <div class="hero-tag">FOOTBALL ARENA LIVE</div>
            <h1 class="hero-headline" id="heroHeadlineText">LOADING...</h1>
          </section>

          <div class="controls-header-bar">
            <input type="text" class="channel-search-input" id="channelSearchInput" placeholder="Search football channels...">
            <div class="channel-selector-bar" id="channelSelector"></div>
          </div>

          <main class="broadcast">
            <div class="track-separator-beam"></div>
            <div class="player-rig-box">
              <div id="player-wrap" class="shaka-video-container">
                <video autoplay muted playsinline id="video" class="shaka-video"></video>
              </div>
            </div>
            <div class="player-meta-bar">
              <div class="stream-title-group">
                <div class="audio-equalizer"><span></span><span></span><span></span></div>
                <div class="stream-text-details">
                  <strong id="currentChannelTitle">Match Arena Feed</strong>
                  <span>CricxCrate Exclusive Access</span>
                </div>
              </div>
              <button class="share-action-btn" id="btnShare">
                <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                <span id="shareBtnText">SHARE STREAM</span>
              </button>
            </div>
          </main>

          <section class="community">
            <div class="community-header"><div class="comm-tag">CRICXCRATE</div></div>
            <div class="community-body">
              <h2 class="comm-heading">Stay connected.<br><span>Never miss a match.</span></h2>
              <a class="comm-btn-prime" href="${tg}" target="_blank" rel="noopener">JOIN COMMUNITY</a>
            </div>
          </section>

          <footer class="footer">
            <span>© 2026 <strong>CRICXCRATE</strong></span>
            <span>NEON SUITE PRO</span>
          </footer>
        </div>

        <div id="tg-overlay"></div>
        <div id="tg-popup">
          <div class="tg-modal-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.21 3.45-.49.33-.94.49-1.35.48-.45-.01-1.31-.25-1.95-.46-.79-.26-1.42-.4-1.36-.84.03-.23.35-.47.96-.73 3.77-1.64 6.29-2.73 7.55-3.25 3.59-1.49 4.33-1.75 4.81-1.76.11 0 .35.03.48.14.11.09.14.22.15.34-.01.07-.01.19-.02.26z"/></svg>
          </div>
          <h3>Join For Free HD Links</h3>
          <p>Get instant access to all football feeds, updates, and live streaming links.</p>
          <a id="tg-join" href="${tg}" target="_blank" rel="noopener">JOIN TELEGRAM NOW</a>
          <button id="tg-close" type="button">I've Joined / Continue</button>
        </div>
        <div id="status">Connecting to broadcast...</div>
      `;
    }

    showStatus(text) {
      const s = this._shadow.querySelector('#status');
      if (s) s.textContent = text;
    }

    initPopup() {
      const overlay = this._shadow.querySelector('#tg-overlay');
      const popup = this._shadow.querySelector('#tg-popup');
      if (!overlay || !popup) return;
      overlay.classList.remove('hiding');
      popup.classList.remove('hiding');
      overlay.classList.add('show');
      popup.classList.add('show');
    }

    hidePopup() {
      const overlay = this._shadow.querySelector('#tg-overlay');
      const popup = this._shadow.querySelector('#tg-popup');
      if (!overlay || !popup) return;
      overlay.classList.add('hiding');
      popup.classList.add('hiding');
      setTimeout(() => {
        overlay.classList.remove('show', 'hiding');
        popup.classList.remove('show', 'hiding');
      }, 1500);
    }

    async initPlayer() {
      if (typeof shaka === 'undefined') {
        setTimeout(() => this.initPlayer(), 100);
        return;
      }
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        this.showStatus('Browser not supported for Shaka Player');
        return;
      }

      const video = this._shadow.querySelector('#video');
      const videoContainer = this._shadow.querySelector('#player-wrap');

      this.playerInstance = new shaka.Player(video);
      const ui = new shaka.ui.Overlay(this.playerInstance, videoContainer, video);
      this.controlsInstance = ui.getControls();

      ui.configure({
        controlPanelElements: ["play_pause", "mute", "volume", "spacer", "time_and_duration", "quality", "fullscreen", "overflow_menu"]
      });

      this.renderChannelButtons(this.channels);
      if (this.currentActiveChannel) {
        this.loadChannel(this.currentActiveChannel);
      }
    }

    async loadChannel(channel) {
      this.currentActiveChannel = channel;
      this.showStatus('Switching to ' + channel.channel_name + '...');

      const heroHeading = this._shadow.querySelector('#heroHeadlineText');
      if (heroHeading) heroHeading.innerHTML = channel.channel_name.toUpperCase() + ' <br><span class="accent-txt">LIVE STREAM.</span>';

      const metaTitle = this._shadow.querySelector('#currentChannelTitle');
      if (metaTitle) metaTitle.textContent = channel.channel_name + ' · Live Broadcast';

      const clearKeysObj = {};
      if (channel.stream_keys) {
        const parts = channel.stream_keys.split(':');
        if (parts.length === 2) clearKeysObj[parts[0].trim()] = parts[1].trim();
      }

      this.playerInstance.configure({
        streaming: { lowLatencyMode: true, bufferingGoal: 6, rebufferingGoal: 1, bufferBehind: 15, stallEnabled: true, stallThreshold: 1 },
        drm: { clearKeys: clearKeysObj, preferredKeySystems: ['org.w3.clearkey'] }
      });

      try {
        await this.playerInstance.load(channel.stream_url);
        if (this.playerInstance.isLive()) {
          this.playerInstance.seek(this.playerInstance.seekRange().end);
        }
        this.showStatus('');

        const buttons = this._shadow.querySelectorAll('.channel-btn');
        buttons.forEach(btn => {
          if (btn.textContent === channel.channel_name) btn.classList.add('active');
          else btn.classList.remove('active');
        });

        this.switchCount++;
        if (this.switchCount % 10 === 0) this.initPopup();
      } catch (e) {
        this.showStatus('');
      }
    }

    renderChannelButtons(channelsList) {
      const container = this._shadow.querySelector('#channelSelector');
      container.innerHTML = '';
      if (!channelsList || channelsList.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted); font-size:12px; padding:10px;">No matching channels found.</span>';
        return;
      }
      channelsList.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'channel-btn';
        btn.textContent = ch.channel_name;
        if (this.currentActiveChannel && this.currentActiveChannel.id === ch.id) btn.classList.add('active');

        btn.onclick = (e) => {
          const rect = btn.getBoundingClientRect();
          const ripple = document.createElement('span');
          ripple.className = 'kick-ripple';
          ripple.style.left = (e.clientX - rect.left) + 'px';
          ripple.style.top = (e.clientY - rect.top) + 'px';
          ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
          btn.appendChild(ripple);
          setTimeout(() => ripple.remove(), 600);
          this.loadChannel(ch);
        };
        container.appendChild(btn);
      });
    }

    initEventListeners() {
      const searchInput = this._shadow.querySelector("#channelSearchInput");
      searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        const filtered = this.channels.filter(ch => ch.channel_name.toLowerCase().includes(keyword));
        this.renderChannelButtons(filtered);
      });

      const btnShare = this._shadow.querySelector("#btnShare");
      const shareBtnText = this._shadow.querySelector("#shareBtnText");
      btnShare.addEventListener("click", async () => {
        const shareText = "Live Match Feed\n" + window.location.href;
        try {
          if (navigator.share && /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent)) {
            await navigator.share({ title: "CRICXCRATE", text: shareText, url: window.location.href });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareText);
            const originalText = shareBtnText.textContent;
            shareBtnText.textContent = "LINK COPIED!";
            setTimeout(() => shareBtnText.textContent = originalText, 1800);
          }
        } catch (err) {}
      });

      const darkBtn = this._shadow.querySelector("#themeDarkBtn");
      const lightBtn = this._shadow.querySelector("#themeLightBtn");
      darkBtn.addEventListener("click", () => {
        this.removeAttribute("data-theme");
        darkBtn.classList.add("active");
        lightBtn.classList.remove("active");
      });
      lightBtn.addEventListener("click", () => {
        this.setAttribute("data-theme", "light");
        lightBtn.classList.add("active");
        darkBtn.classList.remove("active");
      });

      this._shadow.querySelector("#tg-close").addEventListener("click", () => this.hidePopup());
      this._shadow.querySelector("#tg-overlay").addEventListener("click", () => this.hidePopup());
      this._shadow.querySelector("#tg-join").addEventListener("click", () => {
        window.open(this.config.TELEGRAM_URL || "#", '_blank');
        this.hidePopup();
      });
    }

    initWarpField() {
      const canvas = this._shadow.querySelector('#warpGridCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const stars = [];
      const SENSITIVITY = 2.5;
      const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
      window.addEventListener('resize', resize);
      resize();

      const starCount = Math.min(120, Math.floor(window.innerWidth / 12));
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: (Math.random() * 24 + 10) * SENSITIVITY * 0.8,
          speed: (Math.random() * 2.5 + 1.2) * SENSITIVITY,
          alpha: Math.random() * 0.5 + 0.15
        });
      }
      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 1.2;
        stars.forEach(star => {
          ctx.strokeStyle = this.getAttribute('data-theme') === 'light'
            ? `rgba(0, 200, 180, ${star.alpha * 0.8})`
            : `rgba(0, 255, 204, ${star.alpha})`;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x + star.length, star.y);
          ctx.stroke();
          star.x += star.speed;
          if (star.x > canvas.width) { star.x = -star.length; star.y = Math.random() * canvas.height; }
        });
        requestAnimationFrame(render);
      };
      render();
    }
  }

  customElements.define('cricxcrate-ui', CricXCrateUI);
})();
