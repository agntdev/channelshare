import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

interface ManagedChannel {
  id: number;
  title: string;
  username?: string;
  invite_link?: string;
}

function buildChannelLink(ch: ManagedChannel): string {
  if (ch.username) return `https://t.me/${ch.username}`;
  if (ch.invite_link) return ch.invite_link;
  return `tg://chat?id=${ch.id}`;
}

function formatChannelList(channels: ManagedChannel[]): string {
  if (channels.length === 0) {
    return "No channels found. Make sure I'm added as an admin to the channels you want to list.";
  }
  const lines = channels.map((ch, i) => {
    const link = buildChannelLink(ch);
    return `${i + 1}. <b>${ch.title}</b>\n   <a href="${link}">${link}</a>`;
  });
  return `Found ${channels.length} channel${channels.length === 1 ? "" : "s"}:\n\n${lines.join("\n\n")}`;
}

async function fetchManagedChannels(ctx: Ctx): Promise<ManagedChannel[]> {
  try {
    const token = (ctx.api as unknown as { token: string }).token;
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/getMyChannels`,
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      ok: boolean;
      result?: Array<{
        id: number;
        title: string;
        username?: string;
      }>;
    };
    if (!data.ok || !data.result) return [];
    return data.result.map((ch) => ({
      id: ch.id,
      title: ch.title,
      username: ch.username,
    }));
  } catch {
    return [];
  }
}

async function enrichChannelLinks(
  ctx: Ctx,
  channels: ManagedChannel[],
): Promise<ManagedChannel[]> {
  const enriched: ManagedChannel[] = [];
  for (const ch of channels) {
    try {
      const chatInfo = await ctx.api.getChat(ch.id);
      enriched.push({
        ...ch,
        invite_link:
          "invite_link" in chatInfo ? chatInfo.invite_link : undefined,
      });
    } catch {
      enriched.push(ch);
    }
  }
  return enriched;
}

function buildChannelKeyboard(channels: ManagedChannel[]) {
  const rows = channels.map((ch) => [
    inlineButton(ch.title, `lc:select:${ch.id}`),
  ]);
  rows.push([inlineButton("Send to DM only", "lc:post:dm")]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  return inlineKeyboard(rows);
}

const composer = new Composer<Ctx>();

composer.command("list_channels", async (ctx) => {
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

composer.callbackQuery("list_channels:fetch", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Fetching channels…" });

  const raw = await fetchManagedChannels(ctx);
  const channels = await enrichChannelLinks(ctx, raw);

  if (!ctx.session.listChannels) {
    ctx.session.listChannels = { channels: [] };
  }
  ctx.session.listChannels.channels = channels;

  if (channels.length === 0) {
    await ctx.editMessageText(
      "I couldn't find any channels where I'm an admin.\n\nTo use this feature, add me as an administrator to the channels you want to list, then try again.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  const text = formatChannelList(channels);
  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: buildChannelKeyboard(channels),
  });
});

composer.callbackQuery(/^lc:select:(-?\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const channelId = Number(ctx.match[1]);
  const session = ctx.session.listChannels;
  if (!session?.channels?.length) {
    await ctx.editMessageText("Session expired. Tap /start to begin again.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  session.selectedChannelId = channelId;
  session.postingTarget = "both";

  const ch = session.channels.find((c) => c.id === channelId);
  const channelName = ch?.title ?? "the selected channel";

  await ctx.editMessageText(
    `Send the channel list to <b>${channelName}</b> and your DM?`,
    {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard([
        [
          inlineButton("✅ Confirm", "lc:confirm"),
          inlineButton("Cancel", "lc:cancel"),
        ],
      ]),
    },
  );
});

composer.callbackQuery("lc:post:dm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const session = ctx.session.listChannels;
  if (!session?.channels?.length) {
    await ctx.editMessageText("Session expired. Tap /start to begin again.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  session.postingTarget = "dm";

  const text = formatChannelList(session.channels);
  await ctx.reply(text, { parse_mode: "HTML" });
  await ctx.editMessageText("Channel list sent to your DM.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("lc:confirm", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Sending…" });
  const session = ctx.session.listChannels;
  if (!session?.channels?.length) {
    await ctx.editMessageText("Session expired. Tap /start to begin again.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const text = formatChannelList(session.channels);

  await ctx.reply(text, { parse_mode: "HTML" });

  if (
    session.postingTarget === "both" ||
    session.postingTarget === "channel"
  ) {
    const channelId = session.selectedChannelId;
    if (channelId) {
      try {
        await ctx.api.sendMessage(channelId, text, { parse_mode: "HTML" });
      } catch {
        await ctx.reply(
          "Couldn't post to the selected channel. Make sure I'm an admin there with posting rights.",
        );
      }
    }
  }

  await ctx.editMessageText("Channel list sent!", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("lc:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Cancelled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
