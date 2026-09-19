// Chú thích: toàn bộ logic - tạo key có prefix theo loại hạn + quản lý key + hiệu ứng click

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STORAGE_KEY = "tmanhios_keys";

let currentIP = "unknown";

// ============================================================
// Chú thích: MAP DURATION SANG PREFIX + LABEL
// ============================================================
const DURATION_MAP = {
    3600000:    { prefix: "TManhios-1hour-",   label: "1 GIỜ" },
    86400000:   { prefix: "TManhios-1day-",    label: "1 NGÀY" },
    604800000:  { prefix: "TManhios-7day-",    label: "7 NGÀY" },
    2592000000: { prefix: "TManhios-1month-",  label: "1 THÁNG" },
    0:          { prefix: "TManhios-forever-", label: "VĨNH VIỄN" }
};

// ============================================================
// Chú thích: LẤY IPV4 NGƯỜI DÙNG
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
// Chú thích: KHO KEY TRONG LOCALSTORAGE
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

// ============================================================
// Chú thích: LẤY INFO LOẠI HẠN
// ============================================================
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

// ============================================================
// Chú thích: CHUYỂN TAB
// ============================================================
$tabGen.addEventListener("click", () => {
    $tabGen.classList.add("active");
    $tabAdmin.classList.remove("active");
    $viewGen.style.display = "";
    $viewAdmin.style.display = "none";
});

$tabAdmin.addEventListener("click", () => {
    $tabAdmin.classList.add("active");
    $tabGen.classList.remove("active");
    $viewGen.style.display = "none";
    $viewAdmin.style.display = "";
    renderTable($search.value);
});

// ============================================================
// Chú thích: NÚT TẠO KEY - prefix đổi theo loại hạn
// ============================================================
$btnGen.addEventListener("click", () => {
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

    // Chú thích: cộng dồn vào textarea
    const oldText = $result.value;
    if (oldText.trim() === "") {
        $result.value = keys.join("\n");
    } else {
        $result.value = oldText.replace(/\s+$/, "") + "\n" + keys.join("\n");
    }

    totalCount += keys.length;
    $count.textContent = totalCount;

    // Chú thích: ghi kho, expiresAt = 0 là vĩnh viễn
    const store = loadStore();
    const now = Date.now();
    const expiresAt = dur === 0 ? 0 : now + dur;
    let added = 0;

    keys.forEach(k => {
        if (store.some(x => x.key === k)) return;
        store.push({
            key: k,
            ip: currentIP,
            duration: dur,
            createdAt: now,
            expiresAt: expiresAt
        });
        added++;
    });

    saveStore(store);
    renderTable($search.value);

    const old = $btnGen.textContent;
    $btnGen.textContent = `ĐÃ TẠO + LƯU ${added}`;
    setTimeout(() => { $btnGen.textContent = old; }, 1200);
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
// Chú thích: ĐẾM NGƯỢC THỜI GIAN
// ============================================================
function formatRemain(item) {
    if (item.expiresAt === 0) return "∞";

    const remain = item.expiresAt - Date.now();
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
// Chú thích: RENDER BẢNG KEY
// ============================================================
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

        const tdStt = document.createElement("td");
        tdStt.textContent = idx + 1;

        const tdKey = document.createElement("td");
        tdKey.className = "key-cell";
        tdKey.textContent = item.key;

        const tdIp = document.createElement("td");
        tdIp.textContent = item.ip || "unknown";

        const tdType = document.createElement("td");
        tdType.className = "type-cell";
        tdType.textContent = getDurationInfo(item.duration || 0).label;

        const tdCreated = document.createElement("td");
        tdCreated.textContent = formatTime(item.createdAt);

        const tdRemain = document.createElement("td");
        tdRemain.textContent = formatRemain(item);
        if (item.expiresAt === 0) {
            tdRemain.className = "permanent";
        } else if (item.expiresAt - now <= 0) {
            tdRemain.className = "expired";
        } else {
            tdRemain.className = "active";
        }

        const tdAct = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-del";
        btnDel.textContent = "XÓA";
        btnDel.addEventListener("click", () => {
            const newStore = loadStore().filter(x => x.key !== item.key);
            saveStore(newStore);
            renderTable($search.value);
        });
        tdAct.appendChild(btnDel);

        tr.appendChild(tdStt);
        tr.appendChild(tdKey);
        tr.appendChild(tdIp);
        tr.appendChild(tdType);
        tr.appendChild(tdCreated);
        tr.appendChild(tdRemain);
        tr.appendChild(tdAct);
        $keyBody.appendChild(tr);
    });

    $total.textContent = store.length;
}

// ============================================================
// Chú thích: NÚT TẢI LẠI + XÓA TẤT CẢ + TÌM KIẾM
// ============================================================
$btnReload.addEventListener("click", () => {
    renderTable($search.value);
});

$btnClearAll.addEventListener("click", () => {
    if (!confirm("Xóa toàn bộ key đã lưu?")) return;
    saveStore([]);
    renderTable();
});

$search.addEventListener("input", (e) => {
    renderTable(e.target.value);
});

// ============================================================
// Chú thích: TỰ REFRESH BẢNG MỖI 1 GIÂY KHI Ở TAB ADMIN
// ============================================================
setInterval(() => {
    if ($viewAdmin.style.display !== "none") {
        renderTable($search.value);
    }
}, 1000);

// ============================================================
// Chú thích: HIỆU ỨNG CHẤM ĐỎ KHI CLICK CHUỘT
// ============================================================
document.addEventListener("click", (e) => {
    const dot = document.createElement("div");
    dot.className = "click-dot";
    dot.style.left = e.clientX + "px";
    dot.style.top  = e.clientY + "px";
    document.body.appendChild(dot);

    // Chú thích: tự xóa khỏi DOM sau 3 giây
    setTimeout(() => {
        dot.remove();
    }, 3000);
});

// ============================================================
// Chú thích: KHỞI ĐỘNG
// ============================================================
fetchIP();