import type { MediaSafetyProvider } from "../integrations/openai/media-safety-provider";
import type { QuestionMediaService } from "../question-media/service";
import type { QuestionIntelligenceOptions } from "./service";

/** Called only by the opt-in AI endpoint, never by upload, playback or room creation. */
export async function prepareMediaInput(
  mediaService: Pick<QuestionMediaService, "readAsset">,
  safety: MediaSafetyProvider,
  assetId: string,
  capability: string,
  transcriptionModel: string,
): Promise<NonNullable<QuestionIntelligenceOptions["mediaInput"]>> {
  const { media, bytes } = await mediaService.readAsset(assetId, capability);
  if (media.kind === "IMAGE") {
    await safety.moderateImage({
      bytes: new Uint8Array(bytes),
      mimeType: media.mimeType,
      accessibilityText: media.accessibilityText,
    });
    return {
      media,
      image: { mimeType: media.mimeType as "image/jpeg" | "image/png" | "image/webp", bytes },
    };
  }
  const audioTranscript = await safety.transcribeAudio({
    bytes: new Uint8Array(bytes),
    model: transcriptionModel,
  });
  await safety.moderateText(`${media.accessibilityText}\n${audioTranscript}`);
  return { media, audioTranscript };
}
