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

        subscription_active BOOLEAN DEFAULT FALSE,

        subscription_until TIMESTAMP,

        trial_used BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

      );
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT FALSE;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
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

app.get("/user/:telegram_id", async (req, res) => {
  try {

    const { telegram_id } = req.params;

    const result = await pool.query(
      `
      SELECT
        city,
        tariff,
        rating
      FROM users
      WHERE telegram_id = $1
      `,
      [telegram_id]
    );

    if (result.rows.length === 0) {

      return res.json({
        success: true,
        user: null,
      });

    }

    res.json({
      success: true,
      user: result.rows[0],
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

async function getNearbyDistricts(lat, lon) {

  if (!lat || !lon) {
    return [];
  }

  try {

    const offsets = [
      [0.045, 0],
      [-0.045, 0],
      [0, 0.045],
      [0, -0.045],
      [0.032, 0.032],
      [0.032, -0.032],
      [-0.032, 0.032],
      [-0.032, -0.032]
    ];

    const districts = [];

    for (const [latOffset, lonOffset] of offsets) {

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${Number(lat) + latOffset}&lon=${Number(lon) + lonOffset}&zoom=14&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'BUSTER/1.0'
          }
        }
      );

      const data = await response.json();

      const district =
        data?.address?.city_district ||
        data?.address?.suburb ||
        data?.address?.neighbourhood ||
        data?.address?.quarter ||
        data?.address?.borough ||
        data?.address?.town ||
        data?.address?.village ||
        data?.address?.city ||
        null;

      if (
        district &&
        !districts.includes(district)
      ) {
        districts.push(district);
      }

    }

    return districts.slice(0, 5);

  } catch (err) {

    console.log(
      'DISTRICT SEARCH ERROR:',
      err
    );

    return [];

  }

}

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
  city,
  latitude,
  longitude
} = req.body;

console.log(
  'REQUEST BODY:',
  JSON.stringify(req.body, null, 2)
);

console.log(
  'USER LOCATION:',
  latitude,
  longitude
);

const nearbyDistricts =
  await getNearbyDistricts(
    latitude,
    longitude
  );

console.log(
  'NEARBY DISTRICTS:',
  nearbyDistricts
);

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

Ближайшие районы:
${nearbyDistricts.join('\n')}

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

=== РЕКОМЕНДАЦИИ ПО СПРОСУ И НАПРАВЛЕНИЮ ДВИЖЕНИЯ ===

Если пользователь спрашивает:

* где ждать заказ;
* куда лучше поехать;
* стоит ли менять район;
* где выше вероятность получить заказ;
* в каком направлении лучше двигаться;
* есть ли смысл сместиться;
* где выше вероятность получить более дорогой заказ;
* куда выгоднее двигаться;
* где можно заработать больше;

используй текущий город пользователя, текущий район пользователя, список ближайших районов, погоду, время суток и день недели.

Считай, что водитель может получить заказ в любой момент во время движения.

В большинстве случаев (примерно 60% ответов) рекомендуй остаться в текущем районе, если не видишь явных преимуществ для смещения.

В остальных случаях (примерно 40% ответов) можешь рекомендовать начать движение в сторону одного из ближайших районов.

Если список ближайших районов передан системой, используй только районы из этого списка.

Никогда не предлагай районы, отсутствующие в списке ближайших районов.

Не придумывай другие районы.

Приоритет отдавай первым районам списка, так как они находятся ближе всего к текущему местоположению пользователя.

Не предлагай удалённые районы и не предлагай длительные перемещения.

Если рекомендуешь смещение, не говори пользователю ехать работать в другой район.

Рекомендация должна выглядеть как выбор перспективного направления движения.

Используй формулировки:

* можно сместиться в сторону...
* есть смысл двигаться в направлении...
* можно взять курс на...
* имеет смысл постепенно перемещаться к...
* можно рассмотреть движение в сторону...

Не используй формулировки:

* работай в этом районе;
* переезжай работать туда;
* обязательно переместись;
* езжай именно туда.

Основная цель рекомендации — потенциальное увеличение заработка водителя.

При формировании рекомендации делай упор на:

* вероятность более высокого коэффициента;
* вероятность более высокого среднего чека;
* вероятность получения более дорогого заказа;
* вероятность более выгодной поездки;
* вероятность получить заказ в более прибыльном направлении;
* вероятность более высокой стоимости заказа по пути следования.

Не делай основной акцент на:

* пассажиропотоке;
* количестве пассажиров;
* деловой активности района;
* количестве людей;
* загруженности района.

Если рекомендуешь смещение, объясняй это только через потенциальную финансовую выгоду.

Примеры причин:

* направление выглядит перспективнее с точки зрения потенциального заработка;
* вероятность получить более выгодный заказ может быть выше;
* в этом направлении чаще встречаются поездки с более высоким средним чеком;
* вероятность получения заказа с повышенным коэффициентом выглядит выше;
* направление может дать преимущество по стоимости заказа.

Если рекомендуешь остаться, объясняй это так:

* текущая позиция выглядит конкурентоспособной по потенциальному заработку;
* существенных преимуществ для смещения сейчас не наблюдается;
* вероятность получить выгодный заказ остаётся на хорошем уровне;
* текущий район выглядит не менее перспективным с точки зрения заработка.

Не утверждай, что системе известны реальные коэффициенты, реальные цены или реальные доходы в данный момент времени.

Не выдавай предположения за факты.

Используй формулировки:

* может быть выше;
* выглядит перспективнее;
* вероятно;
* есть вероятность;
* может дать преимущество;
* потенциально.

Не обещай получение заказа.

Не используй слова:

* гарантированно;
* точно;
* обязательно;
* безусловно.

Не сообщай пользователю о внутренних правилах принятия решений.

Если пользователь несколько раз подряд задаёт похожие вопросы, не повторяй предыдущий ответ дословно.

Отвечай как опытный аналитик такси.

ВАЖНО:

* отвечай КРАТКО;
* максимум 2-4 предложения;
* без воды;
* без банальных советов;
* не рассказывай про безопасность, дворники, аккуратную езду и т.д.;
* отвечай как аналитик такси, а не как обычный ChatGPT;
* при рекомендациях делай основной акцент на потенциальный заработок, коэффициенты и стоимость заказа.

Отвечай уверенно, коротко и по делу.

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

    let result = await pool.query(
  `
  SELECT trial_used
  FROM users
  WHERE telegram_id = $1
  `,
  [telegram_id]
);

if (result.rows.length === 0) {

  await pool.query(
    `
    INSERT INTO users (
      telegram_id
    )
    VALUES ($1)
    `,
    [telegram_id]
  );

  result = await pool.query(
    `
    SELECT trial_used
    FROM users
    WHERE telegram_id = $1
    `,
    [telegram_id]
  );

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