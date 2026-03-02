import json
import datetime
import os
import smtplib
from email.message import EmailMessage
import sys
import urllib.request
import urllib.parse

# Configuração
# Permite sobrescrever via variável de ambiente, padrão de 10 minutos
TIMEOUT_MINUTES = int(os.environ.get('TIMEOUT_MINUTES', 10))
JSON_PATH = 'data/status.json'

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
    admin_email = os.environ.get('ADMIN_EMAIL', gmail_user) # Fallback

    if not gmail_user or not gmail_password:
        print("Erro: Variáveis de ambiente GMAIL_USER ou GMAIL_APP_PASSWORD não configuradas.")
        return

    # Usa a lista de destinatários se fornecida, caso contrário usa o admin_email
    recipients = recipient_list if recipient_list else [admin_email]
    
    msg = EmailMessage()
    msg.set_content(content)
    msg['Subject'] = subject
    msg['From'] = f'Monitor IFVA <{gmail_user}>'
    msg['To'] = ', '.join(recipients)

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(gmail_user, gmail_password)
            smtp.send_message(msg)
        print(f"E-mail enviado com sucesso para: {', '.join(recipients)}")
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")

def main():
    try:
        if not os.path.exists(JSON_PATH):
            print(f"Erro: {JSON_PATH} não encontrado.")
            sys.exit(1)

        with open(JSON_PATH, 'r') as f:
            data = json.load(f)
        
        last_seen_str = data.get('last_seen')
        if not last_seen_str:
            print("Nenhum timestamp 'last_seen' encontrado.")
            # Se nunca foi visto, não alertamos para evitar ruído em novas instalações.
            return
        
        # Analisa o timestamp (ISO format UTC)
        try:
            if last_seen_str.endswith('Z'):
                last_seen = datetime.datetime.fromisoformat(last_seen_str.replace('Z', '+00:00'))
            else:
                last_seen = datetime.datetime.fromisoformat(last_seen_str)
        except ValueError as e:
            print(f"Erro ao analisar data {last_seen_str}: {e}")
            return

        # Comparação com horário UTC
        now = datetime.datetime.now(datetime.timezone.utc)
        diff = now - last_seen
        minutes_diff = diff.total_seconds() / 60
        
        print(f"Último sinal: {last_seen.isoformat()}")
        print(f"Agora:        {now.isoformat()}")
        print(f"Diferença:    {minutes_diff:.2f} minutos")
        
        current_status = data.get('status', 'offline')
        
        # Lógica: Se tempo limite excedido e status atual é online
        if minutes_diff > TIMEOUT_MINUTES and current_status == 'online':
            print(f"TEMPO LIMITE EXCEDIDO ({TIMEOUT_MINUTES}m). Definindo status como OFFLINE.")
            
            data['status'] = 'offline'
            
            incident = {
                'timestamp': now.isoformat().replace('+00:00', 'Z'),
                'type': 'offline_detected',
                'duration_minutes': 0
            }
            if 'history' not in data:
                data['history'] = []
            data['history'].insert(0, incident)
            
            with open(JSON_PATH, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Conversão para horário de Brasília para os alertas
            brasilia_tz = datetime.timezone(datetime.timedelta(hours=-3))
            now_brasilia = now.astimezone(brasilia_tz)
            
            alert_emails = data.get('config', {}).get('alert_emails', [])
            
            # Alerta E-mail
            subject = f"🔴 ALERTA: IFSul Offline (>{int(minutes_diff)}min)"
            body = (
                f"O sistema de monitoramento detectou que o campus está incomunicável.\n\n"
                f"Último contato: {last_seen_str}\n"
                f"Tempo decorrido: {int(minutes_diff)} minutos\n"
                f"Data do alerta: {now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')} (Horário de Brasília)\n\n"
                f"Verifique a conexão de internet ou energia no local."
            )
            send_email(subject, body, alert_emails if alert_emails else None)
            
            # Alerta Telegram
            telegram_config = data.get('config', {}).get('telegram', {})
            if telegram_config.get('enabled') and telegram_config.get('chat_ids'):
                telegram_msg = (
                    f"🔴 *ALERTA: IFSul Offline*\n\n"
                    f"O sistema não reporta contato há *{int(minutes_diff)} minutos*.\n"
                    f"Último visto: {now_brasilia.strftime('%H:%M:%S')}"
                )
                send_telegram(telegram_msg, telegram_config.get('chat_ids'))
        else:
            print("Status OK.")
            
    except Exception as e:
        print(f"Erro inesperado no watchdog: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
