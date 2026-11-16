from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import hashlib
import hmac
import html
import logging
from pathlib import Path
import secrets
import smtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


def generate_otp_code() -> str:
    """Generate a cryptographically random 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900000) + 100000:06d}"


def hash_otp_code(otp_code: str) -> str:
    """Compute an HMAC-SHA256 digest of the OTP code using the application secret key."""
    settings = get_settings()
    normalized = otp_code.strip()
    return hmac.new(
        settings.secret_key.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp_code(otp_code: str, otp_code_hash: str | None) -> bool:
    """Constant-time verification of a 6-digit OTP against its stored HMAC hash."""
    if not otp_code_hash:
        return False
    expected = hash_otp_code(otp_code)
    return hmac.compare_digest(expected, otp_code_hash)


def _resolve_logo_path() -> Path | None:
    """Locate the VeriPie PNG logo for inline CID email attachment."""
    candidates = [
        Path(__file__).resolve().parent / "assets" / "logo.png",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "logo.png",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def build_otp_email_html(
    full_name: str,
    username: str,
    otp_code: str,
    expire_minutes: int,
    has_inline_logo: bool,
    purpose: str = "register",
) -> str:
    """Build a responsive, inline-styled HTML email in the VeriPie Warm Rigor palette."""
    safe_name = html.escape(full_name or username)
    safe_username = html.escape(username)
    spaced_otp = " ".join(list(otp_code.strip()))

    is_reset = purpose == "reset_password"
    page_title = "VeriPie Password Reset" if is_reset else "VeriPie Email Verification"
    badge_label = "Password Reset" if is_reset else "Email Verification"
    headline = "Reset your account password" if is_reset else "Confirm your email address"
    prompt_desc = (
        "Enter the following 6-digit verification code to reset the password for your VeriPie account:"
        if is_reset
        else "Enter the following 6-digit verification code in the VeriPie Instructor Sign-In window to activate your grading workspace:"
    )
    security_note = (
        "Never share this code with anyone. If you did not request a password reset, your account is safe and you can safely ignore this email."
        if is_reset
        else "Never share this code with anyone. If you did not request a VeriPie Instructor account, you can safely ignore this email."
    )

    logo_block = (
        '<img src="cid:veripie_logo" alt="VeriPie" width="136" '
        'style="display:block;height:auto;max-height:44px;width:auto;border:0;outline:none;" />'
        if has_inline_logo
        else (
            '<span style="font-family:Georgia,serif;font-size:22px;font-weight:700;'
            'color:#FCF0DA;letter-spacing:-0.02em;">VeriPie</span>'
        )
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{page_title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FCF0DA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4C4541;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FCF0DA;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFDF9;border:2px solid #D5CEB8;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(76,69,65,0.10);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#4C4541;padding:22px 28px;border-bottom:3px solid #F2C46A;">
              {logo_block}
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:32px 28px 24px 28px;">
              <p style="margin:0 0 6px 0;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;color:#8F8782;text-transform:uppercase;letter-spacing:0.08em;">
                {badge_label}
              </p>
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:800;color:#4C4541;">
                {headline}
              </h1>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#6B625B;">
                Hello <strong style="color:#4C4541;">{safe_name}</strong> (<code style="font-family:'Courier New',Courier,monospace;background-color:#FCF0DA;padding:2px 6px;border-radius:4px;color:#4C4541;">@{safe_username}</code>),
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#6B625B;">
                {prompt_desc}
              </p>

              <!-- 6-Digit OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color:#FCF0DA;border:2px solid #F2C46A;border-radius:14px;padding:22px 16px;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;color:#6B625B;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
                      One-Time Verification Code
                    </div>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:0.22em;color:#4C4541;line-height:1.2;">
                      {spaced_otp}
                    </div>
                    <div style="margin-top:10px;font-size:12px;color:#6B625B;">
                      Valid for <strong style="color:#4C4541;">{expire_minutes} minutes</strong> &middot; Single use only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F7F2E7;border-left:4px solid #AEAC78;border-radius:8px;padding:12px 14px;">
                <tr>
                  <td style="font-size:12px;line-height:1.5;color:#6B625B;">
                    <strong style="color:#4C4541;">Security Notice:</strong> {security_note}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F7F2E7;padding:16px 28px;border-top:1px solid #E5DEC9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#6B625B;">
                    Evidence First &middot; Human Decision Last
                  </td>
                  <td align="right" style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#8F8782;">
                    VeriPie Engine
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_otp_email(
    recipient_email: str,
    full_name: str,
    username: str,
    otp_code: str,
    purpose: str = "register",
) -> bool:
    """Send the 6-digit OTP email via Google/SMTP with inline VeriPie logo.

    Returns True if delivered via SMTP, or False if running in local/sandbox fallback mode.
    """
    settings = get_settings()
    smtp_user = settings.smtp_user.strip()
    # Strip spaces so 16-char Google App Passwords ("xxxx xxxx xxxx xxxx") work seamlessly
    smtp_password = settings.smtp_password.replace(" ", "").strip()
    raw_from = settings.smtp_from_email.strip()
    sender_email = raw_from if raw_from.count("@") == 1 else smtp_user

    if not smtp_user or not smtp_password:
        logger.info(
            "[OTP] SMTP credentials not configured. OTP for %s (@%s) [%s]: %s",
            recipient_email,
            username,
            purpose,
            otp_code,
        )
        return False

    logo_path = _resolve_logo_path()
    has_inline_logo = logo_path is not None

    is_reset = purpose == "reset_password"
    subject = (
        f"[{otp_code}] Your VeriPie Password Reset Code"
        if is_reset
        else f"[{otp_code}] Your VeriPie Instructor Verification Code"
    )

    msg_root = MIMEMultipart("related")
    msg_root["Subject"] = subject
    msg_root["From"] = formataddr((settings.smtp_from_name, sender_email))
    msg_root["To"] = formataddr((full_name or username, recipient_email))

    msg_alternative = MIMEMultipart("alternative")
    msg_root.attach(msg_alternative)

    topic = "Password Reset" if is_reset else "Email Verification"
    action = (
        "reset the password for your VeriPie account"
        if is_reset
        else "activate your VeriPie Instructor workspace"
    )
    fallback = (
        "If you did not request a password reset, please ignore this email."
        if is_reset
        else "If you did not request this account, please ignore this email."
    )

    plain_text = (
        f"VeriPie Instructor Workstation - {topic}\n\n"
        f"Hello {full_name or username} (@{username}),\n\n"
        f"Your 6-digit verification code to {action} is: {otp_code}\n\n"
        f"This code expires in {settings.otp_expire_minutes} minutes.\n"
        f"{fallback}\n"
    )
    html_body = build_otp_email_html(
        full_name=full_name,
        username=username,
        otp_code=otp_code,
        expire_minutes=settings.otp_expire_minutes,
        has_inline_logo=has_inline_logo,
        purpose=purpose,
    )

    msg_alternative.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg_alternative.attach(MIMEText(html_body, "html", "utf-8"))

    if logo_path is not None:
        try:
            logo_bytes = logo_path.read_bytes()
            image_part = MIMEImage(logo_bytes, _subtype="png")
            image_part.add_header("Content-ID", "<veripie_logo>")
            image_part.add_header("Content-Disposition", "inline", filename="veripie-logo.png")
            msg_root.attach(image_part)
        except Exception as exc:
            logger.warning("Could not attach inline logo to OTP email: %s", exc)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.user = smtp_user
            server.password = smtp_password
            server.auth("PLAIN", server.auth_plain, initial_response_ok=True)
            server.sendmail(sender_email, [recipient_email], msg_root.as_string())
        logger.info("Sent OTP verification email to %s via %s", recipient_email, settings.smtp_host)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        smtp_msg = exc.smtp_error.decode("utf-8", errors="replace") if isinstance(exc.smtp_error, bytes) else str(exc.smtp_error)
        logger.error("SMTP authentication failed (%s) for %s: %s", exc.smtp_code, smtp_user, smtp_msg)
        raise RuntimeError(
            f"SMTP Error {exc.smtp_code}: {smtp_msg}"
        ) from exc
    except smtplib.SMTPServerDisconnected as exc:
        logger.error("SMTP connection closed for %s: %s", smtp_user, exc)
        raise RuntimeError(
            f"SMTP connection closed by {settings.smtp_host} for '{smtp_user}'. Check SMTP_USER and SMTP_PASSWORD in .env."
        ) from exc
    except Exception as exc:
        logger.error("Failed to send OTP email via SMTP: %s", exc)
        raise RuntimeError(f"Could not deliver verification email via SMTP: {exc}") from exc
