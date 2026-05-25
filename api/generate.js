// /api/generate.js
// Vercel Serverless Function
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
      seed = 0,
      steps = 4,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    const invokeUrl =
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

    const response = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Bearer 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",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        seed,
        steps,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // NVIDIA usually returns image base64
    let imageBase64 = null;

    if (data.image) {
      imageBase64 = data.image;
    } else if (data.images?.[0]?.image) {
      imageBase64 = data.images[0].image;
    } else if (data.artifact?.base64) {
      imageBase64 = data.artifact.base64;
    }

    if (!imageBase64) {
      return res.status(500).json({
        error: "No image returned",
        response: data,
      });
    }

    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Watermark SVG
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <style>
          .title {
            fill: white;
            font-size: 42px;
            font-weight: bold;
            font-family: Arial, sans-serif;
          }
        </style>

        <text
          x="50%"
          y="95%"
          text-anchor="middle"
          class="title"
          opacity="0.8"
        >
          https://discord.gg/25ya7J5h
        </text>
      </svg>
    `;

    // Add watermark
    const finalImage = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity: "south",
        },
      ])
      .png()
      .toBuffer();

    // Return base64
    const finalBase64 = finalImage.toString("base64");

    return res.status(200).json({
      success: true,
      image: finalBase64,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
