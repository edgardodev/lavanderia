import type { PrismaClient } from '@prisma/client';

export const WEEKDAY_SLOTS = [
  '07:00-09:00',
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
] as const;

export const SUNDAY_HOLIDAY_SLOTS = [
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
] as const;

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Fecha inválida.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('Fecha inválida.');
  }
  return date;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function moveToMonday(date: Date) {
  const day = date.getUTCDay();
  const offset = day === 1 ? 0 : (8 - day) % 7;
  return addDays(date, offset);
}

// Algoritmo gregoriano de Meeus/Jones/Butcher para Domingo de Pascua.
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function fixed(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function colombiaHolidayMap(year: number) {
  const easter = easterSunday(year);
  const entries: Array<[Date, string]> = [
    [fixed(year, 1, 1), 'Año Nuevo'],
    [moveToMonday(fixed(year, 1, 6)), 'Día de los Reyes Magos'],
    [moveToMonday(fixed(year, 3, 19)), 'Día de San José'],
    [addDays(easter, -3), 'Jueves Santo'],
    [addDays(easter, -2), 'Viernes Santo'],
    [fixed(year, 5, 1), 'Día del Trabajo'],
    [addDays(easter, 43), 'Ascensión del Señor'],
    [addDays(easter, 64), 'Corpus Christi'],
    [addDays(easter, 71), 'Sagrado Corazón'],
    [moveToMonday(fixed(year, 6, 29)), 'San Pedro y San Pablo'],
    [fixed(year, 7, 20), 'Día de la Independencia'],
    [fixed(year, 8, 7), 'Batalla de Boyacá'],
    [moveToMonday(fixed(year, 8, 15)), 'Asunción de la Virgen'],
    [moveToMonday(fixed(year, 10, 12)), 'Día de la Raza'],
    [moveToMonday(fixed(year, 11, 1)), 'Todos los Santos'],
    [moveToMonday(fixed(year, 11, 11)), 'Independencia de Cartagena'],
    [fixed(year, 12, 8), 'Inmaculada Concepción'],
    [fixed(year, 12, 25), 'Navidad'],
  ];
  return new Map(entries.map(([date, name]) => [iso(date), name]));
}

export function colombiaHolidayName(dateValue: string) {
  const date = parseDate(dateValue);
  return colombiaHolidayMap(date.getUTCFullYear()).get(dateValue) ?? null;
}

export async function businessDaySchedule(prisma: PrismaClient, dateValue: string) {
  const date = parseDate(dateValue);
  const officialHoliday = colombiaHolidayName(dateValue);
  const customHoliday = await prisma.holiday.findFirst({
    where: {
      date: new Date(`${dateValue}T00:00:00.000Z`),
      isActive: true,
    },
    select: { name: true },
  });

  const isSunday = date.getUTCDay() === 0;
  const holidayName = customHoliday?.name ?? officialHoliday;
  const isHoliday = Boolean(holidayName);
  const sundayHoliday = isSunday || isHoliday;

  return {
    date: dateValue,
    isSunday,
    isHoliday,
    holidayName,
    scheduleType: sundayHoliday ? 'SUNDAY_HOLIDAY' as const : 'WEEKDAY' as const,
    slots: [...(sundayHoliday ? SUNDAY_HOLIDAY_SLOTS : WEEKDAY_SLOTS)],
  };
}
