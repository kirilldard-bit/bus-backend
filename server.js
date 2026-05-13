const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

app.get('/', (req, res) => {
  res.json({
    status: 'BUSTER backend running'
  });
});

app.get('/check-access', (req, res) => {

  console.log(
    'Checking access for:',
    req.query.user
  );

  res.json({
    access: false
  });

});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `Server running on port ${PORT}`
  );

});