const API_KEYS = [
  "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"
].filter(Boolean);

let currentKeyIndex = 0;

function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];

  currentKeyIndex =
    (currentKeyIndex + 1) % API_KEYS.length;

  return key;
}

export default async function handler(req, res) {

  // ONLY POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { messages } = req.body;

    // VALIDATE
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages array required"
      });
    }

    if (API_KEYS.length === 0) {
      return res.status(500).json({
        error: "No API keys configured"
      });
    }

    let lastError = null;

    // TRY ALL KEYS
    for (let i = 0; i < API_KEYS.length; i++) {

      const apiKey = getNextApiKey();

      try {

        const response = await fetch(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",

            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              Accept: "text/event-stream"
            },

            body: JSON.stringify({
              model: "moonshotai/kimi-k2.6",

              messages,

              temperature: 1.0,
              top_p: 1.0,
              max_tokens: 16384,

              // STREAM ENABLED
              stream: true
            })
          }
        );

        // FAIL
        if (!response.ok) {

          const errorText =
            await response.text();

          let errorData;

          try {
            errorData =
              JSON.parse(errorText);
          } catch {
            errorData = {
              raw: errorText
            };
          }

          // TRY NEXT KEY
          if (
            response.status === 401 ||
            response.status === 403 ||
            response.status === 429
          ) {
            lastError = errorData;
            continue;
          }

          return res.status(response.status).json({
            error: "NVIDIA API error",
            details: errorData
          });
        }

        // STREAM HEADERS
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        });

        // STREAM DATA
        const reader =
          response.body.getReader();

        const decoder =
          new TextDecoder();

        while (true) {

          const { done, value } =
            await reader.read();

          if (done) break;

          const chunk =
            decoder.decode(value);

          res.write(chunk);
        }

        res.end();

        return;

      } catch (err) {

        console.error(
          "KEY FAILED:",
          err
        );

        lastError = {
          message: err.message
        };
      }
    }

    return res.status(500).json({
      error: "All API keys failed",
      details: lastError
    });

  } catch (err) {

    console.error(
      "SERVER ERROR:",
      err
    );

    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}
