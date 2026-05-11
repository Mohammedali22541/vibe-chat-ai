# Vibe Chat AI

A simple ChatGPT-like web app built with only HTML, CSS, and vanilla JavaScript. It supports:

- Text chat using Fireworks Chat Completions
- Image generation using Fireworks FLUX
- Image editing/context using Fireworks FLUX Kontext

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Fireworks AI API
- GitHub Copilot was used during development

## Features

- Chat tab
- Image tab
- API key input
- Chat history/context using `messages` array
- Text-to-image generation
- Image context/editing using the previous generated image
- Reset chat
- Reset image context
- Loading states
- Error handling
- Rate limit handling

## Project Flow

### Chat Flow

1. User enters API key.
2. User writes a message.
3. The message is pushed into the `messages` array as:
   `{ role: "user", content: "..." }`
4. The app sends the full messages array to Fireworks Chat Completions API.
5. The assistant reply is received.
6. The assistant reply is pushed into `messages` as:
   `{ role: "assistant", content: "..." }`
7. The UI renders the assistant reply.
8. Because the full messages array is sent every time, the model keeps text context.

### Image Flow

1. User enters API key.
2. User switches to Image tab.
3. User writes an image prompt.
4. If `currentReferenceImage` is null:
   - The app calls FLUX text-to-image.
   - The generated image is saved as `currentReferenceImage`.
5. If `currentReferenceImage` exists:
   - The app calls FLUX Kontext.
   - It sends `currentReferenceImage` as `input_image`.
   - The new prompt works as an edit instruction.
   - The result becomes the new `currentReferenceImage`.
6. Reset Image Context clears `currentReferenceImage` and starts fresh.

## Important Concepts

- API key should not be committed to GitHub.
- In this frontend-only demo, the API key is entered in the browser for local testing.
- In production, the API key should be stored in a backend or serverless function.
- The chat context is stored in memory only.
- The image context is stored in memory only.
- Refreshing the page clears the state.

## API Endpoints Used

### Chat

POST https://api.fireworks.ai/inference/v1/chat/completions

### Text-to-image

POST https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image

### Image editing/context

POST https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-kontext-pro

### Kontext result polling

POST https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-kontext-pro/get_result

## How To Run

1. Clone or download the project.
2. Open `index.html` in your browser, or use VS Code Live Server.
3. Paste your Fireworks API key in the API key input.
4. Start using Chat or Image tab.

## File Structure

```
Vibe-Chat-AI/
├── index.html
├── style.css
├── script.js
├── README.md
└── .gitignore
```

## Security Warning

- Never hardcode a real API key in `script.js`.
- Never commit API keys to GitHub.
- If an API key is leaked, delete or rotate it immediately in the Fireworks dashboard.
- This project is for local demo and testing only.

## Limitations

- No backend.
- No database.
- Chat history disappears after refresh.
- Image context disappears after refresh.
- API key is exposed in browser memory during local testing.
- Fireworks rate limits may stop image generation temporarily.
- Image consistency depends on the model.

## Future Improvements

- Add backend using ASP.NET Core.
- Store API key server-side.
- Add user authentication.
- Store chat sessions in database.
- Add streaming chat responses.
- Add image gallery.
- Add download image button.
- Add deployable serverless API proxy.
- Add dark mode.

## Example Prompts

### Chat

"Explain Web API in .NET"

### Image first prompt

"Create a realistic portrait of a cat, cinematic lighting"

### Image edit prompt

"same cat with sunglasses"
