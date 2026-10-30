"use strict";

// ========================================
// 共通設定
// ========================================

const $ = (id) => document.getElementById(id);

const screens = [
  "title-screen",
  "mode-screen",
  "game-screen",
  "gift-screen",
  "letter-screen",
  "result-screen"
];

const TOTAL_CANDLES = 20;

let currentMode = "";
let candles = [];
let extinguishedCount = 0;
let giftCount = 0;

let gameRunning = false;
let startTime = 0;
let elapsedTime = 0;

let timerInterval = null;
let candleAnimation = null;

let microphoneStream = null;
let microphoneContext = null;
let microphoneAnalyser = null;
let microphoneAnimation = null;

let lastBreathTime = 0;


// ========================================
// 音声処理
// sound.js の関数を直接利用する
// ========================================

function initializeGameAudio() {
  if (typeof window.initializeAudio === "function") {
    return window.initializeAudio();
  }

  console.warn("initializeAudio が見つかりません");
}

function playSound(name, ...args) {
  const fn = window[name];

  if (typeof fn !== "function") {
    console.warn(`${name} が見つかりません`);
    return;
  }

  try {
    return fn.apply(window, args);
  } catch (error) {
    console.error(`音声エラー: ${name}`, error);
  }
}


// ========================================
// 画面切り替え
// ========================================

function showScreen(id) {
  screens.forEach((screenId) => {
    $(screenId)?.classList.remove("active");
  });

  $(id)?.classList.add("active");
}


// ========================================
// タイトル画面
// ========================================

$("start-button").addEventListener("click", async () => {
  try {
    await initializeGameAudio();
  } catch (error) {
    console.error("音声初期化エラー:", error);
  }

  playSound("playStartSound");
  playSound("stopBGM");

  showScreen("mode-screen");

  playSound("startBGM", "menu");
});

$("back-title").addEventListener("click", () => {
  playSound("stopBGM");

  showScreen("title-screen");

  playSound("startBGM", "title");
});


// ========================================
// モード選択
// ========================================

document.querySelectorAll(".mode-card").forEach((button) => {
  button.addEventListener("click", () => {
    startGame(button.dataset.mode);
  });
});


// ========================================
// ゲーム開始
// ========================================

function startGame(mode) {
  currentMode = mode;

  gameRunning = true;
  extinguishedCount = 0;
  elapsedTime = 0;
  startTime = Date.now();
  giftCount = 0;
  lastBreathTime = 0;

  clearInterval(timerInterval);

  if (candleAnimation !== null) {
    cancelAnimationFrame(candleAnimation);
    candleAnimation = null;
  }

  stopMicrophone();

  candles = [];
  $("candles").innerHTML = "";

  $("cake").classList.remove("cake-fly");

  $("mic-button").classList.add("hidden");
  $("stop-button").classList.add("hidden");
  $("mic-note").classList.add("hidden");

  setupMode(mode);

  showScreen("game-screen");

  // 既存のBGM処理は変更しない
  playSound("stopBGM");
  playSound("startBGM", mode);

  // すべてのモードで20本表示
  for (let i = 0; i < TOTAL_CANDLES; i++) {
    createCandle();
  }

  if (mode === "breath") {
    $("mic-button").classList.remove("hidden");
    $("mic-note").classList.remove("hidden");

    $("game-message").textContent =
      "マイクを使って息を吹いてね！";
  }

  if (mode === "endless") {
    $("stop-button").classList.remove("hidden");
  }

  startTimer();
}


// ========================================
// モード別設定
// ========================================

function setupMode(mode) {
  const settings = {
    birthday: {
      eyebrow: "BIRTHDAY MODE",
      heading: "ろうそくを消してね！",
      instruction: "20本のろうそくを全部消そう。",
      label: "残り",
      message: "ろうそくをタップして消してね！"
    },

    time: {
      eyebrow: "TIME ATTACK",
      heading: "タイムアタック！",
      instruction: "20本をできるだけ速く消そう。",
      label: "残り",
      message: "20本を全部消そう！"
    },

    endless: {
      eyebrow: "ENDLESS MODE",
      heading: "何本消せるかな？",
      instruction: "制限時間なしで挑戦しよう。",
      label: "消した数",
      message: "ろうそくを消し続けよう！"
    },

    breath: {
      eyebrow: "BREATH MODE",
      heading: "息を吹いて消そう！",
      instruction: "マイクに向かって息を吹いてね。",
      label: "消した数",
      message: "マイクを使ってゲームを始めよう！"
    }
  };

  const setting = settings[mode];

  $("mode-eyebrow").textContent = setting.eyebrow;
  $("game-heading").textContent = setting.heading;
  $("game-instruction").textContent = setting.instruction;
  $("stat-label").textContent = setting.label;
  $("game-message").textContent = setting.message;

  updateStats();
}


// ========================================
// ろうそく画像
// ========================================

// ろうそくのイラスト画像（SVG）
const candleImage = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100">
  <defs>
    <linearGradient id="body" x1="0" x2="1">
      <stop offset="0" stop-color="#ff83b7"/>
      <stop offset="0.35" stop-color="#fff0f0"/>
      <stop offset="0.65" stop-color="#ffb4d0"/>
      <stop offset="1" stop-color="#d94f91"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffbd0"/>
      <stop offset="0.45" stop-color="#ffe36a"/>
      <stop offset="1" stop-color="#ff8b28"/>
    </linearGradient>
  </defs>

  <ellipse cx="32" cy="91" rx="14" ry="4" fill="#ffb7d5" opacity=".3"/>

  <path d="M32 8 C18 24 23 34 32 37 C43 32 44 21 32 8Z"
        fill="url(#flame)" stroke="#fff4b0" stroke-width="1.5"/>

  <path d="M32 17 C27 25 29 30 33 32 C37 27 36 22 32 17Z"
        fill="#fffce5"/>

  <path d="M32 36 L32 43"
        stroke="#553b36" stroke-width="3" stroke-linecap="round"/>

  <rect x="20" y="42" width="24" height="47" rx="5"
        fill="url(#body)" stroke="#ffe6f0" stroke-width="1.5"/>

  <path d="M21 53 L43 43 M20 69 L44 57 M20 85 L44 73"
        stroke="#fff2f7" stroke-width="5" opacity=".75"/>

  <ellipse cx="32" cy="43" rx="12" ry="3"
           fill="#ffe9f0" stroke="#ffffff" stroke-width="1"/>
</svg>
`;

const candleImageUrl =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(candleImage);


// ========================================
// ろうそく生成
// ========================================

function createCandle() {
  if (!gameRunning) return;

  const candle = document.createElement("button");

  candle.type = "button";
  candle.className = "candle";
  candle.setAttribute("aria-label", "ろうそくを消す");

  // ろうそくの後ろに置く光
  const glow = document.createElement("span");
  glow.className = "candle-glow";

  // ろうそくの画像
  const image = document.createElement("img");
  image.className = "candle-image";
  image.src = candleImageUrl;
  image.alt = "";
  image.draggable = false;

  // 光を先、画像を後に追加
  candle.appendChild(glow);
  candle.appendChild(image);

  // 5列×4行を基本に配置し、少しランダムにずらす
  const index = candles.length;
  const column = index % 5;
  const row = Math.floor(index / 5);

  candle.x = 10 + column * 19 + (Math.random() * 5 - 2.5);
  candle.y = 13 + row * 23 + (Math.random() * 5 - 2.5);

  // 移動速度
  candle.vx = (Math.random() - 0.5) * 0.10;
  candle.vy = (Math.random() - 0.5) * 0.10;

  candle.style.left = `${candle.x}%`;
  candle.style.top = `${candle.y}%`;

  // クリックで消火
  candle.addEventListener("click", () => {
    extinguishCandle(candle);
  });

  $("candles").appendChild(candle);
  candles.push(candle);

  if (candleAnimation === null) {
    animateCandles();
  }
}


// ========================================
// ろうそくの移動
// ========================================

function animateCandles() {
  candleAnimation = null;

  if (!gameRunning) return;

  candles.forEach((candle) => {
    if (
      !candle.isConnected ||
      candle.classList.contains("extinguished")
    ) {
      return;
    }

    candle.x += candle.vx;
    candle.y += candle.vy;

    // 左右の端で反射
    if (candle.x <= 5 || candle.x >= 95) {
      candle.vx *= -1;
    }

    // 上下の端で反射
    if (candle.y <= 8 || candle.y >= 88) {
      candle.vy *= -1;
    }

    candle.x = Math.max(5, Math.min(95, candle.x));
    candle.y = Math.max(8, Math.min(88, candle.y));

    candle.style.left = `${candle.x}%`;
    candle.style.top = `${candle.y}%`;
  });

  candleAnimation = requestAnimationFrame(animateCandles);
}


// ========================================
// ろうそく消火
// ========================================

function extinguishCandle(candle) {
  if (!gameRunning) return;

  if (candle.classList.contains("extinguished")) {
    return;
  }

  // 本体画像と、そのろうそくの光を同時に消す
  candle.classList.add("extinguished");
  candle.disabled = true;

  playSound("playCandleSound");

  extinguishedCount++;

  updateStats();

  if (
    currentMode === "birthday" ||
    currentMode === "time"
  ) {
    if (extinguishedCount >= TOTAL_CANDLES) {
      finishGame();
      return;
    }
  }

  if (
    currentMode === "endless" ||
    currentMode === "breath"
  ) {
    setTimeout(() => {
      candle.remove();

      candles = candles.filter(
        (item) => item !== candle
      );

      if (gameRunning) {
        createCandle();
      }
    }, 350);
  }
}


// ========================================
// 数字・時間表示
// ========================================

function updateStats() {
  if (
    currentMode === "birthday" ||
    currentMode === "time"
  ) {
    $("stat-value").textContent =
      `${Math.max(0, TOTAL_CANDLES - extinguishedCount)}本`;
  } else {
    $("stat-value").textContent =
      `${extinguishedCount}本`;
  }

  $("timer-value").textContent =
    `${(elapsedTime / 1000).toFixed(1)}秒`;
}


// ========================================
// タイマー
// ========================================

function startTimer() {
  timerInterval = setInterval(() => {
    if (!gameRunning) return;

    elapsedTime = Date.now() - startTime;

    updateStats();
  }, 100);
}


// ========================================
// ゲーム終了
// ========================================

function finishGame() {
  if (!gameRunning) return;

  gameRunning = false;

  elapsedTime = Date.now() - startTime;

  clearInterval(timerInterval);
  stopMicrophone();

  if (candleAnimation !== null) {
    cancelAnimationFrame(candleAnimation);
    candleAnimation = null;
  }

  playSound("stopBGM");

  if (currentMode === "birthday") {
    playSound("playResultMusic");

    setTimeout(() => {
      showGiftScreen();
    }, 800);

    return;
  }

  showResult(false);
}


// ========================================
// プレゼント画面
// ========================================

function showGiftScreen() {
  giftCount = 0;

  $("gift-count").textContent =
    "プレゼント発見：0 / 3";

  $("gift-message").textContent =
    "気になる箱を選んでね！";

  document.querySelectorAll(".gift-box").forEach((box) => {
    box.disabled = false;
    box.textContent = "🎁";
    box.classList.remove("opened");
  });

  showScreen("gift-screen");

  playSound("startBGM", "gift");
}

document.querySelectorAll(".gift-box").forEach((box) => {
  box.addEventListener("click", () => {
    if (box.disabled) return;

    box.disabled = true;
    box.classList.add("opened");
    box.textContent = "✨";

    giftCount++;

    playSound("playGiftSound");

    $("gift-count").textContent =
      `プレゼント発見：${giftCount} / 3`;

    $("gift-message").textContent =
      giftCount >= 3
        ? "全部見つけたね！最後のサプライズへ！"
        : "プレゼントを見つけたね！";

    if (giftCount === 3) {
      setTimeout(showLetterScreen, 1000);
    }
  });
});


// ========================================
// 手紙画面
// ========================================

function showLetterScreen() {
  $("letter").classList.add("hidden");
  $("ending-message").classList.add("hidden");
  $("letter-mode-button").classList.add("hidden");
  $("open-letter").classList.remove("hidden");

  showScreen("letter-screen");

  playSound("startBGM", "letter");
}

$("open-letter").addEventListener("click", () => {
  playSound("stopBGM");
  playSound("playLetterSound");

  $("letter").classList.remove("hidden");
  $("open-letter").classList.add("hidden");

  $("ending-message").classList.remove("hidden");
  $("letter-mode-button").classList.remove("hidden");

  playSound("playResultMusic");
});

$("letter-mode-button").addEventListener("click", () => {
  showScreen("mode-screen");

  playSound("startBGM", "menu");
});


// ========================================
// 結果画面
// ========================================

function showResult(gameOver) {
  playSound("stopBGM");

  if (gameOver) {
    playSound("playGameOverSound");
  } else {
    playSound("playResultMusic");
  }

  $("result-eyebrow").textContent =
    gameOver ? "GAME OVER" : "RESULT";

  $("result-icon").textContent =
    gameOver ? "💨" : "🏆";

  $("result-title").textContent =
    gameOver ? "ゲームオーバー！" : "おめでとう！";

  $("result-description").textContent =
    gameOver
      ? "ケーキが飛んでいってしまった！"
      : "最後まで遊んでくれてありがとう！";

  $("result-stats").innerHTML = `
    <p>消したろうそく：<strong>${extinguishedCount}本</strong></p>
    <p>かかった時間：<strong>${(elapsedTime / 1000).toFixed(1)}秒</strong></p>
  `;

  showScreen("result-screen");
}


// ========================================
// リトライ・モード選択
// ========================================

$("retry-button").addEventListener("click", () => {
  startGame(currentMode);
});

$("result-mode-button").addEventListener("click", () => {
  showScreen("mode-screen");

  playSound("startBGM", "menu");
});

$("game-back-button").addEventListener("click", () => {
  gameRunning = false;

  clearInterval(timerInterval);
  stopMicrophone();

  if (candleAnimation !== null) {
    cancelAnimationFrame(candleAnimation);
    candleAnimation = null;
  }

  playSound("stopBGM");

  showScreen("mode-screen");

  playSound("startBGM", "menu");
});

$("stop-button").addEventListener("click", () => {
  if (currentMode === "endless") {
    finishGame();
  }
});


// ========================================
// ブレスモード
// ========================================

$("mic-button").addEventListener("click", async () => {
  if (!gameRunning || currentMode !== "breath") {
    return;
  }

  try {
    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    microphoneContext = new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    const source =
      microphoneContext.createMediaStreamSource(
        microphoneStream
      );

    microphoneAnalyser =
      microphoneContext.createAnalyser();

    microphoneAnalyser.fftSize = 1024;

    source.connect(microphoneAnalyser);

    $("mic-button").disabled = true;
    $("mic-button").textContent = "🎙️ マイク使用中";

    $("game-message").textContent =
      "息を吹いてろうそくを消そう！";

    detectBreath();

  } catch (error) {
    console.error("マイクエラー:", error);

    $("game-message").textContent =
      "マイクを使用できませんでした。設定を確認してね。";
  }
});


// ========================================
// 息の検出
// ========================================

function detectBreath() {
  if (!gameRunning || !microphoneAnalyser) {
    return;
  }

  const data = new Uint8Array(
    microphoneAnalyser.fftSize
  );

  microphoneAnalyser.getByteTimeDomainData(data);

  let sum = 0;

  for (const value of data) {
    const normalized = (value - 128) / 128;
    sum += normalized * normalized;
  }

  const rms = Math.sqrt(sum / data.length);
  const now = Date.now();

  // 強すぎる息でゲームオーバー
  if (rms > 0.65) {
    cakeFlyAway();
    return;
  }

  // 一定間隔を空けて消火
  if (rms > 0.12 && now - lastBreathTime > 500) {
    const candle = candles.find(
      (item) =>
        !item.classList.contains("extinguished")
    );

    if (candle) {
      lastBreathTime = now;
      extinguishCandle(candle);
    }
  }

  microphoneAnimation =
    requestAnimationFrame(detectBreath);
}


// ========================================
// ケーキが飛ぶ
// ========================================

function cakeFlyAway() {
  if (!gameRunning) return;

  gameRunning = false;

  clearInterval(timerInterval);
  stopMicrophone();

  if (candleAnimation !== null) {
    cancelAnimationFrame(candleAnimation);
    candleAnimation = null;
  }

  elapsedTime = Date.now() - startTime;

  updateStats();

  $("cake").classList.add("cake-fly");

  playSound("stopBGM");

  setTimeout(() => {
    showResult(true);
  }, 800);
}


// ========================================
// マイク停止
// ========================================

function stopMicrophone() {
  if (microphoneAnimation !== null) {
    cancelAnimationFrame(microphoneAnimation);
    microphoneAnimation = null;
  }

  if (microphoneStream) {
    microphoneStream.getTracks().forEach((track) => {
      track.stop();
    });

    microphoneStream = null;
  }

  if (microphoneContext) {
    microphoneContext.close();
    microphoneContext = null;
  }

  microphoneAnalyser = null;

  if ($("mic-button")) {
    $("mic-button").disabled = false;
    $("mic-button").textContent = "🎙️ マイクを使う";
  }
}


// ========================================
// 初期表示
// ========================================

showScreen("title-screen");

console.log("game.js 読み込み完了");