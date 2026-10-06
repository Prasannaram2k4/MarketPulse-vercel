import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`MarketPulse Pro API listening on port ${PORT}`);
});
