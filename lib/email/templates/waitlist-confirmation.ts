import type { WaitlistEmailData } from '@/lib/email/resend';

export const WAITLIST_LOGO_CONTENT_ID = 'islanda-mark';
export const ISLANDA_PUBLIC_URL = 'https://islanda.app';
export const SOLVANE_HUB_URL = 'https://solvanehub.us';
export const SOLVANE_HUB_INSTAGRAM_URL = 'https://www.instagram.com/solvanehubtech/';

export interface WaitlistConfirmationMessage {
  to: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

/** Builds a client-safe, table-based confirmation email and its plain-text fallback. */
export function buildWaitlistConfirmationMessage(
  data: WaitlistEmailData,
): WaitlistConfirmationMessage {
  const greeting = data.firstName.trim() || 'there';
  const safeGreeting = escapeHtml(greeting);
  const preheader = "Thanks for joining Islanda — we'll keep you posted.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>You're on the Islanda waitlist</title>
    <style>
      @media only screen and (max-width: 480px) {
        .card-pad { padding: 34px 26px 32px !important; }
        .headline { font-size: 26px !important; line-height: 33px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#07111d;color:#f4f7fa;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;font-size:1px;color:#07111d;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#07111d" style="width:100%;background-color:#07111d;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 12px 28px;">
          <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;">
            <tr>
              <td align="center" style="padding:4px 24px 20px;">
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="padding-right:12px;">
                      <img src="cid:${WAITLIST_LOGO_CONTENT_ID}" width="38" height="62" alt="Islanda mark" style="display:block;width:38px;height:62px;border:0;outline:none;text-decoration:none;">
                    </td>
                    <td valign="middle" align="left" style="font-family:Arial,Helvetica,sans-serif;">
                      <div style="color:#f4f7fa;font-size:23px;font-weight:600;line-height:28px;letter-spacing:-0.4px;">Islanda</div>
                      <div style="padding-top:3px;color:#98a9ba;font-size:11px;line-height:16px;letter-spacing:1.1px;text-transform:uppercase;">Navigate What's Next.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="card-pad" bgcolor="#101c2a" style="padding:46px 48px 42px;background-color:#101c2a;border:1px solid #192838;border-radius:10px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 18px;">
                      <span style="display:inline-block;padding:8px 11px;border:1px solid #24535d;border-radius:999px;background-color:#102b35;color:#79d8d0;font-size:10px;font-weight:700;line-height:12px;letter-spacing:1.25px;">YOU'RE ON THE LIST</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 26px;">
                      <div style="width:36px;height:2px;line-height:2px;font-size:0;background-color:#2f8c86;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="headline" style="padding:0 0 22px;color:#f4f7fa;font-size:30px;font-weight:600;line-height:37px;letter-spacing:-0.6px;">You're officially on the&nbsp;list.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 10px;color:#f4f7fa;font-size:17px;font-weight:600;line-height:26px;">Hi ${safeGreeting},</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 12px;color:#d5dee7;font-size:16px;line-height:26px;">Thanks for joining the Islanda waitlist.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 28px;color:#aab8c7;font-size:15px;line-height:25px;">We're building Islanda to help businesses understand where they are, make sense of what matters, and navigate what's next.</td>
                  </tr>
                  <tr>
                    <td style="padding:22px 0 30px;border-top:1px solid #1d2c3d;">
                      <div style="color:#f4f7fa;font-size:14px;font-weight:700;line-height:21px;">What's next?</div>
                      <div style="padding-top:4px;color:#aab8c7;font-size:15px;line-height:24px;">We'll keep you updated as we get closer to opening Islanda.</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" style="padding:0;">
                      <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse:separate;">
                        <tr>
                          <td align="center" bgcolor="#d8f3ef" style="border-radius:8px;background-color:#d8f3ef;">
                            <a href="${ISLANDA_PUBLIC_URL}" target="_blank" style="display:inline-block;padding:14px 22px;border:1px solid #d8f3ef;border-radius:8px;color:#0b1a22;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;text-decoration:none;">Explore Islanda &rarr;</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px 0 0;color:#79d8d0;font-size:14px;font-weight:600;line-height:21px;letter-spacing:0.15px;">Navigate What's Next.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 20px 0;color:#8495a6;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;">
                <div style="color:#c7d1dc;font-size:13px;font-weight:600;">Islanda</div>
                <div style="padding-top:2px;">A Solvane Hub product</div>
                <div style="padding-top:10px;">
                  <a href="${SOLVANE_HUB_URL}" target="_blank" style="color:#9fb8c8;text-decoration:underline;">Solvane Hub</a>
                  <span style="padding:0 7px;color:#506172;">·</span>
                  <a href="${SOLVANE_HUB_INSTAGRAM_URL}" target="_blank" style="color:#9fb8c8;text-decoration:underline;">Instagram</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "YOU'RE ON THE LIST",
    '',
    "You're officially on the list.",
    '',
    `Hi ${greeting},`,
    '',
    'Thanks for joining the Islanda waitlist.',
    '',
    "We're building Islanda to help businesses understand where they are, make sense of what matters, and navigate what's next.",
    '',
    "What's next?",
    "We'll keep you updated as we get closer to opening Islanda.",
    '',
    `Explore Islanda → ${ISLANDA_PUBLIC_URL}`,
    '',
    "Navigate What's Next.",
    '',
    'Islanda — A Solvane Hub product',
    `Solvane Hub: ${SOLVANE_HUB_URL}`,
    `Instagram: ${SOLVANE_HUB_INSTAGRAM_URL}`,
  ].join('\n');

  return {
    to: data.email,
    subject: "You're on the Islanda waitlist",
    preheader,
    html,
    text,
  };
}
