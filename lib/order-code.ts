import { randomInt } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Sin I ni O para que no se confundan con 1 y 0 al dictarlo o anotarlo
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export const ORDER_CODE_PATTERN = /^[A-Z]{2}[0-9]{4}$/;

function randomCode(): string {
  return (
    LETTERS[randomInt(LETTERS.length)] +
    LETTERS[randomInt(LETTERS.length)] +
    String(randomInt(10000)).padStart(4, "0")
  );
}

// Código de pedido único: 2 letras + 4 números al azar (la base además lo exige único)
export async function newOrderCode(db: Db): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    const used = await db.pecadoSale.findUnique({ where: { orderCode: code }, select: { id: true } });
    if (!used) return code;
  }
  throw new Error("ORDER_CODE_EXHAUSTED");
}
