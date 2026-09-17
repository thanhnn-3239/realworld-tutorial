export function buildProviderLinkEmailHtml(escapedUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your Google account link</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #373a3c; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 28px 32px; background-color: #ffffff; border-bottom: 2px solid #5cb85c; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #5cb85c; letter-spacing: -0.5px;">conduit</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Account Security</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #2c3e50;">Confirm your Google account link</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #555555;">
                We received a request to sign in with Google using this email address for your Conduit account.
              </p>
              <div style="background-color: #f8fdf8; border-left: 4px solid #5cb85c; padding: 14px 16px; margin: 0 0 24px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; font-size: 14px; color: #2e6930;">
                  <strong>Your account is secure:</strong> Your existing password has not been changed or removed. To finish linking your Google identity, please confirm below.
                </p>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${escapedUrl}" target="_blank" style="display: inline-block; background-color: #5cb85c; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 6px; box-shadow: 0 2px 4px rgba(92, 184, 92, 0.3);">Confirm Google account</a>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #7f8c8d;">
                This link will expire in <strong>15 minutes</strong>. If the button above does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 10px; color: #495057;">
                ${escapedUrl}
              </p>
              <hr style="border: none; border-top: 1px solid #eef0f2; margin: 24px 0;" />
              <p style="margin: 0; font-size: 13px; color: #95a5a6;">
                If you did not make this request, you can safely ignore this email. Your Conduit account and password remain completely secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 32px; background-color: #fafbfc; border-top: 1px solid #edf2f7; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                &copy; Conduit &bull; RealWorld Example Application
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
