class FootXCrateUI extends HTMLElement {
  #root;
  #playerInstance = null;
  #shakaInstance = null;
  #engineStarted = false;
  #playlist = [];
  #currentChannel = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'closed' });
  }

  async connectedCallback() {
    await this.#render();
    this.#bindInteractions();
    this.#runBootSequence();
  }

  disconnectedCallback() {
    if (this.#playerInstance) this.#playerInstance.destroy();
    if (this.#shakaInstance) this.#shakaInstance.destroy();
  }

  // Public method to load all TNT channels
  loadChannels(channelList) {
    if (!Array.isArray(channelList) || channelList.length === 0) return;
    this.#playlist = channelList;
    this.#renderChannelPills();
    
    // Default to the first channel
    this.#currentChannel = this.#playlist[0];
    this.#updateUIHeader(this.#currentChannel);

    if (this.#engineStarted) {
      this.#switchStream(this.#currentChannel);
    }
  }

  async #render() {
    let plyrSvg = '';
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.svg');
      plyrSvg = await res.text();
    } catch (e) {
      console.warn('Plyr icons offline fallback enabled');
    }

    this.#root.innerHTML = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css">

      <style>
        :host {
          --ucl-dark: #020612;
          --ucl-deep-blue: #040d28;
          --ucl-cyan: #00d2ff;
          --ucl-blue: #0066ff;
          --ucl-glow: rgba(0, 210, 255, 0.35);
          --ucl-card: rgba(8, 16, 38, 0.65);
          --ucl-card-active: rgba(0, 102, 255, 0.15);
          --ucl-border: rgba(255, 255, 255, 0.08);
          --ucl-border-hover: rgba(0, 210, 255, 0.4);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          --plyr-color-main: var(--ucl-cyan);

          display: block;
          position: relative;
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: 
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 102, 255, 0.25), transparent 70%),
            radial-gradient(circle at 100% 50%, rgba(0, 210, 255, 0.08), transparent 50%),
            var(--ucl-dark);
          color: var(--text-primary);
          overflow-x: hidden;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .container {
          width: min(1360px, 94vw);
          margin: 0 auto;
          padding: 0 0 clamp(40px, 6vw, 90px);
          position: relative;
          z-index: 10;
        }

        /* Minimal Header */
        .header {
          height: clamp(64px, 8vh, 88px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--ucl-border);
        }

        .brand-cluster {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .brand-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--ucl-border-hover);
          box-shadow: 0 0 16px var(--ucl-glow);
        }

        .brand-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .brand-name {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: clamp(16px, 1.4vw, 20px);
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--ucl-cyan);
          background: rgba(0, 210, 255, 0.1);
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid rgba(0, 210, 255, 0.2);
        }

        .btn-tg-header {
          padding: 8px 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--ucl-blue), var(--ucl-cyan));
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          text-decoration: none;
          letter-spacing: 0.5px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 18px var(--ucl-glow);
        }

        .btn-tg-header:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }

        /* Player Section */
        .player-wrapper {
          margin-top: clamp(20px, 3vh, 32px);
          position: relative;
        }

        .player-card {
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: clamp(16px, 2vw, 24px);
          overflow: hidden;
          border: 1px solid var(--ucl-border);
          box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.95);
          position: relative;
        }

        video#player {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        /* Channel Switcher Dock */
        .channel-dock {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .channel-tab {
          background: var(--ucl-card);
          border: 1px solid var(--ucl-border);
          border-radius: 14px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .channel-tab:hover {
          border-color: var(--ucl-border-hover);
          transform: translateY(-2px);
        }

        .channel-tab.active {
          background: var(--ucl-card-active);
          border-color: var(--ucl-cyan);
          box-shadow: 0 0 20px rgba(0, 210, 255, 0.18);
        }

        .channel-tab.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--ucl-cyan);
        }

        .channel-logo-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #000;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--ucl-border);
          flex-shrink: 0;
        }

        .channel-logo-wrap img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .channel-meta {
          display: flex;
          flex-direction: column;
        }

        .channel-meta-title {
          font-weight: 700;
          font-size: 13.5px;
          color: var(--text-primary);
        }

        .channel-meta-status {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .channel-tab.active .channel-meta-status {
          color: var(--ucl-cyan);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        /* Stream Meta Info Bar */
        .meta-strip {
          margin-top: 20px;
          padding: 16px 20px;
          background: var(--ucl-card);
          border: 1px solid var(--ucl-border);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
        }

        .meta-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .btn-share {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--ucl-border);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-share:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--ucl-cyan);
        }

        /* Boot Screen (Cleaned, No Top Bar) */
        .ucl-boot-screen {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: var(--ucl-dark);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: opacity 0.4s ease, visibility 0.4s ease;
        }

        .ucl-boot-screen.fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .boot-avatar-rig {
          position: relative;
          width: 90px;
          height: 90px;
          margin-bottom: 24px;
        }

        .boot-halo {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--ucl-glow) 0%, transparent 70%);
          animation: pulseHalo 2s ease-in-out infinite alternate;
        }

        @keyframes pulseHalo {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        .boot-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--ucl-border-hover);
          position: relative;
          z-index: 2;
        }

        .boot-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--ucl-cyan);
          font-weight: 700;
          margin-bottom: 12px;
        }

        .boot-bar {
          width: min(320px, 80vw);
          height: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 100px;
          overflow: hidden;
          position: relative;
        }

        .boot-fill {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 0%;
          background: linear-gradient(90deg, var(--ucl-blue), var(--ucl-cyan));
          border-radius: 100px;
          transition: width 0.3s ease;
          box-shadow: 0 0 12px var(--ucl-cyan);
        }

        /* Minimal Telegram Popup Modal */
        .modal-screen {
          position: fixed;
          inset: 0;
          z-index: 99998;
          background: rgba(2, 6, 18, 0.88);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          transition: opacity 0.3s ease, visibility 0.3s ease;
        }

        .modal-screen.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .modal-box {
          background: rgba(8, 16, 38, 0.85);
          border: 1px solid var(--ucl-border-hover);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 210, 255, 0.1);
          border-radius: 24px;
          width: min(440px, 100%);
          padding: clamp(28px, 4vw, 40px);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .modal-avatar {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid var(--ucl-border-hover);
          margin-bottom: 20px;
          box-shadow: 0 0 20px var(--ucl-glow);
        }

        .modal-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .modal-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(22px, 2.5vw, 26px);
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }

        .modal-desc {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.55;
          margin-bottom: 28px;
        }

        .btn-modal-join {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--ucl-blue), var(--ucl-cyan));
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 25px var(--ucl-glow);
          margin-bottom: 12px;
        }

        .btn-modal-join:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }

        .btn-modal-dismiss {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .btn-modal-dismiss:hover {
          color: var(--text-primary);
        }

        .hidden-sprite { display: none; }
      </style>

      <div class="hidden-sprite">${plyrSvg}</div>

      <!-- Minimal Boot Screen (Top Bar Removed) -->
      <aside class="ucl-boot-screen" id="bootScreen">
        <div class="boot-avatar-rig">
          <div class="boot-halo"></div>
          <img class="boot-avatar-img" src="https://files.catbox.moe/crndi2.jpg" alt="FootxCrate">
        </div>
        <div class="boot-title">CONNECTING BROADCAST FEED</div>
        <div class="boot-bar">
          <div class="boot-fill" id="bootFill"></div>
        </div>
      </aside>

      <!-- Minimal Popup Modal -->
      <div id="tgPopup" class="modal-screen hidden">
        <div class="modal-box">
          <div class="modal-avatar">
            <img src="https://files.catbox.moe/crndi2.jpg" alt="FootxCrate">
          </div>
          <h2 class="modal-heading">FootxCrate</h2>
          <p class="modal-desc">Join the official FootxCrate telegram community for live streams updates clips and many more.</p>

          <button class="btn-modal-join" id="btnTgJoin">JOIN FOOTXCRATE</button>
          <button class="btn-modal-dismiss" id="btnTgClose">Continue to Broadcast</button>
        </div>
      </div>

      <div class="container">
        <!-- Minimal Navbar -->
        <header class="header">
          <a class="brand-cluster" href="#">
            <div class="brand-avatar">
              <img src="https://files.catbox.moe/crndi2.jpg" alt="Logo">
            </div>
            <div class="brand-name">
              FootxCrate <span class="brand-tag">UCL LIVE</span>
            </div>
          </a>

          <a class="btn-tg-header" id="headerJoinBtn" href="#" target="_blank" rel="noopener">
            JOIN TELEGRAM
          </a>
        </header>

        <!-- Player Stage -->
        <div class="player-wrapper">
          <div class="player-card">
            <video id="player" playsinline crossorigin="anonymous"></video>
          </div>

          <!-- Channel Selection Grid -->
          <div class="channel-dock" id="channelDock"></div>

          <!-- Meta Information Strip -->
          <div class="meta-strip">
            <div class="meta-heading" id="currentStreamTitle">Loading TNT Sports Channel...</div>
            <button class="btn-share" id="btnShare">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
              <span id="shareText">SHARE MATCH</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  #getTelegramLink() {
    return this.getAttribute('telegram-link') || 'https://t.me/+td-BEF1c2B1kMjk1';
  }

  #bindInteractions() {
    const tgUrl = this.#getTelegramLink();
    const headerJoinBtn = this.#root.getElementById('headerJoinBtn');
    if (headerJoinBtn) headerJoinBtn.href = tgUrl;

    const popup = this.#root.getElementById('tgPopup');
    const closePopup = () => {
      popup.classList.add('hidden');
      sessionStorage.setItem('footx_auth_pass', 'true');
    };

    this.#root.getElementById('btnTgJoin').addEventListener('click', () => {
      window.open(tgUrl, '_blank', 'noopener');
      closePopup();
      this.#startEngine();
    });

    this.#root.getElementById('btnTgClose').addEventListener('click', () => {
      closePopup();
      this.#startEngine();
    });

    this.#root.getElementById('btnShare').addEventListener('click', async () => {
      const label = this.#root.getElementById('shareText');
      const shareData = {
        title: 'FootxCrate — UEFA Champions League Live',
        text: 'Watch live UEFA Champions League on TNT Sports with FootxCrate!',
        url: window.location.href
      };

      try {
        if (navigator.share && /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent)) {
          await navigator.share(shareData);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          const orig = label.textContent;
          label.textContent = 'LINK COPIED!';
          setTimeout(() => { label.textContent = orig; }, 1800);
        }
      } catch (e) {}
    });
  }

  #renderChannelPills() {
    const dock = this.#root.getElementById('channelDock');
    if (!dock) return;
    dock.innerHTML = '';

    this.#playlist.forEach((item) => {
      const pill = document.createElement('div');
      pill.className = 'channel-tab';
      if (this.#currentChannel && this.#currentChannel.channel_name === item.channel_name) {
        pill.classList.add('active');
      }

      pill.innerHTML = `
        <div class="channel-logo-wrap">
          <img src="${item.channel_logo}" alt="${item.channel_name}">
        </div>
        <div class="channel-meta">
          <span class="channel-meta-title">${item.channel_name}</span>
          <span class="channel-meta-status"><i class="status-dot"></i> LIVE BROADCAST</span>
        </div>
      `;

      pill.addEventListener('click', () => {
        if (this.#currentChannel === item) return;
        this.#currentChannel = item;
        this.#updateUIHeader(item);
        this.#switchStream(item);
        this.#renderChannelPills();
      });

      dock.appendChild(pill);
    });
  }

  #updateUIHeader(item) {
    const stream = item.streams[0];
    const headerTitle = this.#root.getElementById('currentStreamTitle');
    if (headerTitle) headerTitle.textContent = `${stream.source_name} · UEFA Champions League Live`;
  }

  #runBootSequence() {
    const screen = this.#root.getElementById('bootScreen');
    const fill = this.#root.getElementById('bootFill');
    const popup = this.#root.getElementById('tgPopup');

    let pct = 0;
    const interval = setInterval(() => {
      pct += 25;
      if (fill) fill.style.width = pct + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          screen.classList.add('fade-out');
          if (sessionStorage.getItem('footx_auth_pass') !== 'true') {
            popup.classList.remove('hidden');
          } else {
            this.#startEngine();
          }
        }, 400);
      }
    }, 280);
  }

  async #startEngine() {
    if (this.#engineStarted) return;
    this.#engineStarted = true;

    try {
      if (!window.shaka || !window.Plyr) return;
      window.shaka.polyfill.installAll();

      if (!window.shaka.Player.isBrowserSupported()) return;

      const video = this.#root.getElementById('player');
      video.muted = true;
      video.autoplay = true;

      const player = new window.shaka.Player(video);
      this.#shakaInstance = player;

      this.#initPlyr(video, player);

      if (this.#currentChannel) {
        await this.#switchStream(this.#currentChannel);
      }
    } catch (err) {
      this.#engineStarted = false;
    }
  }

  async #switchStream(channelData) {
    if (!this.#shakaInstance || !channelData) return;
    const stream = channelData.streams[0];

    let keyId = null;
    let keyVal = null;
    if (stream.stream_keys && stream.stream_keys.includes(':')) {
      [keyId, keyVal] = stream.stream_keys.split(':');
    }

    const config = {
      manifest: { defaultPresentationDelay: 2, dash: { ignoreMinBufferTime: true } },
      streaming: { lowLatencyMode: true, bufferingGoal: 6, rebufferingGoal: 2, jumpLargeGaps: true }
    };

    if (keyId && keyVal) {
      config.drm = { clearKeys: { [keyId]: keyVal } };
    } else {
      config.drm = { clearKeys: {} };
    }

    this.#shakaInstance.configure(config);

    try {
      await this.#shakaInstance.load(stream.stream_url);
      const video = this.#root.getElementById('player');
      if (video) await video.play().catch(() => {});
    } catch (err) {
      console.warn('Playback error on feed swap:', err);
    }
  }

  #initPlyr(videoEl, shakaPlayer) {
    if (this.#playerInstance) return;

    this.#playerInstance = new window.Plyr(videoEl, {
      autoplay: true,
      muted: true,
      loadSprite: false,
      iconUrl: '',
      controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen']
    });

    const triggerAudio = () => {
      videoEl.muted = false;
      videoEl.volume = 1;
      this.#root.removeEventListener('click', triggerAudio);
      this.#root.removeEventListener('touchstart', triggerAudio);
    };
    this.#root.addEventListener('click', triggerAudio, { passive: true });
    this.#root.addEventListener('touchstart', triggerAudio, { passive: true });
  }
}

customElements.define('footxcrate-ui', FootXCrateUI);
