import datetime
import json
import os
import sys

from notifier import DASHBOARD_URL, get_brasilia_now, send_email, send_telegram

TIMEOUT_MINUTES = 30
JSON_PATH = 'data/status.json'
INCIDENTS_PATH = 'data/incidents.json'
HISTORY_LIMIT = 200
INCIDENTS_ROTATION_LIMIT = 200


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


def read_client_payload():
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if not event_path or not os.path.exists(event_path):
        return {}

    try:
        with open(event_path, 'r') as file_handle:
            event_data = json.load(file_handle)
        payload = event_data.get('client_payload', {})
        return payload if isinstance(payload, dict) else {}
    except Exception as err:
        print(f'Aviso: nao foi possivel ler client_payload: {err}')
        return {}


def get_batch_events(payload):
    batch = payload.get('batch', []) if isinstance(payload, dict) else []
    return batch if isinstance(batch, list) else []


def infer_provisional_cause(payload):
    probe = payload.get('probe', {}) if isinstance(payload, dict) else {}
    if not isinstance(probe, dict) or not probe:
        return 'unknown', 'low'

    gateway_ok = to_bool(probe.get('gateway_ok', True))
    internet_ok = to_bool(probe.get('internet_ok', True))

    if not gateway_ok:
        return 'interno', 'high'
    if gateway_ok and not internet_ok:
        return 'externo', 'high'
    return 'unknown', 'low'


def infer_final_cause(batch_events, fallback_cause='unknown'):
    has_firewall_issue = False
    has_external_issue = False

    for event in batch_events:
        probe = event.get('probe', {}) if isinstance(event, dict) else {}
        if not isinstance(probe, dict):
            continue

        gateway_ok = to_bool(probe.get('gateway_ok', True))
        internet_ok = to_bool(probe.get('internet_ok', True))

        if not gateway_ok:
            has_firewall_issue = True
        elif gateway_ok and not internet_ok:
            has_external_issue = True

    if has_firewall_issue and has_external_issue:
        return 'interno_misto'
    if has_firewall_issue:
        return 'interno_firewall'
    if has_external_issue:
        return 'externo'
    if len(batch_events) <= 1:
        return 'interno_servidor'
    return fallback_cause


def make_incident_record(*, started_at, detected_at, ended_at, state, cause_provisional, cause_final, sample_count):
    return {
        'id': f"{started_at}-{detected_at}-{state}",
        'timestamp': started_at,
        'started_at': started_at,
        'detected_at': detected_at,
        'ended_at': ended_at,
        'state': state,
        'type': 'offline_detected',
        'duration_minutes': 0 if ended_at is None else None,
        'cause_provisional': cause_provisional,
        'cause_final': cause_final,
        'sample_count': sample_count,
    }


def seed_incident_store_from_history(status_history):
    incidents = []
    if not isinstance(status_history, list):
        return {'incidents': incidents}

    for index, event in enumerate(reversed(status_history)):
        if not isinstance(event, dict):
            continue

        timestamp = event.get('timestamp')
        if not timestamp:
            continue

        incidents.append({
            'id': f"legacy-{index}-{timestamp}",
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

    return {'incidents': incidents}


def ensure_incident_store(data):
    incident_store = load_json_file(INCIDENTS_PATH, {'incidents': []})
    if not isinstance(incident_store, dict):
        incident_store = {'incidents': []}

    if not isinstance(incident_store.get('incidents'), list):
        incident_store['incidents'] = []

    if not incident_store['incidents'] and data.get('history'):
        incident_store = seed_incident_store_from_history(data.get('history', []))

    return incident_store


def save_incident_store(store):
    save_json_file(INCIDENTS_PATH, store)


def latest_open_incident(incidents):
    for incident in reversed(incidents):
        if isinstance(incident, dict) and incident.get('state') == 'open':
            return incident
    return None


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


def update_v2_fields(data, payload, batch_events):
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
        'active_uplink': probe.get('active_uplink'),
        'github_api_ok': probe.get('github_api_ok'),
        'pending_count': payload.get('pending_count', 0),
        'seq': payload.get('seq')
    }
    data['v2']['pending_count'] = payload.get('pending_count', 0)
    data['v2']['batch_count'] = len(batch_events)
    data['status_detail'] = 'online'

    # Detecta gap de sequência (eventos da fila que não chegaram ao GitHub)
    last_seq = data['v2'].get('last_seq', 0) or 0
    seq_values = [e['seq'] for e in batch_events if isinstance(e, dict) and isinstance(e.get('seq'), int)]
    if seq_values:
        min_seq = min(seq_values)
        max_seq = max(seq_values)
        missed = max(0, min_seq - last_seq - 1) if last_seq > 0 else 0
        if missed > 0:
            print(f'Aviso: {missed} evento(s) perdido(s) na fila (seq esperado: {last_seq + 1}, primeiro recebido: {min_seq})')
        data['v2']['missed_batches'] = missed
        data['v2']['last_seq'] = max_seq
    else:
        data['v2']['missed_batches'] = 0
        seq_payload = payload.get('seq')
        if isinstance(seq_payload, int) and seq_payload > 0:
            data['v2']['last_seq'] = seq_payload


def build_recovery_incident(last_seen_str, now_iso, payload, batch_events):
    provisional_cause, _ = infer_provisional_cause(payload)
    final_cause = infer_final_cause(batch_events, fallback_cause=provisional_cause)
    started_at = last_seen_str
    duration_minutes = 0.0

    if started_at:
        try:
            duration_minutes = round((parse_time(now_iso) - parse_time(started_at)).total_seconds() / 60, 1)
        except Exception:
            duration_minutes = 0.0

    return {
        'id': f"{started_at}-{now_iso}-closed",
        'timestamp': started_at,
        'started_at': started_at,
        'detected_at': now_iso,
        'ended_at': now_iso,
        'state': 'closed',
        'type': 'offline_detected',
        'duration_minutes': duration_minutes,
        'cause_provisional': provisional_cause,
        'cause_final': final_cause,
        'sample_count': len(batch_events),
    }


def close_latest_open_incident(incidents, ended_at, duration_minutes, cause_final, sample_count):
    open_incident = latest_open_incident(incidents)
    if not open_incident:
        return False

    open_incident['ended_at'] = ended_at
    open_incident['state'] = 'closed'
    open_incident['duration_minutes'] = round(float(duration_minutes), 1)
    if cause_final:
        open_incident['cause_final'] = cause_final
    if sample_count is not None:
        open_incident['sample_count'] = sample_count
    return True


def rotate_incidents(incidents):
    open_incs = [inc for inc in incidents if isinstance(inc, dict) and inc.get('state') == 'open']
    closed_incs = [inc for inc in incidents if isinstance(inc, dict) and inc.get('state') != 'open']
    if len(closed_incs) > INCIDENTS_ROTATION_LIMIT:
        closed_incs = closed_incs[-INCIDENTS_ROTATION_LIMIT:]
    return closed_incs + open_incs


def main():
    try:
        data = load_json_file(JSON_PATH, {})
        payload = read_client_payload()
        batch_events = get_batch_events(payload)
        incident_store = ensure_incident_store(data)
        incidents = incident_store.get('incidents', [])

        now = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now.isoformat().replace('+00:00', 'Z')
        last_seen_str = data.get('last_seen')
        current_status = data.get('status', 'online')

        if 'history' not in data or not isinstance(data['history'], list):
            data['history'] = []

        if last_seen_str:
            last_seen = parse_time(last_seen_str)
            gap_minutes = (now - last_seen).total_seconds() / 60
            print(f'Gap desde último sinal: {gap_minutes:.1f} minutos')

            if current_status == 'online' and gap_minutes > TIMEOUT_MINUTES:
                print(f'Queda não registrada detectada! Gap de {gap_minutes:.1f} min.')
                recovery_incident = build_recovery_incident(last_seen_str, now_iso, payload, batch_events)
                incidents.append(recovery_incident)

                now_brasilia = get_brasilia_now()
                alert_emails = data.get('config', {}).get('alert_emails', [])

                subject = f"✅ RECUPERADO: IFSul de volta após queda (>{int(gap_minutes)}min)"
                body = (
                    f"O sistema de monitoramento detectou que o campus voltou a responder.\n\n"
                    f"A queda não havia sido capturada pelo watchdog original.\n"
                    f"Aproximadamente {int(gap_minutes)} minutos offline.\n"
                    f"Último contato antes da queda: {last_seen_str}\n"
                    f"Voltou em: {now_brasilia.strftime('%d/%m/%Y às %H:%M:%S')} (Horário de Brasília)\n\n"
                    f"Acompanhe em: {DASHBOARD_URL}\n"
                )
                send_email(subject, body, alert_emails if alert_emails else None)

                telegram_config = data.get('config', {}).get('telegram', {})
                if telegram_config.get('enabled') and telegram_config.get('chat_ids'):
                    telegram_msg = (
                        f"✅ *RECUPERADO: IFSul Online*\n\n"
                        f"O sistema voltou após uma queda de *{int(gap_minutes)} minutos*.\n"
                        f"Voltou em: {now_brasilia.strftime('%H:%M:%S')}\n\n"
                        f"Acompanhe em: {DASHBOARD_URL}"
                    )
                    send_telegram(telegram_msg, telegram_config.get('chat_ids'))

            elif current_status == 'offline':
                print('Recuperando de estado OFFLINE registrado pelo watchdog.')
                latest_open = latest_open_incident(incidents)
                if latest_open:
                    if last_seen_str:
                        try:
                            duration_minutes = (now - parse_time(latest_open.get('timestamp', last_seen_str))).total_seconds() / 60
                        except Exception:
                            duration_minutes = 0.0
                    else:
                        duration_minutes = 0.0

                    prev_provisional = latest_open.get('cause_provisional', 'unknown')
                final_cause = infer_final_cause(batch_events, fallback_cause=prev_provisional)
                if final_cause == 'unknown':
                    final_cause = prev_provisional
                close_latest_open_incident(incidents, now_iso, duration_minutes, final_cause, len(batch_events))
                print(f'Duração da queda atualizada: {duration_minutes:.1f} min')

                if final_cause != prev_provisional and prev_provisional != 'unknown' and final_cause != 'unknown':
                    cause_labels = {
                        'externo':           'Problema externo (internet)',
                        'interno':           'Problema interno',
                        'interno_firewall':  'Problema interno (firewall)',
                        'interno_servidor':  'Servidor sem resposta',
                        'interno_misto':     'Problema interno (misto)',
                    }
                    label_prev = cause_labels.get(prev_provisional, prev_provisional)
                    label_final = cause_labels.get(final_cause, final_cause)
                    now_brasilia_rc = get_brasilia_now()
                    alert_emails = data.get('config', {}).get('alert_emails', [])
                    subject = f'🔄 RECLASSIFICADO: {label_prev} → {label_final}'
                    body = (
                        f'A causa da queda foi reclassificada após análise dos dados coletados.\n\n'
                        f'Causa provisória: {label_prev}\n'
                        f'Causa final:      {label_final}\n'
                        f'Duração da queda: {int(duration_minutes)} minutos\n'
                        f'Voltou em: {now_brasilia_rc.strftime("%d/%m/%Y às %H:%M:%S")} (Brasília)\n\n'
                        f'Acompanhe em: {DASHBOARD_URL}\n'
                    )
                    send_email(subject, body, alert_emails if alert_emails else None)
                    telegram_config = data.get('config', {}).get('telegram', {})
                    if telegram_config.get('enabled') and telegram_config.get('chat_ids'):
                        brasilia_rc_time = now_brasilia_rc.strftime('%H:%M:%S')
                        telegram_msg = (
                            f'🔄 *RECLASSIFICADO*\n\n'
                            f'Causa da queda corrigida:\n'
                            f'Antes: _{label_prev}_\n'
                            f'Agora: *{label_final}*\n'
                            f'Voltou às: {brasilia_rc_time}\n\n'
                            f'Acompanhe em: {DASHBOARD_URL}'
                        )
                        send_telegram(telegram_msg, telegram_config.get('chat_ids'))

        data['last_seen'] = now_iso
        data['status'] = 'online'
        data.pop('watchdog_pending_since', None)  # cancela pendência de confirmação dupla do watchdog
        update_v2_fields(data, payload, batch_events)
        incidents = rotate_incidents(incidents)
        data['history'] = project_history_from_incidents(incidents)

        save_json_file(JSON_PATH, data)
        incident_store['incidents'] = incidents
        incident_store['updated_at'] = now_iso
        save_incident_store(incident_store)

        print('Status atualizado para ONLINE.')

    except Exception as e:
        print(f'Erro no process_heartbeat: {e}')
        sys.exit(1)


if __name__ == "__main__":
    main()
