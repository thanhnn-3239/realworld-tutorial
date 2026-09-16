export interface MailpitMessageViews {
  text: string;
  html: string;
}

export class MailpitClient {
  constructor(private readonly baseUrl: string) {}

  async getLatestTextMessage(recipient: string): Promise<string | null> {
    const query = `to:"${recipient}"`;
    const url = `${this.baseUrl}/view/latest.txt?query=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(
        `Mailpit request failed with status ${res.status}: ${await res.text()}`,
      );
    }
    return res.text();
  }

  async getLatestHtmlMessage(recipient: string): Promise<string | null> {
    const query = `to:"${recipient}"`;
    const url = `${this.baseUrl}/view/latest.html?query=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(
        `Mailpit request failed with status ${res.status}: ${await res.text()}`,
      );
    }
    return res.text();
  }

  async waitForEmail(
    recipient: string,
    timeoutMs = 10_000,
    intervalMs = 200,
  ): Promise<MailpitMessageViews> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const [text, html] = await Promise.all([
        this.getLatestTextMessage(recipient),
        this.getLatestHtmlMessage(recipient),
      ]);

      if (text !== null && html !== null) {
        return { text, html };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Timed out waiting for email to ${recipient} after ${timeoutMs}ms`,
    );
  }
}
