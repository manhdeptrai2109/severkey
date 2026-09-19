// Chú thích: app.js - web admin TManhios + tự động đồng bộ 10s

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STORAGE_KEY = "tmanhios_keys";

const API_ADD    = "https://tmanhios.pretty-pilot.workers.dev/add";
const API_DELETE = "https://tmanhios.pretty-pilot.workers.dev/delete";
const API_LIST   = "https://tmanhios.pretty-pilot.workers.dev/list";

const SYNC_INTERVAL = 10000; // Chú thích: 10 giây

let currentIP = "unknown";

const DURATION_MAP = {
    3600000:    { prefix: "TManhios-1hour-",   label: "1 GIỜ" },
    86400000:   { prefix: "TManhios-1day-",    label: "1 NGÀY" },
    604800000:  { prefix: "TManhios-7day-",    label: "7 NGÀY" },
    2592000000: { prefix: "TManhios-1month-",  label: "1 THÁNG" },
    0:          { prefix: "TManhios-forever-", label: "VĨNH VIỄN" }
};

// ============================================================
// Chú thích: SUY DURATION TỪ PREFIX KEY
// ============================================================
function durationFromKey(key) {
    if (key.startsWith("TManhios-1hour-"))   return 3600000;
    if (key.startsWith("TManhios-1day-"))    return 86400000;
    if (key.startsWith("TManhios-7day-"))    return 604800000;
    if (key.startsWith("TManhios-1month-"))  return 2592000000;
    if (key.startsWith("TManhios-forever-")) return 0;
    return 86400000;
}

// ============================================================
// Chú thích: GỬI KEY LÊN WORKER
// ============================================================
async function uploadKeyToServer(key) {
    try {
        const form = new FormData();
        form.append("key", key);
        const r = await fetch(API_ADD, { method: "POST", body: form });
        const j = await r.json();
        console.log("[UPLOAD]", key, "->", j.status);
        return j.status === "ok";
    } catch (e) {
        console.error("[UPLOAD FAIL]", key, e);
        return false;
    }
}

// ============================================================
// Chú thích: XÓA KEY KHỎI WORKER
// ============================================================
async function deleteKeyFromServer(key) {
    try {
        const form = new FormData();
        form.append("key", key);
        const r = await fetch(API_DELETE, { method: "POST", body: form });
        const j = await r.json();
        console.log("[DELETE]", key, "->", j.status);
        return j.status === "ok";
    } catch (e) {
        console.error("[DELETE FAIL]", key, e);
        return false;
    }
}

// ============================================================
// Chú thích: LẤY DANH SÁCH KEY TỪ WORKER
// ============================================================
async function fetchServerKeys() {
    try {
        const r = await fetch(API_LIST, { method: "POST" });
        const j = await r.json();
        if (j.status !== "ok") return null;
        return j.keys || [];
    } catch (e) {
        console.error("[SYNC FAIL]", e);
        return null;
    }
}

// ============================================================
// Chú thích: LẤY IPV4
// ============================================================
async function fetchIP() {
    try {
        const r = await fetch("https://api.ipify.org?format=json");
        const j = await r.json();
        currentIP = j.ip || "unknown";
    } catch (e) {
        currentIP = "unknown";
    }
    const el = document.getElementById("ip-display");
    if (el) el.textContent = "IP: " + currentIP;
}

// ============================================================
// Chú thích: SINH KEY
// ============================================================
function randomSuffix(len) {
    let out = "";
    for (let i = 0; i < len; i++) {
        const idx = crypto.getRandomValues(new Uint32Array(1))[0] % CHARS.length;
        out += CHARS[idx];
    }
    return out;
}

function genKey(prefix, len) {
    return prefix + randomSuffix(len);
}

function genKeys(prefix, amount, len) {
    const set = new Set();
    let attempts = 0;
    const maxAttempts = amount * 10;
    while (set.size < amount && attempts < maxAttempts) {
        set.add(genKey(prefix, len));
        attempts++;
    }
    return Array.from(set);
}

// ============================================================
// Chú thích: KHO KEY LOCALSTORAGE
// ============================================================
function loadStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
        return [];
    }
}

function saveStore(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function getDurationInfo(dur) {
    return DURATION_MAP[dur] || { prefix: "TManhios-1day-", label: "1 NGÀY" };
}

// ============================================================
// Chú thích: DOM ELEMENT
// ============================================================
const $tabGen    = document.getElementById("tab-gen");
const $tabAdmin  = document.getElementById("tab-admin");
const $viewGen   = document.getElementById("view-gen");
const $viewAdmin = document.getElementById("view-admin");

const $amount    = document.getElementById("amount");
const $suffixLen = document.getElementById("suffix-len");
const $duration  = document.getElementById("duration");
const $btnGen    = document.getElementById("btn-gen");
const $btnCopy   = document.getElementById("btn-copy");
const $btnClear  = document.getElementById("btn-clear");
const $result    = document.getElementById("result");
const $count     = document.getElementById("count");

const $btnReload   = document.getElementById("btn-reload");
const $btnClearAll = document.getElementById("btn-clear-all");
const $search      = document.getElementById("search");
const $keyBody     = document.getElementById("key-body");
const $total       = document.getElementById("total");

let totalCount = 0;
let syncRunning = false;

// ============================================================
// Chú thích: CHUYỂN TAB
// ============================================================
$tabGen.addEventListener("click", () => {
    $tabGen.classList.add("active");
    $tabAdmin.classList.remove("active");
    $viewGen.style.display = "";
    $viewAdmin.style.display = "none";
});

$tabAdmin.addEventListener("click", async () => {
    $tabAdmin.classList.add("active");
    $tabGen.classList.remove("active");
    $viewGen.style.display = "none";
    $viewAdmin.style.display = "";
    await syncWithServer(true);
    renderTable($search.value);
});

// ============================================================
// Chú thích: NÚT TẠO KEY
// ============================================================
$btnGen.addEventListener("click", async () => {
    let amount = parseInt($amount.value) || 1;
    let len    = parseInt($suffixLen.value) || 10;
    let dur    = parseInt($duration.value);
    if (amount < 1) amount = 1;
    if (amount > 1000) amount = 1000;
    if (len < 4) len = 4;
    if (len > 64) len = 64;
    if (isNaN(dur)) dur = 86400000;

    const info = getDurationInfo(dur);
    const keys = genKeys(info.prefix, amount, len);

    const oldText = $result.value;
    if (oldText.trim() === "") {
        $result.value = keys.join("\n");
    } else {
        $result.value = oldText.replace(/\s+$/, "") + "\n" + keys.join("\n");
    }

    totalCount += keys.length;
    $count.textContent = totalCount;

    const store = loadStore();
    const now = Date.now();
    let added = 0;
    let uploaded = 0;

    for (const k of keys) {
        if (!store.some(x => x.key === k)) {
            store.push({
                key: k,
                ip: currentIP,
                duration: dur,
                activatedAt: null,
                hwid: null,
                createdAt: now
            });
            added++;
        }
        const ok = await uploadKeyToServer(k);
        if (ok) uploaded++;
    }

    saveStore(store);
    renderTable($search.value);

    const old = $btnGen.textContent;
    $btnGen.textContent = `TẠO ${added} | UPLOAD ${uploaded}`;
    setTimeout(() => { $btnGen.textContent = old; }, 1500);
});

// ============================================================
// Chú thích: COPY / XÓA TEXTAREA
// ============================================================
$btnCopy.addEventListener("click", () => {
    if (!$result.value) return;
    navigator.clipboard.writeText($result.value).then(() => {
        const old = $btnCopy.textContent;
        $btnCopy.textContent = "ĐÃ COPY";
        setTimeout(() => { $btnCopy.textContent = old; }, 1200);
    });
});

$btnClear.addEventListener("click", () => {
    $result.value = "";
    totalCount = 0;
    $count.textContent = 0;
});

// ============================================================
// Chú thích: ĐẾM NGƯỢC
// ============================================================
function formatRemain(item) {
    if (!item.activatedAt) return "CHƯA DÙNG";

    const duration = item.duration || durationFromKey(item.key);
    if (duration === 0) return "∞";

    const expiresAt = item.activatedAt + duration;
    const remain = expiresAt - Date.now();
    if (remain <= 0) return "HẾT HẠN";

    const totalSec = Math.floor(remain / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}N ${h}H ${m}M`;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function formatTime(ts) {
    return new Date(ts).toLocaleString("vi-VN");
}

// ============================================================
// Chú thích: RENDER BẢNG
// ============================================================
function renderTable(filter = "") {
    const store = loadStore();
    $keyBody.innerHTML = "";
    const list = filter
        ? store.filter(x => x.key.toLowerCase().includes(filter.toLowerCase()))
        : store;
    list.sort((a, b) => b.createdAt - a.createdAt);

    list.forEach((item, idx) => {
        const tr = document.createElement("tr");
        const tdStt = document.createElement("td"); tdStt.textContent = idx + 1;
        const tdKey = document.createElement("td"); tdKey.className = "key-cell"; tdKey.textContent = item.key;
        const tdIp = document.createElement("td"); tdIp.textContent = item.ip || "unknown";
        const tdType = document.createElement("td"); tdType.className = "type-cell";
        const itemDuration = item.duration || durationFromKey(item.key);
        tdType.textContent = getDurationInfo(itemDuration).label;
        const tdCreated = document.createElement("td"); tdCreated.textContent = formatTime(item.createdAt);

        const tdRemain = document.createElement("td");
        tdRemain.textContent = formatRemain(item);
        if (!item.activatedAt) tdRemain.className = "not-used";
        else if (itemDuration === 0) tdRemain.className = "permanent";
        else if (item.activatedAt + itemDuration - Date.now() <= 0) tdRemain.className = "expired";
        else tdRemain.className = "active";

        const tdAct = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-del"; btnDel.textContent = "XÓA";
        btnDel.addEventListener("click", async () => {
            if (!confirm("Xóa key này? Người dùng sẽ bị chặn ngay lập tức.")) return;
            btnDel.textContent = "...";
            btnDel.disabled = true;

            const ok = await deleteKeyFromServer(item.key);
            if (!ok) {
                alert("Xóa trên server thất bại, thử lại");
                btnDel.textContent = "XÓA";
                btnDel.disabled = false;
                return;
            }

            const newStore = loadStore().filter(x => x.key !== item.key);
            saveStore(newStore);
            renderTable($search.value);
        });
        tdAct.appendChild(btnDel);

        tr.appendChild(tdStt); tr.appendChild(tdKey); tr.appendChild(tdIp);
        tr.appendChild(tdType); tr.appendChild(tdCreated); tr.appendChild(tdRemain);
        tr.appendChild(tdAct);
        $keyBody.appendChild(tr);
    });
    $total.textContent = store.length;
}

// ============================================================
// Chú thích: ĐỒNG BỘ VỚI WORKER
// silent = true → không alert
// ============================================================
async function syncWithServer(silent = false) {
    if (syncRunning) return;
    syncRunning = true;

    try {
        const serverKeys = await fetchServerKeys();
        if (!serverKeys) {
            if (!silent) alert("Đồng bộ thất bại — kiểm tra kết nối");
            syncRunning = false;
            return;
        }

        const store = loadStore();
        const serverMap = {};
        serverKeys.forEach(sk => { serverMap[sk.key] = sk; });

        let updated = 0;
        let added = 0;
        let removed = 0;

        // Chú thích: cập nhật key đã có
        store.forEach(item => {
            const sk = serverMap[item.key];
            if (!sk) return;

            if (!item.duration) {
                item.duration = durationFromKey(item.key);
            }

            // Chú thích: ghi đè activatedAt nếu Worker có
            if (sk.activatedAt && item.activatedAt !== sk.activatedAt) {
                item.activatedAt = sk.activatedAt;
                updated++;
            }
            if (sk.hwid && item.hwid !== sk.hwid) {
                item.hwid = sk.hwid;
            }
        });

        // Chú thích: thêm key mới từ Worker chưa có local
        serverKeys.forEach(sk => {
            if (!store.some(x => x.key === sk.key)) {
                store.push({
                    key: sk.key,
                    ip: sk.ip || "unknown",
                    duration: durationFromKey(sk.key),
                    activatedAt: sk.activatedAt || null,
                    hwid: sk.hwid || null,
                    createdAt: sk.createdAt || Date.now()
                });
                added++;
            }
        });

        // Chú thích: xóa key local đã bị xóa trên Worker
        const before = store.length;
        const filtered = store.filter(item => serverMap[item.key]);
        removed = before - filtered.length;

        saveStore(filtered);
        renderTable($search.value);

        if (!silent && (updated > 0 || added > 0 || removed > 0)) {
            console.log(`[SYNC] updated=${updated} added=${added} removed=${removed}`);
        }
    } finally {
        syncRunning = false;
    }
}

// ============================================================
// Chú thích: NÚT TẢI LẠI / XÓA TẤT CẢ / TÌM KIẾM
// ============================================================
$btnReload.addEventListener("click", async () => {
    await syncWithServer(false);
});

$btnClearAll.addEventListener("click", async () => {
    if (!confirm("Xóa TOÀN BỘ key? Tất cả người dùng sẽ bị chặn.")) return;

    const store = loadStore();
    let deleted = 0;

    for (const item of store) {
        const ok = await deleteKeyFromServer(item.key);
        if (ok) deleted++;
    }

    saveStore([]);
    renderTable();
    alert(`Đã xóa ${deleted}/${store.length} key`);
});

$search.addEventListener("input", (e) => renderTable(e.target.value));

// ============================================================
// Chú thích: AUTO REFRESH MỖI 1S
// ============================================================
setInterval(() => {
    if ($viewAdmin.style.display !== "none") renderTable($search.value);
}, 1000);

// ============================================================
// Chú thích: AUTO SYNC MỖI 10S KHI Ở TAB ADMIN
// ============================================================
setInterval(async () => {
    if ($viewAdmin.style.display !== "none") {
        await syncWithServer(true);
    }
}, SYNC_INTERVAL);

// ============================================================
// Chú thích: HIỆU ỨNG CHẤM ĐỎ
// ============================================================
document.addEventListener("click", (e) => {
    const dot = document.createElement("div");
    dot.className = "click-dot";
    dot.style.left = e.clientX + "px";
    dot.style.top  = e.clientY + "px";
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 3000);
});

// ============================================================
// Chú thích: KHỞI ĐỘNG
// ============================================================
fetchIP();
