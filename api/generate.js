// /api/generate.js
// npm install sharp

import sharp from "sharp";

export default async function handler(req, res) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    // Body
    const {
      prompt,
      width = 1024,
      height = 1024,
      steps = 4,
      seed,
    } = req.body || {};

    // Validate prompt
    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    // NVIDIA API
    const invokeUrl =
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

    // Request image
    const response = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer YOUR_NVIDIA_API_KEY",
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

    // Parse response
    const data = await response.json();

    // NVIDIA API error
    if (!response.ok) {
      return res.status(response.status).json({
        error: "NVIDIA API Error",
        details: data,
      });
    }

    // Find base64 image
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

    // No image
    if (!imageBase64) {
      return res.status(500).json({
        error: "No image returned",
        response: data,
      });
    }

    // Remove base64 prefix if exists
    imageBase64 = imageBase64.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    // Convert to buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Watermark SVG
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <style>
          .text {
            fill: white;
            font-size: 38px;
            font-weight: bold;
            font-family: Arial, Helvetica, sans-serif;
          }
        </style>

        <!-- Dark transparent bar -->
        <rect
          x="0"
          y="${height - 80}"
          width="${width}"
          height="80"
          fill="black"
          opacity="0.45"
        />

        <!-- Watermark text -->
        <text
          x="50%"
          y="${height - 30}"
          text-anchor="middle"
          class="text"
        >
          discord.gg/25ya7J5h
        </text>
      </svg>
    `;

    // Add watermark
    const finalImage = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Convert final image to base64
    const finalBase64 = finalImage.toString("base64");

    // Return image
    return res.status(200).json({
      success: true,
      image: finalBase64,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
