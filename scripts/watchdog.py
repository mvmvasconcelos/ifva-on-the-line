import json
import datetime
import os
import sys
from notifier import send_email, send_telegram, get_brasilia_now

# Configuração
# Permite sobrescrever via variável de ambiente, padrão de 10 minutos
TIMEOUT_MINUTES = int(os.environ.get('TIMEOUT_MINUTES', 10))
JSON_PATH = 'data/status.json'

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
            now_brasilia = get_brasilia_now()
            
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
