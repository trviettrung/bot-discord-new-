const fs = require("fs");
const path = require("path");

const rootDir = path.join(
    __dirname,
    "..",
    ".."
);

const dataDir = path.join(
    rootDir,
    "data"
);

const graphFile = path.resolve(
    process.env.WORDCONNECT_GRAPH_FILE ||
    path.join(
        dataDir,
        "wordconnect-pairs.json"
    )
);

const startWordsFile = path.resolve(
    process.env.WORDCONNECT_START_WORDS_FILE ||
    path.join(
        dataDir,
        "wordconnect-start-words.json"
    )
);

const manualWordsFile = path.resolve(
    process.env.WORDCONNECT_MANUAL_WORDS_FILE ||
    path.join(
        dataDir,
        "manual-words.txt"
    )
);

const vietnameseLetters =
    "a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ";

const manualWordPattern = new RegExp(
    `^[${vietnameseLetters}]+ [${vietnameseLetters}]+$`,
    "i"
);

const wordGraph = loadGraph();
const dictionaryWords = [];
const startWords = loadStartWords();

loadManualWords();
rebuildDictionaryWords();

function normalizeWord(text) {

    return String(text || "")
        .normalize("NFC")
        .toLowerCase()
        .replace(/[!,.?]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function splitWord(text) {

    return normalizeWord(text)
        .split(" ")
        .filter(Boolean);
}

function isTwoWord(text) {

    return splitWord(text)
        .length === 2;
}

function getFirstWord(text) {

    return splitWord(text)
        .at(0) || "";
}

function getLastWord(text) {

    return splitWord(text)
        .at(-1) || "";
}

function addPair(
    graph,
    first,
    second
) {

    const cleanFirst =
        normalizeWord(first);

    const cleanSecond =
        normalizeWord(second);

    if (
        !cleanFirst ||
        !cleanSecond ||
        cleanFirst.includes(" ") ||
        cleanSecond.includes(" ")
    ) return false;

    if (
        !graph.has(cleanFirst)
    ) {

        graph.set(
            cleanFirst,
            new Set()
        );
    }

    const seconds =
        graph.get(cleanFirst);

    const existed =
        seconds.has(cleanSecond);

    seconds.add(cleanSecond);

    return !existed;
}

function addWordToGraph(
    graph,
    word
) {

    const parts =
        splitWord(word);

    if (
        parts.length !== 2
    ) return false;

    return addPair(
        graph,
        parts[0],
        parts[1]
    );
}

function loadGraph() {

    const graph =
        new Map();

    try {

        if (
            !fs.existsSync(graphFile)
        ) return graph;

        const data =
            JSON.parse(
                fs.readFileSync(
                    graphFile,
                    "utf8"
                )
            );

        for (
            const [first, seconds] of Object.entries(data)
        ) {

            if (
                !Array.isArray(seconds)
            ) continue;

            for (const second of seconds) {

                addPair(
                    graph,
                    first,
                    second
                );
            }
        }

    } catch (err) {

        console.error(
            `Không đọc được ${graphFile}:`,
            err
        );
    }

    return graph;
}

function loadTextWords(filePath) {

    try {

        if (
            !fs.existsSync(filePath)
        ) return [];

        return fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .split(/\r?\n/)
            .map(normalizeWord)
            .filter(Boolean);

    } catch (err) {

        console.error(
            `Không đọc được ${filePath}:`,
            err
        );

        return [];
    }
}

function loadJsonWords(filePath) {

    try {

        if (
            !fs.existsSync(filePath)
        ) return [];

        const data =
            JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );

        if (
            !Array.isArray(data)
        ) return [];

        return data
            .map(normalizeWord)
            .filter(Boolean);

    } catch (err) {

        console.error(
            `Không đọc được ${filePath}:`,
            err
        );

        return [];
    }
}

function loadStartWords() {

    return loadJsonWords(startWordsFile)
        .filter(isKnownWord);
}

function loadManualWords() {

    for (
        const word of loadTextWords(manualWordsFile)
    ) {

        addWordToGraph(
            wordGraph,
            word
        );
    }
}

function rebuildDictionaryWords() {

    dictionaryWords.splice(
        0,
        dictionaryWords.length
    );

    for (
        const [first, seconds] of wordGraph
    ) {

        for (const second of seconds) {

            dictionaryWords.push(
                `${first} ${second}`
            );
        }
    }
}

function isKnownWord(text) {

    const parts =
        splitWord(text);

    if (
        parts.length !== 2
    ) return false;

    return Boolean(
        wordGraph
            .get(parts[0])
            ?.has(parts[1])
    );
}

function getRandomPool() {

    if (
        startWords.length > 0
    ) return startWords;

    return dictionaryWords.filter(word =>
        getNextWordCount(word) >= 20
    );
}

function getRandomWord() {

    const pool =
        getRandomPool();

    if (
        pool.length === 0
    ) return null;

    const index =
        Math.floor(
            Math.random() *
            pool.length
        );

    return pool[index];
}

function getNextWords(text) {

    const lastWord =
        getLastWord(text);

    return [
        ...(
            wordGraph.get(lastWord) ||
            []
        )
    ].map(second =>
        `${lastWord} ${second}`
    );
}

function getNextWordCount(text) {

    return getNextWords(text)
        .length;
}

function isDeadWord(text) {

    return getNextWordCount(text) === 0;
}

function isValidManualWord(text) {

    return manualWordPattern.test(
        normalizeWord(text)
    );
}

function readWordSet(filePath) {

    return new Set(
        loadTextWords(filePath)
    );
}

function appendWordIfMissing(
    filePath,
    word
) {

    const words =
        readWordSet(filePath);

    if (
        words.has(word)
    ) return false;

    fs.mkdirSync(
        path.dirname(filePath),
        {
            recursive: true
        }
    );

    const needsNewLine =
        fs.existsSync(filePath) &&
        fs.statSync(filePath).size > 0 &&
        !fs
            .readFileSync(filePath)
            .toString("utf8")
            .endsWith("\n");

    fs.appendFileSync(
        filePath,
        `${needsNewLine ? "\n" : ""}${word}\n`,
        "utf8"
    );

    return true;
}

function addWordToRuntime(word) {

    const added =
        addWordToGraph(
            wordGraph,
            word
        );

    if (added) {

        dictionaryWords.push(word);
    }
}

const DEFAULT_GOOGLE_SHEET_URL =
    "https://script.google.com/macros/s/AKfycbz_zf5CRKsYBb73Cz-OohhrvfZmDrnJSkSacD6flmN6Cb3b7AWiwpKjh4ypDV4F0SqD/exec";

function resolveGoogleSheetUrl() {
    let url = process.env.GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
    if (typeof url !== "string") return DEFAULT_GOOGLE_SHEET_URL;

    // Loại bỏ khoảng trắng, dấu nháy kép, dấu nháy đơn, ký tự xuống dòng (\r, \n)
    url = url.trim().replace(/^["']|["']$/g, "").replace(/\r|\n/g, "").trim();

    // Loại bỏ dấu / ở cuối URL nếu có (vì /exec/ sẽ bị Google trả về 404)
    while (url.endsWith("/")) {
        url = url.slice(0, -1);
    }

    // Tự động sửa nếu bị thiếu /exec hoặc để nhầm /edit
    if (url.endsWith("/edit")) {
        url = url.replace(/\/edit$/, "/exec");
    } else if (!url.endsWith("/exec") && url.includes("/macros/s/")) {
        url = `${url}/exec`;
    }

    return url;
}

const GOOGLE_SHEET_URL = resolveGoogleSheetUrl();

async function syncWordsFromGoogleSheet() {

    if (!GOOGLE_SHEET_URL) return;

    try {
        console.log(`⏳ Đang đồng bộ từ điển từ Google Sheet (${GOOGLE_SHEET_URL})...`);
        const response = await fetch(GOOGLE_SHEET_URL, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data?.words)) {
            let addedCount = 0;
            for (const rawWord of data.words) {
                const word = normalizeWord(rawWord);
                if (isTwoWord(word) && !isKnownWord(word)) {
                    addWordToRuntime(word);
                    appendWordIfMissing(manualWordsFile, word);
                    addedCount++;
                }
            }
            console.log(`✅ Đồng bộ thành công: ${data.words.length} từ trên Google Sheet (${addedCount} từ mới được nạp).`);
        }
    } catch (err) {
        console.error("⚠️ Lỗi đồng bộ từ Google Sheet:", err.message || err);
    }
}

async function saveWordToGoogleSheet(word) {

    if (!GOOGLE_SHEET_URL) return;

    try {
        const response = await fetch(GOOGLE_SHEET_URL, {
            method: "POST",
            body: JSON.stringify({ word }),
            headers: {
                "Content-Type": "text/plain",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            redirect: "follow"
        });

        return await response.json();
    } catch (err) {
        console.error("⚠️ Lỗi lưu từ lên Google Sheet:", err.message || err);
    }
}

async function saveKnownWord(text) {

    const word =
        normalizeWord(text);

    if (
        !isValidManualWord(word)
    ) {

        return {
            ok: false,
            reason: "invalid",
            word
        };
    }

    if (
        isKnownWord(word)
    ) {

        return {
            ok: true,
            existed: true,
            word
        };
    }

    appendWordIfMissing(
        manualWordsFile,
        word
    );

    addWordToRuntime(word);

    // Gửi lưu lên Google Sheet
    await saveWordToGoogleSheet(word);

    return {
        ok: true,
        existed: false,
        word
    };
}

function checkConnect(
    currentWord,
    input
) {

    if (
        !isTwoWord(input)
    ) return false;

    return getFirstWord(input) ===
        getLastWord(currentWord);
}

module.exports = {
    normalizeWord,
    isKnownWord,
    isDeadWord,
    isTwoWord,
    getRandomWord,
    getNextWords,
    getNextWordCount,
    saveKnownWord,
    getLastWord,
    checkConnect,
    syncWordsFromGoogleSheet
};
