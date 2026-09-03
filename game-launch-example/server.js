require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const launchRoutes = require("./src/routes/launch");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/games", launchRoutes);

app.get("/api/health", (req, res) => {
	res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
	console.log(`[game-launch-example] http://localhost:${PORT} adresinde calisiyor`);
});
