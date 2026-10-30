
// ========================================
// たまちゃん Birthday Game
// Firebase・プレイヤー・フレンド・ランキング管理
// ========================================

(() => {
  // Firebaseの初期化は index.html 側で行う
  const auth = window.auth;
  const db = window.db;

  if (!auth || !db) {
    console.error("Firebaseが初期化されていません。index.htmlを確認してください。");
    return;
  }

  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LENGTH = 8;

  window.currentPlayer = null;
  window.currentFriends = [];

  // ----------------------------
  // 共通処理
  // ----------------------------

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function generateFriendCode() {
    const values = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(values);

    return Array.from(values)
      .map(value => CODE_CHARS[value % CODE_CHARS.length])
      .join("");
  }

  function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#ff9eae" : "#ffe3a1";
  }

  // ----------------------------
  // プレイヤー登録・ログイン
  // ----------------------------

  async function initializePlayer(user) {
    const playerRef = db.collection("players").doc(user.uid);
    const playerSnapshot = await playerRef.get();

    if (playerSnapshot.exists) {
      window.currentPlayer = {
        uid: user.uid,
        ...playerSnapshot.data()
      };
      return;
    }

    let playerName = "";

    while (!playerName) {
      const answer = prompt("ゲームで使用する名前を入力してください（20文字以内）");

      if (answer === null) {
        playerName = "たまちゃん";
      } else {
        playerName = answer.trim().slice(0, 20);
      }

      if (!playerName) {
        alert("名前を入力してください。");
      }
    }

    // フレンドコードが重複しないように確認して登録
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateFriendCode();
      const codeRef = db.collection("friendCodes").doc(code);

      try {
        await db.runTransaction(async transaction => {
          const currentPlayer = await transaction.get(playerRef);
          const currentCode = await transaction.get(codeRef);

          if (currentPlayer.exists) return;
          if (currentCode.exists) throw new Error("CODE_ALREADY_EXISTS");

          const now = firebase.firestore.FieldValue.serverTimestamp();

          transaction.set(codeRef, {
            uid: user.uid
          });

          transaction.set(playerRef, {
            name: playerName,
            friendCode: code,
            createdAt: now,
            updatedAt: now
          });
        });

        const saved = await playerRef.get();

        window.currentPlayer = {
          uid: user.uid,
          ...saved.data()
        };

        return;
      } catch (error) {
        if (error.message === "CODE_ALREADY_EXISTS") continue;
        throw error;
      }
    }

    throw new Error("フレンドコードを発行できませんでした。");
  }

  // ----------------------------
  // プレイヤー情報の表示
  // ----------------------------

  function createPlayerPanel() {
    const modeScreen = document.getElementById("mode-screen");
    if (!modeScreen || document.getElementById("player-panel")) return;

    const panel = document.createElement("section");
    panel.id = "player-panel";
    panel.className = "panel";
    panel.style.marginTop = "20px";
    panel.style.maxWidth = "900px";

    panel.innerHTML = `
      <h2>プレイヤー情報</h2>
      <p id="player-name">読み込み中...</p>
      <p>あなたのフレンドコード</p>
      <strong id="player-code" style="font-size:1.5rem;letter-spacing:.15em;color:#ffe3a1;">
        ----
      </strong>
      <div>
        <button class="subtle-button" id="copy-code-button">コードをコピー</button>
      </div>

      <hr style="border-color:#ffffff25;margin:22px 0;">

      <h2>フレンド登録</h2>
      <p style="color:#c9c1d8;">友達のフレンドコードを入力してください。</p>
      <input
        id="friend-code-input"
        type="text"
        maxlength="8"
        placeholder="8文字のコード"
        style="width:min(260px,100%);padding:12px;border-radius:12px;border:1px solid #ffffff44;background:#171528;color:white;text-align:center;font:inherit;text-transform:uppercase;"
      >
      <div>
        <button class="primary-button" id="add-friend-button">フレンド登録</button>
      </div>
      <p id="friend-message"></p>

      <h2>フレンド一覧</h2>
      <div id="friend-list">読み込み中...</div>

      <hr style="border-color:#ffffff25;margin:22px 0;">

      <h2>ランキング</h2>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button class="subtle-button ranking-mode" data-mode="time">タイムアタック</button>
        <button class="subtle-button ranking-mode" data-mode="endless">エンドレス</button>
        <button class="subtle-button ranking-mode" data-mode="breath">ブレス</button>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button class="subtle-button ranking-scope" data-scope="all">全プレイヤー</button>
        <button class="subtle-button ranking-scope" data-scope="friends">フレンド</button>
      </div>
      <div id="ranking-list" style="margin-top:15px;">ランキングを選択してください。</div>
    `;

    const modeGrid = modeScreen.querySelector(".mode-grid");
    if (modeGrid) {
      modeGrid.insertAdjacentElement("afterend", panel);
    } else {
      modeScreen.appendChild(panel);
    }

    document.getElementById("copy-code-button").addEventListener("click", async () => {
      const code = window.currentPlayer?.friendCode;
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
        alert("フレンドコードをコピーしました！");
      } catch {
        prompt("このコードをコピーしてください。", code);
      }
    });

    document.getElementById("add-friend-button").addEventListener("click", async () => {
      const input = document.getElementById("friend-code-input");
      const code = input.value.trim().toUpperCase();

      if (code.length !== CODE_LENGTH) {
        showMessage("friend-message", "8文字のコードを入力してください。", true);
        return;
      }

      try {
        await window.addFriendByCode(code);
        input.value = "";
        showMessage("friend-message", "フレンド登録が完了しました！");
        await loadFriends();
      } catch (error) {
        console.error(error);
        showMessage("friend-message", error.message || "登録できませんでした。", true);
      }
    });

    document.querySelectorAll(".ranking-mode").forEach(button => {
      button.addEventListener("click", () => {
        loadLeaderboard(button.dataset.mode, currentRankingScope);
      });
    });

    document.querySelectorAll(".ranking-scope").forEach(button => {
      button.addEventListener("click", () => {
        loadLeaderboard(currentRankingMode, button.dataset.scope);
      });
    });
  }

  // ----------------------------
  // フレンド登録
  // ----------------------------

  window.addFriendByCode = async function(code) {
    const user = auth.currentUser;
    if (!user) throw new Error("ログインしていません。");

    if (code === window.currentPlayer.friendCode) {
      throw new Error("自分のコードは登録できません。");
    }

    const codeSnapshot = await db.collection("friendCodes").doc(code).get();

    if (!codeSnapshot.exists) {
      throw new Error("このフレンドコードは見つかりません。");
    }

    const friendUid = codeSnapshot.data().uid;

    if (friendUid === user.uid) {
      throw new Error("自分のコードは登録できません。");
    }

    const friendRef = db
      .collection("friendships")
      .doc(user.uid)
      .collection("friends")
      .doc(friendUid);

    const existing = await friendRef.get();

    if (existing.exists) {
      throw new Error("すでにフレンド登録されています。");
    }

    await friendRef.set({
      uid: friendUid
    });
  };

  // ----------------------------
  // フレンド一覧
  // ----------------------------

  async function loadFriends() {
    const user = auth.currentUser;
    if (!user) return;

    const list = document.getElementById("friend-list");
    if (!list) return;

    try {
      const snapshot = await db
        .collection("friendships")
        .doc(user.uid)
        .collection("friends")
        .get();

      const friends = [];

      for (const doc of snapshot.docs) {
        const friendUid = doc.id;
        const player = await db.collection("players").doc(friendUid).get();

        if (player.exists) {
          friends.push({
            uid: friendUid,
            name: player.data().name
          });
        }
      }

      window.currentFriends = friends;

      if (friends.length === 0) {
        list.textContent = "まだフレンドはいません。";
        return;
      }

      list.innerHTML = friends.map(friend => `
        <p style="margin:8px 0;">
          ${escapeHTML(friend.name)}
        </p>
      `).join("");
    } catch (error) {
      console.error("フレンド一覧の取得に失敗:", error);
      list.textContent = "フレンド一覧を読み込めませんでした。";
    }
  }

  // ----------------------------
  // ゲーム記録の保存
  // ----------------------------

  window.saveGameRecord = async function(mode, score, elapsedMs) {
    const user = auth.currentUser;

    if (!user) {
      console.error("ログインしていないため記録を保存できません。");
      return;
    }

    if (!["time", "endless", "breath"].includes(mode)) {
      console.error("保存できないゲームモード:", mode);
      return;
    }

    try {
      await db.collection("records").add({
        uid: user.uid,
        mode: mode,
        score: Number(score),
        elapsedMs: Number(elapsedMs),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log("ゲーム記録を保存しました。");
    } catch (error) {
      console.error("ゲーム記録の保存に失敗:", error);
    }
  };

  // ----------------------------
  // ランキング
  // ----------------------------

  let currentRankingMode = "time";
  let currentRankingScope = "all";

  async function loadLeaderboard(mode, scope) {
    currentRankingMode = mode;
    currentRankingScope = scope;

    const list = document.getElementById("ranking-list");
    if (!list) return;

    list.textContent = "ランキングを読み込み中...";

    try {
      const snapshot = await db.collection("records").get();

      let records = snapshot.docs
        .map(doc => doc.data())
        .filter(record => record.mode === mode);

      if (scope === "friends") {
        const allowedUids = new Set([
          auth.currentUser.uid,
          ...window.currentFriends.map(friend => friend.uid)
        ]);

        records = records.filter(record => allowedUids.has(record.uid));
      }

      const bestByPlayer = new Map();

      for (const record of records) {
        const old = bestByPlayer.get(record.uid);

        const isBetter = !old || (
          mode === "time"
            ? record.elapsedMs < old.elapsedMs
            : record.score > old.score ||
              (record.score === old.score && record.elapsedMs < old.elapsedMs)
        );

        if (isBetter) bestByPlayer.set(record.uid, record);
      }

      records = Array.from(bestByPlayer.values());

      records.sort((a, b) => {
        if (mode === "time") return a.elapsedMs - b.elapsedMs;
        return b.score - a.score || a.elapsedMs - b.elapsedMs;
      });

      const players = new Map();

      for (const record of records) {
        if (!players.has(record.uid)) {
          const player = await db.collection("players").doc(record.uid).get();
          players.set(
            record.uid,
            player.exists ? player.data().name : "名前不明"
          );
        }
      }

      if (records.length === 0) {
        list.textContent = "まだ記録がありません。";
        return;
      }

      list.innerHTML = records.slice(0, 20).map((record, index) => {
        const name = escapeHTML(players.get(record.uid));
        const value = mode === "time"
          ? `${(record.elapsedMs / 1000).toFixed(2)}秒`
          : `${record.score}本`;

        return `
          <div style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            align-items:center;
            padding:10px 12px;
            margin:7px 0;
            border-radius:12px;
            background:#ffffff12;
            text-align:left;
          ">
            <span>${index + 1}位　${name}</span>
            <strong style="color:#ffe3a1;">${value}</strong>
          </div>
        `;
      }).join("");

    } catch (error) {
      console.error("ランキング取得に失敗:", error);
      list.textContent = "ランキングを読み込めませんでした。";
    }
  }

  // ----------------------------
  // 画面への反映
  // ----------------------------

  function updatePlayerPanel() {
    createPlayerPanel();

    const player = window.currentPlayer;
    if (!player) return;

    document.getElementById("player-name").textContent =
      `プレイヤー名：${player.name}`;

    document.getElementById("player-code").textContent =
      player.friendCode;

    loadFriends();
  }

  // ----------------------------
  // Firebaseログイン開始
  // ----------------------------

  auth.onAuthStateChanged(async user => {
    if (!user) return;

    try {
      await initializePlayer(user);
      updatePlayerPanel();
      console.log("プレイヤー情報の読み込みが完了しました。");
    } catch (error) {
      console.error("プレイヤー登録エラー:", error);
      alert("プレイヤー情報を読み込めませんでした。ページを再読み込みしてください。");
    }
  });

  auth.signInAnonymously().catch(error => {
    console.error("匿名ログインに失敗:", error);
    alert("ログインに失敗しました。Firebaseの設定を確認してください。");
  });

})();
