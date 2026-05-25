// /api/edit.js
// package.json -> { "type": "module" }

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

export default async function handler(req, res) {

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const {
      prompt,
      image,
      steps = 30,
      cfg_scale = 3.5,
      seed = 0,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    if (!image) {
      return res.status(400).json({
        error: "Image is required",
      });
    }

    // REMOVE PREFIX
    const cleanBase64 = image.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    // NVIDIA FLUX KONTEXT
    const invokeUrl =
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev";

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

        // FIXED FIELD
        image_b64: cleanBase64,

        aspect_ratio: "match_input_image",

        steps,
        cfg_scale,
        seed,
      }),
    });

    const data = await response.json();

    // NVIDIA ERROR
    if (!response.ok) {

      console.error(data);

      return res.status(response.status).json({
        error: "NVIDIA API Error",
        details: data,
      });
    }

    // EXTRACT IMAGE
    let imageBase64 = null;

    if (typeof data.image === "string") {

      imageBase64 = data.image;

    } else if (
      typeof data.images?.[0]?.image === "string"
    ) {

      imageBase64 = data.images[0].image;

    } else if (
      typeof data.artifacts?.[0]?.base64 === "string"
    ) {

      imageBase64 = data.artifacts[0].base64;
    }

    if (!imageBase64) {

      return res.status(500).json({
        error: "No image returned",
        response: data,
      });
    }

    return res.status(200).json({
      success: true,
      image: imageBase64,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
