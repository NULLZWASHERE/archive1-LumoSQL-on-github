const API_KEYS = [
  "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"
].filter(Boolean);

let currentKeyIndex = 0;

function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];

  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

  return key;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body;

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

    let response;
    let data;
    let lastError = null;

    // Try every API key until one works
    for (let i = 0; i < API_KEYS.length; i++) {
      const apiKey = getNextApiKey();

      try {
        response = await fetch(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              model: "moonshotai/kimi-k2.6",

              messages,

              max_tokens: 16384,
              temperature: 1.0,
              top_p: 1.0,
              stream: true,

              chat_template_kwargs: {
                thinking: false
              }
            })
          }
        );

        data = await response.json();

        // Success
        if (response.ok) {
          return res.status(200).json(data);
        }

        // Rate limit or invalid key -> try next key
        if (
          response.status === 429 ||
          response.status === 401 ||
          response.status === 403
        ) {
          lastError = data;
          continue;
        }

        // Other errors
        return res.status(response.status).json(data);

      } catch (err) {
        lastError = err;
      }
    }

    return res.status(500).json({
      error: "All API keys failed",
      details: lastError
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
