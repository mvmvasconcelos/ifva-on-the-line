import json
import datetime
import os
import smtplib
from email.message import EmailMessage
import sys
import urllib.request
import urllib.parse

# Configuration
# Allow override via env var, default to 10 minutes
TIMEOUT_MINUTES = int(os.environ.get('TIMEOUT_MINUTES', 10))
JSON_PATH = 'data/status.json'

def send_telegram(message, chat_ids=None):
    """Sends a Telegram message using the Bot API."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    
    if not bot_token:
        print("Warning: TELEGRAM_BOT_TOKEN not set. Skipping Telegram.")
        return
    
    if not chat_ids:
        print("Warning: No Telegram chat_ids provided. Skipping Telegram.")
        return
    
    base_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    for chat_id in chat_ids:
        try:
            params = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }
            
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request(base_url, data=data)
            
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                if result.get('ok'):
                    print(f"✅ Telegram sent successfully to chat_id: {chat_id}")
                else:
                    print(f"❌ Telegram error for {chat_id}: {result}")
        except Exception as e:
            print(f"❌ Error sending Telegram to {chat_id}: {e}")

def send_email(subject, content, recipient_list=None):
    """Sends an email using the configured SMTP server."""
    gmail_user = os.environ.get('GMAIL_USER')
    gmail_password = os.environ.get('GMAIL_APP_PASSWORD')
    admin_email = os.environ.get('ADMIN_EMAIL', gmail_user) # Fallback

    if not gmail_user or not gmail_password:
        print("Error: GMAIL_USER or GMAIL_APP_PASSWORD environment variables not set.")
        return

    # Use recipient list if provided, otherwise fallback to admin_email
    recipients = recipient_list if recipient_list else [admin_email]
    
    msg = EmailMessage()
    msg.set_content(content)
    msg['Subject'] = subject
    msg['From'] = f'IFVA Monitor <{gmail_user}>'
    msg['To'] = ', '.join(recipients)

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(gmail_user, gmail_password)
            smtp.send_message(msg)
        print(f"Email sent successfully to: {', '.join(recipients)}")
    except Exception as e:
        print(f"Error sending email: {e}")

def main():
    try:
        if not os.path.exists(JSON_PATH):
            print(f"Error: {JSON_PATH} not found.")
            sys.exit(1)

        with open(JSON_PATH, 'r') as f:
            data = json.load(f)
        
        last_seen_str = data.get('last_seen')
        if not last_seen_str:
            print("No last_seen timestamp found.")
            # If never seen, maybe it's fresh. Don't alert yet? Or alert? 
            # Let's assume we don't alert if it's empty to avoid noise on new setups.
            return
        
        # Parse the timestamp. 
        # The file is expected to be in ISO format ending in 'Z' (UTC)
        try:
            # Python 3.11+ supports 'Z'. For older versions, replace with +00:00
            if last_seen_str.endswith('Z'):
                last_seen = datetime.datetime.fromisoformat(last_seen_str.replace('Z', '+00:00'))
            else:
                last_seen = datetime.datetime.fromisoformat(last_seen_str)
        except ValueError as e:
            print(f"Error parsing date {last_seen_str}: {e}")
            return

        # Ensure we compare with UTC time
        now = datetime.datetime.now(datetime.timezone.utc)
        
        diff = now - last_seen
        minutes_diff = diff.total_seconds() / 60
        
        print(f"Last seen: {last_seen.isoformat()}")
        print(f"Now:       {now.isoformat()}")
        print(f"Difference: {minutes_diff:.2f} minutes")
        
        current_status = data.get('status', 'offline')
        
        # Logic: If timeout exceeded AND currently marked online
        if minutes_diff > TIMEOUT_MINUTES and current_status == 'online':
            print(f"TIMEOUT EXCEEDED ({TIMEOUT_MINUTES}m). Setting status to OFFLINE.")
            
            # 1. Update Status
            data['status'] = 'offline'
            
            # 2. Add to history
            incident = {
                'timestamp': now.isoformat().replace('+00:00', 'Z'), # Keep unified format
                'type': 'offline_detected',
                'duration_minutes': 0 # We don't know duration yet, it just started
            }
            if 'history' not in data:
                data['history'] = []
            
            # Prepend to history
            data['history'].insert(0, incident)
            
            # 3. Save JSON
            with open(JSON_PATH, 'w') as f:
                json.dump(data, f, indent=2)
            
            # 4. Send Alerts (Email + Telegram)
            # Convert to Brasília time for display
            brasilia_tz = datetime.timezone(datetime.timedelta(hours=-3))
            now_brasilia = now.astimezone(brasilia_tz)
            
            # Get email list from config
            alert_emails = data.get('config', {}).get('alert_emails', [])
            
            # Email alert
            subject = f"🔴 ALERTA: IFSul Offline (>{int(minutes_diff)}min)"
            body = (
                f"O sistema de monitoramento detectou que o campus está incomunicável.\n\n"
                f"Último contato: {last_seen_str}\n"
                f"Tempo decorrido: {int(minutes_diff)} minutos\n"
                f"Data do alerta: {now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')} (Horário de Brasília)\n\n"
                f"Verifique a conexão de internet ou energia no local."
            )
            send_email(subject, body, alert_emails if alert_emails else None)
            
            # Telegram alert
            telegram_config = data.get('config', {}).get('telegram', {})
            if telegram_config.get('enabled', False):
                chat_ids = telegram_config.get('chat_ids', [])
                telegram_message = (
                    f"🚨 *ALERTA: Sistema Offline*\n\n"
                    f"🏫 *Local:* IFSul Venâncio Aires\n"
                    f"⏰ *Último sinal:* {now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')}\n"
                    f"⌛ *Tempo decorrido:* {int(minutes_diff)} minutos\n\n"
                    f"Por favor, verifique a conectividade do campus."
                )
                send_telegram(telegram_message, chat_ids)
            
        elif current_status == 'offline':
            print("System is already offline. No new alert.")
            # Optional: We could update the duration of the open incident here if we wanted.
            
        else:
            print("System is online and within timeout limits.")

    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
