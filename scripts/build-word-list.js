const fs = require("fs");
const path = require("path");

const rootDir = path.join(
    __dirname,
    ".."
);

const dataDir = path.join(
    rootDir,
    "data"
);

const vnCoreFile = path.join(
    dataDir,
    "vncorenlp-vi-vocab"
);

const commonFile = path.join(
    dataDir,
    "Viet11K.txt"
);

const viet74kFile = path.join(
    dataDir,
    "Viet74K.txt"
);

const wordsWikiFile = path.join(
    dataDir,
    "wordswiki.txt"
);

const customFile = path.join(
    dataDir,
    "custom-words.txt"
);

const manualFile = path.join(
    dataDir,
    "manual-words.txt"
);

const undertheseaDir = path.join(
    dataDir,
    "underthesea-dictionary",
    "dictionary-master",
    "dictionaries"
);

const buildSourceFiles = [
    vnCoreFile,
    commonFile,
    viet74kFile,
    wordsWikiFile,
    customFile,
    path.join(
        undertheseaDir,
        "tudientv",
        "words.txt"
    ),
    path.join(
        undertheseaDir,
        "wiktionary",
        "words.txt"
    )
];

const outputs = {
    all: path.join(rootDir, "words.txt"),
    start: path.join(rootDir, "words-start.txt"),
    easy: path.join(rootDir, "words-easy.txt"),
    medium: path.join(rootDir, "words-medium.txt"),
    hard: path.join(rootDir, "words-hard.txt"),
    dead: path.join(rootDir, "words-dead.txt"),
    stats: path.join(dataDir, "word-stats.tsv")
};

const vietnameseLetters =
    "a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ";

const wordPattern = new RegExp(
    `^[${vietnameseLetters}]+ [${vietnameseLetters}]+$`,
    "i"
);

const blockedWords = new Set([
    "con cả"
]);

const blockedProperNames = new Set([
    "ai cập",
    "an giang",
    "anh quốc",
    "ấn độ",
    "bà rịa",
    "bắc giang",
    "bắc kạn",
    "bắc ninh",
    "bến tre",
    "bình dương",
    "bình định",
    "bình phước",
    "bình thuận",
    "cà mau",
    "cao bằng",
    "cần thơ",
    "đà nẵng",
    "đài loan",
    "đắk lắk",
    "đắk nông",
    "điện biên",
    "đồng nai",
    "đồng tháp",
    "gia lai",
    "hà giang",
    "hà lan",
    "hà nam",
    "hà nội",
    "hà tĩnh",
    "hải dương",
    "hải phòng",
    "hàn quốc",
    "hậu giang",
    "hoa kỳ",
    "hòa bình",
    "hồng kông",
    "hưng yên",
    "khánh hòa",
    "kiên giang",
    "kon tum",
    "lai châu",
    "lâm đồng",
    "lạng sơn",
    "lào cai",
    "liên xô",
    "long an",
    "nam định",
    "nghệ an",
    "nhật bản",
    "ninh bình",
    "ninh thuận",
    "phú thọ",
    "phú yên",
    "quảng bình",
    "quảng nam",
    "quảng ngãi",
    "quảng ninh",
    "quảng trị",
    "sài gòn",
    "sóc trăng",
    "sơn la",
    "tây ninh",
    "thái bình",
    "thái lan",
    "thái nguyên",
    "thanh hóa",
    "tiền giang",
    "trà vinh",
    "triều tiên",
    "trung quốc",
    "tuyên quang",
    "việt nam",
    "vĩnh long",
    "vĩnh phúc",
    "yên bái"
]);

const blockedEthnicWords = new Set([
    "ba na",
    "brâu",
    "chơ ro",
    "cơ ho",
    "cơ tu",
    "ê đê",
    "gia rai",
    "giáy",
    "hà nhì",
    "hmông",
    "kháng",
    "khơ me",
    "khơ mú",
    "la chí",
    "la ha",
    "la hủ",
    "lô lô",
    "mảng",
    "mông",
    "mường",
    "ngái",
    "nùng",
    "ơ đu",
    "ra glai",
    "sán chay",
    "sán dìu",
    "si la",
    "tà ôi",
    "tày",
    "xơ đăng"
]);

const blockedEthnicFirstWords = new Set([
    "mường",
    "nùng",
    "tày"
]);

const blockedFirstWords = new Set([
    "a",
    "à",
    "á",
    "ấy",
    "bản",
    "bà",
    "bác",
    "bọn",
    "các",
    "chàng",
    "chị",
    "chú",
    "cô",
    "cậu",
    "đám",
    "đàn",
    "em",
    "gã",
    "kẻ",
    "mụ",
    "ngài",
    "ông",
    "tay",
    "thằng"
]);

const blockedTokens = new Set([
    "acid",
    "ad",
    "ampere",
    "carbonic",
    "chlorhydric",
    "folic",
    "nitric",
    "sulfuric",
    "yoga"
]);

function normalizeWord(value) {

    return value
        .normalize("NFC")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function isCleanWord(value) {

    const word =
        normalizeWord(value);

    if (!word) return false;

    if (
        blockedWords.has(word)
    ) return false;

    if (
        blockedProperNames.has(word) ||
        blockedEthnicWords.has(word)
    ) return false;

    if (
        !wordPattern.test(word)
    ) return false;

    const parts =
        word.split(" ");

    if (
        parts.length !== 2
    ) return false;

    if (
        parts.some(part => part.length < 2)
    ) return false;

    if (
        parts.some(part => blockedTokens.has(part))
    ) return false;

    if (
        blockedFirstWords.has(parts[0])
    ) return false;

    if (
        blockedEthnicFirstWords.has(parts[0])
    ) return false;

    return true;
}

function isTitleCasePhrase(value) {

    if (
        typeof value !== "string"
    ) return false;

    const parts =
        value
            .trim()
            .split(/\s+/);

    if (
        parts.length !== 2
    ) return false;

    return parts.every(part =>
        /^[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/.test(part)
    );
}

function addWord(
    wordSources,
    rawWord,
    source
) {

    if (
        typeof rawWord !== "string"
    ) return;

    const preparedWord =
        rawWord.replace(/-/g, " ");

    if (
        (
            source === "wiktionary" ||
            source === "viet74k" ||
            source === "wordswiki"
        ) &&
        isTitleCasePhrase(preparedWord)
    ) return;

    if (
        !isCleanWord(preparedWord)
    ) return;

    const word =
        normalizeWord(preparedWord);

    if (
        !wordSources.has(word)
    ) {

        wordSources.set(
            word,
            new Set()
        );
    }

    wordSources
        .get(word)
        .add(source);
}

function readSerializedStrings(
    filePath,
    wordSources,
    source
) {

    if (
        !fs.existsSync(filePath)
    ) return;

    const buffer =
        fs.readFileSync(filePath);

    for (
        let index = 0;
        index < buffer.length - 3;
        index += 1
    ) {

        if (buffer[index] !== 0x74) continue;

        const length =
            buffer.readUInt16BE(
                index + 1
            );

        const start =
            index + 3;

        const end =
            start + length;

        if (end > buffer.length) continue;

        addWord(
            wordSources,
            buffer
                .subarray(start, end)
                .toString("utf8"),
            source
        );

        index = end - 1;
    }
}

function readJsonLines(
    filePath,
    wordSources,
    fallbackSource
) {

    if (
        !fs.existsSync(filePath)
    ) return;

    const lines =
        fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .split(/\r?\n/);

    for (
        const line of lines
    ) {

        if (!line.trim()) continue;

        try {

            const item =
                JSON.parse(line);

            addWord(
                wordSources,
                item.text,
                item.source || fallbackSource
            );

        } catch {

            // Ignore malformed dictionary rows.
        }
    }
}

function readJsonTextLines(
    filePath,
    wordSources,
    source
) {

    if (
        !fs.existsSync(filePath)
    ) return;

    const lines =
        fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .split(/\r?\n/);

    for (
        const line of lines
    ) {

        if (!line.trim()) continue;

        try {

            const item =
                JSON.parse(line);

            addWord(
                wordSources,
                item.text,
                source
            );

        } catch {

            // Ignore malformed dictionary rows.
        }
    }
}

function readPlainWords(filePath) {

    if (
        !fs.existsSync(filePath)
    ) return new Set();

    return new Set(
        fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .split(/\r?\n/)
            .map(value =>
                normalizeWord(
                    value.replace(/-/g, " ")
                )
            )
            .filter(Boolean)
    );
}

function readPlainWordLines(
    filePath,
    wordSources,
    source
) {

    if (
        !fs.existsSync(filePath)
    ) return;

    const lines =
        fs
            .readFileSync(
                filePath,
                "utf8"
            )
            .split(/\r?\n/);

    for (const line of lines) {

        addWord(
            wordSources,
            line,
            source
        );
    }
}

function firstToken(word) {

    return word
        .split(" ")
        .at(0);
}

function lastToken(word) {

    return word
        .split(" ")
        .at(-1);
}

function sortVi(words) {

    return words.sort((a, b) =>
        a.localeCompare(
            b,
            "vi"
        )
    );
}

function writeList(
    filePath,
    words
) {

    fs.writeFileSync(
        filePath,
        `${sortVi(words).join("\n")}\n`,
        "utf8"
    );
}

function sourceConfidenceCount(sources) {

    return new Set(
        Array
            .from(sources)
            .map(source =>
                source === "wordswiki"
                    ? "wiktionary"
                    : source
            )
    ).size;
}

const wordSources = new Map();

if (
    !buildSourceFiles.some(filePath =>
        fs.existsSync(filePath)
    )
) {

    console.error(
        "Không tìm thấy dữ liệu nguồn trong data/. Khôi phục các file nguồn trước khi build lại words*.txt."
    );

    process.exit(1);
}

readSerializedStrings(
    vnCoreFile,
    wordSources,
    "vncorenlp"
);

readJsonLines(
    path.join(
        undertheseaDir,
        "tudientv",
        "words.txt"
    ),
    wordSources,
    "tudientv"
);

readJsonLines(
    path.join(
        undertheseaDir,
        "wiktionary",
        "words.txt"
    ),
    wordSources,
    "wiktionary"
);

readJsonTextLines(
    wordsWikiFile,
    wordSources,
    "wordswiki"
);

readPlainWordLines(
    viet74kFile,
    wordSources,
    "viet74k"
);

for (
    const word of readPlainWords(customFile)
) {

    addWord(
        wordSources,
        word,
        "custom"
    );
}

for (
    const word of readPlainWords(manualFile)
) {

    addWord(
        wordSources,
        word,
        "manual"
    );
}

function isAllowedBySource(word) {

    const sources =
        wordSources.get(word);

    if (
        sources.size === 1 &&
        sources.has("wiktionary")
    ) return false;

    return true;
}

const words =
    Array.from(
        wordSources.keys()
    ).filter(isAllowedBySource);

const byFirstToken = new Map();

for (
    const word of words
) {

    const first =
        firstToken(word);

    if (
        !byFirstToken.has(first)
    ) {

        byFirstToken.set(
            first,
            new Set()
        );
    }

    byFirstToken
        .get(first)
        .add(word);
}

const easy = [];
const medium = [];
const hard = [];
const dead = [];
const nextCounts = new Map();
const commonWords =
    readPlainWords(commonFile);
const stats = [
    "word\tlevel\tnext_count\tsources"
];

for (
    const word of words
) {

    const nextCount =
        byFirstToken
            .get(lastToken(word))
            ?.size || 0;

    const sourceCount =
        sourceConfidenceCount(
            wordSources
                .get(word)
        );

    nextCounts.set(
        word,
        nextCount
    );

    let level;

    if (
        nextCount >= 20 &&
        sourceCount >= 2
    ) {

        level = "easy";
        easy.push(word);

    } else if (
        nextCount >= 8
    ) {

        level = "medium";
        medium.push(word);

    } else if (
        nextCount >= 1
    ) {

        level = "hard";
        hard.push(word);

    } else {

        level = "dead";
        dead.push(word);
    }

    stats.push(
        [
            word,
            level,
            nextCount,
            Array
                .from(wordSources.get(word))
                .sort()
                .join(",")
        ].join("\t")
    );
}

writeList(
    outputs.all,
    [
        ...easy,
        ...medium,
        ...hard
    ]
);

const startWords = easy.filter(word =>
    commonWords.has(word) &&
    word.split(" ").length === 2 &&
    nextCounts.get(word) >= 30
);

writeList(
    outputs.start,
    startWords
);

writeList(
    outputs.easy,
    easy
);

writeList(
    outputs.medium,
    medium
);

writeList(
    outputs.hard,
    hard
);

writeList(
    outputs.dead,
    dead
);

fs.writeFileSync(
    outputs.stats,
    `${stats.join("\n")}\n`,
    "utf8"
);

console.log(
    [
        `All playable: ${easy.length + medium.length + hard.length}`,
        `Start random: ${startWords.length}`,
        `Easy: ${easy.length}`,
        `Medium: ${medium.length}`,
        `Hard: ${hard.length}`,
        `Dead/excluded: ${dead.length}`
    ].join("\n")
);
