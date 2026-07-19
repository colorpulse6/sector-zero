import type { TestInfo } from "@playwright/test";

export interface BrowserReceiptInput {
  route: string;
  inputMethod: "keyboard" | "pointer" | "touch";
  saveFixture: string;
  expectedOutcome: string;
  observedOutcome: string;
  evidence?: string;
}

export interface BrowserReceipt extends BrowserReceiptInput {
  commit: string;
  project: string;
  viewport: string;
}

export async function attachBrowserReceipt(
  testInfo: TestInfo,
  input: BrowserReceiptInput,
): Promise<BrowserReceipt> {
  const viewport = testInfo.project.use.viewport;
  const receipt: BrowserReceipt = {
    commit: process.env.TESTED_CODE_SHA ?? process.env.GITHUB_SHA ?? "working-tree",
    project: testInfo.project.name,
    viewport: viewport ? `${viewport.width}x${viewport.height}` : "browser-default",
    ...input,
  };
  await testInfo.attach("browser-receipt", {
    body: Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`),
    contentType: "application/json",
  });
  return receipt;
}
