// ===== 共通の小道具 =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
// HTMLエスケープは escapeHtml() に統一した（以前は esc という別関数もあったが、
// escapeHtml のほうがシングルクォートにも対応していて安全なためこちらだけ残した。
// escapeHtml はファイル下部で定義しているが、function宣言は巻き上げられるので
// このファイル内のどこから呼んでも問題ない）

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

async function guestLogin() {
    $("#auth-err").textContent = "";
    try {
        const data = await api("POST", "/guest_login");
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
    renderDueCountdown();
    loadSettings();
    loadChecklist();
    loadContractions();
    loadBenefits();
    loadLog();
    loadCustomLogLabels();
}
function signOut() { Token.set(null); location.reload(); }

// 出産予定日までのカウントダウンと、1週間以内の注意バナーを表示する
function renderDueCountdown() {
    const countdownEl = $("#due-countdown");
    const alertEl = $("#due-alert");
    const dueOn = ME?.household?.due_on;

    if (!dueOn) {
        if (countdownEl) countdownEl.textContent = "";
        if (alertEl) alertEl.hidden = true;
        return;
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueOn); due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (countdownEl) {
        countdownEl.textContent = diffDays > 0
            ? `📅 出産予定日まであと${diffDays}日`
            : diffDays === 0
                ? "📅 本日が出産予定日です"
                : `📅 出産予定日から${Math.abs(diffDays)}日経過`;
    }

    if (alertEl) {
        if (diffDays >= 0 && diffDays <= 7) {
            alertEl.hidden = false;
            alertEl.innerHTML = `<strong>⚠ 予定日まで1週間を切りました</strong><br>入院バッグや連絡先の最終確認を`;
        } else {
            alertEl.hidden = true;
        }
    }
}



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
        `<div class="chk ${i.done ? "done" : ""}" data-id="${i.id}" data-doneby="${escapeHtml(i.done_by || "")}">
       <span class="box">✓</span><span class="txt">${escapeHtml(i.title)}</span>
       ${i.done && i.done_by ? `<span class="by">${escapeHtml(i.done_by)}</span>` : ""}
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
        `<div class="card" data-id="${i.id}" data-doneby="${escapeHtml(i.done_by || "")}">
       <div class="row">
         <span class="t14 ${i.done ? "strike" : ""}">${escapeHtml(i.title)}</span>
         <div style="display:flex; align-items:center; gap:6px;">
           <span class="pill ${i.done ? "g" : "n"}">${i.done ? "完了" : "未"}</span>
           <button class="del" data-del="${i.id}" title="削除">×</button>
         </div>
       </div>
       ${i.place ? `<p class="meta">📍 ${escapeHtml(i.place)}</p>` : ""}
       ${i.detail ? `<p class="meta">${escapeHtml(i.detail)}</p>` : ""}
       <div class="row" style="margin-top:8px; align-items:center;">
         ${i.url ? `<a class="meta-link" href="${escapeHtml(i.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 詳しく見る（公式サイト）</a>` : "<span></span>"}
         ${i.done && i.done_by ? `<span class="meta" style="margin:0 0 0 auto;">✅ ${escapeHtml(i.done_by)}が完了</span>` : ""}
       </div>
     </div>`).join("") || `<div class="empty">項目がありません</div>`;

    $$(`${sel} .card`).forEach(el => el.addEventListener("click", (ev) => {
        if (ev.target.closest(".del")) return; // ×ボタンのクリックは完了トグルに流さない

        const willDone = !el.querySelector(".pill").classList.contains("g");
        const doneBy = el.dataset.doneby;

        const msg = willDone
            ? "この項目を完了にしますか？"
            : (doneBy
                ? `「${doneBy}」が完了にした項目です。未完了に戻しますか？`
                : "この項目を未完了に戻しますか？");

        if (!confirm(msg)) return;
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
            <input id="gedit-title-${i.id}" value="${escapeHtml(i.title)}" placeholder="商品名">
            <input id="gedit-price-${i.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(i.detail || "")}" placeholder="価格（円）">
            <input id="gedit-url-${i.id}" value="${escapeHtml(i.url || "")}" placeholder="商品ページのURL">
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
          <span class="t14">${escapeHtml(i.title)}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            ${i.done ? `<span class="pill g">本命</span>` : ""}
            <button class="del" data-del="${i.id}" title="削除">×</button>
          </div>
        </div>
        ${i.detail ? `<p class="gift-price">${formatYen(i.detail)}</p>` : ""}
        ${i.url ? `<a class="meta-link" href="${escapeHtml(i.url)}" target="_blank" rel="noopener">🔗 商品ページ</a>` : ""}
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



// ===== 育児記録 =====
const LOG_ICON = {
    milk: "🍼", breast: "🤱", solid: "🍚", meal: "🍽", drink: "🥤",
    pee: "💧", poop: "💩", both: "💧💩", sleep_start: "💤", wake: "⏰",
    custom: "📌", pump: "🫙", bottle: "🍼", snack: "🍪", temperature: "🌡️",
    medicine: "💊", runny_nose: "🤧", fever: "🤒", vomit: "🤮",
    breast_left: "🤱", breast_right: "🤱"
};
const LOG_LABEL = {
    milk: "ミルク", breast: "母乳", solid: "離乳食", meal: "ごはん", drink: "飲み物",
    pee: "おしっこ", poop: "うんち", both: "両方", sleep_start: "寝た", wake: "起きた",
    pump: "搾乳", bottle: "哺乳瓶", snack: "おやつ", temperature: "体温",
    medicine: "くすり", runny_nose: "鼻水", fever: "発熱", vomit: "吐く",
    breast_left: "授乳(左)", breast_right: "授乳(右)"
};
// ml/gを入力する記録の種類と、単位・プリセットの基準値
// ※bottle(哺乳瓶)・breastfeeding(授乳)・pump(搾乳器)は専用モーダルを別途作るため、ここには含めない
const AMOUNT_CONFIG = {
    milk: { unit: "ml", base: 80 },
    breast: { unit: "ml", base: 80 },
    drink: { unit: "ml", base: 80 },
    solid: { unit: "g", base: 50 }
};

// 文字列をHTMLとして安全に埋め込めるようにエスケープする
// （&, <, >, ", ' をすべて対応する実体参照に変換。アプリ全体でこの関数に統一した）
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

function shiftDate(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

function toTimeStr(isoString) {
    const d = isoString ? new Date(isoString) : new Date();
    return two(d.getHours()) + ":" + two(d.getMinutes());
}

function toDateStr(isoString) {
    const d = new Date(isoString);
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

let currentLogDate = todayStr();
let customLogLabels = ["", "", "", ""];
let lastLogEntries = [];
let logDetailContext = null; // { mode: "create"|"edit", kind, id, note }
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 300;                  // ml の上限
const MIN_PRESET_BASE = 10;              // プリセット一番左の最小値（0mlは出さない）
const MAX_PRESET_BASE = MAX_AMOUNT - 20; // プリセット一番右が300を超えないための上限(280)

let amountPresetBase = 70;
let currentAmountUnit = "ml";   // プリセットボタンに表示する単位(ml/g)
let currentAmountDefaultBase = 80; // 未入力時にパネルの中心にする基準値

// プリセットボタン（左/中央/右の3つ）を今のamountPresetBaseに従って描画する
function renderAmountPresets() {
    const current = Number($("#log-detail-amount").value) || null;
    const presets = [amountPresetBase, amountPresetBase + 10, amountPresetBase + 20];
    $("#log-detail-amount-presets").innerHTML = presets.map(v =>
        `<button type="button" class="preset-btn ${v === current ? "on" : ""}" data-preset="${v}">${v}${currentAmountUnit}</button>`
    ).join("");
    $$("#log-detail-amount-presets [data-preset]").forEach(btn => {
        btn.addEventListener("click", () => {
            $("#log-detail-amount").value = btn.dataset.preset;
            centerAmountPresets(btn.dataset.preset); // タップした値を中心にパネルを追従させる
        });
    });

    // 端まで来たら ‹ / › ボタンを押せなくする
    $("#log-detail-amount-prev").disabled = amountPresetBase <= MIN_PRESET_BASE;
    $("#log-detail-amount-next").disabled = amountPresetBase >= MAX_PRESET_BASE;
}

// 今の量（rawValue）を中心に、プリセットの範囲(amountPresetBase)を計算し直して描画する
// 空欄のときは80mlを基準にする（未入力時のデフォルト表示）
function centerAmountPresets(rawValue) {
    const hasValue = rawValue !== "" && rawValue != null && !Number.isNaN(Number(rawValue));
    const base = hasValue ? Number(rawValue) : currentAmountDefaultBase;
    const rounded = Math.round(base / 10) * 10;
    amountPresetBase = Math.min(MAX_PRESET_BASE, Math.max(MIN_PRESET_BASE, rounded - 10));
    renderAmountPresets();
}

// ml（量）を増減させる共通処理（±10ボタン用）
function adjustAmount(delta) {
    const input = $("#log-detail-amount");
    // 空欄のときはパネルと同じ基準(80)を出発点にする
    const current = input.value === "" ? 80 : (parseInt(input.value, 10) || 0);
    const next = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, current + delta));
    input.value = next;
    centerAmountPresets(next);
}

async function loadLog(dateStr) {
    currentLogDate = dateStr || currentLogDate;
    const data = await api("GET", "/log_entries?date=" + currentLogDate);
    if ($("#log-date")) $("#log-date").value = currentLogDate;
    if ($("#log-heading")) {
        $("#log-heading").textContent = (currentLogDate === todayStr()) ? "今日のログ" : currentLogDate.replace(/-/g, "/") + " のログ";
    }
    renderLog(data.entries, data.summary);
}

function renderLog(entries, summary) {
    lastLogEntries = entries || [];
    $("#sum-milk").textContent = (summary.milk || 0) + "回";
    $("#sum-meal").textContent = (summary.meal || 0) + "回";
    $("#sum-toilet").textContent = (summary.toilet || 0) + "回";
    $("#sum-sleep").textContent = (summary.sleep || 0) + "回";

    $("#log-list").innerHTML = lastLogEntries.map(e => {
        const d = new Date(e.occurred_at);
        const tm = two(d.getHours()) + ":" + two(d.getMinutes());
        const ROLE_CHAR = { husband: "夫", wife: "妻" };
        const roleClass = e.recorded_by_role === "wife" ? "w" : e.recorded_by_role === "husband" ? "h" : "o";
        const roleChar = ROLE_CHAR[e.recorded_by_role] || "他";
        const who = e.recorded_by
            ? `<span class="who ${roleClass}">${roleChar}</span>`
            : "";
        const label = e.kind === "custom" ? (e.note || "カスタム") : (LOG_LABEL[e.kind] || e.kind);
        let detail;
        if (e.kind === "bottle") {
            const parts = [];
            if (e.breast_ml) parts.push(`母乳${e.breast_ml}ml`);
            if (e.formula_ml) parts.push(`ミルク${e.formula_ml}ml`);
            detail = parts.join("/") || e.memo || "";
        } else if (e.kind === "breast_left" || e.kind === "breast_right") {
            detail = formatSec(e.duration_sec || 0) + (e.memo ? ` ${e.memo}` : "");
        } else if (e.kind === "pump") {
            const parts = [];
            if (e.duration_sec) parts.push(`${Math.round(e.duration_sec / 60)}分`);
            if (e.amount) parts.push(`${e.amount}ml`);
            detail = parts.join("/") || e.memo || "";
        } else {
            detail = e.amount ? `${e.amount}ml` : (e.memo || "");
        }
        const detailHtml = detail ? ` <span style="color:var(--hint); font-size:11px;">(${escapeHtml(detail)})</span>` : "";
        return `<div class="rec" data-id="${e.id}">
            <span class="tm">${tm}</span>
            <span class="ic">${LOG_ICON[e.kind] || "📌"}</span>
            <span class="txt" style="flex:1;">${escapeHtml(label)}${detailHtml}</span>
            ${who}
            <button class="del" data-del-log="${e.id}" title="削除">×</button>
        </div>`;
    }).join("") || `<div class="empty">記録がありません</div>`;

    $$("#log-list [data-del-log]").forEach(btn => {
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            deleteLogEntry(btn.dataset.delLog);
        });
    });

    $$("#log-list .rec").forEach(el => {
        el.addEventListener("click", () => {
            const entry = lastLogEntries.find(e => String(e.id) === el.dataset.id);
            if (!entry) return;
            if (entry.kind === "bottle") {
                openBottleDetail(entry);
            } else if (entry.kind === "breast_left" || entry.kind === "breast_right") {
                openBreastfeedingDetail(entry);
            } else if (entry.kind === "pump") {
                openPumpDetail(entry);
            } else {
                openLogDetail(entry.kind, entry.note, entry);
            }
        });
    });
}

async function deleteLogEntry(id) {
    if (!confirm("この記録を削除しますか？")) return;
    await api("DELETE", "/log_entries/" + id);
    loadLog();
}

// mm:ss形式に整形する
function formatSec(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return two(m) + ":" + two(s);
}

let breastfeedContext = null; // { mode, editKind, editId, date }
let breastTimers = {
    left: { running: false, startedAt: null, accumulatedSec: 0 },
    right: { running: false, startedAt: null, accumulatedSec: 0 }
};
let breastTimerTickInterval = null;

// 今の経過秒数（動いていればリアルタイム分も加算して返す）
function currentBreastSeconds(side) {
    const t = breastTimers[side];
    return t.accumulatedSec + (t.running ? Math.floor((Date.now() - t.startedAt) / 1000) : 0);
}

// 左右のボタン表示と合計時間を今の状態に合わせて更新する
function renderBreastTimers() {
    const leftSec = currentBreastSeconds("left");
    const rightSec = currentBreastSeconds("right");
    $("#breastfeeding-left-btn").textContent = (breastTimers.left.running ? "■ " : "▶ ") + "左 " + formatSec(leftSec);
    $("#breastfeeding-right-btn").textContent = (breastTimers.right.running ? "■ " : "▶ ") + "右 " + formatSec(rightSec);
    $("#breastfeeding-left-btn").classList.toggle("on", breastTimers.left.running);
    $("#breastfeeding-right-btn").classList.toggle("on", breastTimers.right.running);
    $("#breastfeeding-total").textContent = formatSec(leftSec + rightSec);
}

// 左右どちらかのタイマーを開始/停止する
function toggleBreastTimer(side) {
    const t = breastTimers[side];
    if (t.running) {
        t.accumulatedSec += Math.floor((Date.now() - t.startedAt) / 1000);
        t.running = false;
        t.startedAt = null;
    } else {
        t.running = true;
        t.startedAt = Date.now();
    }
    renderBreastTimers();
}

function startBreastTimerTick() {
    stopBreastTimerTick();
    breastTimerTickInterval = setInterval(renderBreastTimers, 1000);
}
function stopBreastTimerTick() {
    if (breastTimerTickInterval) clearInterval(breastTimerTickInterval);
    breastTimerTickInterval = null;
}

// existingがあれば編集（片側のみ）、なければ新規（左右両方使える）
function openBreastfeedingDetail(existing) {
    const dateForEntry = existing ? toDateStr(existing.occurred_at) : todayStr();
    breastfeedContext = {
        mode: existing ? "edit" : "create",
        editKind: existing?.kind,
        editId: existing?.id,
        date: dateForEntry
    };
    breastTimers = {
        left: { running: false, startedAt: null, accumulatedSec: existing?.kind === "breast_left" ? (existing.duration_sec || 0) : 0 },
        right: { running: false, startedAt: null, accumulatedSec: existing?.kind === "breast_right" ? (existing.duration_sec || 0) : 0 }
    };
    $("#breastfeeding-title").textContent = existing ? "授乳を編集" : "授乳を記録";
    $("#breastfeeding-time").value = existing ? toTimeStr(existing.occurred_at) : toTimeStr();
    $("#breastfeeding-memo").value = existing?.memo ?? "";
    renderBreastTimers();
    $("#breastfeeding-modal").hidden = false;
    startBreastTimerTick();
}

function closeBreastfeedingDetail() {
    stopBreastTimerTick();
    $("#breastfeeding-modal").hidden = true;
    breastfeedContext = null;
}

async function saveBreastfeedingDetail() {
    if (!breastfeedContext) return;
    // 動いているタイマーがあれば、保存前に一旦止めて時間を確定させる
    ["left", "right"].forEach(side => {
        if (breastTimers[side].running) toggleBreastTimer(side);
    });

    const { mode, editKind, editId, date } = breastfeedContext;
    const time = $("#breastfeeding-time").value || toTimeStr();
    const memo = $("#breastfeeding-memo").value || "";
    const occurredAt = date + "T" + time;

    if (mode === "edit") {
        const side = editKind === "breast_left" ? "left" : "right";
        await api("PATCH", "/log_entries/" + editId, {
            occurred_at: occurredAt,
            duration_sec: breastTimers[side].accumulatedSec,
            memo
        });
    } else {
        if (breastTimers.left.accumulatedSec <= 0 && breastTimers.right.accumulatedSec <= 0) {
            alert("左右どちらかのタイマーを計測してください");
            return;
        }
        if (breastTimers.left.accumulatedSec > 0) {
            await api("POST", "/log_entries", { kind: "breast_left", occurred_at: occurredAt, duration_sec: breastTimers.left.accumulatedSec, memo });
        }
        if (breastTimers.right.accumulatedSec > 0) {
            await api("POST", "/log_entries", { kind: "breast_right", occurred_at: occurredAt, duration_sec: breastTimers.right.accumulatedSec, memo });
        }
    }
    closeBreastfeedingDetail();
    if (mode === "create" && date !== currentLogDate) {
        loadLog(date);
    } else {
        loadLog();
    }
}

let pumpContext = null; // { mode: "create"|"edit", id, date }

function openPumpDetail(existing) {
    const dateForEntry = existing ? toDateStr(existing.occurred_at) : todayStr();
    pumpContext = { mode: existing ? "edit" : "create", id: existing?.id, date: dateForEntry };
    $("#pump-title").textContent = existing ? "搾乳器を編集" : "搾乳器を記録";
    $("#pump-time").value = existing ? toTimeStr(existing.occurred_at) : toTimeStr();
    $("#pump-duration").value = existing?.duration_sec ? Math.round(existing.duration_sec / 60) : "";
    $("#pump-amount").value = existing?.amount ?? "";
    $("#pump-memo").value = existing?.memo ?? "";
    $("#pump-modal").hidden = false;
}

function closePumpDetail() {
    $("#pump-modal").hidden = true;
    pumpContext = null;
}

// 時間(分)欄・量(ml)欄、両方に使う共通の±ボタン処理
function adjustPumpValue(inputSelector, delta, max) {
    const input = $(inputSelector);
    const current = parseInt(input.value, 10) || 0;
    input.value = Math.min(max, Math.max(0, current + delta));
}

async function savePumpDetail() {
    if (!pumpContext) return;
    const { mode, id, date } = pumpContext;
    const time = $("#pump-time").value || toTimeStr();
    const minutes = parseInt($("#pump-duration").value, 10) || 0;
    const body = {
        occurred_at: date + "T" + time,
        duration_sec: minutes > 0 ? minutes * 60 : "",
        amount: $("#pump-amount").value || "",
        memo: $("#pump-memo").value || ""
    };
    if (mode === "create") {
        body.kind = "pump";
        await api("POST", "/log_entries", body);
    } else {
        await api("PATCH", "/log_entries/" + id, body);
    }
    closePumpDetail();
    if (mode === "create" && date !== currentLogDate) {
        loadLog(date);
    } else {
        loadLog();
    }
}

let bottleContext = null; // { mode: "create"|"edit", id, date }

// 哺乳瓶モーダルを開く（existingがあれば編集、なければ新規）
function openBottleDetail(existing) {
    const dateForEntry = existing ? toDateStr(existing.occurred_at) : todayStr();
    bottleContext = { mode: existing ? "edit" : "create", id: existing?.id, date: dateForEntry };
    $("#bottle-title").textContent = existing ? "哺乳瓶を編集" : "哺乳瓶を記録";
    $("#bottle-time").value = existing ? toTimeStr(existing.occurred_at) : toTimeStr();
    $("#bottle-breast-ml").value = existing?.breast_ml ?? "";
    $("#bottle-formula-ml").value = existing?.formula_ml ?? "";
    $("#bottle-memo").value = existing?.memo ?? "";
    $("#bottle-modal").hidden = false;
}

function closeBottleDetail() {
    $("#bottle-modal").hidden = true;
    bottleContext = null;
}

// 母乳/ミルクどちらのml欄にも使う共通の±10ボタン処理
function adjustBottleAmount(inputSelector, delta) {
    const input = $(inputSelector);
    const current = parseInt(input.value, 10) || 0;
    input.value = Math.min(1000, Math.max(0, current + delta));
}

async function saveBottleDetail() {
    if (!bottleContext) return;
    const { mode, id, date } = bottleContext;
    const time = $("#bottle-time").value || toTimeStr();
    const body = {
        occurred_at: date + "T" + time,
        breast_ml: $("#bottle-breast-ml").value || "",
        formula_ml: $("#bottle-formula-ml").value || "",
        memo: $("#bottle-memo").value || ""
    };
    if (mode === "create") {
        body.kind = "bottle";
        await api("POST", "/log_entries", body);
    } else {
        await api("PATCH", "/log_entries/" + id, body);
    }
    closeBottleDetail();
    if (mode === "create" && date !== currentLogDate) {
        loadLog(date);
    } else {
        loadLog();
    }
}

function openLogDetail(kind, note, existing) {
    const dateForEntry = existing ? toDateStr(existing.occurred_at) : todayStr();
    logDetailContext = { mode: existing ? "edit" : "create", kind, id: existing?.id, note, date: dateForEntry };
    const amountConfig = AMOUNT_CONFIG[kind];
    const isAmount = !!amountConfig;
    const isTemperature = kind === "temperature";
    const label = kind === "custom" ? (note || "カスタム") : (LOG_LABEL[kind] || kind);
    $("#log-detail-title").textContent = label + (existing ? "を編集" : "を記録");
    $("#log-detail-time").value = existing ? toTimeStr(existing.occurred_at) : toTimeStr();

    $("#log-detail-amount-wrap").hidden = !isAmount;
    $("#log-detail-temp-wrap").hidden = !isTemperature;
    // メモは体温以外なら常に表示する（量とメモを同時に入力できるようにするため）
    $("#log-detail-memo-wrap").hidden = isTemperature;

    $("#log-detail-amount").value = existing?.amount ?? "";
    if (isAmount) {
        currentAmountUnit = amountConfig.unit;
        currentAmountDefaultBase = amountConfig.base;
        centerAmountPresets($("#log-detail-amount").value);
    }

    $("#log-detail-temperature").value = existing?.temperature ?? "";
    $("#log-detail-memo").value = existing?.memo ?? "";
    $("#log-detail-modal").hidden = false;
}

function closeLogDetail() {
    $("#log-detail-modal").hidden = true;
    logDetailContext = null;
}

async function saveLogDetail() {
    if (!logDetailContext) return;
    const { mode, kind, id, note, date } = logDetailContext;
    const amountConfig = AMOUNT_CONFIG[kind];
    const isTemperature = kind === "temperature";
    const time = $("#log-detail-time").value || toTimeStr();
    const body = {
        occurred_at: date + "T" + time,
        amount: amountConfig ? ($("#log-detail-amount").value || "") : "",
        temperature: isTemperature ? ($("#log-detail-temperature").value || "") : "",
        memo: isTemperature ? "" : ($("#log-detail-memo").value || "")
    };
    if (mode === "create") {
        body.kind = kind;
        if (note) body.note = note;
        await api("POST", "/log_entries", body);
    } else {
        await api("PATCH", "/log_entries/" + id, body);
    }
    closeLogDetail();
    // 新規記録は必ず「今日」で保存されるため、今見ている日付が今日でなければ
    // 今日のログ画面に自動で切り替えて、記録した内容が見えるようにする
    if (mode === "create" && date !== currentLogDate) {
        loadLog(date);
    } else {
        loadLog();
    }
}

async function loadCustomLogLabels() {
    const data = await api("GET", "/household/custom_log_labels");
    customLogLabels = data.custom_log_labels || ["", "", "", ""];
    renderCustomTiles();
}

function renderCustomTiles() {
    const tiles = customLogLabels.map((label, i) => {
        if (label) {
            return `<div class="c" data-custom-index="${i}"><div class="ic">📌</div><p class="k">${escapeHtml(label)}</p></div>`;
        }
        return `<div class="c empty" data-custom-index="${i}"><div class="ic">－</div><p class="k">未設定</p></div>`;
    }).join("");
    const editTile = `<div class="c" id="custom-edit-open"><div class="ic">✎</div><p class="k">編集</p></div>`;
    $("#log-custom-tiles").innerHTML = tiles + editTile;

    $$("#log-custom-tiles [data-custom-index]").forEach(el => {
        el.addEventListener("click", () => {
            const i = Number(el.dataset.customIndex);
            const label = customLogLabels[i];
            if (label) {
                openLogDetail("custom", label);
            } else {
                openCustomEditModal();
            }
        });
    });
    $("#custom-edit-open").addEventListener("click", openCustomEditModal);
}

function renderCustomEditModal() {
    $("#custom-edit-list").innerHTML = customLogLabels.map((label, i) => {
        return label
            ? `<div class="modal-row"><span class="lbl editable" data-edit-idx="${i}">📌 ${escapeHtml(label)}</span><span class="modal-action remove" data-del-idx="${i}">削除</span></div>`
            : `<div class="modal-row"><span class="lbl empty">未設定</span><span class="modal-action add" data-add-idx="${i}">追加</span></div>`;
    }).join("");

    $$("#custom-edit-list [data-edit-idx]").forEach(el => {
        el.addEventListener("click", async () => {
            const i = Number(el.dataset.editIdx);
            const label = prompt("項目名を編集してください", customLogLabels[i]);
            if (label === null || !label.trim()) return;
            await saveCustomLabel(i, label.trim());
        });
    });

    $$("#custom-edit-list [data-add-idx]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const label = prompt("項目名を入力してください（例: 体温測定）");
            if (!label || !label.trim()) return;
            await saveCustomLabel(Number(btn.dataset.addIdx), label.trim());
        });
    });
    $$("#custom-edit-list [data-del-idx]").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("この項目を削除しますか？")) return;
            await saveCustomLabel(Number(btn.dataset.delIdx), "");
        });
    });
}

async function saveCustomLabel(index, label) {
    const data = await api("PATCH", "/household/custom_log_labels", { index, label });
    customLogLabels = data.custom_log_labels;
    renderCustomTiles();
    renderCustomEditModal();
}

function openCustomEditModal() {
    renderCustomEditModal();
    $("#custom-edit-modal").hidden = false;
}

function closeCustomEditModal() {
    $("#custom-edit-modal").hidden = true;
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
        const link = s.url ? `<a class="meta-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">🔗 詳しく見る（公式サイト）</a>` : "";

        return `<div class="tl">
      <div class="dot"><div class="c" style="background:${bg};color:${fg}">${mark}</div>${line}</div>
      <div class="ct">
        <p class="ph">${escapeHtml(s.timing_note || s.phase_label)}</p>
        <p class="ti">${escapeHtml(s.title)}</p>
        <p class="tx">${escapeHtml(s.description)}</p>
        <div class="btns">${buttons}</div>
        <div class="row" style="margin-top:6px; align-items:center;">
          ${link || "<span></span>"}
          ${s.updated_by ? `<span class="meta" style="margin:0 0 0 auto;">✅ ${escapeHtml(s.updated_by)}が最終更新</span>` : ""}
        </div>
      </div>
    </div>`;
    }).join("");

    $$("#money-list [data-step]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const label = labels[btn.dataset.status];
            if (!confirm(`ステータスを「${label}」に変更しますか？`)) return;
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
    <p style="margin:0 0 4px; font-weight:600;">${escapeHtml(ME.user.name)}（${ROLE_LABELS[ME.user.role] || ME.user.role}）</p>
    <p class="meta" style="margin:0;">${escapeHtml(ME.user.email)}</p>
  `;

    // 家族情報フォームに現在値をセット
    $("#set-household-name").value = h.name || "";
    $("#set-due-on").value = h.due_on || "";
    $("#set-baby-name").value = h.baby_name || "";

    // 招待コード（再発行ボタンはオーナーだけに表示）
    $("#set-invite-code").textContent = h.invite_code || "------";
    $("#set-regenerate-invite").hidden = !ME.user.owner;

    // 家族メンバー一覧（オーナーだけ、自分以外に削除ボタンを表示）
    $("#set-members").innerHTML = h.members.map(m => `
    <div class="card" style="margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
      <p style="margin:0;">${escapeHtml(m.name)}（${escapeHtml(m.role_label)}）${m.owner ? "👑" : ""}</p>
      ${ME.user.owner && m.id !== ME.user.id ? `<button class="del" data-remove-member="${m.id}" title="削除">×</button>` : ""}
    </div>
  `).join("");

    $$("#set-members [data-remove-member]").forEach(btn => {
        btn.addEventListener("click", () => removeMember(btn.dataset.removeMember));
    });

    renderDueCountdown();
}

// メンバーを削除する（オーナーのみ、確認ダイアログあり）
async function removeMember(id) {
    if (!confirm("このメンバーを家族グループから削除しますか？取り消せません。")) return;
    try {
        await api("DELETE", "/household/members/" + id);
        loadSettings();
    } catch (e) {
        alert(e.message);
    }
}

// 招待コードを再発行する（オーナーのみ、確認ダイアログあり）
async function regenerateInviteCode() {
    if (!confirm("招待コードを再発行しますか？古いコードは使えなくなります。")) return;
    try {
        await api("POST", "/household/regenerate_invite_code");
        loadSettings();
    } catch (e) {
        alert(e.message);
    }
}



async function saveHousehold() {
    const body = {
        name: $("#set-household-name").value,
        due_on: $("#set-due-on").value || null,
        baby_name: $("#set-baby-name").value
    };
    const h = await api("PATCH", "/household", body);
    ME.household = h;
    renderDueCountdown();
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

let scrollBeforeAnyFocus = null;

document.addEventListener("focusin", (e) => {
    if (e.target.matches("input, textarea")) {
        const screen = e.target.closest(".screen");
        if (screen && scrollBeforeAnyFocus === null) {
            scrollBeforeAnyFocus = screen.scrollTop;
        }
    }
});

document.addEventListener("focusout", (e) => {
    if (e.target.matches("input, textarea")) {
        const screen = e.target.closest(".screen");
        setTimeout(() => {
            const active = document.activeElement;
            const stillInInput = active && active.matches("input, textarea");
            if (!stillInInput && scrollBeforeAnyFocus !== null && screen) {
                screen.scrollTop = scrollBeforeAnyFocus;
                scrollBeforeAnyFocus = null;
            }
        }, 50);
    }
});

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
    $("#guest-login").addEventListener("click", guestLogin);
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
    // breastfeeding(授乳)・bottle(哺乳瓶)・pump(搾乳器)は専用モーダルを別のフェーズで実装するため、
    // ここでは通常の記録モーダル(openLogDetail)を使う項目だけにクリックを登録する
    const SPECIAL_TILE_KINDS = ["breastfeeding", "bottle", "pump"];
    $$("#log-tiles .c[data-kind]").forEach(el => {
        const kind = el.dataset.kind;
        if (SPECIAL_TILE_KINDS.includes(kind)) return;
        el.addEventListener("click", () => openLogDetail(kind));
    });
    $("#log-detail-save").addEventListener("click", saveLogDetail)
    $("#log-detail-cancel").addEventListener("click", closeLogDetail);
    $("#bottle-save").addEventListener("click", saveBottleDetail);
    $("#bottle-cancel").addEventListener("click", closeBottleDetail);
    $("#bottle-breast-minus").addEventListener("click", () => adjustBottleAmount("#bottle-breast-ml", -10));
    $("#bottle-breast-plus").addEventListener("click", () => adjustBottleAmount("#bottle-breast-ml", 10));
    $("#bottle-formula-minus").addEventListener("click", () => adjustBottleAmount("#bottle-formula-ml", -10));
    $("#bottle-formula-plus").addEventListener("click", () => adjustBottleAmount("#bottle-formula-ml", 10));
    $$("#log-tiles .c[data-kind='bottle']").forEach(el => el.addEventListener("click", () => openBottleDetail()));
    $$("#log-tiles .c[data-kind='breastfeeding']").forEach(el => el.addEventListener("click", () => openBreastfeedingDetail()));
    $("#breastfeeding-left-btn").addEventListener("click", () => toggleBreastTimer("left"));
    $("#breastfeeding-right-btn").addEventListener("click", () => toggleBreastTimer("right"));
    $("#breastfeeding-save").addEventListener("click", saveBreastfeedingDetail);
    $("#breastfeeding-cancel").addEventListener("click", closeBreastfeedingDetail);
    $$("#log-tiles .c[data-kind='pump']").forEach(el => el.addEventListener("click", () => openPumpDetail()));
    $("#pump-save").addEventListener("click", savePumpDetail);
    $("#pump-cancel").addEventListener("click", closePumpDetail);
    $("#pump-duration-minus").addEventListener("click", () => adjustPumpValue("#pump-duration", -1, 180));
    $("#pump-duration-plus").addEventListener("click", () => adjustPumpValue("#pump-duration", 1, 180));
    $("#pump-amount-minus").addEventListener("click", () => adjustPumpValue("#pump-amount", -10, 1000));
    $("#pump-amount-plus").addEventListener("click", () => adjustPumpValue("#pump-amount", 10, 1000));
    // ±10ボタン（前回は±5だったが10刻みに変更）
    $("#log-detail-amount-minus").addEventListener("click", () => adjustAmount(-10));
    $("#log-detail-amount-plus").addEventListener("click", () => adjustAmount(10));

    // 値を変えずにプリセットの範囲だけ手動でずらす（10〜280の間でクランプ）
    $("#log-detail-amount-prev").addEventListener("click", () => {
        amountPresetBase = Math.max(MIN_PRESET_BASE, amountPresetBase - 10);
        renderAmountPresets();
    });
    $("#log-detail-amount-next").addEventListener("click", () => {
        amountPresetBase = Math.min(MAX_PRESET_BASE, amountPresetBase + 10);
        renderAmountPresets();
    });

    // 直接入力したときも、300を超えないようクランプしつつパネルを追従させる
    $("#log-detail-amount").addEventListener("input", () => {
        const el = $("#log-detail-amount");
        const num = parseInt(el.value, 10);
        if (!Number.isNaN(num) && num > MAX_AMOUNT) el.value = MAX_AMOUNT;
        centerAmountPresets(el.value);
    });
    $("#custom-edit-close").addEventListener("click", closeCustomEditModal);
    $("#log-date").addEventListener("change", () => loadLog($("#log-date").value));
    $("#log-today-btn").addEventListener("click", () => loadLog(todayStr()));
    $("#log-prev").addEventListener("click", () => loadLog(shiftDate(currentLogDate, -1)));
    $("#log-next").addEventListener("click", () => loadLog(shiftDate(currentLogDate, 1)));
    $("#set-save").addEventListener("click", saveHousehold);
    $("#set-copy-invite").addEventListener("click", copyInviteCode);
    $("#set-regenerate-invite").addEventListener("click", regenerateInviteCode);

    // すでに鍵があれば自動ログイン
    if (Token.get()) {
        try {
            const me = await api("GET", "/me");
            ME = { user: me.user, household: me.household };
            enterApp();
        } catch { Token.set(null); }
    }
});