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
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages array required"
      });
    }

    // No API keys
    if (API_KEYS.length === 0) {
      return res.status(500).json({
        error: "No API keys configured"
      });
    }

    let lastError = null;

    // Try all keys
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
              Accept: "application/json"
            },
            body: JSON.stringify({
              model: "meta/llama-3.1-70b-instruct",

              messages,

              temperature: 0.7,
              top_p: 1,
              max_tokens: 2048,

              // IMPORTANT
              stream: false
            })
          }
        );

        // Read raw text first
        const text = await response.text();

        let data;

        // Parse safely
        try {
          data = JSON.parse(text);
        } catch {
          data = {
            raw: text
          };
        }

        console.log("STATUS:", response.status);
        console.log("DATA:", data);

        // Success
        if (response.ok) {
          return res.status(200).json(data);
        }

        // Retry next key on auth/rate errors
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 429
        ) {
          lastError = data;
          continue;
        }

        // Other API errors
        return res.status(response.status).json({
          error: "NVIDIA API error",
          details: data
        });

      } catch (err) {
        console.error("KEY FAILED:", err);

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
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}
