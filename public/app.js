// ===== 共通の小道具 =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
// 入力文字をそのまま画面に出しても安全にする（HTMLエスケープ）
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// トークン（ログインの鍵）をブラウザに保存・取り出し。再読み込みしてもログインが続く
const Token = {
    get: () => localStorage.getItem("papa_token"),
    set: (v) => v ? localStorage.setItem("papa_token", v) : localStorage.removeItem("papa_token"),
};
let ME = null; // ログイン中の { user, household }

// APIを呼ぶ共通関数。トークンがあれば自動で添える
async function api(method, path, body) {
    const res = await fetch("/api" + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(Token.get() ? { Authorization: "Bearer " + Token.get() } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;                 // 中身なし（削除など）
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "エラーが発生しました");
    return data;
}

// ===== 認証（ログイン / 新規登録）=====
let isLogin = true; // true=ログイン, false=新規登録

async function submitAuth() {
    $("#auth-err").textContent = "";
    try {
        let data;
        if (isLogin) {
            data = await api("POST", "/login", {
                email: $("#f-email").value, password: $("#f-password").value,
            });
        } else {
            data = await api("POST", "/signup", {
                role: $("#f-role").value, name: $("#f-name").value,
                household_name: $("#f-household").value,
                email: $("#f-email").value, password: $("#f-password").value,
            });
        }
        Token.set(data.token);                       // 鍵を保存
        ME = { user: data.user, household: data.household };
        enterApp();
    } catch (e) {
        $("#auth-err").textContent = e.message;      // エラー文を表示
    }
}

// ログイン画面を隠してアプリ本体を表示、データ読み込み開始
function enterApp() {
    $("#auth").hidden = true;
    $("#app").hidden = false;
    loadChecklist();
    loadContractions();
    loadBenefits();
}
function signOut() { Token.set(null); location.reload(); }

// ===== タブ切り替え =====
function setupTabs() {
    $$(".tab").forEach(t => t.addEventListener("click", () => {
        $$(".tab").forEach(x => x.classList.remove("on"));
        $$(".view").forEach(x => x.classList.remove("active"));
        t.classList.add("on");
        $("#" + t.dataset.v).classList.add("active");
    }));
}

// ===== チェックリスト（段取り・当日・手続き）=====
async function loadChecklist() {
    // APIは { prep:[...], day:[...], procedure:[...] } を返す
    const data = await api("GET", "/checklist_items");
    renderChecks("#prep-list", data.prep);
    renderChecks("#day-list", data.day);
    renderDoc("#doc-list", data.procedure);
}

// 段取り・当日：チェックボックス形式で描画
function renderChecks(sel, items) {
    $(sel).innerHTML = (items || []).map(i =>
        `<label class="chk ${i.done ? "done" : ""}" data-id="${i.id}">
       <span class="box">✓</span><span class="txt">${esc(i.title)}</span>
       ${i.done && i.done_by ? `<span class="by">${esc(i.done_by)}</span>` : ""}
     </label>`).join("") || `<div class="empty">項目がありません</div>`;
    // クリックで完了・未完了を切り替え
    $$(`${sel} .chk`).forEach(el => el.addEventListener("click",
        () => toggleItem(el.dataset.id, !el.classList.contains("done"))));
}

// 手続き：カード形式で描画（提出先・補足つき）
function renderDoc(sel, items) {
    $(sel).innerHTML = (items || []).map(i =>
        `<div class="card" data-id="${i.id}">
       <div class="row">
         <span class="t14 ${i.done ? "strike" : ""}">${esc(i.title)}</span>
         <span class="pill ${i.done ? "g" : "n"}">${i.done ? "完了" : "未"}</span>
       </div>
       ${i.place ? `<p class="meta">📍 ${esc(i.place)}</p>` : ""}
       ${i.detail ? `<p class="meta">${esc(i.detail)}</p>` : ""}
     </div>`).join("") || `<div class="empty">項目がありません</div>`;
    $$(`${sel} .card`).forEach(el => el.addEventListener("click",
        () => toggleItem(el.dataset.id, !el.querySelector(".pill").classList.contains("g"))));
}

// 完了トグル：APIに更新を送って、再読み込み
async function toggleItem(id, done) {
    await api("PATCH", "/checklist_items/" + id, { done });
    loadChecklist();
}

// ===== 陣痛タイマー =====
let lastContraction = null; // 最後に記録した時刻（経過時間の表示に使う）

// 一覧＋統計を取得して画面に反映
async function loadContractions() {
    const data = await api("GET", "/contraction_events");
    applyStats(data.stats);
}

// 統計（回数・平均間隔・病院連絡の目安）を画面に反映する
function applyStats(stats) {
    if (!stats) return;
    $("#st-cnt").textContent = (stats.count || 0) + "回";
    $("#st-int").textContent = stats.average_interval_sec
        ? Math.round(stats.average_interval_sec / 60 * 10) / 10 + "分" // 秒→分に変換（小数1桁）
        : "—";
    // 最後の記録時刻を覚えておく（毎秒の経過表示に使う）
    lastContraction = stats.last_occurred_at ? new Date(stats.last_occurred_at) : null;
    // 目安に達したら黄色い警告、そうでなければ通常メッセージ
    const a = $("#alert");
    if (stats.call_hospital) {
        a.className = "banner warn";
        a.textContent = "📞 そろそろ病院に電話（目安に近づいています）";
    } else {
        a.className = "banner mute";
        a.textContent = "「陣痛が来た」を押すと間隔を計測します";
    }
}

// 「陣痛が来た」ボタン：今の時刻で1件記録し、返ってきた統計を反映
async function recordContraction() {
    const data = await api("POST", "/contraction_events", {});
    applyStats(data.stats);
}

// リセット：確認のうえ、これまでの記録を全部消して計測をやり直す
async function resetContractions() {
    if (!confirm("これまでの陣痛の記録をリセットしますか？")) return;
    const data = await api("DELETE", "/contraction_events/reset");
    lastContraction = null;               // 経過表示のもとをクリア
    $("#tm-main").textContent = "00:00";  // 大きな数字を00:00に戻す
    applyStats(data.stats);               // 空の統計を反映（回数0・平均— など）
}

// ===== お金（育休・給付金）=====

// 一覧を取得して画面に描画する
async function loadBenefits() {
    const steps = await api("GET", "/benefit_steps"); // 配列がそのまま返る
    renderBenefits(steps);
}

// ステップの配列を、時間軸（タイムライン）のカードとして描画する
function renderBenefits(steps) {
    // 状態ごとの色を決めておく（未=グレー、進行中=赤系、完了=緑系）
    const colors = {
        todo: ["#f0f1ee", "var(--muted)"],
        doing: ["var(--danger-bg)", "var(--danger-dark)"],
        done: ["var(--accent-bg)", "var(--accent-dark)"],
    };
    const labels = { todo: "未", doing: "進行中", done: "完了" };

    $("#money-list").innerHTML = steps.map((s, i) => {
        const [bg, fg] = colors[s.status] || colors.todo;
        // 完了なら✓、進行中なら●、未なら番号を表示
        const mark = s.status === "done" ? "✓" : s.status === "doing" ? "●" : (i + 1);
        // 最後のステップ以外は、下に線を伸ばして次につなげる
        const line = i < steps.length - 1 ? `<div class="ln"></div>` : "";
        // 3つの状態ボタン（未・進行中・完了）を作る。今の状態には on クラスを付ける
        const buttons = ["todo", "doing", "done"].map(st =>
            `<button data-step="${s.id}" data-status="${st}" class="${s.status === st ? "on" : ""}">${labels[st]}</button>`
        ).join("");

        return `<div class="tl">
      <div class="dot"><div class="c" style="background:${bg};color:${fg}">${mark}</div>${line}</div>
      <div class="ct">
        <p class="ph">${esc(s.timing_note || s.phase_label)}</p>
        <p class="ti">${esc(s.title)}</p>
        <p class="tx">${esc(s.description)}</p>
        <div class="btns">${buttons}</div>
      </div>
    </div>`;
    }).join("");

    // 各状態ボタンにクリックを登録。押したらAPIに更新を送って再読み込み
    $$("#money-list [data-step]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await api("PATCH", "/benefit_steps/" + btn.dataset.step, { status: btn.dataset.status });
            loadBenefits(); // 最新の状態で描画し直す
        });
    });
}

// 時計と「前回からの経過」を毎秒更新する
function two(n) { return (n < 10 ? "0" : "") + n; }
setInterval(() => {
    const d = new Date();
    if ($("#clock")) $("#clock").textContent = two(d.getHours()) + ":" + two(d.getMinutes());
    if ($("#tm-main") && lastContraction) {
        const s = Math.floor((Date.now() - lastContraction.getTime()) / 1000);
        $("#tm-main").textContent = two(Math.floor(s / 60)) + ":" + two(s % 60);
    }
}, 1000);

// ===== 起動時の処理 =====
document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    $("#btn-submit").addEventListener("click", submitAuth);
    // 「ログイン⇄新規登録」の切り替え
    $("#toggle-auth").addEventListener("click", () => {
        isLogin = !isLogin;
        $("#signup-fields").hidden = isLogin;
        $("#btn-submit").textContent = isLogin ? "ログイン" : "新規登録";
        $("#toggle-auth").textContent = isLogin ? "新規登録はこちら" : "ログインはこちら";
    });
    $$("[data-signout]").forEach(b => b.addEventListener("click", signOut));
    $("#tm-btn").addEventListener("click", recordContraction);
    $("#tm-reset").addEventListener("click", resetContractions);

    // すでに鍵があれば自動ログイン
    if (Token.get()) {
        try {
            const me = await api("GET", "/me");
            ME = { user: me.user, household: me.household };
            enterApp();
        } catch { Token.set(null); }
    }
});