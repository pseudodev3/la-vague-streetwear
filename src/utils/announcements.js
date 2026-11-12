export const campaignKeys = [
    'announcementEnabled',
    'announcementMessage',
    'announcementStartsAt',
    'announcementEndsAt'
];

function parseDate(value, label) {
    if (value === '' || value == null) return '';
    const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/);
    if (!parts) throw new Error(`${label} must include a valid date, time and timezone.`);
    const date = new Date(value);
    const [, year, month, day, hour, minute, second = '0'] = parts;
    const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    if (!Number.isFinite(date.getTime()) || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
        throw new Error(`${label} must be a valid date and time.`);
    }
    return date.toISOString();
}

function normalizeAnnouncement(settings) {
    const enabled = settings.announcementEnabled ?? 'false';
    if (![true, false, 'true', 'false'].includes(enabled)) {
        throw new Error('Announcement enabled must be true or false.');
    }
    const message = settings.announcementMessage ?? '';
    if (typeof message !== 'string' || message.trim().length > 80) {
        throw new Error('Announcement message must be text of 80 characters or fewer.');
    }
    const result = {
        announcementEnabled: String(enabled),
        announcementMessage: message.trim(),
        announcementStartsAt: parseDate(settings.announcementStartsAt, 'Announcement start'),
        announcementEndsAt: parseDate(settings.announcementEndsAt, 'Announcement end')
    };
    if (result.announcementStartsAt && result.announcementEndsAt && Date.parse(result.announcementStartsAt) >= Date.parse(result.announcementEndsAt)) {
        throw new Error('Announcement end must be after its start.');
    }
    if (result.announcementEnabled === 'true' && (!result.announcementMessage || !result.announcementEndsAt)) {
        throw new Error('An enabled announcement needs a message and an end date.');
    }
    return result;
}

export function validateAnnouncementSettings(settings, now = Date.now()) {
    const result = normalizeAnnouncement(settings);
    if (result.announcementEnabled === 'true' && Date.parse(result.announcementEndsAt) <= Number(now)) {
        throw new Error('Announcement end must be in the future.');
    }
    return result;
}

export function getActiveAnnouncement(settings, now = Date.now()) {
    let campaign;
    try {
        campaign = normalizeAnnouncement(settings);
    } catch {
        return null;
    }
    const currentTime = Number(now);
    if (campaign.announcementEnabled !== 'true' || !Number.isFinite(currentTime) ||
        (campaign.announcementStartsAt && Date.parse(campaign.announcementStartsAt) > currentTime) ||
        Date.parse(campaign.announcementEndsAt) <= currentTime) return null;

    return {
        message: campaign.announcementMessage,
        startsAt: campaign.announcementStartsAt,
        endsAt: campaign.announcementEndsAt
    };
}
