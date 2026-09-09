class FootXCrateUI extends HTMLElement {
  static get observedAttributes() {
    return ['telegram-link'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._playerInstance = null;
    this._shakaInstance = null;
    this._engineStarted = false;
    this._animId = null;
    this._currentChannelIdx = 0;

    this._tntChannels = [
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
  }

  connectedCallback() {
    this._render();
    // Use a slight delay to ensure the DOM is painted before targeting elements
    setTimeout(() => {
      this._initWarpField();
      this._bindInteractions();
      this._runBootSequence();
    }, 50);
  }

  disconnectedCallback() {
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._playerInstance) this._playerInstance.destroy();
    if (this._shakaInstance) this._shakaInstance.destroy();
  }

  _render() {
    this._root.innerHTML = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@600;700;800&family=Space+Grotesk:wght@600;700;800&family=Syne:wght@800;900&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css">

      <style>
        :host {
          --primary-rgb: 0, 85, 255;
          --secondary-rgb: 0, 200, 255;
          --accent: rgb(var(--primary-rgb));
          --accent-glow: rgba(var(--primary-rgb), 0.55);
          --accent-glow-intense: rgba(var(--primary-rgb), 0.85);
          --bg-pure: #00040a;
          --bg-card: rgba(4, 12, 28, 0.75);
          --border-glass: rgba(0, 200, 255, 0.15);
          --border-glass-bright: rgba(0, 200, 255, 0.35);
          --text-pure: #ffffff;
          --text-main: #f0f4f8;
          --text-muted: #8a9bb2;
          --text-dark: #415570;
          --btn-main-bg: #ffffff;
          --btn-main-text: #00122e;
          --player-shadow: 0 30px 90px -15px rgba(0, 10, 30, 0.95);
          --hud-bg: rgba(2, 8, 20, 0.85);
          --plyr-color-main: var(--accent);

          display: block;
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: radial-gradient(circle at 50% 0%, rgba(0, 85, 255, 0.18) 0%, transparent 60%), #00040a;
          color: var(--text-main);
          overflow-x: hidden;
          font-size: 15px;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }

        #warpGridCanvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
          opacity: 0.6;
        }

        .container {
          width: min(1400px, 94vw);
          margin: 0 auto;
          padding-bottom: 80px;
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
          padding: 20px;
          transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        .boot-screen.fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .boot-hud-card {
          display: flex;
          align-items: center;
          gap: clamp(12px, 3vw, 32px);
          margin-bottom: 24px;
          padding: 10px 20px;
          border-radius: 14px;
          background: rgba(4, 12, 28, 0.85);
          border: 1px solid var(--border-glass-bright);
        }

        .hud-stat-box { display: flex; flex-direction: column; align-items: center; }
        .hud-stat-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: var(--text-muted); }
        .hud-stat-val { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .hud-stat-val.accent { color: rgb(var(--secondary-rgb)); }

        .shift-bank { display: flex; gap: 4px; margin-top: 4px; }
        .shift-led { width: 6px; height: 10px; border-radius: 2px; background: rgba(255, 255, 255, 0.1); }
        .shift-led.cyan.on { background: #00c8ff; box-shadow: 0 0 8px #00c8ff; }
        .shift-led.blue.on { background: #0055ff; box-shadow: 0 0 8px #0055ff; }
        .shift-led.white.on { background: #ffffff; box-shadow: 0 0 10px #ffffff; }

        .gyro-badge-rig {
          position: relative;
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }
        .gyro-aura {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--accent-glow-intense) 0%, transparent 75%);
          filter: blur(16px);
        }
        .gyro-inner-media {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          z-index: 5;
          border: 2px solid rgba(0, 200, 255, 0.5);
        }
        .gyro-inner-media img { width: 100%; height: 100%; object-fit: cover; }

        .boot-status-text {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 16px;
          text-align: center;
        }

        .boot-progress-arena {
          width: min(320px, 85vw);
          height: 4px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          position: relative;
        }
        .boot-track-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #0055ff, #00c8ff);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .popup-modal-screen {
          position: fixed;
          inset: 0;
          z-index: 99998;
          background: rgba(0, 4, 10, 0.96);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
        }
        .popup-modal-screen.hidden { display: none; }

        .fs-media-frame {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          margin-bottom: 20px;
          border: 2px solid #00c8ff;
          box-shadow: 0 0 25px rgba(0, 200, 255, 0.4);
        }
        .fs-media-frame img { width: 100%; height: 100%; object-fit: cover; }

        .fs-master-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(26px, 5vw, 42px);
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }
        .fs-master-desc {
          font-size: 14px;
          color: #8f9db0;
          max-width: 360px;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .fs-btn-apex {
          width: min(280px, 90vw);
          height: 48px;
          border: 0;
          border-radius: 100px;
          background: linear-gradient(135deg, #0055ff, #00c8ff);
          color: #fff;
          font-weight: 800;
          letter-spacing: 1.5px;
          cursor: pointer;
        }
        .fs-btn-dismiss {
          background: transparent;
          border: 0;
          color: #687a90;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          margin-top: 14px;
          cursor: pointer;
        }

        .nav {
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #fff;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 800;
        }
        .brand-media-shell {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          overflow: hidden;
          border: 1px solid rgba(0, 200, 255, 0.4);
        }
        .brand-media-shell img { width: 100%; height: 100%; object-fit: cover; }

        .hero { padding: 30px 0 20px; }
        .hero-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(38px, 8vw, 84px);
          line-height: 0.9;
          font-weight: 900;
          text-transform: uppercase;
        }
        .hero-headline span {
          background: linear-gradient(135deg, #00c8ff, #fff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .player-rig-box {
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border-glass-bright);
          box-shadow: var(--player-shadow);
          position: relative;
        }
        video#player { width: 100%; height: 100%; object-fit: contain; }

        .player-hud-overlay {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          pointer-events: none;
          z-index: 20;
        }
        .hud-pill {
          background: var(--hud-bg);
          border: 1px solid var(--border-glass);
          padding: 4px 10px;
          border-radius: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #fff;
          backdrop-filter: blur(8px);
        }

        .player-meta-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
        }
        .channel-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          background: var(--bg-card);
          padding: 6px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
        }
        .channel-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .channel-btn.active {
          background: var(--accent);
          color: #fff;
        }

        .comm-btn-prime {
          display: block;
          text-align: center;
          margin-top: 30px;
          padding: 16px;
          border-radius: 100px;
          background: #ffffff;
          color: #00122e;
          font-weight: 800;
          text-decoration: none;
          letter-spacing: 1px;
        }
      </style>

      <canvas id="warpGridCanvas"></canvas>

      <aside class="boot-screen" id="appBootScreen">
        <div class="boot-hud-card">
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">FORMATION</span>
            <span class="hud-stat-val accent" id="bootStat1">4-3-3</span>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">STATUS</span>
            <div class="shift-bank">
              <div class="shift-led cyan on" id="led1"></div>
              <div class="shift-led cyan on" id="led2"></div>
              <div class="shift-led blue" id="led3"></div>
              <div class="shift-led white" id="led4"></div>
            </div>
          </div>
          <div class="hud-stat-box">
            <span class="hud-stat-lbl">STADIUM</span>
            <span class="hud-stat-val" id="bootStat2">LIVE</span>
          </div>
        </div>

        <div class="gyro-badge-rig">
          <div class="gyro-aura"></div>
          <div class="gyro-ring"></div>
          <div class="gyro-inner-media">
            <img src="https://files.catbox.moe/crndi2.jpg" alt="Badge">
          </div>
        </div>

        <div class="boot-status-text" id="bootStatusText">TUNING MULTIPLEX...</div>
        <div class="boot-progress-arena">
          <div class="boot-track-fill" id="bootProgress"></div>
        </div>
      </aside>

      <div id="tgPopup" class="popup-modal-screen hidden">
        <div class="fs-media-frame">
          <img src="https://files.catbox.moe/crndi2.jpg" alt="Logo">
        </div>
        <h2 class="fs-master-heading">FootxCrate Live</h2>
        <p class="fs-master-desc">Join our official Telegram community for live match links, alternate feeds, and instant goal replays.</p>
        <button class="fs-btn-apex" id="tgJoinBtn">JOIN TELEGRAM</button>
        <button class="fs-btn-dismiss" id="tgCloseBtn">WATCH BROADCAST</button>
      </div>

      <div class="container">
        <header class="nav">
          <a class="brand" href="https://t.me/+W6YlSdXBttFjOGM1" target="_blank" rel="noopener">
            <div class="brand-media-shell">
              <img src="https://files.catbox.moe/crndi2.jpg" alt="Brand">
            </div>
            <span>FOOTXCRATE</span>
          </a>
          <div class="hud-pill">MATCH STREAM</div>
        </header>

        <section class="hero">
          <h1 class="hero-headline">TNT <span>SPORTS.</span></h1>
        </section>

        <main>
          <div class="player-rig-box">
            <div class="player-hud-overlay">
              <div class="hud-pill" id="hudChannelText">TNT Sports 1 UK</div>
              <div class="hud-pill">1080P HD</div>
            </div>
            <video id="player" playsinline controls></video>
          </div>

          <div class="player-meta-bar">
            <div class="channel-switcher">
              <button class="channel-btn active" data-idx="0">TNT 1</button>
              <button class="channel-btn" data-idx="1">TNT 2</button>
              <button class="channel-btn" data-idx="2">TNT 3</button>
              <button class="channel-btn" data-idx="3">TNT 4</button>
            </div>
          </div>
        </main>

        <a class="comm-btn-prime" href="https://t.me/+W6YlSdXBttFjOGM1" target="_blank" rel="noopener">
          JOIN CRATE TELEGRAM
        </a>
      </div>
    `;
  }

  _initWarpField() {
    const canvas = this._root.getElementById('warpGridCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const stars = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random() * 20 + 5,
      speed: Math.random() * 2 + 1
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
      ctx.lineWidth = 1;
      stars.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
        s.x += s.speed;
        if (s.x > width) {
          s.x = -s.len;
          s.y = Math.random() * height;
        }
      });
      this._animId = requestAnimationFrame(draw);
    };
    draw();
  }

  _runBootSequence() {
    const bootScreen = this._root.getElementById('appBootScreen');
    const bootProgress = this._root.getElementById('bootProgress');
    const popup = this._root.getElementById('tgPopup');

    let pct = 0;
    const interval = setInterval(() => {
      pct += 25;
      if (bootProgress) bootProgress.style.width = pct + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          if (bootScreen) bootScreen.classList.add('fade-out');
          if (sessionStorage.getItem('crate_auth_pass') !== 'true') {
            if (popup) popup.classList.remove('hidden');
          } else {
            this._startStreamingEngine();
          }
        }, 400);
      }
    }, 250);
  }

  _bindInteractions() {
    const tgUrl = 'https://t.me/+W6YlSdXBttFjOGM1';
    const popup = this._root.getElementById('tgPopup');

    const closePopup = () => {
      if (popup) popup.classList.add('hidden');
      sessionStorage.setItem('crate_auth_pass', 'true');
      this._startStreamingEngine();
    };

    const joinBtn = this._root.getElementById('tgJoinBtn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        window.open(tgUrl, '_blank');
        closePopup();
      });
    }

    const dismissBtn = this._root.getElementById('tgCloseBtn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', closePopup);
    }

    const channelButtons = this._root.querySelectorAll('.channel-btn');
    channelButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        channelButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this._currentChannelIdx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const channel = this._tntChannels[this._currentChannelIdx];

        const hudText = this._root.getElementById('hudChannelText');
        if (hudText) hudText.textContent = channel.name;

        this._reloadStream();
      });
    });
  }

  async _startStreamingEngine() {
    if (this._engineStarted) return;
    this._engineStarted = true;

    try {
      if (!window.shaka) return;
      window.shaka.polyfill.installAll();

      if (!window.shaka.Player.isBrowserSupported()) return;

      const video = this._root.getElementById('player');
      video.muted = true;
      video.autoplay = true;

      const player = new window.shaka.Player(video);
      this._shakaInstance = player;

      const current = this._tntChannels[this._currentChannelIdx];
      const [keyId, keyVal] = current.keys.split(':');

      player.configure({
        drm: {
          clearKeys: { [keyId]: keyVal }
        },
        streaming: {
          lowLatencyMode: true,
          jumpLargeGaps: true
        }
      });

      await player.load(current.url);
      await video.play().catch(() => {});

      if (window.Plyr) {
        this._playerInstance = new window.Plyr(video, {
          autoplay: true,
          muted: true
        });
      }
    } catch (e) {
      this._engineStarted = false;
      console.error(e);
    }
  }

  async _reloadStream() {
    if (!this._shakaInstance) return;
    const current = this._tntChannels[this._currentChannelIdx];
    const [keyId, keyVal] = current.keys.split(':');

    try {
      this._shakaInstance.configure({
        drm: {
          clearKeys: { [keyId]: keyVal }
        }
      });
      await this._shakaInstance.load(current.url);
      const video = this._root.getElementById('player');
      if (video) await video.play().catch(() => {});
    } catch (e) {}
  }
}

customElements.define('footxcrate-ui', FootXCrateUI);
