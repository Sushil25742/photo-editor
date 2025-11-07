import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Sends an image and a text prompt to the Gemini API to get an edited image.
 * @param base64ImageData The base64-encoded string of the original image.
 * @param mimeType The MIME type of the original image (e.g., 'image/jpeg').
 * @param prompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the base64-encoded string of the edited image.
 */
export async function editImageWithPrompt(
    base64ImageData: string,
    mimeType: string,
    prompt: string
): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    return part.inlineData.data;
                }
            }
        }
        
        throw new Error("No image was generated in the API response.");

    } catch (error) {
        console.error("Error calling Gemini API for editing:", error);
        throw new Error("Failed to communicate with the AI model. Please check your API key and network connection.");
    }
}

/**
 * Sends an image and a text prompt to the Gemini API to get a text analysis.
 * @param base64ImageData The base64-encoded string of the image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param prompt The text prompt asking a question about the image.
 * @returns A promise that resolves to the text analysis from the model.
 */
export async function analyzeImageWithPrompt(
    base64ImageData: string,
    mimeType: string,
    prompt: string
): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Model for image understanding
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        });

        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for analysis:", error);
        throw new Error("Failed to communicate with the AI model for analysis. Please check your API key and network connection.");
    }
}