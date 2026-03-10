const app = require('./index');

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  process.stdout.write(`API dev server listening on http://localhost:${port}\n`);
});

