require("dotenv").config();

const { App } = require("@slack/bolt");
const puppeteer = require("puppeteer");

const app = new App({
  signingSecret: process.env.SIGNING_SECRET,
  token: process.env.SLACK_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function login(page) {
  const domainInput = await page.waitForSelector(
    'input[data-qa="signin_domain_input"]'
  );

  // Cookie popup
  const cookiePopup = await page.$("#onetrust-accept-btn-handler");
  if (cookiePopup) {
    await cookiePopup.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await domainInput.type("rareagency");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await page.click('button[data-qa="submit_team_domain_button"]');
  const email = await page.waitForSelector('input[data-qa="login_email"]');
  await email.type(process.env.SLACK_USERNAME);
  await page.type(
    'input[data-qa="login_password"]',
    process.env.SLACK_PASSWORD
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('button[data-qa="signin_button"]');
}

let currentBrowser;

async function open(url) {
  console.log("📞 Joining call", url);
  if (currentBrowser) {
    currentBrowser.close();
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    userDataDir: "./data",
    args: [
      "--start-fullscreen",
      "--kiosk",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      "--noerrdialogs",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  currentBrowser = browser;

  const context = browser.defaultBrowserContext();
  context.overridePermissions(url, ["camera", "microphone"]);

  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  if (page.url().includes("workspace-signin")) {
    await login();
  }

  // Turn camera on
  const videoButton = await page.waitForSelector(
    'button[data-qa="video-button"]',
    {
      timeout: null,
    }
  );

  if (videoButton.getProperty("aria-checked") !== "true") {
    await videoButton.click();
  }

  // Turn mic on
  const micButton = await page.waitForSelector('button[data-qa="mic-button"]', {
    timeout: null,
  });

  if (micButton.getProperty("aria-checked") !== "false") {
    await micButton.click();
  }

  const startedWaiting = Date.now();
  const fiveMinutes = 1000 * 60 * 5;
  let roomEmpty = await page.$("p-active_call__empty_message_heading");

  if (roomEmpty) {
    while (roomEmpty) {
      const waitedOver5Minutes = Date.now() - startedWaiting < fiveMinutes;
      if (waitedOver5Minutes) {
        await currentBrowser.close();
        currentBrowser = null;
        return;
      }
      roomEmpty = await page.$("p-active_call__empty_message_heading");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  // Leave the room once everyone else is gone
  while (!roomEmpty) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  await currentBrowser.close();
  currentBrowser = null;
}

// Listens to incoming messages that contain "hello"
app.message(async ({ message }) => {
  if (message.subtype === "sh_room_created") {
    open(`https://app.slack.com/free-willy/TTHGF5X5Y/${message.room.id}`);
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
