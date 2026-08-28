require("dotenv").config();

const websiteName = String(process.env.WEBSITE_NAME || "website").trim();
const projectId = String(process.env.PROJECT_ID || "local").trim();

module.exports = {
	apps: [
		{
			name: `${projectId}-${websiteName}-backend`,
			script: "app.js",
			exec_mode: "cluster",
			instances: 4,
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
