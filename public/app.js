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
let signupMode = "new"; // "new"=新しく家族を作る, "join"=相手として参加

async function submitAuth() {
    $("#auth-err").textContent = "";
    try {
        let data;
        if (isLogin) {
            data = await api("POST", "/login", {
                email: $("#f-email").value, password: $("#f-password").value,
            });
        } else {
            const body = {
                role: $("#f-role").value,
                name: $("#f-name").value,
                email: $("#f-email").value,
                password: $("#f-password").value,
            };
            if (signupMode === "new") {
                body.household_name = $("#f-household").value;
            } else {
                body.invite_code = $("#f-invite").value;
            }
            data = await api("POST", "/signup", body);
        }
        Token.set(data.token);
        ME = { user: data.user, household: data.household };
        enterApp();
    } catch (e) {
        $("#auth-err").textContent = e.message;
    }
}

// ログイン画面を隠してアプリ本体を表示、データ読み込み開始
function enterApp() {
    $("#auth").hidden = true;
    $("#app").hidden = false;
    loadSettings();
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
    const data = await api("GET", "/checklist_items");
    renderChecks("#prep-list", data.prep);
    renderChecks("#day-list", data.day);
    renderDoc("#doc-list", data.procedure);
    renderGifts(data.gift);
}

// 段取り・当日：チェックボックス形式で描画（削除ボタン付き）
function renderChecks(sel, items) {
    $(sel).innerHTML = (items || []).map(i =>
        `<div class="chk ${i.done ? "done" : ""}" data-id="${i.id}" data-doneby="${esc(i.done_by || "")}">
       <span class="box">✓</span><span class="txt">${esc(i.title)}</span>
       ${i.done && i.done_by ? `<span class="by">${esc(i.done_by)}</span>` : ""}
       <button class="del" data-del="${i.id}" title="削除">×</button>
     </div>`).join("") || `<div class="empty">項目がありません</div>`;

    $$(`${sel} .chk`).forEach(el => el.addEventListener("click", (ev) => {
        if (ev.target.closest(".del")) return;

        const willDone = !el.classList.contains("done");
        // 完了→未完了に戻す操作だけ、確認を挟む（相手の完了を誤って消さないため）
        if (!willDone) {
            const doneBy = el.dataset.doneby;
            const msg = doneBy
                ? `「${doneBy}」が完了にした項目です。未完了に戻しますか？`
                : "この項目を未完了に戻しますか？";
            if (!confirm(msg)) return;
        }
        toggleItem(el.dataset.id, willDone);
    }));

    $$(`${sel} .del`).forEach(btn => btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        deleteItem(btn.dataset.del);
    }));
}

// 新しい項目を追加する共通処理（category と、入力欄/ボタンのidを受け取る）
async function addChecklistItem(category, inputSel, buttonSel) {
    const input = $(inputSel);
    const title = input.value.trim();
    if (!title) return; // 空なら何もしない

    await api("POST", "/checklist_items", { category, title });
    input.value = "";     // 入力欄を空にする
    loadChecklist();      // 一覧を再読み込みして、追加した項目を表示
}

// 手続き：カード形式で描画（提出先・補足・公式リンクつき）
function renderDoc(sel, items) {
    $(sel).innerHTML = (items || []).map(i =>
        `<div class="card" data-id="${i.id}" data-doneby="${esc(i.done_by || "")}">
       <div class="row">
         <span class="t14 ${i.done ? "strike" : ""}">${esc(i.title)}</span>
         <div style="display:flex; align-items:center; gap:6px;">
           <span class="pill ${i.done ? "g" : "n"}">${i.done ? "完了" : "未"}</span>
           <button class="del" data-del="${i.id}" title="削除">×</button>
         </div>
       </div>
       ${i.place ? `<p class="meta">📍 ${esc(i.place)}</p>` : ""}
       ${i.detail ? `<p class="meta">${esc(i.detail)}</p>` : ""}
       <div class="row" style="margin-top:8px; align-items:center;">
         ${i.url ? `<a class="meta-link" href="${esc(i.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 詳しく見る（公式サイト）</a>` : "<span></span>"}
         ${i.done && i.done_by ? `<span class="meta" style="margin:0 0 0 auto;">✅ ${esc(i.done_by)}が完了</span>` : ""}
       </div>
     </div>`).join("") || `<div class="empty">項目がありません</div>`;

    $$(`${sel} .card`).forEach(el => el.addEventListener("click", (ev) => {
        if (ev.target.closest(".del")) return; // ×ボタンのクリックは完了トグルに流さない
        const willDone = !el.querySelector(".pill").classList.contains("g");
        if (!willDone) {
            const doneBy = el.dataset.doneby;
            const msg = doneBy
                ? `「${doneBy}」が完了にした項目です。未完了に戻しますか？`
                : "この項目を未完了に戻しますか？";
            if (!confirm(msg)) return;
        }
        toggleItem(el.dataset.id, willDone);
    }));

    $$(`${sel} .del`).forEach(btn => btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        deleteItem(btn.dataset.del);
    }));
}

// ===== Push Gift 候補 =====
let lastGiftItems = [];  // 直近取得した候補一覧（再描画に使う。APIを呼び直さないため）
let editingGiftId = null; // 今インライン編集中の項目id（無ければnull）

// 数字（円）を "¥10,000" の形に整形する
function formatYen(v) {
    const n = Number(v);
    if (!v || Number.isNaN(n)) return "";
    return "¥" + n.toLocaleString("ja-JP"); // 3桁ごとにカンマを入れる
}

// Push Gift候補を、価格・リンク・編集・削除・「本命」ボタン付きで描画する
function renderGifts(items) {
    lastGiftItems = items || [];
    const el = $("#gift-list");
    if (!el) return;

    el.innerHTML = lastGiftItems.map(i => {
        // 編集中の項目だけ、入力フォームに切り替えて表示する
        if (String(i.id) === String(editingGiftId)) {
            return `
        <div class="card gift-card" data-id="${i.id}">
          <div class="gift-form">
            <input id="gedit-title-${i.id}" value="${esc(i.title)}" placeholder="商品名">
            <input id="gedit-price-${i.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${esc(i.detail || "")}" placeholder="価格（円）">
            <input id="gedit-url-${i.id}" value="${esc(i.url || "")}" placeholder="商品ページのURL">
            <div class="row">
              <button class="btn" data-save="${i.id}" style="width:auto; padding:0 14px; margin-top:0;">保存</button>
              <button class="gift-choose" data-cancel="${i.id}">キャンセル</button>
            </div>
          </div>
        </div>`;
        }

        // 通常表示
        return `
      <div class="card gift-card ${i.done ? "chosen" : ""}" data-id="${i.id}">
        <div class="row">
          <span class="t14">${esc(i.title)}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            ${i.done ? `<span class="pill g">本命</span>` : ""}
            <button class="del" data-del="${i.id}" title="削除">×</button>
          </div>
        </div>
        ${i.detail ? `<p class="gift-price">${formatYen(i.detail)}</p>` : ""}
        ${i.url ? `<a class="meta-link" href="${esc(i.url)}" target="_blank" rel="noopener">🔗 商品ページ</a>` : ""}
        <div class="row" style="margin-top:8px;">
          <button class="gift-choose" data-choose="${i.id}" data-chosen="${i.done}">${i.done ? "本命を解除" : "本命に選ぶ"}</button>
          <button class="gift-choose" data-edit="${i.id}">編集</button>
        </div>
      </div>`;
    }).join("") || `<div class="empty">まだ候補がありません</div>`;

    // 「本命に選ぶ／解除」
    $$("#gift-list [data-choose]").forEach(btn => {
        btn.addEventListener("click", () => {
            const nowChosen = btn.dataset.chosen === "true";
            toggleItem(btn.dataset.choose, !nowChosen);
        });
    });

    // 「編集」：インライン編集モードに切り替える（再取得はせず、今のデータで再描画）
    $$("#gift-list [data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
            editingGiftId = btn.dataset.edit;
            renderGifts(lastGiftItems);
        });
    });

    // 「保存」：入力内容をAPIに送って更新し、一覧を再読み込み
    $$("#gift-list [data-save]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.save;
            const title = $(`#gedit-title-${id}`).value.trim();
            const price = $(`#gedit-price-${id}`).value.replace(/[^0-9]/g, "");
            const url = $(`#gedit-url-${id}`).value.trim();
            await api("PATCH", "/checklist_items/" + id, { title, detail: price, url });
            editingGiftId = null;
            loadChecklist();
        });
    });

    // 「キャンセル」：APIは呼ばず、編集モードだけ解除
    $$("#gift-list [data-cancel]").forEach(btn => {
        btn.addEventListener("click", () => {
            editingGiftId = null;
            renderGifts(lastGiftItems);
        });
    });

    // ×ボタン：削除
    $$("#gift-list .del").forEach(btn => {
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            deleteItem(btn.dataset.del);
        });
    });
}

// 新しい候補を追加する
async function addGift() {
    const title = $("#gift-title").value.trim();
    if (!title) return;
    await api("POST", "/checklist_items", {
        category: "gift",
        title,
        detail: $("#gift-price").value.replace(/[^0-9]/g, ""),
        url: $("#gift-url").value.trim(),
    });
    $("#gift-title").value = "";
    $("#gift-price").value = "";
    $("#gift-url").value = "";
    loadChecklist();
}

// 完了トグル：APIに更新を送って、再読み込み
async function toggleItem(id, done) {
    await api("PATCH", "/checklist_items/" + id, { done });
    return loadChecklist();
}

// 項目を削除する。確認してからAPIにDELETEを送り、一覧を再読み込み
async function deleteItem(id) {
    if (!confirm("この項目を削除しますか？")) return;
    await api("DELETE", "/checklist_items/" + id);
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
    const colors = {
        todo: ["#f0f1ee", "var(--muted)"],
        doing: ["var(--danger-bg)", "var(--danger-dark)"],
        done: ["var(--accent-bg)", "var(--accent-dark)"],
    };
    const labels = { todo: "未", doing: "進行中", done: "完了" };

    $("#money-list").innerHTML = steps.map((s, i) => {
        const [bg, fg] = colors[s.status] || colors.todo;
        const mark = s.status === "done" ? "✓" : s.status === "doing" ? "●" : (i + 1);
        const line = i < steps.length - 1 ? `<div class="ln"></div>` : "";
        const buttons = ["todo", "doing", "done"].map(st =>
            `<button data-step="${s.id}" data-status="${st}" class="${s.status === st ? "on" : ""}">${labels[st]}</button>`
        ).join("");
        // 公式リンクがあれば「詳しく見る」を表示
        const link = s.url ? `<a class="meta-link" href="${esc(s.url)}" target="_blank" rel="noopener">🔗 詳しく見る（公式サイト）</a>` : "";

        return `<div class="tl">
      <div class="dot"><div class="c" style="background:${bg};color:${fg}">${mark}</div>${line}</div>
      <div class="ct">
        <p class="ph">${esc(s.timing_note || s.phase_label)}</p>
        <p class="ti">${esc(s.title)}</p>
        <p class="tx">${esc(s.description)}</p>
        <div class="btns">${buttons}</div>
        ${link}
      </div>
    </div>`;
    }).join("");

    $$("#money-list [data-step]").forEach(btn => {
        btn.addEventListener("click", async () => {
            await api("PATCH", "/benefit_steps/" + btn.dataset.step, { status: btn.dataset.status });
            loadBenefits();
        });
    });
}

// ---- 設定画面 ----
const ROLE_LABELS = { husband: "夫", wife: "妻", other: "その他" };

async function loadSettings() {
    const h = await api("GET", "/household");
    ME.household = h;

    // ログイン中のアカウント
    $("#me-card").innerHTML = `
    <p style="margin:0 0 4px; font-weight:600;">${esc(ME.user.name)}（${ROLE_LABELS[ME.user.role] || ME.user.role}）</p>
    <p class="meta" style="margin:0;">${esc(ME.user.email)}</p>
  `;

    // 家族情報フォームに現在値をセット
    $("#set-household-name").value = h.name || "";
    $("#set-due-on").value = h.due_on || "";
    $("#set-baby-name").value = h.baby_name || "";

    // 招待コード
    $("#set-invite-code").textContent = h.invite_code || "------";

    // 家族メンバー一覧
    $("#set-members").innerHTML = h.members.map(m => `
    <div class="card" style="margin-bottom:8px;">
      <p style="margin:0;">${esc(m.name)}（${esc(m.role_label)}）</p>
    </div>
  `).join("");
}

async function saveHousehold() {
    const body = {
        name: $("#set-household-name").value,
        due_on: $("#set-due-on").value || null,
        baby_name: $("#set-baby-name").value
    };
    const h = await api("PATCH", "/household", body);
    ME.household = h;
    $("#set-saved-msg").textContent = "保存しました";
    setTimeout(() => { $("#set-saved-msg").textContent = ""; }, 2000);
}

function copyInviteCode() {
    const code = $("#set-invite-code").textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = $("#set-copy-invite");
        const original = btn.textContent;
        btn.textContent = "コピーしました";
        setTimeout(() => { btn.textContent = original; }, 1500);
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
    // 「新しく家族を作る／相手として参加」の切り替え
    $$("[data-mode]").forEach(btn => btn.addEventListener("click", () => {
        signupMode = btn.dataset.mode;
        $$("[data-mode]").forEach(b => b.classList.toggle("on", b === btn));
        $("#new-household-fields").hidden = signupMode !== "new";
        $("#join-household-fields").hidden = signupMode !== "join";
    }));
    $$("[data-signout]").forEach(b => b.addEventListener("click", signOut));
    $("#tm-btn").addEventListener("click", recordContraction);
    $("#tm-reset").addEventListener("click", resetContractions);
    $("#prep-add").addEventListener("click", () => addChecklistItem("prep", "#prep-new", "#prep-add"));
    $("#day-add").addEventListener("click", () => addChecklistItem("day", "#day-new", "#day-add"));
    $("#doc-add").addEventListener("click", () => addChecklistItem("procedure", "#doc-new", "#doc-add"));
    $("#gift-add").addEventListener("click", addGift);
    $("#set-save").addEventListener("click", saveHousehold);
    $("#set-copy-invite").addEventListener("click", copyInviteCode);

    // すでに鍵があれば自動ログイン
    if (Token.get()) {
        try {
            const me = await api("GET", "/me");
            ME = { user: me.user, household: me.household };
            enterApp();
        } catch { Token.set(null); }
    }
});