// Genera el valor de ADMIN_PASSWORD_HASH para el archivo .env
// Uso: node scripts/hash-password.js 'mi-contraseña-segura'
const crypto = require("crypto");

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Uso: node scripts/hash-password.js '<contraseña de al menos 12 caracteres>'");
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
