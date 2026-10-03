require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { JWT } = require("google-auth-library");
const { GoogleSpreadsheet } = require("google-spreadsheet");

let docInstance = null;
let initPromise = null;

async function getDoc() {
    if (docInstance) return docInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const spreadsheetId = process.env.SPREADSHEET_ID;
        if (!spreadsheetId) {
            throw new Error("Chưa cấu hình SPREADSHEET_ID trong file .env");
        }

        const credsPath = path.resolve(
            __dirname,
            "..",
            process.env.GOOGLE_CREDENTIALS_FILE || "google-credentials.json"
        );

        if (!fs.existsSync(credsPath)) {
            throw new Error(`Không tìm thấy file credentials tại: ${credsPath}`);
        }

        const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));

        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
        await doc.loadInfo();
        docInstance = doc;
        console.log(`✅ Đã kết nối Google Sheet thành công: "${doc.title}"`);
        return doc;
    })();

    try {
        return await initPromise;
    } finally {
        initPromise = null;
    }
}

async function getSheet(sheetTitle) {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
        throw new Error(`Không tìm thấy tab "${sheetTitle}" trong Google Sheet.`);
    }
    return sheet;
}

/*
=====================================================
1. WORDS
=====================================================
*/

async function getAllWords() {
    try {
        const sheet = await getSheet("Words");
        const rows = await sheet.getRows();
        return rows
            .filter(row => row.get("status") !== "inactive" && row.get("status") !== "rejected")
            .map(row => ({
                id: row.get("id"),
                word: String(row.get("word") || "").trim().toLowerCase(),
                addedBy: row.get("added_by"),
                status: row.get("status"),
                createdAt: row.get("created_at")
            }))
            .filter(item => Boolean(item.word));
    } catch (err) {
        console.error("Lỗi khi đọc Words từ Google Sheet:", err);
        return [];
    }
}

async function addWordToSheet({ word, addedBy }) {
    const sheet = await getSheet("Words");
    const rows = await sheet.getRows();

    const normalized = String(word || "").trim().toLowerCase();
    const existed = rows.some(r => String(r.get("word") || "").trim().toLowerCase() === normalized);
    if (existed) {
        return { ok: false, existed: true };
    }

    // Tính ID lớn nhất hiện tại
    let maxId = 0;
    for (const row of rows) {
        const idVal = Number.parseInt(row.get("id"), 10);
        if (Number.isFinite(idVal) && idVal > maxId) {
            maxId = idVal;
        }
    }
    const nextId = maxId + 1;

    const newRow = await sheet.addRow({
        id: nextId,
        word: normalized,
        added_by: String(addedBy || ""),
        status: "active",
        created_at: new Date().toISOString()
    });

    return {
        ok: true,
        id: nextId,
        word: normalized,
        addedBy,
        createdAt: newRow.get("created_at")
    };
}

/*
=====================================================
2. QR
=====================================================
*/

async function getQRList({ guildId, userId = null }) {
    try {
        const sheet = await getSheet("QR");
        const rows = await sheet.getRows();

        return rows
            .filter(row => {
                const gId = String(row.get("guild_id") || "").trim();
                if (guildId && gId !== String(guildId)) return false;

                if (userId) {
                    const uId = String(row.get("user_id") || "").trim();
                    if (uId !== String(userId)) return false;
                }
                return true;
            })
            .map(row => ({
                id: row.get("id"),
                guildId: row.get("guild_id"),
                userId: row.get("user_id"),
                name: row.get("name"),
                messageId: row.get("message_id"),
                imageUrl: row.get("image_url"),
                createdAt: row.get("created_at")
            }));
    } catch (err) {
        console.error("Lỗi khi đọc QR từ Google Sheet:", err);
        return [];
    }
}

async function addQRToSheet({ guildId, userId, name, messageId, imageUrl }) {
    const sheet = await getSheet("QR");
    const rows = await sheet.getRows();

    let maxId = 0;
    for (const row of rows) {
        const idVal = Number.parseInt(row.get("id"), 10);
        if (Number.isFinite(idVal) && idVal > maxId) {
            maxId = idVal;
        }
    }
    const nextId = maxId + 1;

    await sheet.addRow({
        id: nextId,
        guild_id: String(guildId),
        user_id: String(userId),
        name: String(name),
        message_id: String(messageId),
        image_url: String(imageUrl),
        created_at: new Date().toISOString()
    });

    return {
        ok: true,
        id: nextId,
        guildId,
        userId,
        name,
        messageId,
        imageUrl
    };
}

async function deleteQRFromSheet({ guildId, userId = null, qrId = null }) {
    const sheet = await getSheet("QR");
    const rows = await sheet.getRows();

    if (qrId) {
        const row = rows.find(r => {
            const matchesGuild = String(r.get("guild_id")) === String(guildId);
            const matchesId = String(r.get("id")) === String(qrId);
            const matchesUser = userId ? String(r.get("user_id")) === String(userId) : true;
            return matchesGuild && matchesId && matchesUser;
        });

        if (!row) {
            return { ok: false, notFound: true };
        }

        const deletedData = {
            id: row.get("id"),
            guildId: row.get("guild_id"),
            userId: row.get("user_id"),
            name: row.get("name"),
            messageId: row.get("message_id"),
            imageUrl: row.get("image_url")
        };

        await row.delete();
        return { ok: true, deletedQR: deletedData };
    }

    const userRows = rows.filter(r => 
        String(r.get("guild_id")) === String(guildId) && String(r.get("user_id")) === String(userId)
    );

    if (userRows.length === 0) {
        return { ok: false, notFound: true };
    }

    if (userRows.length > 1) {
        return {
            ok: false,
            multiple: true,
            qrs: userRows.map(r => ({
                id: r.get("id"),
                name: r.get("name"),
                messageId: r.get("message_id"),
                imageUrl: r.get("image_url")
            }))
        };
    }

    const singleRow = userRows[0];
    const deletedData = {
        id: singleRow.get("id"),
        guildId: singleRow.get("guild_id"),
        userId: singleRow.get("user_id"),
        name: singleRow.get("name"),
        messageId: singleRow.get("message_id"),
        imageUrl: singleRow.get("image_url")
    };

    await singleRow.delete();
    return { ok: true, deletedQR: deletedData };
}

/*
=====================================================
3. BIRTHDAYS
=====================================================
*/

async function getBirthdays({ guildId, userId = null }) {
    try {
        const sheet = await getSheet("Birthdays");
        const rows = await sheet.getRows();

        return rows
            .filter(row => {
                const gId = String(row.get("guild_id") || "").trim();
                if (guildId && gId !== String(guildId)) return false;

                if (userId) {
                    const uId = String(row.get("user_id") || "").trim();
                    if (uId !== String(userId)) return false;
                }
                return true;
            })
            .map(row => ({
                guildId: row.get("guild_id"),
                userId: row.get("user_id"),
                birthday: row.get("birthday"),
                enabled: row.get("enabled"),
                createdAt: row.get("created_at")
            }));
    } catch (err) {
        console.error("Lỗi khi đọc Birthdays từ Google Sheet:", err);
        return [];
    }
}

async function saveBirthdayToSheet({ guildId, userId, birthday }) {
    const sheet = await getSheet("Birthdays");
    const rows = await sheet.getRows();

    const existingRow = rows.find(
        r => String(r.get("guild_id")) === String(guildId) && String(r.get("user_id")) === String(userId)
    );

    if (existingRow) {
        existingRow.set("birthday", String(birthday));
        existingRow.set("enabled", "true");
        await existingRow.save();
        return { ok: true, updated: true };
    }

    await sheet.addRow({
        guild_id: String(guildId),
        user_id: String(userId),
        birthday: String(birthday),
        enabled: "true",
        created_at: new Date().toISOString()
    });

    return { ok: true, updated: false };
}

async function deleteBirthdayFromSheet({ guildId, userId }) {
    const sheet = await getSheet("Birthdays");
    const rows = await sheet.getRows();

    const row = rows.find(
        r => String(r.get("guild_id")) === String(guildId) && String(r.get("user_id")) === String(userId)
    );

    if (!row) {
        return { ok: false, notFound: true };
    }

    const birthdayVal = row.get("birthday");
    await row.delete();
    return { ok: true, deleted: true, birthday: birthdayVal };
}

/*
=====================================================
4. SERVERS
=====================================================
*/

async function upsertServer({ guildId, guildName, ownerId, joinedAt, enabled = true }) {
    try {
        const sheet = await getSheet("Servers");
        const rows = await sheet.getRows();

        const existingRow = rows.find(r => String(r.get("guild_id")) === String(guildId));
        if (existingRow) {
            existingRow.set("guild_name", guildName);
            existingRow.set("owner_id", String(ownerId));
            existingRow.set("enabled", String(enabled));
            await existingRow.save();
            return;
        }

        await sheet.addRow({
            guild_id: String(guildId),
            guild_name: guildName,
            owner_id: String(ownerId),
            joined_at: joinedAt ? new Date(joinedAt).toISOString() : new Date().toISOString(),
            enabled: String(enabled)
        });
    } catch (err) {
        console.error(`Lỗi cập nhật Server ${guildId} lên Google Sheet:`, err.message);
    }
}

/*
=====================================================
5. WORDGAME & USERS (Batch update support)
=====================================================
*/

async function updateWordGameStatus({ guildId, channelId, enabled, timeout = 60, difficulty = "normal", startedAt = null }) {
    try {
        const sheet = await getSheet("WordGame");
        const rows = await sheet.getRows();

        const existingRow = rows.find(r => String(r.get("guild_id")) === String(guildId));
        if (existingRow) {
            existingRow.set("channel_id", String(channelId));
            existingRow.set("enabled", String(enabled));
            existingRow.set("timeout", String(timeout));
            existingRow.set("difficulty", String(difficulty));
            if (startedAt) existingRow.set("started_at", new Date(startedAt).toISOString());
            await existingRow.save();
            return;
        }

        await sheet.addRow({
            guild_id: String(guildId),
            channel_id: String(channelId),
            enabled: String(enabled),
            timeout: String(timeout),
            difficulty: String(difficulty),
            started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString()
        });
    } catch (err) {
        console.error(`Lỗi cập nhật WordGame ${guildId} lên Google Sheet:`, err.message);
    }
}

module.exports = {
    getDoc,
    getAllWords,
    addWordToSheet,
    getQRList,
    addQRToSheet,
    deleteQRFromSheet,
    getBirthdays,
    saveBirthdayToSheet,
    deleteBirthdayFromSheet,
    upsertServer,
    updateWordGameStatus
};
