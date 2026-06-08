const fs = require("fs");
const path = require("path");

const rootDir = path.join(
    __dirname,
    ".."
);

const ver2BotDir =
    process.env.WORDCONNECT_VER2_BOT_DIR ||
    "F:/Noi-tu-ver2/bot";

const graphInputFile = path.join(
    ver2BotDir,
    "wordPairs.json"
);

const learnedWordsFile = path.join(
    ver2BotDir,
    "learned-words.json"
);

const startWordsFile = path.join(
    ver2BotDir,
    "words-start.json"
);

const outputGraphFile = path.join(
    rootDir,
    "data",
    "wordconnect-pairs.json"
);

const outputStartWordsFile = path.join(
    rootDir,
    "data",
    "wordconnect-start-words.json"
);

function normalizeWord(value) {

    return String(value || "")
        .normalize("NFC")
        .toLowerCase()
        .replace(/[!,.?]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function readJson(
    filePath,
    fallback
) {

    try {

        return JSON.parse(
            fs.readFileSync(
                filePath,
                "utf8"
            )
        );

    } catch {

        return fallback;
    }
}

const graph =
    new Map();

function addPair(
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

    const values =
        graph.get(cleanFirst);

    const existed =
        values.has(cleanSecond);

    values.add(cleanSecond);

    return !existed;
}

function addPhrase(phrase) {

    const parts =
        normalizeWord(phrase)
            .split(" ")
            .filter(Boolean);

    if (
        parts.length !== 2
    ) return false;

    return addPair(
        parts[0],
        parts[1]
    );
}

if (
    !fs.existsSync(graphInputFile)
) {

    console.error(
        `Không tìm thấy ${graphInputFile}. Đặt WORDCONNECT_VER2_BOT_DIR nếu bot ver2 nằm ở thư mục khác.`
    );

    process.exit(1);
}

let addedFromGraph = 0;
let addedFromExistingGraph = 0;

for (
    const [first, seconds] of Object.entries(
        readJson(
            outputGraphFile,
            {}
        )
    )
) {

    if (
        !Array.isArray(seconds)
    ) continue;

    for (const second of seconds) {

        if (
            addPair(
                first,
                second
            )
        ) {

            addedFromExistingGraph += 1;
        }
    }
}

for (
    const [first, seconds] of Object.entries(
        readJson(
            graphInputFile,
            {}
        )
    )
) {

    if (
        !Array.isArray(seconds)
    ) continue;

    for (const second of seconds) {

        if (
            addPair(
                first,
                second
            )
        ) {

            addedFromGraph += 1;
        }
    }
}

let addedFromLearnedWords = 0;

for (
    const word of readJson(
        learnedWordsFile,
        []
    )
) {

    if (
        addPhrase(word)
    ) {

        addedFromLearnedWords += 1;
    }
}

const outputGraph = {};

for (
    const first of Array
        .from(graph.keys())
        .sort((left, right) =>
            left.localeCompare(
                right,
                "vi"
            )
        )
) {

    outputGraph[first] =
        Array
            .from(graph.get(first))
            .sort((left, right) =>
                left.localeCompare(
                    right,
                    "vi"
                )
            );
}

const startWords =
    Array
        .from(
            new Set(
                readJson(
                    startWordsFile,
                    []
                )
                    .map(normalizeWord)
            )
        )
        .filter(word => {

            const parts =
                word.split(" ");

            return parts.length === 2 &&
                graph.get(parts[0])?.has(parts[1]);
        })
        .sort((left, right) =>
            left.localeCompare(
                right,
                "vi"
            )
        );

fs.mkdirSync(
    path.dirname(outputGraphFile),
    {
        recursive: true
    }
);

fs.writeFileSync(
    outputGraphFile,
    `${JSON.stringify(outputGraph, null, 2)}\n`,
    "utf8"
);

fs.writeFileSync(
    outputStartWordsFile,
    `${JSON.stringify(startWords, null, 2)}\n`,
    "utf8"
);

let edgeCount = 0;

for (const values of graph.values()) {

    edgeCount += values.size;
}

console.log(
    [
        `Graph keys: ${graph.size}`,
        `Graph pairs: ${edgeCount}`,
        `Start words: ${startWords.length}`,
        `Seeded from existing graph: ${addedFromExistingGraph}`,
        `Added from graph: ${addedFromGraph}`,
        `Added from learned words: ${addedFromLearnedWords}`
    ].join("\n")
);
