import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({
  label: "📋 Share my channels",
  data: "list_channels:start",
  order: 10,
});

const composer = new Composer<Ctx>();

composer.callbackQuery("list_channels:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "I'll gather links to all the channels you manage and send them here.\n\nTap below to continue.",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🔗 List my channels", "list_channels:fetch")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
