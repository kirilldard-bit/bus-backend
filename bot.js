const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {

  try {

    await ctx.replyWithPhoto(

      {
        source: './welcome.jpg'
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
  ],

  [
    Markup.button.url(
      '📄 Политика',
      'https://buster-app-three.vercel.app/privacy.html'
    ),

    Markup.button.url(
      '📑 Оферта',
      'https://buster-app-three.vercel.app/oferta.html'
    )
  ],

  [
    Markup.button.url(
      '📞 Поддержка',
      'https://t.me/buster_support'
    ),

    Markup.button.url(
      '📢 Новости',
      'https://t.me/buster_chanel'
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