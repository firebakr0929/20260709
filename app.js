// Global state variables
let currentTab = 'home';
let slideDecks = { eew: [], ai: [] };
let activeDeck = 'eew';
let activeSlideIndex = 0;
let slidePlayInterval = null;
let isPlayingSlides = false;
let isSpeaking = false;
let synth = window.speechSynthesis;
let utterance = null;

// Simulator variables
let simRunning = false;
let simTime = 0; // seconds
let simSpeed = 1.0;
let eqEpicenter = 'hualien';
let eqMagnitude = 7.2;
let eqDelay = 9.0; // regional EEW delay
let simTimerInterval = null;
let animationFrameId = null;

// Seismic wave constants (in px per second on canvas)
// Taiwan width ~360km, represented as ~300px. Scale: ~1.2 px/km
// P-wave speed: ~6.0 km/s -> ~7.2 px/s
// S-wave speed: ~3.5 km/s -> ~4.2 px/s
const P_WAVE_SPEED = 32; // px per simulated second
const S_WAVE_SPEED = 18; // px per simulated second

// Taiwan Outline Coordinates (for Canvas drawing)
const TAIWAN_OUTLINE = [
  { x: 250, y: 35 },  // 富貴角
  { x: 270, y: 45 },  // 基隆
  { x: 285, y: 65 },  // 三貂角
  { x: 280, y: 110 }, // 宜蘭海岸
  { x: 265, y: 160 }, // 蘇澳
  { x: 255, y: 210 }, // 花蓮海岸
  { x: 245, y: 260 }, // 秀姑巒溪口
  { x: 225, y: 340 }, // 台東成功
  { x: 215, y: 400 }, // 台東
  { x: 185, y: 470 }, // 鵝鑾鼻
  { x: 165, y: 480 }, // 貓鼻頭
  { x: 160, y: 440 }, // 枋寮
  { x: 145, y: 410 }, // 林園
  { x: 135, y: 370 }, // 高雄海岸
  { x: 125, y: 330 }, // 台南安平
  { x: 120, y: 290 }, // 嘉義布袋
  { x: 125, y: 240 }, // 雲林麥寮
  { x: 135, y: 200 }, // 彰化鹿港
  { x: 150, y: 160 }, // 台中港
  { x: 165, y: 120 }, // 苗栗通霄
  { x: 185, y: 90 },  // 新竹海岸
  { x: 210, y: 70 },  // 桃園觀音
  { x: 235, y: 45 }   // 淡水
];

// Presets for Epicenter
const EPICENTERS = {
  hualien: { x: 265, y: 220, name: '花蓮外海' },
  chiayi: { x: 150, y: 310, name: '嘉義梅山斷層' },
  yilan: { x: 275, y: 120, name: '宜蘭外海' },
  tainan: { x: 140, y: 350, name: '台南甲仙' }
};

// Cities data
const CITIES = {
  taipei: { x: 260, y: 70, name: '台北' },
  yilan: { x: 275, y: 120, name: '宜蘭' },
  hualien: { x: 250, y: 220, name: '花蓮' },
  taichung: { x: 175, y: 190, name: '台中' },
  chiayi: { x: 150, y: 310, name: '嘉義' },
  tainan: { x: 140, y: 350, name: '台南' },
  kaohsiung: { x: 145, y: 400, name: '高雄' },
  taitung: { x: 210, y: 380, name: '台東' }
};

// AI Agent Simulator State
let agentsActive = false;
let agentTimeline = [];

// DOM elements
let canvas, ctx;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Theme setup
  setupTheme();
  
  // Navigation tabs
  setupTabs();
  
  // Load Markdown Slides
  loadSlides();
  
  // Slides controller hooks
  setupSlideControls();
  
  // Initialize Simulator Canvas
  setupSimulator();
  
  // Initialize AI Agent Workspace
  setupAgentSimulator();
  
  // Chat QA
  setupChatQA();
});

/* Theme Setup */
function setupTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
    
    // Redraw map on theme change
    if (currentTab === 'simulator') {
      drawMap();
    }
  });
}

/* Tabs Switching */
function setupTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  
  // Update nav buttons active state
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  
  // Update panel visible state
  document.querySelectorAll('.content-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  
  // Update header text
  const title = document.getElementById('page-title');
  const subtitle = document.getElementById('page-subtitle');
  
  if (tabId === 'home') {
    title.textContent = '首頁大廳';
    subtitle.textContent = '歡迎來到臺灣地震測報與次世代科技應用展示平台';
  } else if (tabId === 'slides') {
    title.textContent = '簡報展演';
    subtitle.textContent = '中央氣象署地震專案講習簡報與內容解析';
    // Load slides if parsed
    renderActiveSlide();
  } else if (tabId === 'simulator') {
    title.textContent = '地震預警物理模擬器';
    subtitle.textContent = '直觀理解地震波傳播速度、預警延遲與防震黃金窗口';
    // Redraw map
    setTimeout(() => {
      resizeCanvas();
      drawMap();
    }, 100);
  } else if (tabId === 'agents') {
    title.textContent = '次世代 AI 代理應變網絡';
    subtitle.textContent = '多智慧代理群 (Multi-Agent System) 協同運作地震分析與通報展示';
    // Draw SVG connections
    setTimeout(drawAgentConnections, 100);
  }
  
  // Stop Speech if switching tabs
  stopSpeech();
}

/* Load Slides Content */
async function loadSlides() {
  try {
    const eewFilename = '2026_0612_嘉義災防宣導-臺灣地震預警系統的演進與發展.md';
    const aiFilename = '2026_0603_AI 代理群與大型語言模型在次世代地震測報之整合與應用.md';
    
    // Fetch and parse EEW slides
    const resEEW = await fetch(encodeURIComponent(eewFilename));
    if (resEEW.ok) {
      const text = await resEEW.text();
      slideDecks.eew = SlidesParser.parse(text);
      document.getElementById('eew-slide-count').textContent = slideDecks.eew.length;
    } else {
      console.warn("Failed to load EEW slides. Trying backup parser.");
    }
    
    // Fetch and parse AI slides
    const resAI = await fetch(encodeURIComponent(aiFilename));
    if (resAI.ok) {
      const text = await resAI.text();
      slideDecks.ai = SlidesParser.parse(text);
      document.getElementById('ai-slide-count').textContent = slideDecks.ai.length;
    }
    
    // Initialize slide outlines
    populateSlideOutline();
    
  } catch (error) {
    console.error("Error loading slides: ", error);
  }
}

function openSlideDeck(deckKey) {
  activeDeck = deckKey;
  activeSlideIndex = 0;
  document.getElementById('deck-select').value = deckKey;
  populateSlideOutline();
  switchTab('slides');
}

function populateSlideOutline() {
  const list = document.getElementById('slide-outline-list');
  list.innerHTML = '';
  
  const deck = slideDecks[activeDeck];
  if (!deck || deck.length === 0) return;
  
  deck.forEach((slide, index) => {
    const li = document.createElement('li');
    li.className = `outline-item ${index === activeSlideIndex ? 'active' : ''}`;
    li.id = `outline-item-${index}`;
    li.innerHTML = `
      <span class="outline-num">${slide.slideNum}</span>
      <span class="outline-text" title="${slide.title}">${slide.title}</span>
    `;
    li.addEventListener('click', () => {
      goToSlide(index);
    });
    list.appendChild(li);
  });
}

function renderActiveSlide() {
  const deck = slideDecks[activeDeck];
  const contentArea = document.getElementById('slide-content-area');
  
  if (!deck || deck.length === 0) {
    contentArea.innerHTML = `
      <div class="loading-spinner">
        <i data-lucide="alert-circle" class="text-amber"></i>
        <p>找不到簡報資料，請確認 Markdown 檔案放置於正確目錄。</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  const slide = deck[activeSlideIndex];
  
  // Set progress
  const progressFill = document.getElementById('slide-progress-fill');
  const percent = ((activeSlideIndex + 1) / deck.length) * 100;
  progressFill.style.width = `${percent}%`;
  
  // Set meta labels
  document.getElementById('slide-layout-label').textContent = `版面配置: ${slide.layout}`;
  document.getElementById('slide-number-label').textContent = `Slide ${activeSlideIndex + 1} / ${deck.length}`;
  
  // Render slide HTML
  contentArea.style.opacity = 0;
  contentArea.style.transform = 'translateY(5px)';
  
  setTimeout(() => {
    contentArea.innerHTML = SlidesParser.renderHTML(slide);
    lucide.createIcons(); // refresh icons inside slides
    
    // Notes block updates
    const notesContent = document.getElementById('slide-notes-content');
    notesContent.innerHTML = getSlideNotes(slide);
    
    contentArea.style.opacity = 1;
    contentArea.style.transform = 'translateY(0)';
  }, 150);
  
  // Keep outline scrolled to active
  const activeOutlineItem = document.getElementById(`outline-item-${activeSlideIndex}`);
  if (activeOutlineItem) {
    activeOutlineItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    
    // Highlight outline item
    document.querySelectorAll('.outline-item').forEach(item => item.classList.remove('active'));
    activeOutlineItem.classList.add('active');
  }
  
  // Trigger reading voice if playing & speaking is active
  if (isSpeaking) {
    speakActiveSlide();
  }
}

function getSlideNotes(slide) {
  // Compile summary of slide or show notes based on contents
  let noteHtml = '<strong>💡 防災/科技觀點：</strong><br>';
  
  const contentText = slide.elements.map(e => e.content).join(' ');
  
  if (contentText.includes('集集地震') || contentText.includes('花蓮地震')) {
    noteHtml += '震央位置與板塊碰撞息息相關。例如 1999 年集集地震震央在南投中寮斷層，2024 年花蓮地震則在花蓮近海，皆對台灣陸地造成毀滅性破壞。這凸顯了預警系統「跟時間賽跑」的重要性。';
  } else if (contentText.includes('現地型') || contentText.includes('區域型')) {
    noteHtml += '<strong>現地型 (In-situ)：</strong> 只要本測站觀測 P 波震度超過閾值即立刻對本地警報（約 2-3 秒），優點是盲區小，但可能會有誤報率。<br><strong>區域型 (Regional)：</strong> 整合多測站波形送回氣象署精算後發送細胞廣播（約 8-12 秒），盲區較大但警報精度高。';
  } else if (contentText.includes('AI') || contentText.includes('代理') || contentText.includes('LLM')) {
    noteHtml += '次世代地震測報引入「AI 代理群 (AI Agents)」，能將地震波觀測、震度分佈計算、自動生成災情簡報、多國語言災情通知、甚至社群媒體答詢，在短短 30 秒內全自動完成，極大降低人工作業瓶頸。';
  } else {
    noteHtml += `本頁簡報闡明「${slide.title}」之重點。透過科學模型與大眾防災宣導的整合，提升臺灣民眾面對天然災害的應變韌性。`;
  }
  
  return noteHtml;
}

function setupSlideControls() {
  // Dropdown select deck
  const deckSelect = document.getElementById('deck-select');
  deckSelect.addEventListener('change', (e) => {
    activeDeck = e.target.value;
    activeSlideIndex = 0;
    populateSlideOutline();
    renderActiveSlide();
  });
  
  // Search bar filter
  const searchInput = document.getElementById('slide-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.outline-item');
    
    slideDecks[activeDeck].forEach((slide, index) => {
      const match = slide.title.toLowerCase().includes(query) || 
                    slide.rawContent.toLowerCase().includes(query);
      
      const item = document.getElementById(`outline-item-${index}`);
      if (item) {
        item.classList.toggle('hidden', !match);
      }
    });
  });
  
  // Previous button
  document.getElementById('btn-prev-slide').addEventListener('click', prevSlide);
  // Next button
  document.getElementById('btn-next-slide').addEventListener('click', nextSlide);
  
  // Play / Pause button
  const playBtn = document.getElementById('btn-play-slide');
  playBtn.addEventListener('click', () => {
    if (isPlayingSlides) {
      pauseSlideShow();
    } else {
      startSlideShow();
    }
  });
  
  // Speech volume btn
  document.getElementById('btn-speech-slide').addEventListener('click', toggleSpeech);
  
  // Fullscreen button
  document.getElementById('btn-fullscreen-slide').addEventListener('click', toggleFullscreen);
  
  // Keyboard keys
  document.addEventListener('keydown', (e) => {
    if (currentTab !== 'slides') return;
    if (e.key === 'ArrowRight') {
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'Space') {
      e.preventDefault();
      if (isPlayingSlides) pauseSlideShow(); else startSlideShow();
    }
  });
}

function prevSlide() {
  if (activeSlideIndex > 0) {
    activeSlideIndex--;
    renderActiveSlide();
  }
}

function nextSlide() {
  const deck = slideDecks[activeDeck];
  if (activeSlideIndex < deck.length - 1) {
    activeSlideIndex++;
    renderActiveSlide();
  } else {
    pauseSlideShow();
  }
}

function startSlideShow() {
  isPlayingSlides = true;
  document.getElementById('play-icon').classList.add('hidden');
  document.getElementById('pause-icon').classList.remove('hidden');
  
  slidePlayInterval = setInterval(() => {
    nextSlide();
  }, 7000); // 7 seconds per slide
}

function pauseSlideShow() {
  isPlayingSlides = false;
  document.getElementById('play-icon').classList.remove('hidden');
  document.getElementById('pause-icon').classList.add('hidden');
  clearInterval(slidePlayInterval);
}

function toggleFullscreen() {
  const player = document.getElementById('slide-player-card');
  player.classList.toggle('fullscreen');
  
  const icon = document.getElementById('btn-fullscreen-slide').querySelector('i');
  if (player.classList.contains('fullscreen')) {
    icon.setAttribute('data-lucide', 'minimize');
  } else {
    icon.setAttribute('data-lucide', 'maximize');
  }
  lucide.createIcons();
}

function toggleSpeech() {
  const btn = document.getElementById('btn-speech-slide');
  if (isSpeaking) {
    stopSpeech();
    btn.classList.remove('text-cyan');
  } else {
    isSpeaking = true;
    btn.classList.add('text-cyan');
    speakActiveSlide();
  }
}

function speakActiveSlide() {
  if (!synth) return;
  synth.cancel();
  
  const deck = slideDecks[activeDeck];
  if (!deck || deck.length === 0) return;
  
  const slide = deck[activeSlideIndex];
  
  // Compile text to speak
  let text = `標題：${slide.title}。`;
  slide.elements.forEach(el => {
    if (el.content !== slide.title) {
      text += `${el.content}。`;
    }
  });
  
  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 1.0;
  
  utterance.onend = () => {
    // If autoplayslides is active, let's wait
  };
  
  synth.speak(utterance);
}

function stopSpeech() {
  isSpeaking = false;
  document.getElementById('btn-speech-slide').classList.remove('text-cyan');
  if (synth) {
    synth.cancel();
  }
}


/* Earthquake Early Warning Simulator */
function setupSimulator() {
  canvas = document.getElementById('taiwan-map-canvas');
  ctx = canvas.getContext('2d');
  
  // Set up ranges values update
  document.getElementById('sim-magnitude').addEventListener('input', (e) => {
    eqMagnitude = parseFloat(e.target.value);
    document.getElementById('val-magnitude').textContent = eqMagnitude.toFixed(1);
  });
  
  document.getElementById('sim-delay').addEventListener('input', (e) => {
    eqDelay = parseFloat(e.target.value);
    document.getElementById('val-delay').textContent = `${eqDelay.toFixed(1)} 秒`;
  });

  document.getElementById('sim-speed-scale').addEventListener('input', (e) => {
    simSpeed = parseFloat(e.target.value);
    document.getElementById('val-speed-scale').textContent = `${simSpeed.toFixed(1)}x`;
  });
  
  document.getElementById('sim-epicenter').addEventListener('change', (e) => {
    eqEpicenter = e.target.value;
    if (!simRunning) {
      drawMap();
    }
  });
  
  // Action Buttons
  document.getElementById('btn-trigger-eq').addEventListener('click', triggerEarthquake);
  document.getElementById('btn-reset-eq').addEventListener('click', resetEarthquake);
  
  // Canvas Click: custom epicenter
  canvas.addEventListener('click', (e) => {
    if (simRunning) return;
    
    // Get mouse coords
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Check if clicked inside/near Taiwan
    // We can define custom epicenter
    EPICENTERS.custom = { x: x, y: y, name: '自訂震央' };
    eqEpicenter = 'custom';
    
    // Select custom option in select
    let select = document.getElementById('sim-epicenter');
    // Add custom option if not exists
    let hasCustom = Array.from(select.options).some(opt => opt.value === 'custom');
    if (!hasCustom) {
      let opt = document.createElement('option');
      opt.value = 'custom';
      opt.textContent = `自訂位置 (X: ${Math.round(x)}, Y: ${Math.round(y)})`;
      select.appendChild(opt);
    }
    select.value = 'custom';
    
    drawMap();
  });
  
  resizeCanvas();
  drawMap();
  updateCityListHTML();
}

function resizeCanvas() {
  // Let it fit container size but keep 400x550 aspect ratio
  const wrapper = canvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  
  // Set fixed internal dimensions
  canvas.width = 400;
  canvas.height = 550;
}

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const isLightTheme = document.body.classList.contains('light-theme');
  
  // Color configuration
  const colorMapBg = isLightTheme ? '#e2e8f0' : '#141824';
  const colorMapBorder = isLightTheme ? '#cbd5e1' : '#2a3147';
  const colorGrids = isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)';
  
  // Draw Background Grid
  ctx.strokeStyle = colorGrids;
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Draw Taiwan Island
  ctx.save();
  ctx.shadowColor = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(59, 130, 246, 0.15)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = colorMapBg;
  ctx.strokeStyle = colorMapBorder;
  ctx.lineWidth = 2.5;
  
  ctx.beginPath();
  ctx.moveTo(TAIWAN_OUTLINE[0].x, TAIWAN_OUTLINE[0].y);
  for (let i = 1; i < TAIWAN_OUTLINE.length; i++) {
    ctx.lineTo(TAIWAN_OUTLINE[i].x, TAIWAN_OUTLINE[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  
  // Draw waves if simulator is running
  if (simRunning) {
    drawSeismicWaves();
  }
  
  // Draw Epicenter
  const epi = EPICENTERS[eqEpicenter];
  if (epi) {
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    // Pulsing outer circle if running
    if (simRunning) {
      const radiusScale = (Math.sin(Date.now() / 100) + 1) * 3 + 6;
      ctx.beginPath();
      ctx.arc(epi.x, epi.y, radiusScale, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw cross star for epicenter
    ctx.beginPath();
    ctx.moveTo(epi.x - 10, epi.y);
    ctx.lineTo(epi.x + 10, epi.y);
    ctx.moveTo(epi.x, epi.y - 10);
    ctx.lineTo(epi.x, epi.y + 10);
    ctx.stroke();
    
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(epi.x, epi.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Epicenter label
    ctx.font = '10px var(--font-sans)';
    ctx.fillStyle = isLightTheme ? '#0f172a' : '#f8fafc';
    ctx.fillText('震央', epi.x + 12, epi.y + 4);
    ctx.restore();
  }
  
  // Draw Cities
  Object.keys(CITIES).forEach(key => {
    const city = CITIES[key];
    const cityState = getCityState(key);
    
    // Calculate display coordinates for shake effect
    let drawX = city.x;
    let drawY = city.y;
    
    if (cityState.status === 'shake') {
      // Shaking offset
      drawX += (Math.random() - 0.5) * 4;
      drawY += (Math.random() - 0.5) * 4;
    }
    
    ctx.save();
    // Set color based on status
    if (cityState.status === 'shake') {
      ctx.fillStyle = '#ef4444'; // Red
      ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
      ctx.shadowBlur = 10;
    } else if (cityState.status === 'alert') {
      ctx.fillStyle = '#f59e0b'; // Amber
      ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
      ctx.shadowBlur = 8;
    } else if (cityState.status === 'detect') {
      ctx.fillStyle = '#06b6d4'; // Cyan
      ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = '#10b981'; // Green (Safe)
    }
    
    // Draw city dot
    ctx.beginPath();
    ctx.arc(drawX, drawY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Glowing ring for alerts
    if (cityState.status === 'alert' || cityState.status === 'shake') {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 9 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // City Label
    ctx.font = 'bold 11px var(--font-sans)';
    ctx.fillStyle = isLightTheme ? '#334155' : '#cbd5e1';
    
    // Offset labels to avoid overlap
    let labelOffset = { x: 8, y: 4 };
    if (key === 'yilan') labelOffset = { x: 8, y: -4 };
    if (key === 'taitung') labelOffset = { x: 8, y: -2 };
    
    ctx.fillText(city.name, drawX + labelOffset.x, drawY + labelOffset.y);
    ctx.restore();
  });
}

function drawSeismicWaves() {
  const epi = EPICENTERS[eqEpicenter];
  if (!epi) return;
  
  const pRadius = simTime * P_WAVE_SPEED;
  const sRadius = simTime * S_WAVE_SPEED;
  
  // 1. Draw P-Wave (Cyan)
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.fillStyle = 'rgba(6, 182, 212, 0.02)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(epi.x, epi.y, pRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  
  // 2. Draw S-Wave (Red - Shaking)
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(epi.x, epi.y, sRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  
  // 3. Draw Regional EEW Wireless Alarm Broadcast Boundary (Amber)
  // Explodes out at near-infinite speed (radio wave), but represents the boundary of alert.
  if (simTime >= eqDelay) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.01)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    // Broadcast spreads quickly
    const wirelessRadius = (simTime - eqDelay) * 120;
    ctx.beginPath();
    ctx.arc(epi.x, epi.y, Math.min(wirelessRadius, 600), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

// Calculate the state of a city at current simTime
function getCityState(cityKey) {
  const city = CITIES[cityKey];
  const epi = EPICENTERS[eqEpicenter];
  if (!epi) return { status: 'safe', countdown: 99, warningTime: -1 };
  
  // Pixel Distance
  const dx = city.x - epi.x;
  const dy = city.y - epi.y;
  const distPx = Math.sqrt(dx*dx + dy*dy);
  
  // P wave arrival time (s)
  const pArrival = distPx / P_WAVE_SPEED;
  // S wave arrival time (s)
  const sArrival = distPx / S_WAVE_SPEED;
  
  // Local EEW triggers 2.0s after P-wave reaches first station (at epicenter, t = 0)
  const localEewAlertTime = 2.0;
  
  // Regional EEW triggers at eqDelay
  const regionalEewAlertTime = eqDelay;
  
  // Warning received by city is the earliest of:
  // - Local EEW (if city is close enough to local station triggering local alert? In Taiwan, local EEW applies to local city, regional EEW applies to all. Let's simplify: Local EEW covers the county itself. If it is the epicenter county, warning triggers at t = 2.0s. For other counties, warning is received at regionalEewAlertTime = 9.0s).
  let warningReceivedTime = regionalEewAlertTime;
  const isEpicenterCounty = (cityKey === eqEpicenter);
  
  if (isEpicenterCounty) {
    warningReceivedTime = localEewAlertTime;
  }
  
  let status = 'safe';
  let countdown = Math.max(0, sArrival - simTime);
  let warningTime = -1; // lead time
  
  if (simTime >= sArrival) {
    status = 'shake';
    countdown = 0;
    
    // Lead time is warning received time minus S-wave arrival (if positive, warning was successful)
    // Warning window = S-wave arrival - warning received time
    if (sArrival > warningReceivedTime) {
      warningTime = sArrival - warningReceivedTime;
    } else {
      warningTime = 0; // Blind Zone!
    }
  } else if (simTime >= warningReceivedTime) {
    status = 'alert';
    warningTime = sArrival - warningReceivedTime;
  } else if (simTime >= pArrival) {
    status = 'detect';
  }
  
  return {
    status,
    countdown,
    warningTime,
    sArrival
  };
}

function updateCityListHTML() {
  const container = document.getElementById('sim-cities-list');
  container.innerHTML = '';
  
  Object.keys(CITIES).forEach(key => {
    const city = CITIES[key];
    const state = getCityState(key);
    
    const row = document.createElement('div');
    row.className = 'city-row';
    
    let countdownText = `${state.countdown.toFixed(1)}s`;
    let statusBadge = '';
    
    if (state.status === 'shake') {
      countdownText = '搖晃中!';
      const leadTime = state.warningTime;
      if (leadTime > 0) {
        statusBadge = `<span class="city-status-badge badge-shake">劇烈搖晃 (預警時間: ${leadTime.toFixed(1)}s)</span>`;
      } else {
        statusBadge = `<span class="city-status-badge badge-shake" style="border-color: #ef4444; color: #ef4444;">盲區! 0.0s 預警</span>`;
      }
    } else if (state.status === 'alert') {
      statusBadge = `<span class="city-status-badge badge-alert">警報: 趴下掩護穩住!</span>`;
    } else if (state.status === 'detect') {
      statusBadge = `<span class="city-status-badge badge-detect">微幅震動 (P波抵達)</span>`;
    } else {
      statusBadge = `<span class="city-status-badge badge-safe">監測中 (安全)</span>`;
    }
    
    row.innerHTML = `
      <span class="city-name">${city.name}</span>
      <span class="city-countdown ${state.status === 'shake' ? 'shaking' : ''}">${countdownText}</span>
      <span>${statusBadge}</span>
    `;
    
    container.appendChild(row);
  });
}

function triggerEarthquake() {
  if (simRunning) return;
  
  simRunning = true;
  simTime = 0;
  
  // UI updates
  document.getElementById('sim-status-indicator').className = 'status-indicator danger';
  document.getElementById('sim-status-indicator').querySelector('.indicator-text').textContent = '⚠️ 地震波擴散中!';
  document.getElementById('btn-trigger-eq').disabled = true;
  
  // Timer loop
  const startTime = Date.now();
  
  simTimerInterval = setInterval(() => {
    simTime += 0.05 * simSpeed;
    document.getElementById('sim-timer-val').textContent = simTime.toFixed(2);
    
    // Trigger system badges on dashboard
    const localBox = document.getElementById('box-local-eew');
    const regionalBox = document.getElementById('box-regional-eew');
    
    // Local EEW triggers at t = 2.0s
    if (simTime >= 2.0) {
      localBox.className = 'status-box active-local';
      localBox.querySelector('.status-value').textContent = '已發佈 (2.0s)';
    } else {
      localBox.className = 'status-box';
      localBox.querySelector('.status-value').textContent = '未觸發';
    }
    
    // Regional EEW triggers at t = eqDelay
    if (simTime >= eqDelay) {
      regionalBox.className = 'status-box active';
      regionalBox.querySelector('.status-value').textContent = `已發佈 (${eqDelay.toFixed(1)}s)`;
    } else {
      regionalBox.className = 'status-box';
      regionalBox.querySelector('.status-value').textContent = '未觸發';
    }
    
    updateCityListHTML();
    
    // Auto stop after 20s
    if (simTime >= 20.0) {
      stopSimTimer();
    }
  }, 50);
  
  // Canvas animation loop
  function animLoop() {
    drawMap();
    if (simRunning) {
      animationFrameId = requestAnimationFrame(animLoop);
    }
  }
  animLoop();
}

function stopSimTimer() {
  clearInterval(simTimerInterval);
}

function resetEarthquake() {
  simRunning = false;
  simTime = 0;
  stopSimTimer();
  cancelAnimationFrame(animationFrameId);
  
  // Reset UI
  document.getElementById('sim-status-indicator').className = 'status-indicator';
  document.getElementById('sim-status-indicator').querySelector('.indicator-text').textContent = '監測中 (安全)';
  document.getElementById('btn-trigger-eq').disabled = false;
  document.getElementById('sim-timer-val').textContent = '00.00';
  
  document.getElementById('box-local-eew').className = 'status-box';
  document.getElementById('box-local-eew').querySelector('.status-value').textContent = '未觸發';
  
  document.getElementById('box-regional-eew').className = 'status-box';
  document.getElementById('box-regional-eew').querySelector('.status-value').textContent = '未觸發';
  
  drawMap();
  updateCityListHTML();
}


/* AI Agent Seismology Center Simulator */
function setupAgentSimulator() {
  document.getElementById('btn-trigger-agents').addEventListener('click', triggerAgentSimulation);
  document.getElementById('btn-clear-console').addEventListener('click', clearAgentConsole);
  
  // Handle output tabs
  const tabBtns = document.querySelectorAll('.output-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabId = btn.dataset.outputTab;
      document.querySelectorAll('.output-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `output-tab-${tabId}`);
      });
    });
  });
}

function drawAgentConnections() {
  const svg = document.getElementById('graph-connections-svg');
  svg.innerHTML = '';
  
  // Find nodes coordinates
  const nodes = [
    { from: 'sensor', to: 'ingestion' },
    { from: 'ingestion', to: 'eew' },
    { from: 'ingestion', to: 'shakemap' },
    { from: 'eew', to: 'advisory' },
    { from: 'shakemap', to: 'advisory' },
    { from: 'advisory', to: 'llm' }
  ];
  
  const svgRect = svg.getBoundingClientRect();
  
  nodes.forEach(conn => {
    const fromNode = document.getElementById(`node-${conn.from}`);
    const toNode = document.getElementById(`node-${conn.to}`);
    
    if (fromNode && toNode) {
      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();
      
      const x1 = (fromRect.left + fromRect.width / 2) - svgRect.left;
      const y1 = (fromRect.top + fromRect.height / 2) - svgRect.top;
      const x2 = (toRect.left + toRect.width / 2) - svgRect.left;
      const y2 = (toRect.top + toRect.height / 2) - svgRect.top;
      
      // Draw bezier line
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
      
      path.setAttribute('d', d);
      path.setAttribute('class', 'connection-line');
      path.setAttribute('id', `conn-${conn.from}-${conn.to}`);
      svg.appendChild(path);
    }
  });
}

function clearAgentConsole() {
  const consoleBody = document.getElementById('agent-console-logs');
  consoleBody.innerHTML = '<div class="console-line system">[系統] 日誌已清除。待命。</div>';
}

function addConsoleLog(agentKey, message) {
  const consoleBody = document.getElementById('agent-console-logs');
  const line = document.createElement('div');
  line.className = `console-line ${agentKey}`;
  
  const timestamp = new Date().toLocaleTimeString();
  line.innerHTML = `[${timestamp}] <strong>${getAgentName(agentKey)}:</strong> ${message}`;
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

function getAgentName(key) {
  const names = {
    system: '系統',
    sensor: '觀測網',
    ingestion: '數據代理',
    eew: '快速預警',
    shakemap: '震度圖代理',
    advisory: '通報代理',
    llm: 'Seismo-LLM'
  };
  return names[key] || key;
}

function triggerAgentSimulation() {
  if (agentsActive) return;
  agentsActive = true;
  
  const triggerBtn = document.getElementById('btn-trigger-agents');
  triggerBtn.disabled = true;
  
  // Reset all nodes state
  document.querySelectorAll('.agent-node').forEach(node => {
    node.className = 'agent-node';
    node.querySelector('.node-status').textContent = '待命';
  });
  document.querySelectorAll('.connection-line').forEach(line => {
    line.className.baseVal = 'connection-line';
  });
  
  // Clear Report paper
  const reportBody = document.getElementById('agent-report-body');
  reportBody.innerHTML = `
    <div class="loading-spinner" style="margin-top: 50px;">
      <i data-lucide="loader" class="animate-spin text-cyan"></i>
      <p>AI 代理網絡運作中，即時彙整地震通報中...</p>
    </div>
  `;
  lucide.createIcons();
  
  // Run sequenced timeline
  runAgentStage(0);
}

function runAgentStage(stageIndex) {
  const timeline = [
    // 1. Sensor detects
    {
      delay: 500,
      action: () => {
        const node = document.getElementById('node-sensor');
        node.className = 'agent-node active';
        node.querySelector('.node-status').textContent = '🔴 偵測到地震!';
        node.querySelector('.node-log').textContent = 'P波振幅突破閥值 (8 gal)，觸發通報事件!';
        addConsoleLog('sensor', '監測測站 (Hualien-03) 於 2026-07-09 16:21:05 觀測到首波 P波 訊號。');
        
        // Active connection
        const conn = document.getElementById('conn-sensor-ingestion');
        if (conn) conn.className.baseVal = 'connection-line active';
      }
    },
    // 2. Data Ingestion
    {
      delay: 1500,
      action: () => {
        document.getElementById('node-sensor').className = 'agent-node completed';
        
        const node = document.getElementById('node-ingestion');
        node.className = 'agent-node active';
        node.querySelector('.node-status').textContent = '⏳ 分析數據中';
        node.querySelector('.node-log').textContent = '讀取全台72個主震站即時串流...';
        addConsoleLog('ingestion', '收到觀測網中斷事件。啟動即時大數據降噪與格式統合。');
        addConsoleLog('ingestion', '濾除高頻背景雜訊，確認首站 PGA = 32.5 gal。派發特徵向量給計算端。');
        
        // Connections
        const conn1 = document.getElementById('conn-ingestion-eew');
        const conn2 = document.getElementById('conn-ingestion-shakemap');
        if (conn1) conn1.className.baseVal = 'connection-line active';
        if (conn2) conn2.className.baseVal = 'connection-line active';
      }
    },
    // 3. EEW Calculation & Map Generation
    {
      delay: 3000,
      action: () => {
        document.getElementById('node-ingestion').className = 'agent-node completed';
        
        const eew = document.getElementById('node-eew');
        eew.className = 'agent-node active';
        eew.querySelector('.node-status').textContent = '⚙️ 運算預警參數';
        eew.querySelector('.node-log').textContent = '震央定位:花蓮近海, 規模:6.8, 深度:12km';
        addConsoleLog('eew', '透過 Pd 法估算震央，推估震源深度 12.4 km，震級 M_L = 6.8。');
        
        const shakemap = document.getElementById('node-shakemap');
        shakemap.className = 'agent-node active';
        shakemap.querySelector('.node-status').textContent = '⚙️ 繪製震度分布';
        shakemap.querySelector('.node-log').textContent = '推估花蓮地區最大震度6強, 台北4級';
        addConsoleLog('shakemap', '套用衰減公式 (Ground Motion Prediction Equations)，生成各縣市最大峰值震度分佈。最大震度花蓮縣 6 強，宜蘭縣 5 弱，南投與台中 4 級。');
        
        // Connections
        const conn1 = document.getElementById('conn-eew-advisory');
        const conn2 = document.getElementById('conn-shakemap-advisory');
        if (conn1) conn1.className.baseVal = 'connection-line active';
        if (conn2) conn2.className.baseVal = 'connection-line active';
      }
    },
    // 4. Advisory Broadcast
    {
      delay: 4500,
      action: () => {
        document.getElementById('node-eew').className = 'agent-node completed';
        document.getElementById('node-shakemap').className = 'agent-node completed';
        
        const node = document.getElementById('node-advisory');
        node.className = 'agent-node active';
        node.querySelector('.node-status').textContent = '📡 發佈細胞廣播';
        node.querySelector('.node-log').textContent = '發送 PWS 簡訊至花蓮與宜蘭全區...';
        addConsoleLog('advisory', '⚠️ [細胞簡訊觸發] 對花蓮縣、宜蘭縣發佈強震即時警報。預估本地震度 5 級以上。');
        addConsoleLog('advisory', '向中央防災中心與地方消防局自動回報地震一報數據。');
        
        // Connections
        const conn = document.getElementById('conn-advisory-llm');
        if (conn) conn.className.baseVal = 'connection-line active';
      }
    },
    // 5. LLM Synthesis
    {
      delay: 6000,
      action: () => {
        document.getElementById('node-advisory').className = 'agent-node completed';
        
        const node = document.getElementById('node-llm');
        node.className = 'agent-node active';
        node.querySelector('.node-status').textContent = '✍️ 撰寫市民報告';
        node.querySelector('.node-log').textContent = '產出自然語言報告中...';
        addConsoleLog('llm', '收到警報數據。啟動地震專屬大型語言模型 (Seismo-LLM-v2)。');
        addConsoleLog('llm', '正整合地質特徵與歷史強震庫，生成中/英雙語新聞稿與市民避難指引。');
        
        generateLLMReport();
      }
    },
    // 6. Finish
    {
      delay: 8500,
      action: () => {
        document.getElementById('node-llm').className = 'agent-node completed';
        addConsoleLog('system', '✅ AI 代理應變網絡協作完成。全部任務已處置。');
        
        agentsActive = false;
        document.getElementById('btn-trigger-agents').disabled = false;
      }
    }
  ];
  
  if (stageIndex < timeline.length) {
    setTimeout(() => {
      timeline[stageIndex].action();
      runAgentStage(stageIndex + 1);
    }, timeline[stageIndex].delay);
  }
}

function generateLLMReport() {
  const reportBody = document.getElementById('agent-report-body');
  
  const reportTextHTML = `
    <div class="report-grid">
      <div class="report-item"><strong>發震時間：</strong>2026/07/09 16:21:05</div>
      <div class="report-item"><strong>震央位置：</strong>花蓮縣政府東南方 12 公里</div>
      <div class="report-item"><strong>地震規模：</strong>M<sub>L</sub> 6.8</div>
      <div class="report-item"><strong>震源深度：</strong>12.4 公里</div>
    </div>
    
    <div class="report-section-title">氣象署 Seismo-LLM 專業分析</div>
    <p style="margin-bottom: 10px;"><strong>構造機制分析：</strong>本次地震成因為菲律賓海板塊向北隱沒至歐亞大陸板塊邊緣所產生的剪切錯動，震央位於隱沒帶前緣之破碎帶，屬於高頻強震。歷史上該區域每 5-10 年均有 M6.5 以上的強烈餘震發生。</p>
    
    <p style="margin-bottom: 10px;"><strong>預警成效評估：</strong>本次區域預警（Regional EEW）於發震後 8.8 秒順利對大眾發送細胞廣播（PWS）。由於震央位於花蓮近海，花蓮市區防震應變窗口為 1.5 秒（盲區邊緣），但距震央較遠的宜蘭市獲得 8 秒、台北市獲得 15 秒、台中市更獲得高達 22 秒之黃金避難預警時間。</p>

    <div class="report-section-title">各縣市最大震度分布</div>
    <ul class="report-bullet-list">
      <li><strong>6強：</strong>花蓮縣（花蓮市、壽豐鄉）</li>
      <li><strong>5弱：</strong>宜蘭縣（澳花、羅東）</li>
      <li><strong>4級：</strong>南投縣、台中市、台北市、新北市</li>
      <li><strong>3級：</strong>桃園市、新竹縣、苗栗縣、彰化縣</li>
    </ul>

    <div class="report-section-title">市民避難指引</div>
    <p>強烈有感地震正在發生，請立即實施「趴下、掩護、穩住」保命三步驟。請勿搭乘電梯，避開外牆玻璃與高懸掛物。後續 72 小時內請防範規模 5.5 以上之餘震。</p>
  `;
  
  // Simulating typewriter typing
  reportBody.innerHTML = '';
  
  const paper = document.querySelector('.report-paper');
  const dateMeta = paper.querySelector('.report-meta');
  dateMeta.textContent = `產出時間：2026-07-09 16:21:13 (發震後 8 秒)`;
  
  let currentLength = 0;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = reportTextHTML;
  const textElements = tempDiv.innerHTML;
  
  // Quick reveal typing
  let index = 0;
  function typeText() {
    if (index < textElements.length) {
      // Advance by chunks of HTML to avoid broken tag rendering
      const nextTag = textElements.indexOf('<', index);
      if (nextTag === index) {
        const closeTag = textElements.indexOf('>', index);
        reportBody.innerHTML += textElements.substring(index, closeTag + 1);
        index = closeTag + 1;
      } else {
        const nextStop = nextTag === -1 ? textElements.length : nextTag;
        reportBody.innerHTML += textElements.substring(index, index + 3);
        index += 3;
      }
      setTimeout(typeText, 10);
    } else {
      reportBody.innerHTML = reportTextHTML; // safety replace
      lucide.createIcons();
    }
  }
  typeText();
}


/* Chatbot Q&A simulation */
function setupChatQA() {
  const sendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-user-input');
  
  sendBtn.addEventListener('click', handleChatSubmit);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });
}

function handleChatSubmit() {
  const chatInput = document.getElementById('chat-user-input');
  const query = chatInput.value.trim();
  if (!query) return;
  
  // Add User Message
  addChatMessage('user', query);
  chatInput.value = '';
  
  // Response simulation
  setTimeout(() => {
    const response = getChatResponse(query);
    addChatMessage('agent', response);
  }, 1000);
}

function addChatMessage(sender, text) {
  const box = document.getElementById('chat-messages-box');
  const msg = document.createElement('div');
  msg.className = `chat-message ${sender === 'user' ? 'user-msg' : 'agent-msg'}`;
  
  const iconName = sender === 'user' ? 'user' : 'bot';
  
  msg.innerHTML = `
    <i data-lucide="${iconName}" class="avatar"></i>
    <div class="message-bubble">${text}</div>
  `;
  
  box.appendChild(msg);
  lucide.createIcons();
  
  // Scroll to bottom
  box.scrollTop = box.scrollHeight;
}

function getChatResponse(query) {
  const q = query.toLowerCase();
  
  if (q.includes('盲區') || q.includes('blind zone')) {
    return '<strong>地震預警盲區 (Blind Zone)：</strong>是指地震發生後，地震波已抵達測站並完成警報發送，但在這段「系統反應時間」內，強震的 S 波已經先抵達了震央附近的區域。在盲區內的居民會在收到警報之前（或同時）就感受到強烈搖晃。我們的模擬器中，你可以透過調整「預警延遲」時間，看到震央附近的城市預警秒數變為 0，這就是盲區。';
  }
  if (q.includes('p波') || q.includes('s波') || q.includes('速度')) {
    return '地震波分為 P 波與 S 波：<br>1. <strong>P波 (縱波/Primary Wave)：</strong>傳播速度極快（約 6-7 km/s），介質粒子震動方向與波傳播方向平行（上下搖晃），破壞力較小。<br>2. <strong>S波 (橫波/Secondary Wave)：</strong>傳播速度較慢（約 3.5 km/s），震動方向與傳播方向垂直（左右水平搖晃），破壞力極大。預警系統的本質，就是利用較快抵達的 P波 訊號，在破壞力強的 S波 到達前爭取黃金避難時間！';
  }
  if (q.includes('ai') || q.includes('代理') || q.includes('agent') || q.includes('次世代')) {
    return '次世代地震測報引入 <strong>AI 代理群 (AI Agents)</strong>，是一種分散式協同系統。它將原先人工耗時的資料統合、波形濾波、定位計算、細胞簡訊發佈、LLM摘要撰寫等任務，分派給特定的 AI 角色去處理。各個代理之間會互相傳遞 JSON 資料結構，使地震速報能從傳統的數分鐘縮短至 10 秒內完成，並實現多國語言自動生成，極具前瞻性。';
  }
  if (q.includes('陳達毅') || q.includes('科長')) {
    return '<strong>陳達毅科長</strong>目前任職於中華民國交通部中央氣象署地震測報中心。他是臺灣推動「即時逐秒觀測震度輔助地震預警」以及引進「大型語言模型與 AI 代理於次世代地震測報」的前瞻推手，致力於結合先進科技以落實全民減災宣導。';
  }
  if (q.includes('現地型') || q.includes('區域型')) {
    return '<strong>現地型 (In-situ) 與區域型 (Regional) 地震預警：</strong><br>1. <strong>現地型：</strong>在震央附近直接裝設地震儀，只要該儀器偵測到 P波 的位移或速度振幅達閾值，就立刻發出就地警報。反應時間極快（2秒內），可有效降低盲區半徑，但由於只用單測站資訊，較容易有雜訊誤報。<br>2. <strong>區域型：</strong>需要收納數個測站的資料傳回總部，精算震央、深度與規模後再對外廣播。雖然需要 8-10 秒反應時間，但警報範圍大且準確性極高。臺灣目前正朝向兩者結合的智慧型防護網發展。';
  }
  
  return '謝謝您的詢問！這個問題與我們的地震測報息息相關。您可以嘗試詢問「什麼是地震預警盲區？」、「P波與S波有什麼差別？」或「AI代理在地震測報中做些什麼？」以獲得更多細節！';
}
