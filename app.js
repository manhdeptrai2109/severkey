// Chú thích: app.js - web admin + quản lý seller có prefix + brand

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STORAGE_KEY = "tmanhios_keys";

const API_ADD         = "https://tmanhios.pretty-pilot.workers.dev/add";
const API_DELETE      = "https://tmanhios.pretty-pilot.workers.dev/delete";
const API_LIST        = "https://tmanhios.pretty-pilot.workers.dev/list";
const API_SELLERS     = "https://tmanhios.pretty-pilot.workers.dev/admin/sellers";
const API_CREATE      = "https://tmanhios.pretty-pilot.workers.dev/admin/create";
const API_DEL_SELLER  = "https://tmanhios.pretty-pilot.workers.dev/admin/delete-seller";
const API_TOGGLE      = "https://tmanhios.pretty-pilot.workers.dev/admin/toggle";
const API_SELLER_KEYS = "https://tmanhios.pretty-pilot.workers.dev/admin/seller-keys";

let currentIP = "unknown";
let totalCount = 0;

const DURATION_MAP = {
    3600000:    { prefix: "TManhios-1hour-",   label: "1 GIỜ" },
    86400000:   { prefix: "TManhios-1day-",    label: "1 NGÀY" },
    604800000:  { prefix: "TManhios-7day-",    label: "7 NGÀY" },
    2592000000: { prefix: "TManhios-1month-",  label: "1 THÁNG" },
    0:          { prefix: "TManhios-forever-", label: "VĨNH VIỄN" }
};

function durationFromKey(key) {
    if (key.indexOf("-12hour-") !== -1) return 43200000;
    if (key.indexOf("-1hour-")  !== -1) return 3600000;
    if (key.indexOf("-1day-")   !== -1) return 86400000;
    if (key.indexOf("-7day-")   !== -1) return 604800000;
    if (key.indexOf("-1month-") !== -1) return 2592000000;
    if (key.indexOf("-forever-")!== -1) return 0;
    return 86400000;
}

async function uploadKeyToServer(key) {
    try {
        const form = new FormData();
        form.append("key", key);
        const r = await fetch(API_ADD, { method: "POST", body: form });
        const j = await r.json();
        return j.status === "ok";
    } catch (e) { return false; }
}

async function deleteKeyFromServer(key) {
    try {
        const form = new FormData();
        form.append("key", key);
        const r = await fetch(API_DELETE, { method: "POST", body: form });
        const j = await r.json();
        return j.status === "ok";
    } catch (e) { return false; }
}

async function fetchServerKeys() {
    try {
        const r = await fetch(API_LIST, { method: "POST" });
        const j = await r.json();
        if (j.status !== "ok") return null;
        return j.keys || [];
    } catch (e) { return null; }
}

async function fetchIP() {
    try {
        const r = await fetch("https://api.ipify.org?format=json");
        const j = await r.json();
        currentIP = j.ip || "unknown";
    } catch (e) { currentIP = "unknown"; }
    const el = document.getElementById("ip-display");
    if (el) el.textContent = "IP: " + currentIP;
}

function randomSuffix(len) {
    let out = "";
    for (let i = 0; i < len; i++) {
        const idx = crypto.getRandomValues(new Uint32Array(1))[0] % CHARS.length;
        out += CHARS[idx];
    }
    return out;
}

function genKeys(prefix, amount, len) {
    const set = new Set();
    let attempts = 0;
    while (set.size < amount && attempts < amount * 10) {
        set.add(prefix + randomSuffix(len));
        attempts++;
    }
    return Array.from(set);
}

function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch (e) { return []; }
}

function saveStore(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function getDurationInfo(dur) {
    return DURATION_MAP[dur] || { prefix: "TManhios-1day-", label: "1 NGÀY" };
}

const $tabGen     = document.getElementById("tab-gen");
const $tabAdmin   = document.getElementById("tab-admin");
const $tabSeller  = document.getElementById("tab-seller");
const $viewGen    = document.getElementById("view-gen");
const $viewAdmin  = document.getElementById("view-admin");
const $viewSeller = document.getElementById("view-seller");

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

const $adminPass       = document.getElementById("admin-pass");
const $btnLoadSellers  = document.getElementById("btn-load-sellers");
const $newUsername     = document.getElementById("new-username");
const $newPassword     = document.getElementById("new-password");
const $newPrefix       = document.getElementById("new-prefix");
const $newBrand        = document.getElementById("new-brand");
const $btnCreateSeller = document.getElementById("btn-create-seller");
const $sellerBody      = document.getElementById("seller-body");
const $sellerTotal     = document.getElementById("seller-total");

function showTab(tab) {
    $tabGen.classList.remove("active");
    $tabAdmin.classList.remove("active");
    $tabSeller.classList.remove("active");
    $viewGen.style.display = "none";
    $viewAdmin.style.display = "none";
    $viewSeller.style.display = "none";

    if (tab === "gen") {
        $tabGen.classList.add("active");
        $viewGen.style.display = "";
    } else if (tab === "admin") {
        $tabAdmin.classList.add("active");
        $viewAdmin.style.display = "";
        renderTable($search.value);
    } else if (tab === "seller") {
        $tabSeller.classList.add("active");
        $viewSeller.style.display = "";
    }
}

$tabGen.addEventListener("click", () => showTab("gen"));
$tabAdmin.addEventListener("click", () => showTab("admin"));
$tabSeller.addEventListener("click", () => showTab("seller"));

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
    if (oldText.trim() === "") $result.value = keys.join("\n");
    else $result.value = oldText.replace(/\s+$/, "") + "\n" + keys.join("\n");

    totalCount += keys.length;
    $count.textContent = totalCount;

    const store = loadStore();
    const now = Date.now();
    let added = 0, uploaded = 0;

    for (const k of keys) {
        if (!store.some(x => x.key === k)) {
            store.push({
                key: k, ip: currentIP, duration: dur,
                activatedAt: null, hwid: null, createdAt: now
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

function renderTable(filter = "") {
    const store = loadStore();
    $keyBody.innerHTML = "";
    const now = Date.now();
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
        else if (item.activatedAt + itemDuration - now <= 0) tdRemain.className = "expired";
        else tdRemain.className = "active";

        const tdAct = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-del"; btnDel.textContent = "XÓA";
        btnDel.addEventListener("click", async () => {
            if (!confirm("Xóa key này?")) return;
            btnDel.textContent = "..."; btnDel.disabled = true;
            const ok = await deleteKeyFromServer(item.key);
            if (!ok) { alert("Lỗi xóa"); btnDel.textContent = "XÓA"; btnDel.disabled = false; return; }
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

async function syncWithServer() {
    const serverKeys = await fetchServerKeys();
    if (!serverKeys) { alert("Đồng bộ thất bại"); return; }
    const store = loadStore();
    const serverMap = {};
    serverKeys.forEach(sk => { serverMap[sk.key] = sk; });

    let updated = 0, added = 0;
    store.forEach(item => {
        const sk = serverMap[item.key];
        if (!sk) return;
        if (!item.duration) item.duration = durationFromKey(item.key);
        if (sk.activatedAt && item.activatedAt !== sk.activatedAt) {
            item.activatedAt = sk.activatedAt; updated++;
        }
        if (sk.hwid && !item.hwid) item.hwid = sk.hwid;
    });

    serverKeys.forEach(sk => {
        if (!store.some(x => x.key === sk.key)) {
            store.push({
                key: sk.key, ip: sk.ip || "unknown",
                duration: durationFromKey(sk.key),
                activatedAt: sk.activatedAt || null,
                hwid: sk.hwid || null,
                createdAt: sk.createdAt || Date.now()
            });
            added++;
        }
    });

    saveStore(store);
    renderTable($search.value);
    alert(`Cập nhật ${updated}, thêm ${added}`);
}

$btnReload.addEventListener("click", syncWithServer);

$btnClearAll.addEventListener("click", async () => {
    if (!confirm("Xóa TOÀN BỘ key?")) return;
    const store = loadStore();
    let deleted = 0;
    for (const item of store) {
        const ok = await deleteKeyFromServer(item.key);
        if (ok) deleted++;
    }
    saveStore([]);
    renderTable();
    alert(`Đã xóa ${deleted}/${store.length}`);
});

$search.addEventListener("input", (e) => renderTable(e.target.value));

setInterval(() => {
    if ($viewAdmin.style.display !== "none") renderTable($search.value);
}, 1000);

// ============================================================
// Chú thích: QUẢN LÝ SELLER
// ============================================================
async function loadSellers() {
    const pass = $adminPass.value.trim();
    if (!pass) { alert("Nhập mật khẩu admin"); return; }

    try {
        const form = new FormData();
        form.append("admin_pass", pass);
        const r = await fetch(API_SELLERS, { method: "POST", body: form });
        const j = await r.json();

        if (j.status !== "ok") { alert("Lỗi: " + (j.msg || "unknown")); return; }

        renderSellers(j.sellers, pass);
        $sellerTotal.textContent = j.count;
    } catch (e) {
        alert("Không kết nối server");
    }
}

function renderSellers(sellers, pass) {
    $sellerBody.innerHTML = "";
    sellers.sort((a, b) => b.createdAt - a.createdAt);

    sellers.forEach((s, idx) => {
        const tr = document.createElement("tr");
        const tdStt = document.createElement("td"); tdStt.textContent = idx + 1;
        const tdUser = document.createElement("td"); tdUser.className = "key-cell"; tdUser.textContent = s.username;

        const tdPrefix = document.createElement("td");
        tdPrefix.className = "type-cell";
        tdPrefix.textContent = s.prefix || "TManhios-";

        const tdBrand = document.createElement("td");
        tdBrand.textContent = s.brand || "TMANHIOS SELLER";
        tdBrand.className = "type-cell";

        const tdStatus = document.createElement("td");
        tdStatus.textContent = s.active ? "HOẠT ĐỘNG" : "ĐÃ KHÓA";
        tdStatus.className = s.active ? "seller-active" : "seller-disabled";

        const tdQuota = document.createElement("td");
        tdQuota.textContent = `${s.quotaUsed}/${s.dailyLimit} (còn ${s.quotaRemain})`;

        const tdCreated = document.createElement("td"); tdCreated.textContent = formatTime(s.createdAt);

        const tdAct = document.createElement("td");

        const btnToggle = document.createElement("button");
        btnToggle.className = "btn-toggle";
        btnToggle.textContent = s.active ? "KHÓA" : "MỞ";
        btnToggle.addEventListener("click", async () => {
            if (!confirm(`Đổi trạng thái seller ${s.username}?`)) return;
            const form = new FormData();
            form.append("admin_pass", pass);
            form.append("username", s.username);
            const r = await fetch(API_TOGGLE, { method: "POST", body: form });
            const j = await r.json();
            if (j.status === "ok") loadSellers();
            else alert("Lỗi: " + j.msg);
        });

        const btnKeys = document.createElement("button");
        btnKeys.className = "btn-keys";
        btnKeys.textContent = "XEM KEY";
        btnKeys.addEventListener("click", async () => {
            const form = new FormData();
            form.append("admin_pass", pass);
            form.append("username", s.username);
            const r = await fetch(API_SELLER_KEYS, { method: "POST", body: form });
            const j = await r.json();
            if (j.status === "ok") {
                let msg = `Seller: ${s.username}\nPrefix: ${s.prefix}\nBrand: ${s.brand}\nTổng key: ${j.count}\n\n`;
                j.keys.slice(0, 20).forEach(k => { msg += k.key + "\n"; });
                if (j.count > 20) msg += `... và ${j.count - 20} key khác`;
                alert(msg);
            } else alert("Lỗi: " + j.msg);
        });

        const btnDel = document.createElement("button");
        btnDel.className = "btn-del";
        btnDel.textContent = "XÓA";
        btnDel.addEventListener("click", async () => {
            if (!confirm(`XÓA seller ${s.username} và toàn bộ key?`)) return;
            const form = new FormData();
            form.append("admin_pass", pass);
            form.append("username", s.username);
            const r = await fetch(API_DEL_SELLER, { method: "POST", body: form });
            const j = await r.json();
            if (j.status === "ok") loadSellers();
            else alert("Lỗi: " + j.msg);
        });

        tdAct.appendChild(btnToggle);
        tdAct.appendChild(btnKeys);
        tdAct.appendChild(btnDel);

        tr.appendChild(tdStt); tr.appendChild(tdUser); tr.appendChild(tdPrefix);
        tr.appendChild(tdBrand); tr.appendChild(tdStatus); tr.appendChild(tdQuota);
        tr.appendChild(tdCreated); tr.appendChild(tdAct);
        $sellerBody.appendChild(tr);
    });
}

$btnLoadSellers.addEventListener("click", loadSellers);

$btnCreateSeller.addEventListener("click", async () => {
    const pass = $adminPass.value.trim();
    const user = $newUsername.value.trim().toLowerCase();
    const pwd  = $newPassword.value.trim();
    const prefix = $newPrefix.value.trim() || "TManhios-";
    const brand  = $newBrand.value.trim() || "TMANHIOS SELLER";

    if (!pass) { alert("Nhập mật khẩu admin"); return; }
    if (!user || !pwd) { alert("Nhập đủ username + password"); return; }
    if (user.length < 4) { alert("Username >= 4 ký tự"); return; }
    if (pwd.length < 6) { alert("Password >= 6 ký tự"); return; }
    if (!/^[A-Za-z0-9\-]+$/.test(prefix)) { alert("Prefix chỉ chữ, số, dấu gạch"); return; }

    try {
        const form = new FormData();
        form.append("admin_pass", pass);
        form.append("username", user);
        form.append("password", pwd);
        form.append("prefix", prefix);
        form.append("brand", brand);
        const r = await fetch(API_CREATE, { method: "POST", body: form });
        const j = await r.json();

        if (j.status === "ok") {
            alert("Tạo seller thành công!\nUsername: " + user + "\nPrefix: " + prefix + "\nBrand: " + brand);
            $newUsername.value = "";
            $newPassword.value = "";
            $newPrefix.value = "TManhios-";
            $newBrand.value = "TMANHIOS SELLER";
            loadSellers();
        } else {
            alert("Lỗi: " + (j.msg || "unknown"));
        }
    } catch (e) {
        alert("Không kết nối server");
    }
});

document.addEventListener("click", (e) => {
    const dot = document.createElement("div");
    dot.className = "click-dot";
    dot.style.left = e.clientX + "px";
    dot.style.top  = e.clientY + "px";
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 3000);
});

fetchIP();
