import crypto from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
const IV_LENGTH = 16; // For AES, this is always 16
const KEY = config.encryptionKey;

// Ensure key is 32 bytes (256 bits)
// If the provided key is shorter/longer, we'll hash it to get exactly 32 bytes
const getKey = () => {
    if (!KEY) throw new Error("ENCRYPTION_KEY is not defined");
    return crypto.createHash('sha256').update(String(KEY)).digest();
};

export const encrypt = (text) => {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString(ENCODING) + ':' + encrypted.toString(ENCODING);
    } catch (error) {
        console.error("Encryption error:", error);
        return null;
    }
};

export const decrypt = (text) => {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        // Handle legacy plaintext passwords (if any exist during migration)
        if (textParts.length < 2) return text;

        const iv = Buffer.from(textParts.shift(), ENCODING);
        const encryptedText = Buffer.from(textParts.join(':'), ENCODING);
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Decryption error:", error);
        // Fallback: return original text if decryption fails (assumes it might be plaintext)
        return text;
    }
};
