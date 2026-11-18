export function getAppBaseUrl(value: string | undefined = process.env.APP_BASE_URL) {
  if (!value) throw new Error("APP_BASE_URL is not configured.");
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("APP_BASE_URL must be a valid URL."); }
  if ((url.protocol !== "https:" && url.hostname !== "localhost") || url.username || url.password || url.search || url.hash) {
    throw new Error("APP_BASE_URL must be an HTTPS origin (HTTP is allowed for localhost).");
  }
  return url;
}
