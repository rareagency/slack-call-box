require("dotenv").config();

const { App } = require("@slack/bolt");
const puppeteer = require("puppeteer");

const app = new App({
  signingSecret: process.env.SIGNING_SECRET,
  token: process.env.SLACK_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

function wait(forTime) {
  return new Promise((resolve) => {
    setTimeout(resolve, forTime);
  })
}

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
      // "--start-fullscreen",
      // "--kiosk",
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
    timeout: 0
  });

  if (page.url().includes("workspace-signin")) {
    await login();
  } else {
    console.log('Already logged in');

  }

  // Turn camera on
  const videoButton = await page.waitForSelector(
    'button[data-qa="video-button"]',
    {
      timeout: null,
    }
  );

  if (videoButton.getProperty("aria-checked") !== "true") {
    console.log("Enabled camera");
    await videoButton.click();
  }

  // Slack automatically mutes the microphone few seconds after joining the call
  // this reverses that
  await wait(5000)

  // Turn mic on
  const micButton = await page.waitForSelector('button[data-qa="mic-button"]', {
    timeout: null,
  });

  if (micButton.getProperty("aria-pressed") !== "true") {
    console.log("Unmuted microphone");
    // await micButton.click();
  }

  /*
   * Auto leave
   */
  const roomEmptyText = () => page.$(".p-active_call__empty_message_heading");

  const startedWaiting = Date.now();
  const fiveMinutes = 1000 * 60 * 5;
  let roomEmpty = await roomEmptyText();

  if (roomEmpty) {
    console.log("Room is empty, waiting for others");
    while (roomEmpty) {
      const waitedOver5Minutes = Date.now() - startedWaiting < fiveMinutes;
      if (waitedOver5Minutes) {
        console.log("Waited for 5 minutes in an empty room, leaving");
        await currentBrowser.close();
        currentBrowser = null;
        return;
      }
      roomEmpty = await roomEmptyText();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } else {
    console.log("Someone is in the room already");
  }

  // Leave the room once everyone else is gone
  while (!roomEmpty) {
    roomEmpty = await roomEmptyText();
    console.log("Room currently empty", Boolean(roomEmpty));
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  console.log("Everyone left, bye");
  await currentBrowser.close();
  currentBrowser = null;
}

// Listens to incoming messages that contain "hello"
app.message(async ({ message }) => {
  if (message.subtype === "sh_room_created") {
    try {
      await open(`https://app.slack.com/free-willy/TTHGF5X5Y/${message.room.id}`);
    } catch (error) {
      console.error(error);
    }
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
