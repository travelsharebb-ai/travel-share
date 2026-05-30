import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 10000);
const app = createApp();

app.listen(port, () => {
  console.log(`Travel Share API listening on ${port}`);
});
