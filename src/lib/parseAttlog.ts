export interface RawPunch {
  employeeCode: string;
  timestamp: Date;
  rawLine: string;
}

export function parseAttlog(fileContent: string): RawPunch[] {
  const lines = fileContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n");

  const punches: RawPunch[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const employeeCode = parts[0].trim();
    const timestampStr = parts[1].trim();

    const timestamp = new Date(timestampStr);
    if (isNaN(timestamp.getTime())) continue;

    punches.push({ employeeCode, timestamp, rawLine: line });
  }

  return punches;
}
