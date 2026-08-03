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

    // すでに鍵があれば自動ログイン
    if (Token.get()) {
        try {
            const me = await api("GET", "/me");
            ME = { user: me.user, household: me.household };
            enterApp();
        } catch { Token.set(null); }
    }
});