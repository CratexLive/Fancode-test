// cricxcrate-ui.js
class CricXCrateUI extends HTMLElement {
    constructor() {
        super();
        // Strict Requirement: Create a closed Shadow DOM
        this._shadowRoot = this.attachShadow({ mode: 'closed' });
        
        this.masterChannels = [];
        this.playerInstance = null;
        this.controlsInstance = null;
        this.switchCount = 0;
        this.currentActiveChannel = null;
    }

    async connectedCallback() {
        // 1. Fetch secure data from your Cloudflare Worker first
        try {
            const response = await fetch(CRICX_CONFIG.API_URL);
            if (!response.ok) throw new Error("Domain Lock Triggered or API Offline");
            this.masterChannels = await response.json();
        } catch (error) {
            // If the user isn't on the allowed domain, the fetch fails here
            this._shadowRoot.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#050a0f; color:#ff2a2a; font-family:sans-serif; text-align:center;">
                    <h2>⚠️ Access Denied<br><span style="font-size:16px; color:#fff;">Sorry bro, you're not smart. Use the official domain.</span></h2>
                </div>`;
            return;
        }

        // 2. Dynamically load Shaka Player to the main document so its core features work
        await this.loadScript('https://cdn.jsdelivr.net/npm/shaka-player@latest/dist/shaka-player.ui.js');

        // 3. Render the UI inside the Shadow DOM
        this.render();
        
        // 4. Wait for DOM to paint, then initialize everything
        requestAnimationFrame(() => {
            this.initWarpField();
            this.initEventListeners();
            this.initPlayer();
            setTimeout(() => this.initPopup(), 400);
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = "anonymous";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    render() {
        // External CSS is appended directly into the Shadow DOM so it styles the scoped elements
        this._shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/shaka-player@latest/dist/controls.css" crossorigin="anonymous">
            <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Manrope:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700;800;900&family=Syne:wght@700;800;900&display=swap" rel="stylesheet">
            <style>
              :host { display: block; width: 100%; min-height: 100vh; }
              :root {
                --primary-rgb: 0, 255, 204; --accent: rgb(var(--primary-rgb)); --accent-glow: rgba(var(--primary-rgb), 0.45);
                --bg-pure: #050a0f; --bg-card: rgba(10, 22, 30, 0.82); --border-glass: rgba(0, 255, 204, 0.2);
                --border-glass-bright: rgba(0, 255, 204, 0.45); --heading-dynamic: #ffffff; --text-main: #e0f2f1;
                --text-muted: #78909c; --text-dark: #455a64; --btn-main-bg: #ffffff; --btn-main-text: #050a0f;
                --player-shadow: 0 45px 120px -20px rgba(0, 255, 204, 0.25);
              }
              #cricx-wrapper[data-theme="light"] {
                --primary-rgb: 0, 200, 180; --accent: #00c8b4; --bg-pure: #f0f7f7; --bg-card: rgba(255, 255, 255, 0.88);
                --border-glass: rgba(0, 0, 0, 0.1); --border-glass-bright: rgba(0, 200, 180, 0.4);
                --heading-dynamic: #000000; --text-main: #0a0f12; --text-muted: #546e7a; --btn-main-bg: #091015; --btn-main-text: #ffffff;
              }
              *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
              
              #cricx-wrapper { 
                background-color: var(--bg-pure); color: var(--text-main); font-family: 'Manrope', sans-serif; 
                overflow-x: hidden; min-height: 100vh; position: relative;
                background: radial-gradient(circle at 50% 0%, rgba(var(--primary-rgb), 0.12) 0%, transparent 60%), var(--bg-pure);
                transition: background 0.3s ease, color 0.3s ease;
              }
              #cricx-wrapper::before {
                content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 1;
                background: linear-gradient(115deg, transparent 40%, rgba(var(--primary-rgb), 0.04) 48%, rgba(var(--primary-rgb), 0.08) 50%, rgba(var(--primary-rgb), 0.04) 52%, transparent 60%);
                background-size: 250% 250%; animation: floodlightsSweep 12s ease-in-out infinite alternate;
              }
              @keyframes floodlightsSweep { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }

              /* ALL ORIGINAL CSS CLASSES GO HERE */
              #warpGridCanvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 0; opacity: 0.85; }
              .container { width: min(1500px, 92vw); margin: 0 auto; padding: 0 0 clamp(40px, 6vw, 100px); position: relative; z-index: 10; }
              .nav { height: clamp(64px, 8.5vh, 96px); display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 50; }
              .brand-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(20px, 2.2vw, 28px); font-weight: 900; letter-spacing: 1px; color: var(--heading-dynamic); }
              .nav-actions { display: flex; align-items: center; gap: clamp(8px, 1vw, 14px); }
              .theme-switch-deck { background: var(--bg-card); border: 1px solid var(--border-glass-bright); border-radius: 100px; padding: 3px; display: flex; align-items: center; gap: 3px; }
              .mode-toggle-btn { height: clamp(26px, 2.2vw, 34px); padding: 0 clamp(8px, 0.9vw, 12px); border: 0; background: transparent; color: var(--text-muted); font-size: clamp(7px, 0.6vw, 8.5px); cursor: pointer; border-radius: 100px; }
              .mode-toggle-btn.active { background: var(--accent); color: #000; }
              
              .hero { position: relative; padding: clamp(10px, 2vw, 30px) 0 clamp(10px, 1.5vw, 20px); }
              .hero-tag { font-family: 'Space Grotesk', sans-serif; color: var(--accent); font-weight: 800; }
              .hero-headline { margin-top: 10px; font-family: 'Syne', sans-serif; font-size: clamp(26px, 4.5vw, 65px); font-weight: 900; text-transform: uppercase; color: var(--heading-dynamic); }
              .hero-headline .accent-txt { color: var(--accent); -webkit-text-fill-color: transparent; }

              .controls-header-bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
              .channel-search-input { width: 100%; max-width: 320px; background: var(--bg-card); border: 1px solid var(--border-glass-bright); color: var(--text-main); padding: 8px 16px; border-radius: 100px; outline: none; }
              .channel-selector-bar { display: flex; gap: 10px; overflow-x: auto; padding: 6px 0 16px 0; white-space: nowrap; scrollbar-width: thin; scrollbar-color: var(--accent) var(--bg-card); }
              .channel-btn { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-glass); padding: 8px 18px; border-radius: 100px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; transition: all 0.3s ease; flex-shrink: 0; }
              .channel-btn.active { background: var(--accent); color: #000; }

              .player-rig-box { width: 100%; aspect-ratio: 16/9; position: relative; background: #000; border-radius: clamp(14px, 1.8vw, 26px); border: 1px solid var(--border-glass-bright); box-shadow: var(--player-shadow); overflow: hidden; z-index: 1; }
              #player-wrap, .shaka-video-container { position: absolute; inset: 0; width: 100%; height: 100%; }
              video#video { width: 100%; height: 100%; object-fit: contain; }

              #tg-overlay { position: fixed; inset: 0; z-index: 99998; background: rgba(2, 6, 12, 0.85); backdrop-filter: blur(16px); opacity: 0; pointer-events: none; transition: opacity 0.5s; }
              #tg-overlay.show { opacity: 1; pointer-events: all; }
              #tg-popup { position: fixed; left: 50%; top: 50%; z-index: 99999; width: min(420px, 90vw); background: var(--bg-card); border: 1px solid var(--border-glass-bright); border-radius: 28px; padding: 30px; text-align: center; transform: translate(-50%, -46%) scale(0.92); opacity: 0; pointer-events: none; transition: all 0.5s; }
              #tg-popup.show { opacity: 1; pointer-events: all; transform: translate(-50%, -50%) scale(1); }
              #tg-join { display: flex; align-items: center; justify-content: center; height: 52px; border-radius: 100px; background: linear-gradient(135deg, #00ffcc 0%, #0096ff 100%); color: #000; font-family: 'Space Grotesk', sans-serif; font-weight: 900; text-decoration: none; cursor: pointer; margin-bottom: 12px; }
              #tg-close { background: transparent; border: 1px solid var(--border-glass-bright); color: var(--text-muted); padding: 10px 20px; border-radius: 100px; cursor: pointer; }

              #status { position: fixed; left: 16px; bottom: 16px; z-index: 1000; color: #fff; background: rgba(5, 10, 15, 0.85); border: 1px solid rgba(0, 255, 204, 0.3); border-radius: 10px; padding: 10px 16px; font-size: 12px; }
              #status:empty { display: none; }
            </style>

            <div id="cricx-wrapper">
                <canvas id="warpGridCanvas"></canvas>
                <div class="container">
                    <header class="nav">
                        <div class="brand-title">CRICXCRATE</div>
                        <div class="nav-actions">
                            <aside class="theme-switch-deck">
                                <button class="mode-toggle-btn active" id="themeDarkBtn"><i></i> Obs</button>
                                <button class="mode-toggle-btn" id="themeLightBtn"><i></i> Cer</button>
                            </aside>
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
                        <div class="player-rig-box">
                            <div id="player-wrap" class="shaka-video-container">
                                <video autoplay muted playsinline id="video" class="shaka-video"></video>
                            </div>
                        </div>
                    </main>
                    
                    <div id="status">Connecting to backend...</div>
                </div>

                <div id="tg-overlay"></div>
                <div id="tg-popup">
                    <h3>Join For Free HD Links</h3>
                    <p>Get instant access to all football feeds, updates, and live streaming links.</p>
                    <a id="tg-join" href="${CRICX_CONFIG.TELEGRAM_URL}" target="_blank">JOIN TELEGRAM NOW</a>
                    <button id="tg-close" type="button">I've Joined / Continue</button>
                </div>
            </div>
        `;
    }

    showStatus(text) {
        const s = this._shadowRoot.getElementById('status');
        if (s) s.textContent = text;
    }

    initPopup() {
        const overlay = this._shadowRoot.getElementById('tg-overlay');
        const popup = this._shadowRoot.getElementById('tg-popup');
        if(overlay) overlay.classList.add('show');
        if(popup) popup.classList.add('show');
    }

    hidePopup() {
        const overlay = this._shadowRoot.getElementById('tg-overlay');
        const popup = this._shadowRoot.getElementById('tg-popup');
        if(overlay) overlay.classList.remove('show');
        if(popup) popup.classList.remove('show');
    }

    async initPlayer() {
        shaka.polyfill.installAll();
        
        // Grab elements from inside Shadow DOM
        const video = this._shadowRoot.getElementById('video');
        const container = this._shadowRoot.getElementById('player-wrap');
        
        // Manual UI Initialization for Shadow DOM
        this.playerInstance = new shaka.Player(video);
        this.controlsInstance = new shaka.ui.Overlay(this.playerInstance, container, video);

        this.controlsInstance.configure({
            controlPanelElements: ["play_pause", "mute", "volume", "spacer", "time_and_duration", "quality", "fullscreen", "overflow_menu"]
        });

        // Determine initial channel via URL Param or default to first channel from the Worker
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('ch');
        
        if (targetId) {
            this.currentActiveChannel = this.masterChannels.find(ch => ch.id === targetId);
        }
        if (!this.currentActiveChannel && this.masterChannels.length > 0) {
            this.currentActiveChannel = this.masterChannels[0];
        }

        this.renderChannelButtons(this.masterChannels);
        if (this.currentActiveChannel) {
            this.loadChannel(this.currentActiveChannel, false);
        }
    }

    async loadChannel(channel, pushHistory = true) {
        this.currentActiveChannel = channel;
        this.showStatus(`Switching to ${channel.channel_name}...`);

        const heroHeading = this._shadowRoot.getElementById('heroHeadlineText');
        if (heroHeading) {
            heroHeading.innerHTML = `${channel.channel_name.toUpperCase()} <br><span class="accent-txt">LIVE STREAM.</span>`;
        }

        // Parse ClearKeys safely
        let clearKeysObj = {};
        if (channel.stream_keys) {
            const parts = channel.stream_keys.split(':');
            if (parts.length === 2) clearKeysObj[parts[0].trim()] = parts[1].trim();
        }

        this.playerInstance.configure({
            streaming: { lowLatencyMode: true },
            drm: { clearKeys: clearKeysObj, preferredKeySystems: ['org.w3.clearkey'] }
        });

        try {
            await this.playerInstance.load(channel.stream_url);
            this.showStatus('');

            if (pushHistory && history.pushState) {
                const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?ch=${channel.id}`;
                history.pushState({path: newUrl}, '', newUrl);
                
                this.switchCount++;
                if (this.switchCount % 10 === 0) this.initPopup(); // Trigger popup every 10 channel switches
            }

            // Update UI buttons inside shadow DOM
            const buttons = this._shadowRoot.querySelectorAll('.channel-btn');
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.textContent === channel.channel_name);
            });
        } catch (e) {
            this.showStatus('Stream offline or blocked.');
        }
    }

    renderChannelButtons(channelsList) {
        const container = this._shadowRoot.getElementById('channelSelector');
        if (!container) return;
        
        container.innerHTML = '';
        if (channelsList.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted); font-size:12px; padding:10px;">No matching channels.</span>';
            return;
        }

        channelsList.forEach(ch => {
            const btn = document.createElement('button');
            btn.className = 'channel-btn';
            btn.textContent = ch.channel_name;
            if (this.currentActiveChannel && this.currentActiveChannel.id === ch.id) {
                btn.classList.add('active');
            }

            btn.onclick = () => this.loadChannel(ch, true);
            container.appendChild(btn);
        });
    }

    initEventListeners() {
        const wrapper = this._shadowRoot.getElementById("cricx-wrapper");
        const darkBtn = this._shadowRoot.getElementById("themeDarkBtn");
        const lightBtn = this._shadowRoot.getElementById("themeLightBtn");
        
        // Theme switching
        if (darkBtn && lightBtn) {
            darkBtn.addEventListener("click", () => {
                wrapper.removeAttribute("data-theme");
                darkBtn.classList.add("active");
                lightBtn.classList.remove("active");
            });
            lightBtn.addEventListener("click", () => {
                wrapper.setAttribute("data-theme", "light");
                lightBtn.classList.add("active");
                darkBtn.classList.remove("active");
            });
        }

        // Channel Search
        const searchInput = this._shadowRoot.getElementById("channelSearchInput");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                const keyword = e.target.value.toLowerCase().trim();
                const filtered = this.masterChannels.filter(ch => ch.channel_name.toLowerCase().includes(keyword));
                this.renderChannelButtons(filtered);
            });
        }

        // Telegram Modal
        const closeBtn = this._shadowRoot.getElementById("tg-close");
        const overlay = this._shadowRoot.getElementById("tg-overlay");
        const joinBtn = this._shadowRoot.getElementById("tg-join");
        
        if(closeBtn) closeBtn.addEventListener("click", () => this.hidePopup());
        if(overlay) overlay.addEventListener("click", () => this.hidePopup());
        if(joinBtn) joinBtn.addEventListener("click", () => this.hidePopup());
    }

    initWarpField() {
        const canvas = this._shadowRoot.getElementById('warpGridCanvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const stars = [];
        const SENSITIVITY = 2.5;

        const resize = () => { 
            canvas.width = window.innerWidth; 
            canvas.height = window.innerHeight; 
        };
        window.addEventListener('resize', resize);
        resize();

        for (let i = 0; i < 100; i++) {
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
                const isLight = this._shadowRoot.getElementById('cricx-wrapper').getAttribute('data-theme') === 'light';
                ctx.strokeStyle = isLight ? `rgba(0, 200, 180, ${star.alpha * 0.8})` : `rgba(0, 255, 204, ${star.alpha})`;
                ctx.beginPath();
                ctx.moveTo(star.x, star.y);
                ctx.lineTo(star.x + star.length, star.y);
                ctx.stroke();
                
                star.x += star.speed;
                if (star.x > canvas.width) {
                    star.x = -star.length;
                    star.y = Math.random() * canvas.height;
                }
            });
            requestAnimationFrame(render);
        };
        render();
    }
}

// Register the custom element
customElements.define('cricxcrate-ui', CricXCrateUI);
