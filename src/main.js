import {Telegraf, session} from "telegraf";
import {message} from "telegraf/filters"
import {code} from "telegraf/format"
import config from "config"
import {ogg} from "./ogg.js"
import {openai} from "./openai.js";
import {removeFile} from "./utils.js";

const INITIAL_SESSION = {
  messages: []
}

const bot = new Telegraf(config.get("TELEGRAM_TOKEN"))

const checkAuthorization = async (ctx, next) => {
  config.get("AUTHORISED_USERS").includes(ctx.from.id)
    ? await next()
    : await ctx.reply(code('You are not authorized to use this bot.'))
}

bot.use(session())
bot.use(checkAuthorization)

bot.command('start', async (ctx) => {
  ctx.session = {messages: []}
  await ctx.reply(`${ctx.from.username}, welcome to the GPT Voice Bot!`)
  await ctx.reply(code('Send me a voice message or text message'))
})

bot.command('new', async (ctx) => {
  ctx.session = {messages: []}
  await ctx.reply(code('Send me a voice message or text message'))
})

bot.command('help', async (ctx) => {
  const commands = [
    '/start - start bot',
    '/new - start a new session',
    '/help - show list of commands',
  ];
  const message = `List of available commands:\n${commands.join('\n')}`;
  ctx.reply(message);
})

bot.on(message('voice'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION
  try {
    await ctx.reply(code("Your voice message is processing..."))
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = String(ctx.message.from.id)
    const oggPath = await ogg.create(link.href, userId)
    const mp3Path = await ogg.toMp3(oggPath, userId)

    const text = await openai.transcription(mp3Path)
    console.log(`${userId}: ${text}`)

    ctx.session.messages.push({role: openai.roles.USER, content: text})
    const response = await openai.chat(ctx.session.messages)
    ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

    await ctx.reply(response.content)
    await removeFile(mp3Path)
  } catch (e) {
    console.log(`Error while voice message`, e.message)
  }
})

bot.on(message('text'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION
  try {
    // if first symbol is /, then don't process it as text message
    if (ctx.message.text[0] === '/') {
      return
    }
    await ctx.reply(code("Your text message is processing..."))
    console.log(`${ctx.message.from.id}: ${ctx.message.text}`)
    ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})
    const response = await openai.chat(ctx.session.messages)
    ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

    await ctx.reply(response.content)
  } catch (e) {
    console.log(`Error while text message`, e.message)
  }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

