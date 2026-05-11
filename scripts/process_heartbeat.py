import json
import datetime
import os
import sys
from notifier import send_email, send_telegram, get_brasilia_now

TIMEOUT_MINUTES = 17
JSON_PATH = 'data/status.json'


def to_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'y', 'on')
    return bool(value)

def parse_time(ts):
    if ts.endswith('Z'):
        return datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return datetime.datetime.fromisoformat(ts)


def read_client_payload():
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if not event_path or not os.path.exists(event_path):
        return {}

    try:
        with open(event_path, 'r') as f:
            event_data = json.load(f)
        payload = event_data.get('client_payload', {})
        return payload if isinstance(payload, dict) else {}
    except Exception as err:
        print(f'Aviso: nao foi possivel ler client_payload: {err}')
        return {}


def infer_provisional_cause(payload):
    probe = payload.get('probe', {}) if isinstance(payload, dict) else {}
    if not isinstance(probe, dict) or not probe:
        return 'unknown', 'low'

    gateway_ok = to_bool(probe.get('gateway_ok', True))
    internet_ok = to_bool(probe.get('internet_ok', True))

    if (not gateway_ok):
        return 'interno', 'high'
    if gateway_ok and (not internet_ok):
        return 'externo', 'high'
    return 'unknown', 'low'


def update_v2_fields(data, payload):
    if 'v2' not in data or not isinstance(data['v2'], dict):
        data['v2'] = {}

    cause, confidence = infer_provisional_cause(payload)
    probe = payload.get('probe', {}) if isinstance(payload, dict) else {}

    data['v2']['cause_provisional'] = cause
    data['v2']['cause_confidence'] = confidence
    data['v2']['last_probe'] = {
        'timestamp': payload.get('ts'),
        'gateway_ok': probe.get('gateway_ok'),
        'internet_ok': probe.get('internet_ok'),
        'dns_ok': probe.get('dns_ok'),
        'pending_count': payload.get('pending_count', 0),
        'seq': payload.get('seq')
    }
    data['v2']['pending_count'] = payload.get('pending_count', 0)

    # Mantem online/offline para compatibilidade atual do frontend.
    data['status_detail'] = 'online'

def main():
    try:
        with open(JSON_PATH, 'r') as f:
            data = json.load(f)

        payload = read_client_payload()

        now = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now.isoformat().replace('+00:00', 'Z')
        last_seen_str = data.get('last_seen')
        current_status = data.get('status', 'online')

        if 'history' not in data:
            data['history'] = []

        if last_seen_str:
            last_seen = parse_time(last_seen_str)
            gap_minutes = (now - last_seen).total_seconds() / 60
            print(f'Gap desde último sinal: {gap_minutes:.1f} minutos')

            # CASO 1: Estava online, mas o gap indica que houve queda que o watchdog não pegou
            if current_status == 'online' and gap_minutes > TIMEOUT_MINUTES:
                print(f'Queda não registrada detectada! Gap de {gap_minutes:.1f} min.')
                incidente = {
                    'timestamp': last_seen_str,
                    'type': 'offline_detected',
                    'duration_minutes': round(float(gap_minutes), 1)
                }
                data['history'].insert(0, incidente)
                
                # ENVIAR ALERTA DE SISTEMA VOLTOU (POST-MORTEM)
                now_brasilia = get_brasilia_now()
                alert_emails = data.get('config', {}).get('alert_emails', [])
                
                # Alerta E-mail
                subject = f"✅ RECUPERADO: IFSul de volta após queda (>{int(gap_minutes)}min)"
                body = (
                    f"O sistema de monitoramento detectou que o campus voltou a responder.\n\n"
                    f"A queda não havia sido capturada pelo watchdog original.\n"
                    f"Aproximadamente {int(gap_minutes)} minutos offline.\n"
                    f"Último contato antes da queda: {last_seen_str}\n"
                    f"Voltou em: {now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')} (Horário de Brasília)\n"
                )
                send_email(subject, body, alert_emails if alert_emails else None)
                
                # Alerta Telegram
                telegram_config = data.get('config', {}).get('telegram', {})
                if telegram_config.get('enabled') and telegram_config.get('chat_ids'):
                    telegram_msg = (
                        f"✅ *RECUPERADO: IFSul Online*\n\n"
                        f"O sistema voltou após uma queda de *{int(gap_minutes)} minutos*.\n"
                        f"Voltou em: {now_brasilia.strftime('%H:%M:%S')}"
                    )
                    send_telegram(telegram_msg, telegram_config.get('chat_ids'))

            # CASO 2: Estava oficialmente offline (watchdog já registrou) - atualiza a duração
            elif current_status == 'offline':
                print('Recuperando de estado OFFLINE registrado pelo watchdog.')
                if len(data['history']) > 0:
                    ultimo_evento = data['history'][0]
                    if ultimo_evento.get('type') in ('offline_detected', 'offline'):
                        evento_ts = parse_time(ultimo_evento['timestamp'])
                        duracao = (now - evento_ts).total_seconds() / 60
                        ultimo_evento['duration_minutes'] = round(float(duracao), 1)
                        if isinstance(ultimo_evento, dict) and 'cause_final' not in ultimo_evento:
                            cause, _ = infer_provisional_cause(payload)
                            if cause != 'unknown':
                                ultimo_evento['cause_final'] = cause
                        print(f'Duração da queda atualizada: {duracao:.1f} min')

        # Atualiza status e last_seen
        data['last_seen'] = now_iso
        data['status'] = 'online'
        update_v2_fields(data, payload)

        with open(JSON_PATH, 'w') as f:
            json.dump(data, f, indent=2)

        print('Status atualizado para ONLINE.')

    except Exception as e:
        print(f'Erro no process_heartbeat: {e}')
        sys.exit(1)

if __name__ == "__main__":
    main()
