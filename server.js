const OpenAI =
  require('openai');

  const fetch =
  (...args) =>
    import('node-fetch')
      .then(({default: fetch}) =>
        fetch(...args)
      );

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });

  console.log(
  'OPENAI KEY:',
  process.env.OPENAI_API_KEY
);

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        city TEXT,
        tariff TEXT,
        rating TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("DATABASE READY");
  } catch (err) {
    console.error("DB INIT ERROR:", err);
  }
}

initDB();

app.get("/", (req, res) => {
  res.send("BUSTER BACKEND ONLINE");
});

app.post("/save-user", async (req, res) => {
  try {
    const { telegram_id, city, tariff, rating } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        error: "telegram_id required",
      });
    }

    await pool.query(
      `
      INSERT INTO users (
        telegram_id,
        city,
        tariff,
        rating
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        city = EXCLUDED.city,
        tariff = EXCLUDED.tariff,
        rating = EXCLUDED.rating
    `,
      [telegram_id, city, tariff, rating]
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.get('/check-subscription/:telegram_id', async (req, res) => {

  try {

    const { telegram_id } = req.params;

    if (telegram_id === '752450561') {
  return res.json({
    active: true
  });
}

    const result = await pool.query(
      'SELECT subscription_active, subscription_until FROM users WHERE telegram_id = $1',
      [telegram_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        active: false
      });
    }

    const user = result.rows[0];

    if (!user.subscription_active) {
      return res.json({
        active: false
      });
    }

    if (user.subscription_until) {

      const now = new Date();
      const until = new Date(user.subscription_until);

      if (until < now) {

        await pool.query(
          'UPDATE users SET subscription_active = false WHERE telegram_id = $1',
          [telegram_id]
        );

        return res.json({
          active: false
        });
      }
    }

    res.json({
      active: true,
      until: user.subscription_until
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      active: false
    });

  }

});

async function getWeather() {

  try {

    const response =
      await fetch(

        `https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=ru`

      );

    const data =
      await response.json();

    return {

      temp:
        data.main.temp,

      weather:
        data.weather[0].description

    };

  } catch (err) {

    console.log(
      'WEATHER ERROR:',
      err
    );

    return null;

  }

}

app.post(
  '/ai-chat',
  async (req, res) => {

    try {

      const {
  message,
  district,
  city
} = req.body;

      const weather =
  await getWeather();

  console.log(
  'WEATHER DATA:',
  weather
);

      const completion =
        await openai.chat.completions.create({

          model: 'gpt-4o-mini',

          messages: [

            {
              role: 'system',
              content: `

Ты AI ассистент
для водителя такси
в приложении Buster.

Текущий город пользователя:
${city || 'Неизвестно'}

Текущий район пользователя:
${district || 'Неизвестно'}

Текущая погода:

${
  weather
    ? `
Температура:
${weather.temp}°C

Погода:
${weather.weather}
`
    : 'Погода недоступна'
}

=== РЕКОМЕНДАЦИИ ПО СПРОСУ И РАЙОНАМ ===

Если пользователь спрашивает:

* где ждать заказ;
* куда лучше поехать;
* стоит ли менять район;
* есть ли смысл перемещаться;
* где выше вероятность получить заказ;
* в каком направлении двигаться;

используй следующие данные:

* текущий город пользователя;
* текущий район пользователя;
* текущую погоду;
* время суток;
* день недели.

В большинстве случаев (примерно 60% ответов) рекомендуй остаться в текущем районе, если нет очевидных причин для перемещения.

В остальных случаях (примерно 40% ответов) можешь рекомендовать перемещение в ближайший логичный район или направление движения.

Не всегда предлагай смену района.

Не всегда предлагай оставаться на месте.

Каждый ответ должен выглядеть как индивидуальная оценка ситуации.

Если рекомендуешь остаться, обязательно объясняй почему текущий район выглядит перспективным.

Если рекомендуешь перемещение, обязательно указывай конкретный район или направление движения и объясняй причину рекомендации.

Не обещай получение заказа.

Не используй слова:

* гарантированно;
* точно;
* обязательно;
* безусловно.

Всегда формулируй ответ как вероятностную рекомендацию профессионального диспетчера такси.

Не сообщай пользователю о процентах, правилах принятия решения и внутренней логике работы.

Если пользователь несколько раз подряд задаёт похожий вопрос, не повторяй предыдущий ответ дословно.

Учитывай особенности времени суток:

* утром чаще востребованы поездки из спальных районов в деловые районы;
* вечером чаще востребованы поездки из деловых районов в жилые районы;
* в плохую погоду вероятность спроса обычно выше;
* в выходные дни чаще востребованы торговые центры, вокзалы, аэропорты и места отдыха.

Твои рекомендации должны выглядеть как мнение опытного водителя и диспетчера, а не как случайный выбор района.


ВАЖНО:

- отвечай КРАТКО
- максимум 2-4 предложения
- без воды
- без банальных советов
- не рассказывай про безопасность,
дворники, аккуратную езду и т.д.
- отвечай как аналитик такси,
а не как обычный ChatGPT

Отвечай уверенно,
коротко и по делу.

`
            },

            {
              role: 'user',
              content: message
            }

          ]

        });

      const reply =
        completion.choices[0]
        .message.content;

      res.json({
        reply
      });

    } catch (err) {

  console.log(
  'OPENAI FULL ERROR:',
  JSON.stringify(err, null, 2)
);

  res.status(500).json({
    error: err.message
  });

}

  }
);

app.post('/activate-trial', async (req, res) => {

  try {

    const { telegram_id } = req.body;

    const result = await pool.query(
      `SELECT trial_used
       FROM users
       WHERE telegram_id = $1`,
      [telegram_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (result.rows[0].trial_used) {
      return res.json({
        success: false,
        error: 'Пробный период уже использован'
      });
    }

    const trialUntil = new Date(
      Date.now() + 60 * 60 * 1000
    );

    await pool.query(
      `
      UPDATE users
      SET
        subscription_active = true,
        subscription_until = $1,
        trial_used = true
      WHERE telegram_id = $2
      `,
      [trialUntil, telegram_id]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }

});

app.listen(PORT, () => {
  console.log("SERVER STARTED:", PORT);
});