import datetime
import json
import os
import sys

from notifier import DASHBOARD_URL, get_brasilia_now, send_email, send_telegram

TIMEOUT_MINUTES = int(os.environ.get('TIMEOUT_MINUTES', 10))
MERGE_WINDOW_MINUTES = 20
JSON_PATH = 'data/status.json'
INCIDENTS_PATH = 'data/incidents.json'
HISTORY_LIMIT = 200


def load_json_file(path, default):
    if not os.path.exists(path):
        return default

    try:
        with open(path, 'r') as file_handle:
            data = json.load(file_handle)
        return data if data is not None else default
    except Exception as err:
        print(f'Aviso: nao foi possivel ler {path}: {err}')
        return default


def save_json_file(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as file_handle:
        json.dump(data, file_handle, indent=2)


def parse_time(ts):
    if ts.endswith('Z'):
        return datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return datetime.datetime.fromisoformat(ts)


def to_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'y', 'on')
    return bool(value)


def load_incident_store(data):
    incident_store = load_json_file(INCIDENTS_PATH, {'incidents': []})
    if not isinstance(incident_store, dict):
        incident_store = {'incidents': []}
    if not isinstance(incident_store.get('incidents'), list):
        incident_store['incidents'] = []

    if not incident_store['incidents'] and data.get('history'):
        incident_store['incidents'] = []
        for index, event in enumerate(reversed(data.get('history', []))):
            if not isinstance(event, dict):
                continue
            timestamp = event.get('timestamp')
            if not timestamp:
                continue
            incident_store['incidents'].append({
                'id': f'legacy-{index}-{timestamp}',
                'timestamp': timestamp,
                'started_at': timestamp,
                'detected_at': timestamp,
                'ended_at': timestamp,
                'state': 'closed',
                'type': event.get('type', 'offline_detected'),
                'duration_minutes': event.get('duration_minutes', 0),
                'cause_provisional': event.get('cause_provisional', 'unknown'),
                'cause_final': event.get('cause_final', 'unknown'),
                'sample_count': event.get('sample_count', 0),
            })

    return incident_store


def latest_probe(data):
    return data.get('v2', {}).get('last_probe', {}) if isinstance(data.get('v2', {}), dict) else {}


def infer_provisional_cause_from_probe(probe):
    if not isinstance(probe, dict) or not probe:
        return 'unknown', 'low'

    gateway_ok = to_bool(probe.get('gateway_ok', True))
    internet_ok = to_bool(probe.get('internet_ok', True))

    if not gateway_ok:
        return 'interno', 'high'
    if gateway_ok and not internet_ok:
        return 'externo', 'high'
    return 'unknown', 'low'


def project_history_from_incidents(incidents):
    history = []
    for incident in reversed(incidents):
        if not isinstance(incident, dict):
            continue
        history.append({
            'timestamp': incident.get('timestamp') or incident.get('started_at'),
            'type': incident.get('type', 'offline_detected'),
            'duration_minutes': incident.get('duration_minutes', 0),
            'cause_provisional': incident.get('cause_provisional', 'unknown'),
            'cause_final': incident.get('cause_final', 'unknown'),
            'state': incident.get('state', 'closed'),
            'sample_count': incident.get('sample_count', 0),
        })
    return history[:HISTORY_LIMIT]


def append_open_incident(incidents, timestamp, detected_at, cause_provisional):
    incidents.append({
        'id': f'{timestamp}-{detected_at}-open',
        'timestamp': timestamp,
        'started_at': timestamp,
        'detected_at': detected_at,
        'ended_at': None,
        'state': 'open',
        'type': 'offline_detected',
        'duration_minutes': 0,
        'cause_provisional': cause_provisional,
        'cause_final': None,
        'sample_count': 0,
    })


def main():
    try:
        if not os.path.exists(JSON_PATH):
            print(f'Erro: {JSON_PATH} nao encontrado.')
            sys.exit(1)

        data = load_json_file(JSON_PATH, {})
        incident_store = load_incident_store(data)
        incidents = incident_store.get('incidents', [])

        last_seen_str = data.get('last_seen')
        if not last_seen_str:
            print("Nenhum timestamp 'last_seen' encontrado.")
            return

        try:
            last_seen = parse_time(last_seen_str)
        except ValueError as err:
            print(f'Erro ao analisar data {last_seen_str}: {err}')
            return

        now = datetime.datetime.now(datetime.timezone.utc)
        diff = now - last_seen
        minutes_diff = diff.total_seconds() / 60

        print(f'Último sinal: {last_seen.isoformat()}')
        print(f'Agora:        {now.isoformat()}')
        print(f'Diferença:    {minutes_diff:.2f} minutos')

        current_status = data.get('status', 'offline')

        if minutes_diff > TIMEOUT_MINUTES and current_status == 'online':
            pending_since = data.get('watchdog_pending_since')
            if not pending_since:
                # Primeira detecção: registra pendência e aguarda confirmação no próximo ciclo
                data['watchdog_pending_since'] = now.isoformat().replace('+00:00', 'Z')
                save_json_file(JSON_PATH, data)
                print(f'Primeira detecção de timeout ({minutes_diff:.1f} min). Aguardando confirmação no próximo ciclo.')
                return
            # Segunda detecção confirmada: limpa pendência e dispara alerta
            data.pop('watchdog_pending_since', None)
            print(f'TEMPO LIMITE EXCEDIDO ({TIMEOUT_MINUTES}m). Definindo status como OFFLINE.')
            cause_provisional, confidence = infer_provisional_cause_from_probe(latest_probe(data))

            data['status'] = 'offline'
            data['status_detail'] = 'offline_suspeito'
            if 'v2' not in data or not isinstance(data['v2'], dict):
                data['v2'] = {}
            data['v2']['cause_provisional'] = cause_provisional
            data['v2']['cause_confidence'] = confidence

            detected_at_iso = now.isoformat().replace('+00:00', 'Z')
            last_closed = next(
                (inc for inc in reversed(incidents) if isinstance(inc, dict) and inc.get('state') == 'closed'),
                None
            )
            merged = False
            if last_closed and last_closed.get('ended_at'):
                try:
                    ended_dt = parse_time(last_closed['ended_at'])
                    if (now - ended_dt).total_seconds() / 60 <= MERGE_WINDOW_MINUTES:
                        last_closed['state'] = 'open'
                        last_closed['ended_at'] = None
                        last_closed['duration_minutes'] = 0
                        if cause_provisional != 'unknown':
                            last_closed['cause_provisional'] = cause_provisional
                        print(f'Incidente anterior reaberto (janela de {MERGE_WINDOW_MINUTES} min).')
                        merged = True
                except Exception:
                    pass
            if not merged:
                append_open_incident(incidents, last_seen_str, detected_at_iso, cause_provisional)
            data['history'] = project_history_from_incidents(incidents)
            incident_store['updated_at'] = detected_at_iso
            save_json_file(INCIDENTS_PATH, incident_store)
            save_json_file(JSON_PATH, data)

            now_brasilia = get_brasilia_now()
            brasilia_timestamp = now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')
            alert_emails = data.get('config', {}).get('alert_emails', [])

            subject = f'🔴 ALERTA: IFSul Offline (>{int(minutes_diff)}min)'
            body = (
                f'O sistema de monitoramento detectou que o campus está incomunicável.\n\n'
                f'Último contato: {last_seen_str}\n'
                f'Tempo decorrido: {int(minutes_diff)} minutos\n'
                f'Data do alerta: {brasilia_timestamp} (Horário de Brasília)\n\n'
                f'Verifique a conexão de internet ou energia no local.\n\n'
                f'Acompanhe em: {DASHBOARD_URL}'
            )
            send_email(subject, body, alert_emails if alert_emails else None)

            telegram_config = data.get('config', {}).get('telegram', {})
            if telegram_config.get('enabled') and telegram_config.get('chat_ids'):
                brasilia_time = now_brasilia.strftime('%H:%M:%S')
                telegram_msg = (
                    f'🔴 *ALERTA: IFSul Offline*\n\n'
                    f'O sistema não reporta contato há *{int(minutes_diff)} minutos*.\n'
                    f'Último visto: {brasilia_time}\n\n'
                    f'Acompanhe em: {DASHBOARD_URL}'
                )
                send_telegram(telegram_msg, telegram_config.get('chat_ids'))
        else:
            if data.get('watchdog_pending_since'):
                data.pop('watchdog_pending_since', None)
                save_json_file(JSON_PATH, data)
                print('Sinal recebido antes da confirmação. Pendência cancelada.')
            print('Status OK.')

    except Exception as err:
        print(f'Erro inesperado no watchdog: {err}')
        sys.exit(1)


if __name__ == '__main__':
    main()
