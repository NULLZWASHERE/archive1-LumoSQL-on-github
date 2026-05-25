// /api/generate.js
// npm install sharp

import sharp from "sharp";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const {
      prompt,
      width = 1024,
      height = 1024,
      steps = 4,
      seed,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    // NVIDIA API
    const invokeUrl =
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

    const response = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer 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",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        steps,
        ...(seed !== undefined ? { seed } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "NVIDIA API Error",
        details: data,
      });
    }

    // Extract image
    let imageBase64 = null;

    if (typeof data.image === "string") {
      imageBase64 = data.image;
    } else if (typeof data.images?.[0]?.image === "string") {
      imageBase64 = data.images[0].image;
    } else if (typeof data.artifact?.base64 === "string") {
      imageBase64 = data.artifact.base64;
    } else if (typeof data.artifacts?.[0]?.base64 === "string") {
      imageBase64 = data.artifacts[0].base64;
    }

    if (!imageBase64) {
      return res.status(500).json({
        error: "No image returned",
        response: data,
      });
    }

    // Remove data:image prefix
    imageBase64 = imageBase64.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    const imageBuffer = Buffer.from(imageBase64, "base64");

    // MAKE WATERMARK PNG INSTEAD OF SVG
    // SVG fonts break on Vercel/Linux sometimes

    const watermark = await sharp({
      create: {
        width,
        height: 80,
        channels: 4,
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0.45,
        },
      },
    })
      .png()
      .toBuffer();

    // Final image with bottom bar
    const finalImage = await sharp(imageBuffer)
      .composite([
        {
          input: watermark,
          left: 0,
          top: height - 80,
        },
      ])
      .png()
      .toBuffer();

    // Return image
    return res.status(200).json({
      success: true,
      image: finalImage.toString("base64"),
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
