import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const view = (page: Page, name: "Redacted PDF" | "Original text" | "Text to be sent") => page.getByRole("button", { name, exact: true }).click();

const openAnalyze = (page: Page) => page.getByRole("button", { name: "Analyze with AI" }).click();
const openExport = (page: Page) => page.getByRole("button", { name: "Export PDF" }).click();

async function textPdf(text: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Private Source Title");
  pdf.setAuthor("Client Confidential");
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 48, y: 730, size: 16, font, color: rgb(0, 0, 0) });
  return Buffer.from(await pdf.save());
}

function extractPdfText(bytes: Buffer) {
  return [...bytes.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) => inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"))
    .join("\n").replace(/<([0-9A-F]+)>/g, (_, hex: string) => decodeHexString(hex));
}

function decodeHexString(hex: string) {
  const bytes = Buffer.from(hex, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const utf16be = Buffer.from(bytes.subarray(2));
    for (let index = 0; index + 1 < utf16be.length; index += 2) [utf16be[index], utf16be[index + 1]] = [utf16be[index + 1], utf16be[index]];
    return utf16be.toString("utf16le");
  }
  return bytes.toString("latin1");
}

test("explains local PDF handling and optional remote AI analysis on the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Extract and redact PDF text in your browser/i)).toBeVisible();
  await expect(page.getByText(/only the reviewed redacted text is sent for analysis/i)).toBeVisible();
  await expect(page.getByText(/spot the 7 deadly agency traps locally/i)).toHaveCount(0);
});

test("keeps the source local and sends only approved redacted text", async ({ page }) => {
  await page.goto("/app/upload");
  await expect(page.getByLabel(/Remember this session on this device/)).not.toBeChecked();
  const upload = await textPdf("Acme Project. Contact alice@example.com for payment in 90 days.");
  await page.locator('input[type="file"]').setInputFiles({ name: "private-client-contract.pdf", mimeType: "application/pdf", buffer: upload });

  await expect(page.locator("[data-redaction]").first()).toBeVisible();
  await view(page, "Original text");
  await expect(page.getByText("alice@example.com").first()).toBeVisible();
  await view(page, "Text to be sent");
  await expect(page.getByText("[REDACTED_1]", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Text to redact everywhere").fill("Acme Project");
  await page.getByRole("button", { name: "Add redaction" }).click();
  const outgoingPreview = page.getByRole("region", { name: "Redacted document pages", exact: true })
    .getByText(/REDACTED/);
  await expect(outgoingPreview).toBeVisible();

  await openExport(page);
  await page.getByLabel("I reviewed the redacted text above and approve creating this PDF.").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download redacted PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("scopeshield-redacted.pdf");
  const downloadedBytes = await readFile((await download.path())!);
  const exportedPdf = await PDFDocument.load(downloadedBytes);
  expect(exportedPdf.getTitle()).toBe("ScopeShield Redacted Copy");
  expect(exportedPdf.getAuthor()).toBe("ScopeShield");
  const exportedText = extractPdfText(downloadedBytes);
  expect(exportedText).toContain("[REDACTED_");
  expect(exportedText).not.toContain("alice@example.com");
  expect(exportedText).not.toContain("Acme Project");
  const decodedPdf = downloadedBytes.toString("latin1").replace(/<([0-9A-F]+)>/g, (_, hex: string) => decodeHexString(hex));
  expect(decodedPdf).not.toContain("Private Source Title");
  expect(decodedPdf).not.toContain("Client Confidential");
  expect(decodedPdf).not.toContain("private-client-contract.pdf");

  let submitted: Record<string, unknown> | undefined;
  let analysisRequests = 0;
  await page.route("**/api/analyze", async (route) => {
    analysisRequests++;
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ findings: [], notFound: [] }) });
  });
  const consent = page.getByLabel("I reviewed the exact text above and approve sending it for analysis.");
  const addAnotherRedaction = async () => {
    await page.getByLabel("Text to redact everywhere").fill("payment");
    await page.getByRole("button", { name: "Add redaction" }).click();
  };
  await openAnalyze(page);
  await expect(page.getByRole("button", { name: "Analyze redacted text" })).toBeDisabled();
  expect(analysisRequests).toBe(0);
  await consent.check();
  await page.keyboard.press("Escape");
  await addAnotherRedaction();
  await openAnalyze(page);
  await expect(consent).not.toBeChecked();
  await page.keyboard.press("Escape");
  await openExport(page);
  await expect(page.getByLabel("I reviewed the redacted text above and approve creating this PDF.")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await openAnalyze(page);
  await consent.check();
  await page.getByRole("button", { name: "Analyze redacted text" }).click();
  await expect(page).toHaveURL(/\/app\/analysis/);
  await expect(page.getByText("No findings.")).toBeVisible();
  expect(Object.keys(submitted ?? {}).sort()).toEqual(["redactedText"]);
  const outgoing = String(submitted?.redactedText);
  expect(outgoing).toContain("[REDACTED_");
  expect(outgoing).not.toContain("Acme Project");
  expect(outgoing).not.toContain("alice@example.com");
  expect(outgoing).not.toContain("private-client-contract.pdf");
  expect(analysisRequests).toBe(1);
  await page.goto("/app/upload");

  const secondPdf = await textPdf("Second engagement, delivered on 1 July.");
  await page.locator('input[type="file"]').setInputFiles({ name: "another-private-name.pdf", mimeType: "application/pdf", buffer: secondPdf });
  await openAnalyze(page);
  await expect(page.getByLabel("I reviewed the exact text above and approve sending it for analysis.")).not.toBeChecked();
});

test("restores opt-in local sessions and clear session removes them", async ({ page }) => {
  await page.goto("/app/upload");
  await page.getByLabel(/Remember this session on this device/).check();
  const upload = await textPdf("Project Northstar. alice@example.com.");
  await page.locator('input[type="file"]').setInputFiles({ name: "resume-test.pdf", mimeType: "application/pdf", buffer: upload });
  await view(page, "Original text");
  await expect(page.getByText("Project Northstar", { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your saved session was restored from this browser.")).toBeVisible();
  await view(page, "Original text");
  await expect(page.getByText("Project Northstar", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await view(page, "Text to be sent");
  await expect(page.getByRole("region", { name: "Redacted document pages", exact: true }).getByText("alice@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByText("Session cleared.")).toBeVisible();
  await expect(page.getByLabel(/Remember this session on this device/)).not.toBeChecked();
  await page.reload();
  await expect(page.getByText("Project Northstar", { exact: false })).toHaveCount(0);
});

test("offers email account creation for analysis credits and keeps local redaction free", async ({ page }) => {
  await page.goto("/login?next=%2Fpricing");
  await expect(page.getByText("Your PDFs stay on this device.")).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).first().click();
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByRole("button", { name: "Create account" }).last()).toBeEnabled();
  await page.goto("/pricing");
  await expect(page.getByText("Local PDF redaction and review are free. Credits are for AI contract analysis.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy 1 Credit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy 5-Pack" })).toBeVisible();
});

test("sends signed-out purchasers to sign-in and gives analysis users credit guidance", async ({ page }) => {
  await page.route("**/api/billing/checkout", (route) => route.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sign in before buying credits." }),
  }));
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Buy 1 Credit" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fpricing/);

  await page.goto("/app/upload");
  await page.route("**/api/analyze", (route) => route.fulfill({
    status: 402, contentType: "application/json", body: JSON.stringify({ error: "You need an analysis credit to continue.", code: "no_credits" }),
  }));
  const upload = await textPdf("Project Beacon payment terms are due in 30 days.");
  await page.locator('input[type="file"]').setInputFiles({ name: "credit-check.pdf", mimeType: "application/pdf", buffer: upload });
  await openAnalyze(page);
  await page.getByLabel("I reviewed the exact text above and approve sending it for analysis.").check();
  await page.getByRole("button", { name: "Analyze redacted text" }).click();
  await expect(page.getByText("You need an analysis credit to continue.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Buy an analysis credit" })).toHaveAttribute("href", "/pricing");
});

test("OCRs a scanned PDF locally and requires review before analysis", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/app/upload");
  const imageData = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1400; canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black"; context.font = "48px Arial";
    context.fillText("Scan review for alice@example.com and payment terms", 30, 110);
    return canvas.toDataURL("image/png");
  });
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(Buffer.from(imageData.split(",")[1], "base64"));
  const pdfPage = pdf.addPage([612, 792]);
  pdfPage.drawImage(image, { x: 24, y: 610, width: 564, height: 161 });
  await page.locator('input[type="file"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByText(/Local OCR · .*% confidence/).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();
  const ocrText = page.locator("textarea");
  await page.getByLabel("I checked this page against the original PDF.").check();
  await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeEnabled();
  const corrected = (await ocrText.inputValue()).replace("payment terms", "payment terms NET-30");
  await ocrText.fill(corrected);
  await expect(page.getByLabel("I checked this page against the original PDF.")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Analyze with AI" })).toBeDisabled();
  await page.getByLabel("I checked this page against the original PDF.").check();
  await page.route("**/api/analyze", async (route) => {
    expect(route.request().postDataJSON().redactedText).toContain("NET-30");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ findings: [], notFound: [] }) });
  });
  await openAnalyze(page);
  await page.getByLabel("I reviewed the exact text above and approve sending it for analysis.").check();
  await page.getByRole("button", { name: "Analyze redacted text" }).click();
  await expect(page).toHaveURL(/\/app\/analysis/);
  await page.goto("/app/upload");

  const blank = await PDFDocument.create(); blank.addPage([612, 792]);
  await page.locator('input[type="file"]').setInputFiles({ name: "unreadable-scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(await blank.save()) });
  await expect(page.locator('p[role="alert"]')).toContainText("could not be read reliably", { timeout: 90_000 });
});

test("keeps the redacted PDF beside the controls on desktop and stacked on narrow viewports", async ({ page }) => {
  await page.goto("/app/upload");
  await page.locator('input[type="file"]').setInputFiles({
    name: "comparison.pdf", mimeType: "application/pdf",
    buffer: await textPdf(`Contract ${"A".repeat(10)} alice@example.com`),
  });
  const preview = page.getByRole("region", { name: "Redacted PDF preview", exact: true });
  const controls = page.getByRole("region", { name: "Manage redactions", exact: true });
  await expect(preview).toBeVisible();
  await expect(page.locator("[data-redaction]").first()).toBeVisible();
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const left = (await preview.boundingBox())!;
    const right = (await controls.boundingBox())!;
    if (width >= 768) expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
    else expect(right.y).toBeGreaterThan(left.y + left.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
