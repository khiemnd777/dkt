export {};

const appKey = process.env.YVP_APP_KEY;
const rawAllowed = process.env.YVP_ALLOWED_BIBLE_IDS ?? "";

if (!appKey) {
  console.error("YVP_APP_KEY is required for this opt-in release probe.");
  process.exitCode = 1;
} else {
  const allowed = rawAllowed
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (!allowed.length) {
    console.error("YVP_ALLOWED_BIBLE_IDS must contain at least one approved Bible ID.");
    process.exitCode = 1;
  } else {
    const accessible: Array<{ id: number; abbreviation?: string; language_tag?: string }> = [];
    for (const versionId of allowed) {
      const response = await fetch(`https://api.youversion.com/v1/bibles/${versionId}`, {
        headers: { Accept: "application/json", "X-YVP-App-Key": appKey },
      });
      if (!response.ok || response.status === 204) {
        console.error(
          `YouVersion probe failed for Bible ${versionId} with HTTP ${response.status}.`,
        );
        process.exitCode = 1;
        continue;
      }
      const version = (await response.json()) as {
        id?: number;
        abbreviation?: string;
        language_tag?: string;
      };
      if (version.id !== versionId || !version.language_tag?.toLowerCase().startsWith("vi")) {
        console.error(`Bible ${versionId} is not an accessible Vietnamese version.`);
        process.exitCode = 1;
        continue;
      }
      accessible.push({ ...version, id: versionId });
    }
    if (accessible.length === allowed.length) {
      console.info(
        `YouVersion release probe passed for ${accessible.map((version) => `${version.abbreviation ?? version.id} (${version.language_tag ?? "unknown"})`).join(", ")}.`,
      );
    }
  }
}
