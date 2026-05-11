// Put your API key here only for local testing. Never commit it to GitHub.
const API_KEY = "";

const TEXT_TO_IMAGE_API_URL =
  "https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image";
const IMAGE_API_URL = TEXT_TO_IMAGE_API_URL;
const KONTEXT_MODEL = "flux-kontext-pro";
const KONTEXT_START_URL = `https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/${KONTEXT_MODEL}`;
const KONTEXT_RESULT_URL = `https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/${KONTEXT_MODEL}/get_result`;
const FIRST_IMAGE_PLACEHOLDER =
  "Create a realistic portrait of a young man with curly hair, cinematic lighting";
const EDIT_IMAGE_PLACEHOLDER = "Edit the same person: make him wear sunglasses";

console.log("TEXT_TO_IMAGE_API_URL:", TEXT_TO_IMAGE_API_URL);
console.log("KONTEXT_START_URL:", KONTEXT_START_URL);
console.log("KONTEXT_RESULT_URL:", KONTEXT_RESULT_URL);

// Fireworks model name.
// If this model gives "Model not found", open Fireworks Models page and copy an available Chat model id.
const MODEL_NAME = "accounts/fireworks/models/gpt-oss-120b";
// Keep the text chat context here.
const messages = [
  {
    role: "system",
    content:
      "You are a helpful assistant. Answer clearly in Arabic unless the user asks for another language.",
  },
];

const apiKeyInput = document.getElementById("apiKey");
const messagesContainer = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const typingIndicator = document.getElementById("typing");
const chatTabBtn = document.getElementById("chatTabBtn");
const imageTabBtn = document.getElementById("imageTabBtn");
const chatSection = document.getElementById("chatSection");
const imageSection = document.getElementById("imageSection");
const imagePromptInput = document.getElementById("imagePrompt");
const imageContextStatus = document.getElementById("imageContextStatus");
const resetImageContextBtn = document.getElementById("resetImageContextBtn");
const generateImageBtn = document.getElementById("generateImageBtn");
const imageLoading = document.getElementById("imageLoading");
const imageResult = document.getElementById("imageResult");
const imageError = document.getElementById("imageError");

let isSending = false;
let isImageGenerating = false;
let isCoolingDown = false;
// Image context used for Kontext edits.
let currentReferenceImage = null;
let generatedImages = [];
let lastImageObjectUrl = null;

function getApiKey() {
  const runtimeKey = apiKeyInput.value.trim();

  if (runtimeKey) {
    return runtimeKey;
  }

  if (API_KEY && API_KEY.trim()) {
    return API_KEY.trim();
  }

  return "";
}

function setTyping(isVisible) {
  typingIndicator.classList.toggle("hidden", !isVisible);
}

function addMessage(role, content, variant) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;

  if (variant) {
    bubble.classList.add(variant);
  }

  bubble.textContent = content;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function resetChat() {
  messagesContainer.innerHTML = "";

  messages.length = 0;
  messages.push({
    role: "system",
    content:
      "You are a helpful assistant. Answer clearly in Arabic unless the user asks for another language.",
  });

  setTyping(false);
}

function getApiErrorMessage(data, status) {
  if (data?.error?.message) {
    return data.error.message;
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.detail) {
    return data.detail;
  }

  return `Request failed (${status}). Please try again.`;
}

function isRateLimitError(message) {
  return (
    message.includes("RATE_LIMIT_EXCEEDED") ||
    message.toLowerCase().includes("rate limit")
  );
}

function hasImageHistory() {
  return Boolean(currentReferenceImage);
}

function updateImageContextStatus() {
  const isActive = hasImageHistory();
  imageContextStatus.textContent = isActive
    ? "Image context: Active"
    : "Image context: Empty";
  imagePromptInput.placeholder = isActive
    ? EDIT_IMAGE_PLACEHOLDER
    : FIRST_IMAGE_PLACEHOLDER;
}

function resetImageHistory() {
  currentReferenceImage = null;
  generatedImages = [];

  if (lastImageObjectUrl) {
    URL.revokeObjectURL(lastImageObjectUrl);
    lastImageObjectUrl = null;
  }

  imageResult.innerHTML = "";
  clearImageError();
  updateImageContextStatus();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });
}

function normalizeImageValue(value) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return normalizeImageValue(value[0]);
  }

  if (typeof value === "object") {
    if (value.url) {
      return value.url;
    }

    if (value.base64) {
      return value.base64;
    }

    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

async function extractImageDataUrl(data) {
  const candidates = [
    data?.base64,
    data?.image,
    data?.image?.url,
    data?.image?.base64,
    data?.result,
    data?.result?.image,
    data?.result?.image?.url,
    data?.result?.image?.base64,
    data?.result?.images?.[0],
    data?.result?.images?.[0]?.url,
    data?.result?.images?.[0]?.base64,
    data?.images?.[0],
    data?.images?.[0]?.url,
    data?.images?.[0]?.base64,
    data?.url,
    data?.output,
    data?.output?.[0],
    data?.output?.[0]?.url,
    data?.output?.[0]?.base64,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeImageValue(candidate);

    if (!normalized) {
      continue;
    }

    if (normalized.startsWith("data:image")) {
      return normalized;
    }

    if (normalized.startsWith("http")) {
      const response = await fetch(normalized);
      if (response.ok) {
        const blob = await response.blob();
        return blobToDataUrl(blob);
      }

      continue;
    }

    return `data:image/png;base64,${normalized}`;
  }

  return "";
}

function displayGeneratedImage(imageSrc, usesObjectUrl) {
  if (lastImageObjectUrl) {
    URL.revokeObjectURL(lastImageObjectUrl);
    lastImageObjectUrl = null;
  }

  imageResult.innerHTML = "";
  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = "Generated image";
  imageResult.appendChild(img);

  if (usesObjectUrl) {
    lastImageObjectUrl = imageSrc;
  }
}

function saveGeneratedImage(imageSrc, prompt) {
  currentReferenceImage = imageSrc;
  generatedImages.push({
    src: imageSrc,
    prompt,
  });
  updateImageContextStatus();
}

function showImageError(message, variant = "error") {
  imageError.textContent = message;
  imageError.classList.remove("hidden");
  imageError.classList.toggle("note", variant === "note");
}

function clearImageError() {
  imageError.textContent = "";
  imageError.classList.add("hidden");
  imageError.classList.remove("note");
}

function looksLikeEditPrompt(prompt) {
  return /(same|edit|change|keep|background|wear|sunglasses|smil|expression)/i.test(
    prompt,
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startImageCooldown(seconds) {
  // Rate limit cooldown prevents repeated requests.
  isCoolingDown = true;
  generateImageBtn.disabled = true;

  for (let i = seconds; i > 0; i--) {
    imageLoading.classList.remove("hidden");
    imageLoading.textContent = `Please wait ${i}s before trying again...`;
    await delay(1000);
  }

  imageLoading.textContent = "Generating image...";
  imageLoading.classList.add("hidden");
  generateImageBtn.disabled = false;
  isCoolingDown = false;
}

async function parseImageResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const dataUrl = await extractImageDataUrl(data);

    if (!dataUrl) {
      throw new Error("Image generation failed.");
    }

    return {
      dataUrl,
      displaySrc: dataUrl,
      usesObjectUrl: false,
    };
  }

  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);

  return {
    dataUrl,
    displaySrc: dataUrl,
    usesObjectUrl: false,
  };
}

async function pollKontextResult(requestId, apiKey) {
  const timeoutMs = 90000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(KONTEXT_RESULT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: requestId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Image generation failed.");
    }

    const data = await response.json();
    console.log("Kontext poll response:", data);

    const rawStatus = data?.status || data?.state || data?.result?.status;
    const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : "";

    if (["pending", "queued", "running", "in_progress"].includes(status)) {
      await delay(3000);
      continue;
    }

    if (
      ["error", "failed", "content_filtered", "content_moderated"].includes(
        status,
      )
    ) {
      throw new Error(
        data?.error?.message || data?.message || "Image generation failed.",
      );
    }

    if (["ready", "completed", "succeeded"].includes(status) || !status) {
      const dataUrl = await extractImageDataUrl(data);

      if (dataUrl) {
        return dataUrl;
      }
    }

    await delay(3000);
  }

  throw new Error("Image generation timed out.");
}

async function startKontextEdit(prompt, inputImage, apiKey) {
  const response = await fetch(KONTEXT_START_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      input_image: inputImage,
      aspect_ratio: "1:1",
      output_format: "png",
      seed: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Image generation failed.");
  }

  const data = await response.json();
  console.log("Kontext start response:", data);

  if (data?.request_id) {
    const dataUrl = await pollKontextResult(data.request_id, apiKey);
    return {
      dataUrl,
      displaySrc: dataUrl,
      usesObjectUrl: false,
    };
  }

  const dataUrl = await extractImageDataUrl(data);

  if (dataUrl) {
    return {
      dataUrl,
      displaySrc: dataUrl,
      usesObjectUrl: false,
    };
  }

  throw new Error("Kontext did not return request_id or image.");
}

function switchMode(mode) {
  const isChatMode = mode === "chat";

  chatSection.classList.toggle("hidden", !isChatMode);
  imageSection.classList.toggle("hidden", isChatMode);
  chatTabBtn.classList.toggle("active", isChatMode);
  imageTabBtn.classList.toggle("active", !isChatMode);
  chatTabBtn.setAttribute("aria-selected", String(isChatMode));
  imageTabBtn.setAttribute("aria-selected", String(!isChatMode));
}

async function generateImage() {
  // Text-to-image for first generation, Kontext for edits with image context.
  if (isImageGenerating || isCoolingDown) {
    if (isCoolingDown) {
      showImageError(
        "Rate limit exceeded. Please wait a bit before trying again.",
      );
    }
    return;
  }

  const apiKey = getApiKey();
  const imagePrompt = imagePromptInput.value.trim();

  if (!apiKey) {
    showImageError("Please enter your API key first.");
    return;
  }

  if (!imagePrompt) {
    showImageError("Please enter an image prompt.");
    return;
  }

  clearImageError();

  if (!hasImageHistory() && looksLikeEditPrompt(imagePrompt)) {
    showImageError("No previous image found, generating a new image.", "note");
  }

  isImageGenerating = true;
  generateImageBtn.disabled = true;
  imageLoading.classList.remove("hidden");

  try {
    let result;

    if (hasImageHistory()) {
      result = await startKontextEdit(
        imagePrompt,
        currentReferenceImage,
        apiKey,
      );
    } else {
      const response = await fetch(IMAGE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "image/png",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspect_ratio: "1:1",
          guidance_scale: 3.5,
          num_inference_steps: 4,
          seed: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Image generation failed.");
      }

      result = await parseImageResponse(response);
    }

    saveGeneratedImage(result.dataUrl, imagePrompt);
    displayGeneratedImage(result.displaySrc || result.dataUrl, false);
  } catch (error) {
    const message = error?.message || "Image generation failed.";

    if (isRateLimitError(message)) {
      showImageError(
        "Rate limit exceeded. Please wait a bit before trying again.",
      );
      startImageCooldown(30);
      return;
    }

    if (hasImageHistory()) {
      showImageError(
        `Kontext error:\n${message}\nEndpoint: ${KONTEXT_START_URL}\nModel: ${KONTEXT_MODEL}`,
      );
    } else {
      showImageError(message);
    }
  } finally {
    isImageGenerating = false;
    if (!isCoolingDown) {
      generateImageBtn.disabled = false;
      imageLoading.classList.add("hidden");
      imageLoading.textContent = "Generating image...";
    }
  }
}

async function sendMessage() {
  if (isSending) {
    return;
  }

  const userMessage = userInput.value.trim();

  if (!userMessage) {
    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    addMessage("assistant", "Please enter your API key first.", "error");
    return;
  }

  addMessage("user", userMessage);
  messages.push({
    role: "user",
    content: userMessage,
  });

  userInput.value = "";
  userInput.style.height = "auto";

  isSending = true;
  sendBtn.disabled = true;
  setTyping(true);

  try {
    const response = await fetch(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          max_tokens: 16384,
          top_p: 1,
          top_k: 40,
          presence_penalty: 0,
          frequency_penalty: 0,
          temperature: 0.6,
          messages: messages,
        }),
      },
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const apiError = getApiErrorMessage(data, response.status);

      addMessage(
        "assistant",
        `Error: ${apiError}\n\nCurrent model: ${MODEL_NAME}`,
        "error",
      );

      // Remove the last user message from history if the request failed.
      // This prevents broken messages from staying in the context.
      messages.pop();

      return;
    }

    const assistantReply = data?.choices?.[0]?.message?.content;

    if (!assistantReply) {
      addMessage("assistant", "Sorry, I did not receive a reply.", "error");
      messages.pop();
      return;
    }

    messages.push({
      role: "assistant",
      content: assistantReply,
    });

    addMessage("assistant", assistantReply);
  } catch (error) {
    addMessage(
      "assistant",
      `Network error. Please try again.\n\nDetails: ${error.message}`,
      "error",
    );

    messages.pop();
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    setTyping(false);
    userInput.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);

clearBtn.addEventListener("click", () => {
  resetChat();
});

chatTabBtn.addEventListener("click", () => {
  switchMode("chat");
});

imageTabBtn.addEventListener("click", () => {
  switchMode("image");
});

generateImageBtn.addEventListener("click", generateImage);

resetImageContextBtn.addEventListener("click", () => {
  resetImageHistory();
});

userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
});

updateImageContextStatus();
