export function formatDurationVerbose(minutes, addSuffix = false) {
    if (minutes == null || minutes < 0 || isNaN(minutes)) return "--";
    if (minutes === 0) return "0 min";

    const mins = Math.round(minutes);
    if (mins < 60) {
        return `${mins} min${addSuffix ? ' atrás' : ''}`;
    }

    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours < 24) {
        let res = `${hours} hora${hours > 1 ? 's' : ''}`;
        if (remainingMins > 0) res += ` e ${remainingMins} min`;
        if (addSuffix) res += ' atrás';
        return res;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days < 7) {
        let res = `${days} dia${days > 1 ? 's' : ''}`;
        if (remainingHours > 0) {
            res += ` e ${remainingHours} hora${remainingHours > 1 ? 's' : ''}`;
        }
        if (addSuffix) res += ' atrás';
        return res;
    }

    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;

    let res = `${weeks} semana${weeks > 1 ? 's' : ''}`;
    if (remainingDays > 0) {
        res += ` e ${remainingDays} dia${remainingDays > 1 ? 's' : ''}`;
    }

    if (addSuffix) res += ' atrás';
    return res;
}

export function tempoRelativoVerbose(date, addSuffix = true) {
    if (!date) return "--";
    const diffMs = Math.abs(new Date() - new Date(date));
    const diffMins = diffMs / 60000;

    if (diffMins < 1) return "agora mesmo";

    return formatDurationVerbose(diffMins, addSuffix);
}

export function formatDateTimeShort(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
