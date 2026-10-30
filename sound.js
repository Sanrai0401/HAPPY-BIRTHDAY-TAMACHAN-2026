"use strict";

// ========================================
// 音声の基本設定
// ========================================

let audioContext = null;
let masterGain = null;

let bgmTimer = null;
let currentBGM = null;
let bgmIndex = 0;

const MASTER_VOLUME = 0.35;


// ========================================
// メロディ設定
// ========================================

// ドレミの周波数
const NOTES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.00,
  B5: 987.77,
  C6: 1046.50,
  REST: 0
};

// 各BGMのメロディ
const melodies = {
  title: [
    "C5", "E5", "G5", "E5",
    "A5", "G5", "E5", "D5"
  ],

  menu: [
    "C5", "G5", "E5", "G5",
    "A5", "G5", "E5", "D5"
  ],

  birthday: [
    "C5", "C5", "D5", "C5",
    "F5", "E5", "REST", "C5",
    "C5", "D5", "C5", "G5",
    "F5", "REST", "REST", "REST"
  ],

  time: [
    "E5", "G5", "A5", "G5",
    "E5", "G5", "B5", "A5"
  ],

  endless: [
    "C5", "E5", "G5", "A5",
    "G5", "E5", "D5", "C5"
  ],

  breath: [
    "G4", "C5", "E5", "C5",
    "G4", "D5", "C5", "G4"
  ],

  gift: [
    "C5", "E5", "G5", "C6",
    "G5", "E5", "A5", "G5"
  ],

  letter: [
    "C5", "E5", "G5", "E5",
    "D5", "C5", "G4", "C5"
  ],

  result: [
    "C5", "E5", "G5", "C6",
    "B5", "G5", "C6", "REST"
  ],

  gameover: [
    "G5", "E5", "D5", "C5",
    "A4", "G4", "REST", "REST"
  ]
};


// ========================================
// 音声初期化
// ========================================

window.initializeAudio = async function () {
  try {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error("このブラウザは音声に対応していません。");
        return;
      }

      audioContext = new AudioContextClass();

      masterGain = audioContext.createGain();

      masterGain.gain.value = MASTER_VOLUME;

      masterGain.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    console.log("音声初期化成功:", audioContext.state);

  } catch (error) {
    console.error("音声初期化エラー:", error);
  }
};


// ========================================
// 音を鳴らす基本関数
// ========================================

window.playTone = function (
  frequency,
  duration = 0.3,
  type = "sine",
  volume = 0.2
) {
  if (!audioContext || !masterGain) {
    return;
  }

  if (frequency <= 0) {
    return;
  }

  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime
    );

    gain.gain.setValueAtTime(
      0.001,
      audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      audioContext.currentTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(masterGain);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + duration + 0.05
    );

  } catch (error) {
    console.error("音の再生エラー:", error);
  }
};


// ========================================
// BGM停止
// ========================================

window.stopBGM = function () {
  if (bgmTimer !== null) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }

  currentBGM = null;
  bgmIndex = 0;
};


// ========================================
// BGM再生
// ========================================

window.startBGM = async function (name) {
  await window.initializeAudio();

  if (!audioContext || audioContext.state !== "running") {
    console.warn("音声を再生できません。");
    return;
  }

  const melody = melodies[name];

  if (!melody) {
    console.warn("BGMが見つかりません:", name);
    return;
  }

  window.stopBGM();

  currentBGM = name;
  bgmIndex = 0;

  function playNextNote() {
    if (currentBGM !== name) {
      return;
    }

    const noteName = melody[bgmIndex];
    const frequency = NOTES[noteName];

    if (frequency > 0) {
      window.playTone(
        frequency,
        0.32,
        "triangle",
        0.09
      );
    }

    bgmIndex++;

    if (bgmIndex >= melody.length) {
      bgmIndex = 0;
    }

    bgmTimer = setTimeout(
      playNextNote,
      380
    );
  }

  playNextNote();

  console.log("BGM再生:", name);
};


// ========================================
// 効果音
// ========================================

// ゲーム開始
window.playStartSound = function () {
  window.playTone(NOTES.C5, 0.12, "sine", 0.2);

  setTimeout(() => {
    window.playTone(NOTES.E5, 0.12, "sine", 0.2);
  }, 100);

  setTimeout(() => {
    window.playTone(NOTES.G5, 0.25, "sine", 0.2);
  }, 200);
};


// ろうそくを消す
window.playCandleSound = function () {
  window.playTone(
    NOTES.G5,
    0.12,
    "sine",
    0.15
  );

  setTimeout(() => {
    window.playTone(
      NOTES.C6,
      0.15,
      "sine",
      0.12
    );
  }, 60);
};


// プレゼントを開ける
window.playGiftSound = function () {
  window.playTone(NOTES.C5, 0.15, "triangle", 0.2);

  setTimeout(() => {
    window.playTone(NOTES.E5, 0.15, "triangle", 0.2);
  }, 120);

  setTimeout(() => {
    window.playTone(NOTES.G5, 0.25, "triangle", 0.2);
  }, 240);
};


// 手紙を開く
window.playLetterSound = function () {
  window.playTone(
    NOTES.C5,
    0.35,
    "sine",
    0.15
  );

  setTimeout(() => {
    window.playTone(
      NOTES.E5,
      0.35,
      "sine",
      0.15
    );
  }, 250);

  setTimeout(() => {
    window.playTone(
      NOTES.G5,
      0.5,
      "sine",
      0.15
    );
  }, 500);
};


// クリア音楽
window.playResultMusic = function () {
  window.playTone(NOTES.C5, 0.2, "triangle", 0.2);

  setTimeout(() => {
    window.playTone(NOTES.E5, 0.2, "triangle", 0.2);
  }, 150);

  setTimeout(() => {
    window.playTone(NOTES.G5, 0.2, "triangle", 0.2);
  }, 300);

  setTimeout(() => {
    window.playTone(NOTES.C6, 0.5, "triangle", 0.2);
  }, 450);
};


// ゲームオーバー
window.playGameOverSound = function () {
  window.playTone(
    NOTES.G5,
    0.3,
    "sawtooth",
    0.12
  );

  setTimeout(() => {
    window.playTone(
      NOTES.E5,
      0.3,
      "sawtooth",
      0.12
    );
  }, 250);

  setTimeout(() => {
    window.playTone(
      NOTES.C5,
      0.6,
      "sawtooth",
      0.12
    );
  }, 500);
};


// 成功音
window.playSuccessSound = function () {
  window.playResultMusic();
};

console.log("sound.js 読み込み完了");