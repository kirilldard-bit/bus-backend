const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {

  try {

    await ctx.replyWithPhoto(

      {
        url: 'https://buster-app-three.vercel.app/assets/welcome.jpeg'
      },

      {
        caption:
`🚀 Добро пожаловать в BUSTER

Помощник для водителей нового поколения.

Нажми кнопку ниже чтобы открыть приложение.`,

        ...Markup.inlineKeyboard([
          [
            Markup.button.webApp(
              '🚀 ОТКРЫТЬ BUSTER',
              'https://buster-app-three.vercel.app'
            )
          ]
        ])

      }

    );

  } catch (err) {

    console.log(err);

  }

});

bot.launch();

console.log('TELEGRAM BOT STARTED');