import json
import datetime
import os
import smtplib
from email.message import EmailMessage
import urllib.request
import urllib.parse

def send_telegram(message, chat_ids=None):
    """Envia uma mensagem via Telegram usando a API de Bot."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    
    if not bot_token:
        print("Aviso: TELEGRAM_BOT_TOKEN não configurado. Pulando Telegram.")
        return
    
    if not chat_ids:
        print("Aviso: Nenhum chat_id do Telegram fornecido. Pulando Telegram.")
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
                    print(f"✅ Telegram enviado com sucesso para o chat_id: {chat_id}")
                else:
                    print(f"❌ Erro no Telegram para {chat_id}: {result}")
        except Exception as e:
            print(f"❌ Erro ao enviar Telegram para {chat_id}: {e}")

def send_email(subject, content, recipient_list=None):
    """Envia um e-mail usando o servidor SMTP configurado."""
    gmail_user = os.environ.get('GMAIL_USER')
    gmail_password = os.environ.get('GMAIL_APP_PASSWORD')
    admin_email = os.environ.get('ADMIN_EMAIL', gmail_user)

    if not gmail_user or not gmail_password:
        print("Erro: Variáveis de ambiente GMAIL_USER ou GMAIL_APP_PASSWORD não configuradas.")
        return

    # Garantir que recipients seja uma lista de strings
    recipients = [str(r) for r in recipient_list] if recipient_list else ([str(admin_email)] if admin_email else [])
    
    if not recipients:
        print("Erro: Nenhum destinatário configurado para o e-mail.")
        return

    msg = EmailMessage()
    msg.set_content(content)
    msg['Subject'] = subject
    msg['From'] = f'Monitor IFVA <{gmail_user}>'
    msg['To'] = ', '.join(recipients)

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(str(gmail_user), str(gmail_password))
            smtp.send_message(msg)
        print(f"E-mail enviado com sucesso para: {', '.join(recipients)}")
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")

def get_brasilia_now():
    """Retorna o horário atual no fuso de Brasília."""
    brasilia_tz = datetime.timezone(datetime.timedelta(hours=-3))
    return datetime.datetime.now(datetime.timezone.utc).astimezone(brasilia_tz)
