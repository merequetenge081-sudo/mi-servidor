import crypto from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

export function generateTemporaryPassword(length = 12) {
  const finalLength = Math.max(8, length);
  const password = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];

  while (password.length < finalLength) {
    password.push(pick(ALL));
  }

  return shuffle(password).join("");
}

