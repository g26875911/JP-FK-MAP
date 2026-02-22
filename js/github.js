// js/github.js - GitHub API 底層 + notes.md 文字操作函式
const GH_TOKEN  = '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';
const GH_OWNER  = 'g26875911';
const GH_REPO   = 'JP-FK-MAP';
const GH_BRANCH = 'main';
const GH_FILE   = 'notes.md';
const GH_API    = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

// ── GitHub Contents API ─────────────────────────────────
export async function githubGetFile() {
    const res = await fetch(`${GH_API}?ref=${GH_BRANCH}&t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}` }
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    return {
        text: decodeURIComponent(escape(atob(json.content.replace(/\n/g, '')))),
        sha: json.sha
    };
}

export async function githubPutFile(newText, sha, message) {
    const content = btoa(unescape(encodeURIComponent(newText)));
    const res = await fetch(GH_API, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${GH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, content, sha, branch: GH_BRANCH })
    });
    if (!res.ok) throw new Error(String(res.status));
}

export function handleGithubError(e) {
    if (e.message === '401' || e.message === '403') alert('GitHub Token 無效或權限不足');
    else if (e.message === '409') alert('儲存衝突（SHA 過期），請重新整理後再試');
    else alert('儲存失敗，請確認網路連線');
}

// ── notes.md 文字操作 ────────────────────────────────────

export function notesMd_setDay(text, name, newDay) {
    const blocks = text.split(/(?=^# \[)/gm);
    const idx = blocks.findIndex(b => {
        const m = b.match(/^# \[.*?\]\s+(.*?)(?:\n|$)/);
        return m && m[1].trim() === name.trim();
    });
    if (idx === -1) return text;

    let block = blocks[idx];
    if (newDay === '0' || !newDay) {
        block = block.replace(/^> (Day|行程)[：:]\s*.*\n?/m, '');
    } else if (/^> (Day|行程)[：:]\s*.*$/m.test(block)) {
        block = block.replace(/^> (Day|行程)[：:]\s*.*$/m, `> Day: ${newDay}`);
    } else {
        block = block.replace(/((?:^> [^\n]*\n)+)/m, `$1> Day: ${newDay}\n`);
    }
    blocks[idx] = block;
    return blocks.join('');
}

export function notesMd_setContent(text, name, newTodo, newNotes) {
    const blocks = text.split(/(?=^# \[)/gm);
    const idx = blocks.findIndex(b => {
        const m = b.match(/^# \[.*?\]\s+(.*?)(?:\n|$)/);
        return m && m[1].trim() === name.trim();
    });
    if (idx === -1) return text;

    let block = blocks[idx];
    const sectionSplit = /(?=^### )/m;
    const metaEnd = block.search(sectionSplit);
    const metaPart = metaEnd === -1 ? block : block.substring(0, metaEnd);
    const sectionsPart = metaEnd === -1 ? '' : block.substring(metaEnd);
    const sections = sectionsPart ? sectionsPart.split(sectionSplit) : [''];

    let newSections = [];
    let hasTodo = false, hasNotes = false;
    for (const sec of sections) {
        if (sec.startsWith('### 想做什麼')) {
            newSections.push(`### 想做什麼\n${newTodo}\n`); hasTodo = true;
        } else if (sec.startsWith('### 備註')) {
            newSections.push(`### 備註\n${newNotes}\n`); hasNotes = true;
        } else {
            newSections.push(sec);
        }
    }
    if (!hasTodo) newSections.unshift(`### 想做什麼\n${newTodo}\n`);
    if (!hasNotes) newSections.push(`### 備註\n${newNotes}\n`);

    blocks[idx] = metaPart + newSections.join('');
    return blocks.join('');
}

export function notesMd_setOrder(text, day, order) {
    const dayNum = day.replace('day', '');
    const orderStr = order.join(', ');
    const regex = new RegExp(`^> day${dayNum}_Order:.*$`, 'mi');
    if (regex.test(text)) {
        return text.replace(regex, `> day${dayNum}_Order: ${orderStr}`);
    }
    return text.replace(/(# \[設定\][^\n]*\n(?:> [^\n]*\n)+)/m,
        `$1> day${dayNum}_Order: ${orderStr}\n`);
}

export function notesMd_setSettings(text, newDate, newDays) {
    if (newDate) text = text.replace(/^(> 開始日期[：:]\s*).*$/m, `$1${newDate}`);
    if (newDays) text = text.replace(/^(> 總天數[：:]\s*).*$/m, `$1${newDays}`);
    return text;
}
