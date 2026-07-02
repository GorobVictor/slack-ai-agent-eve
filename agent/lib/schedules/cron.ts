import { CronExpressionParser } from "cron-parser";

export function getNextScheduleRunAt(cron: string, from = new Date()) {
  if (!isFiveFieldCron(cron)) {
    throw new Error(`Schedule cron must have exactly five fields: ${cron}`);
  }

  return CronExpressionParser.parse(cron, {
    currentDate: from,
    strict: false,
  })
    .next()
    .toDate();
}

export function isFiveFieldCron(cron: string) {
  return cron.trim().split(/\s+/).length === 5;
}
