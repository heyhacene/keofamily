export interface ParsedICSEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  category: 'famille' | 'anniversaire' | 'ecole' | 'sante' | 'sortie' | 'travail' | 'general';
}

/**
 * Nettoie et déplie les lignes RFC 5545 (lignes coupées avec un espace initial)
 */
function unfoldICS(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Décode les caractères d'échappement iCal (\n, \,, \;)
 */
function unescapeICS(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Analyse une chaîne de date iCalendar (ex: 20261025T093000Z, 20261025)
 */
export function parseICSDate(rawStr: string): { date: Date; allDay: boolean } {
  const clean = rawStr.replace(/^.*:/, '').trim();

  // Format jour entier : YYYYMMDD (8 chiffres)
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    return { date: new Date(y, m, d, 0, 0, 0), allDay: true };
  }

  // Format complet : YYYYMMDDTHHMMSS ou YYYYMMDDTHHMMSSZ
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (match) {
    const [, y, m, d, h, min, s, isUtc] = match;
    if (isUtc) {
      return {
        date: new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s)),
        allDay: false,
      };
    }
    return {
      date: new Date(+y, +m - 1, +d, +h, +min, +s),
      allDay: false,
    };
  }

  // Fallback
  const parsed = new Date(clean);
  return {
    date: isNaN(parsed.getTime()) ? new Date() : parsed,
    allDay: false,
  };
}

/**
 * Détermine automatiquement la catégorie la plus adaptée selon les mots-clés
 */
export function detectCategory(
  title: string,
  desc: string = ''
): 'famille' | 'anniversaire' | 'ecole' | 'sante' | 'sortie' | 'travail' | 'general' {
  const text = `${title} ${desc}`.toLowerCase();

  if (text.includes('anniv') || text.includes('birthday') || text.includes('fête')) {
    return 'anniversaire';
  }
  if (
    text.includes('dr ') ||
    text.includes('docteur') ||
    text.includes('dentiste') ||
    text.includes('médecin') ||
    text.includes('medecin') ||
    text.includes('santé') ||
    text.includes('sante') ||
    text.includes('rdv') ||
    text.includes('ophtalmo') ||
    text.includes('kiné') ||
    text.includes('kine') ||
    text.includes('vaccin') ||
    text.includes('hôpital') ||
    text.includes('doctolib')
  ) {
    return 'sante';
  }
  if (
    text.includes('école') ||
    text.includes('ecole') ||
    text.includes('collège') ||
    text.includes('lycée') ||
    text.includes('classe') ||
    text.includes('devoirs') ||
    text.includes('brevet') ||
    text.includes('bac') ||
    text.includes('rentrée')
  ) {
    return 'ecole';
  }
  if (
    text.includes('vacances') ||
    text.includes('vol ') ||
    text.includes('train') ||
    text.includes('sncf') ||
    text.includes('hotel') ||
    text.includes('resto') ||
    text.includes('restaurant') ||
    text.includes('cinéma') ||
    text.includes('cinema') ||
    text.includes('voyage') ||
    text.includes('sortie') ||
    text.includes('spectacle') ||
    text.includes('concert') ||
    text.includes('plage')
  ) {
    return 'sortie';
  }
  if (
    text.includes('travail') ||
    text.includes('réunion') ||
    text.includes('reunion') ||
    text.includes('bureau') ||
    text.includes('formation') ||
    text.includes('shift')
  ) {
    return 'travail';
  }

  return 'famille';
}

/**
 * Parse un fichier ou une chaîne de texte au format .ics (iCalendar / RFC 5545)
 */
export function parseICS(icsContent: string): ParsedICSEvent[] {
  const unfolded = unfoldICS(icsContent);
  const lines = unfolded.split(/\r?\n/);
  const events: ParsedICSEvent[] = [];

  let inEvent = false;
  let current: Partial<ParsedICSEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && current.title && current.startDate) {
        const cat = current.category || detectCategory(current.title, current.description || '');
        events.push({
          title: current.title,
          description: current.description || (current.location ? `Lieu : ${current.location}` : undefined),
          startDate: current.startDate,
          endDate: current.endDate,
          allDay: Boolean(current.allDay),
          location: current.location,
          category: cat,
        });
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    // Découper Nom_Champ:Valeur ou Nom_Champ;PARAM:Valeur
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = trimmed.slice(0, colonIdx).toUpperCase();
    const valPart = trimmed.slice(colonIdx + 1);

    if (keyPart === 'SUMMARY' || keyPart.startsWith('SUMMARY;')) {
      current.title = unescapeICS(valPart);
    } else if (keyPart === 'DESCRIPTION' || keyPart.startsWith('DESCRIPTION;')) {
      current.description = unescapeICS(valPart);
    } else if (keyPart === 'LOCATION' || keyPart.startsWith('LOCATION;')) {
      current.location = unescapeICS(valPart);
    } else if (keyPart === 'DTSTART' || keyPart.startsWith('DTSTART;')) {
      const { date, allDay } = parseICSDate(trimmed);
      current.startDate = date;
      current.allDay = allDay;
    } else if (keyPart === 'DTEND' || keyPart.startsWith('DTEND;')) {
      const { date } = parseICSDate(trimmed);
      current.endDate = date;
    } else if (keyPart === 'CATEGORIES' || keyPart.startsWith('CATEGORIES;')) {
      current.category = detectCategory(current.title || '', valPart);
    }
  }

  // Trier les événements par date croissante
  return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Génère une chaîne iCalendar (.ics) exportable à partir des événements de l'agenda
 */
export function generateICS(events: any[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatICSDateTime = (d: Date, allDay: boolean) => {
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    if (allDay) {
      return `${y}${m}${day}`;
    }
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${y}${m}${day}T${h}${min}${s}`;
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Keo Family//Espace Familial//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((e) => {
    const start = new Date(e.start_date);
    const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + (e.all_day ? 86400000 : 3600000));
    const now = new Date();

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:dar-event-${e.id}@dar.otsmane.fr`);
    ics.push(`DTSTAMP:${formatICSDateTime(now, false)}Z`);
    if (e.all_day) {
      ics.push(`DTSTART;VALUE=DATE:${formatICSDateTime(start, true)}`);
      ics.push(`DTEND;VALUE=DATE:${formatICSDateTime(end, true)}`);
    } else {
      ics.push(`DTSTART:${formatICSDateTime(start, false)}`);
      ics.push(`DTEND:${formatICSDateTime(end, false)}`);
    }
    ics.push(`SUMMARY:${e.title.replace(/[\r\n]+/g, ' ')}`);
    if (e.description) {
      ics.push(`DESCRIPTION:${e.description.replace(/[\r\n]+/g, '\\n')}`);
    }
    ics.push(`CATEGORIES:${e.category.toUpperCase()}`);
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}
