import { eq, lt, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@trackingext/db";
import { lanPairing, lanSignal } from "@trackingext/db/schema/tracked";

import { createId } from "../lib/ids";
import { publicProcedure } from "../index";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const SIGNAL_TTL_MS = 15 * 60 * 1000;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function purgeExpiredPairings() {
  await db.delete(lanPairing).where(lt(lanPairing.expiresAt, new Date()));
}

async function purgeExpiredSignals() {
  const cutoff = new Date(Date.now() - SIGNAL_TTL_MS);
  await db.delete(lanSignal).where(lt(lanSignal.createdAt, cutoff));
}

export const lanSyncRouter = {
  createPairing: publicProcedure
    .input(
      z.object({
        initiatorDeviceId: z.string().min(1),
        initiatorDeviceName: z.string().min(1).max(120),
        offerSdp: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      await purgeExpiredPairings();

      let code = generateCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
          await db.insert(lanPairing).values({
            code,
            initiatorDeviceId: input.initiatorDeviceId,
            initiatorDeviceName: input.initiatorDeviceName,
            offerSdp: input.offerSdp,
            status: "pending",
            expiresAt,
          });
          return {
            code,
            expiresAt: expiresAt.toISOString(),
          };
        } catch {
          code = generateCode();
        }
      }

      throw new Error("Could not create pairing session");
    }),

  getPairing: publicProcedure
    .input(z.object({ code: z.string().length(6) }))
    .handler(async ({ input }) => {
      await purgeExpiredPairings();
      const row = await db.query.lanPairing.findFirst({
        where: eq(lanPairing.code, input.code),
      });
      if (!row || row.status !== "pending" || row.expiresAt < new Date()) {
        return null;
      }
      return {
        code: row.code,
        initiatorDeviceId: row.initiatorDeviceId,
        initiatorDeviceName: row.initiatorDeviceName,
        offerSdp: row.offerSdp,
        expiresAt: row.expiresAt.toISOString(),
      };
    }),

  completePairing: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
        joinerDeviceId: z.string().min(1),
        joinerDeviceName: z.string().min(1).max(120),
        answerSdp: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      await purgeExpiredPairings();
      const row = await db.query.lanPairing.findFirst({
        where: eq(lanPairing.code, input.code),
      });
      if (!row || row.status !== "pending" || row.expiresAt < new Date()) {
        throw new Error("Pairing code expired or not found");
      }

      await db
        .update(lanPairing)
        .set({
          joinerDeviceId: input.joinerDeviceId,
          joinerDeviceName: input.joinerDeviceName,
          answerSdp: input.answerSdp,
          status: "complete",
        })
        .where(eq(lanPairing.code, input.code));

      return {
        initiatorDeviceId: row.initiatorDeviceId,
        initiatorDeviceName: row.initiatorDeviceName,
      };
    }),

  pollPairingAnswer: publicProcedure
    .input(z.object({ code: z.string().length(6), initiatorDeviceId: z.string().min(1) }))
    .handler(async ({ input }) => {
      await purgeExpiredPairings();
      const row = await db.query.lanPairing.findFirst({
        where: eq(lanPairing.code, input.code),
      });
      if (!row || row.initiatorDeviceId !== input.initiatorDeviceId) {
        return null;
      }
      if (row.status !== "complete" || !row.answerSdp || !row.joinerDeviceId) {
        return null;
      }

      await db.delete(lanPairing).where(eq(lanPairing.code, input.code));

      return {
        joinerDeviceId: row.joinerDeviceId,
        joinerDeviceName: row.joinerDeviceName ?? "Paired device",
        answerSdp: row.answerSdp,
      };
    }),

  postSignal: publicProcedure
    .input(
      z.object({
        fromDeviceId: z.string().min(1),
        toDeviceId: z.string().min(1),
        kind: z.enum(["offer", "answer", "ice"]),
        payload: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      await purgeExpiredSignals();
      const id = createId("sig");
      await db.insert(lanSignal).values({
        id,
        fromDeviceId: input.fromDeviceId,
        toDeviceId: input.toDeviceId,
        kind: input.kind,
        payload: input.payload,
        createdAt: new Date(),
      });
      return { id };
    }),

  pollSignals: publicProcedure
    .input(z.object({ deviceId: z.string().min(1) }))
    .handler(async ({ input }) => {
      await purgeExpiredSignals();
      const rows = await db.query.lanSignal.findMany({
        where: eq(lanSignal.toDeviceId, input.deviceId),
        limit: 50,
      });
      if (rows.length > 0) {
        await db.delete(lanSignal).where(inArray(lanSignal.id, rows.map((row) => row.id)));
      }
      return rows.map((row) => ({
        id: row.id,
        fromDeviceId: row.fromDeviceId,
        kind: row.kind,
        payload: row.payload,
      }));
    }),
};
