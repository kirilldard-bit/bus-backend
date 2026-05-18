bot.start(async (ctx) => {

  await ctx.replyWithPhoto(

    {
      url: 'https://buster-app-three.vercel.app/assets/welcome.png'
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

});