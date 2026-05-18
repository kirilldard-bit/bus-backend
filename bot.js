const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {

  await ctx.reply(

`🚀 Добро пожаловать в BUSTER

Инструмент для водителей нового поколения.

• аналитика
• маршруты
• статистика
• настройки профиля

Нажми кнопку ниже чтобы открыть приложение.`,

    Markup.inlineKeyboard([
      [
        Markup.button.webApp(
          '🚀 ОТКРЫТЬ BUSTER',
          'https://buster-app-three.vercel.app'
        )
      ]
    ])

  );

});

bot.launch();

console.log('TELEGRAM BOT STARTED');