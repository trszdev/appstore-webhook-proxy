const {
  getAppStoreStatusLabel,
  getStatusEmoji,
  getBuildUploadStateLabel,
  getBuildUploadStateEmoji,
  getExternalBuildStateLabel,
  getExternalBuildStateEmoji,
} = require("./stateDescriptions");

// Message body: "<emoji> <message type>: <current status>".
// The status part is omitted for events that have no status.
function formatBody(emoji, title, status) {
  return status ? `${emoji} ${title}: ${status}` : `${emoji} ${title}`;
}

// `text` is the body (and the notification fallback). Optional context
// elements (links) are rendered as a small line under it.
function buildMessage(text, contextElements = []) {
  if (contextElements.length === 0) return { text };

  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "context", elements: contextElements },
    ],
  };
}

function buildSlackMessage(payload) {
  const type = payload.data?.type || "unknown";

  const APP_STORE_URL = process.env.APP_STORE_URL || null;

  const events = {
    appStoreVersionAppVersionStateUpdated: () => {
      const newValue = payload.data.attributes.newValue;

      const elements = [];
      if (APP_STORE_URL) {
        elements.push({
          type: "mrkdwn",
          text: `<${APP_STORE_URL}|🔗 View on App Store>`,
        });
      }

      return buildMessage(
        formatBody(
          getStatusEmoji(newValue),
          "App Version Status Updated",
          getAppStoreStatusLabel(newValue)
        ),
        elements
      );
    },

    webhookPingCreated: () =>
      buildMessage(formatBody("🔄", "Webhook Test Ping")),

    webhookPings: () => null,

    betaFeedbackScreenshotSubmissionCreated: () => {
      const feedbackId = payload.data.relationships?.instance?.data?.id;

      const adamId = process.env.APP_ADAM_ID;
      const bundleId = process.env.APP_BUNDLE_ID;
      const platformId = process.env.APP_PLATFORM_ID;

      const elements = [];

      const isValidFeedbackId = typeof feedbackId === "string" && feedbackId.trim() !== "";

      if (isValidFeedbackId && adamId) {
        const webLink = `https://appstoreconnect.apple.com/apps/${adamId}/testflight/screenshots/${feedbackId}`;
        elements.push({
          type: "mrkdwn",
          text: `🌐 <${webLink}|View in App Store Connect>`,
        });
      }

      if (isValidFeedbackId && adamId && bundleId && platformId) {
        const xcodeLink = `xcode://organizer/feedback/downloadFeedback?adamId=${adamId}&feedbackId=${feedbackId}&bundleId=${bundleId}&platformId=${platformId}&userAgent=appStoreConnect`;
        elements.push({
          type: "mrkdwn",
          text: `💻 <${xcodeLink}|Open in Xcode Organizer>`,
        });
      }

      return buildMessage(
        formatBody("🧪", "TestFlight Feedback Screenshot Submitted"),
        elements
      );
    },

    betaFeedbackCrashSubmissionCreated: () => {
      const crashId = payload.data.relationships?.instance?.data?.id;

      const adamId = process.env.APP_ADAM_ID;

      const elements = [];

      const isValidCrashId = typeof crashId === "string" && crashId.trim() !== "";
      if (isValidCrashId && adamId) {
        const webLink = `https://appstoreconnect.apple.com/apps/${adamId}/testflight/crashes/${crashId}`;
        elements.push({
          type: "mrkdwn",
          text: `🌐 <${webLink}|View in App Store Connect>`,
        });
      }

      return buildMessage(
        formatBody("🐞", "TestFlight Crash Feedback Submitted"),
        elements
      );
    },

    buildUploadStateUpdated: () => {
      const newState = payload.data.attributes?.newState;

      return buildMessage(
        formatBody(
          getBuildUploadStateEmoji(newState),
          "App Store Build Upload Processed",
          getBuildUploadStateLabel(newState)
        )
      );
    },

    buildBetaDetailExternalBuildStateUpdated: () => {
      const externalState =
        payload.data.attributes?.newExternalBuildState;

      // Optional deep links (only if we want)
      // If we know adamId, we COULD build a link to that specific build in TestFlight QA dashboard,
      // but Apple doesn't give the build number or train here, so we skip to avoid broken links.

      return buildMessage(
        formatBody(
          getExternalBuildStateEmoji(externalState),
          "TestFlight External Availability Updated",
          getExternalBuildStateLabel(externalState)
        )
      );
    },

  };

  const unhandledText = formatBody("📬", `Unhandled App Store Event: ${type}`);

  const template = events[type]?.() ?? {
    text: unhandledText,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: unhandledText } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```json\n" + JSON.stringify(payload, null, 2) + "\n```",
        },
      },
    ],
  };

  return template;
}

module.exports = { buildSlackMessage };
