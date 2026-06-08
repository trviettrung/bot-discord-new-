const fs = require("fs");
const path = require("path");

const rootDir = path.join(
    __dirname,
    "..",
    ".."
);

const wordsFile = path.join(
    rootDir,
    "words.txt"
);

const deadWordsFile = path.join(
    rootDir,
    "words-dead.txt"
);

const easyWordsFile = path.join(
    rootDir,
    "words-easy.txt"
);

const startWordsFile = path.join(
    rootDir,
    "words-start.txt"
);

const manualWordsFile = path.resolve(
    process.env.WORDCONNECT_MANUAL_WORDS_FILE ||
    path.join(
        rootDir,
        "data",
        "manual-words.txt"
    )
);

const vietnameseLetters =
    "a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ";

const manualWordPattern = new RegExp(
    `^[${vietnameseLetters}]+ [${vietnameseLetters}]+$`,
    "i"
);

const dictionaryWords = loadDictionary();
const deadWords = loadDeadWords();
const dictionary = new Set(
    [
        ...dictionaryWords,
        ...deadWords
    ]
);
const deadDictionary = new Set(
    deadWords
);
const wordsByFirstWord = buildWordsByFirstWord(
    dictionary
);
const randomWords = loadRandomWords();

function loadWords(filePath) {

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

function loadDictionary() {

    return [
        ...loadWords(
            wordsFile
        ),
        ...loadWords(
            manualWordsFile
        )
    ];
}

function loadDeadWords() {

    return loadWords(
        deadWordsFile
    );
}

function loadRandomWords() {

    const startWords =
        loadWords(
            startWordsFile
        );

    if (
        startWords.length > 0
    ) return startWords;

    const easyWords =
        loadWords(
            easyWordsFile
        );

    if (
        easyWords.length > 0
    ) return easyWords;

    return dictionaryWords;
}

function normalizeWord(text) {

    return text
        .normalize("NFC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function isKnownWord(text) {

    return dictionary.has(
        normalizeWord(text)
    );
}

function isDeadWord(text) {

    return deadDictionary.has(
        normalizeWord(text)
    );
}

function isTwoWord(text) {

    return normalizeWord(text)
        .split(" ")
        .length === 2;
}

function isValidManualWord(text) {

    return manualWordPattern.test(
        normalizeWord(text)
    );
}

function getRandomWord() {

    if (
        randomWords.length === 0
    ) return null;

    const index =
        Math.floor(
            Math.random() *
            randomWords.length
        );

    return randomWords[index];
}

function getLastWord(text) {

    return normalizeWord(text)
        .split(" ")
        .pop();
}

function getFirstWord(text) {

    return normalizeWord(text)
        .split(" ")
        .at(0);
}

function buildWordsByFirstWord(words) {

    const map =
        new Map();

    for (const word of words) {

        const firstWord =
            getFirstWord(word);

        if (
            !map.has(firstWord)
        ) {

            map.set(
                firstWord,
                []
            );
        }

        map
            .get(firstWord)
            .push(word);
    }

    return map;
}

function getNextWords(text) {

    const lastWord =
        getLastWord(text);

    return [
        ...(
            wordsByFirstWord.get(lastWord) ||
            []
        )
    ];
}

function getNextWordCount(text) {

    return getNextWords(text).length;
}

function readWordSet(filePath) {

    return new Set(
        loadWords(filePath)
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

    dictionary.add(word);
    dictionaryWords.push(word);

    const firstWord =
        getFirstWord(word);

    if (
        !wordsByFirstWord.has(firstWord)
    ) {

        wordsByFirstWord.set(
            firstWord,
            []
        );
    }

    if (
        !wordsByFirstWord
            .get(firstWord)
            .includes(word)
    ) {

        wordsByFirstWord
            .get(firstWord)
            .push(word);
    }
}

function saveKnownWord(text) {

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
        dictionary.has(word)
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

    const lastWord =
        getLastWord(currentWord);

    const firstWord =
        normalizeWord(input)
            .split(" ")
            .at(0);

    return firstWord === lastWord;
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
    checkConnect
};
