require("dotenv").config();

const { App } = require("@slack/bolt");
const puppeteer = require("puppeteer");

const app = new App({
  signingSecret: process.env.SIGNING_SECRET,
  token: process.env.SLACK_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function open(url) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--start-fullscreen",
      "--kiosk",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      "--noerrdialogs",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = browser.defaultBrowserContext();
  context.overridePermissions(url, ["camera", "microphone"]);

  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("#onetrust-accept-btn-handler");
  await page.click("#onetrust-accept-btn-handler");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await page.waitForSelector('input[data-qa="signin_domain_input"]');
  await page.type('input[data-qa="signin_domain_input"]', "rareagency");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await page.click('button[data-qa="submit_team_domain_button"]');
  await page.waitForSelector('input[data-qa="login_email"]');
  await page.type('input[data-qa="login_email"]', process.env.SLACK_USERNAME);
  await page.type(
    'input[data-qa="login_password"]',
    process.env.SLACK_PASSWORD
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('button[data-qa="signin_button"]');
}

// Listens to incoming messages that contain "hello"
app.message(async ({ message, say }) => {
  if (message.subtype === "sh_room_created") {
    open(`https://app.slack.com/free-willy/TTHGF5X5Y/${message.room.id}`);
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
