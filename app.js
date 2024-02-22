import { Telegraf } from "telegraf";
import { message } from "telegraf/filters"
import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import zenith from "./zenith.js"

dotenv.config();

const prisma = new PrismaClient();

const bot = new Telegraf(process.env.TG_TOKEN);

async function getOrCreate(userid) {
  let search = await prisma.user.findUnique({ where: { id: userid } });
  if (!search) search = await prisma.user.create({ data: { id: userid } });

  return search;
}

bot.command("neinnein", async (ctx) => {
  await ctx.reply("Oke, schick mir den Sticker den ich verbieten soll!");
  const user = await getOrCreate(ctx.message.from.id);

  await prisma.listener.create({
    data: {
      user: { connect: { id: user.id } },
      action: "DISALLOW"
    }
  });
});

bot.command("jaja", async (ctx) => {
  await ctx.reply("Oke, schick mir den Sticker den ich freigeben soll!");
  const user = await getOrCreate(ctx.message.from.id);

  await prisma.listener.create({
    data: {
      user: { connect: { id: user.id } },
      action: "ALLOW"
    }
  });
});

bot.on(message("sticker"), async (ctx) => {
  let userId = ctx.message.from.id;
  let stickerId = ctx.message.sticker.file_unique_id;

  const listener = await prisma.listener.findUnique({ where: { userId: userId } });

  // checke ob listener auf eine eingabe warten
  if (listener) {
    const result = await prisma.sticker.upsert({
      where: { id: stickerId },
      update: { allowed: (listener.action === "ALLOW") },
      create: {
        id: stickerId,
        allowed: (listener.action === "ALLOW")
      },
    });

    await ctx.reply("Oke, der Sticker wird " + (result.allowed ? "nicht mehr" : "jetzt") + " geahndet");

    await prisma.listener.delete({ where: { id: listener.id } });
  } else {
    // frage den sticker ab
    let stickerResult = await prisma.sticker.findUnique({ where: { id: stickerId } });

    // sollte der sticker nicht vermerkt sein, evaluiere ihn zunächst
    if (!stickerResult) {
      // abuse zenith
      const stickerEval = await zenith.evaluate(ctx);
      const stickerIsAllowed = await (stickerEval[0].error ? true : (await zenith.isAllowed(stickerEval)));

      stickerResult = await prisma.sticker.create({
        data: {
          id: stickerId,
          used: 1,
          allowed: stickerIsAllowed,
          evaluation: stickerEval
        }
      });
    } else {
      // zähle die nutzungen
      await prisma.sticker.update({
        where: { id: stickerId },
        data: { used: { increment: 1 } }
      })
    }

    if (!stickerResult || stickerResult.allowed) return;

    // update den user
    const update = await prisma.user.upsert({
      where: { id: userId, immune: false },
      update: {
        infractions: { increment: 1 }
      },
      create: {
        id: userId,
        infractions: 1
      }
    });

    await ctx.reply("BÖSE! HIER WIRD NICHT GESABBERT!\nDu wurdest schon " + update.infractions + "mal beim Sabbern erwischt.");
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));