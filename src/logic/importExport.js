/**
 * Parse TSV backup format
 */
export function parseTSV(text) {
  const lines = text.split('\n');
  const result = {
    expenses: [],
    participants: new Set(),
    strangers: new Set(),
  };

  let section = 'UNKNOWN';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('EXPENSE HISTORY')) {
      section = 'EXPENSES';
      continue;
    }
    if (line.startsWith('PARTICIPANTS_DATA')) {
      section = 'PARTICIPANTS';
      continue;
    }
    if (line.startsWith('STRANGERS_DATA')) {
      section = 'STRANGERS';
      continue;
    }
    if (line.startsWith('TOTAL SPENT')) continue;
    if (line.startsWith('OPTIMIZED SETTLEMENT PLAN')) continue;

    // Skip headers
    if (
      line.startsWith('Date\t') ||
      line.startsWith('Name') ||
      line.startsWith('Pair') ||
      line.startsWith('From\t')
    ) {
      continue;
    }

    const cols = line.split('\t');

    if (section === 'EXPENSES' && cols.length >= 4) {
      const amount = parseFloat(cols[3]);
      if (!isNaN(amount)) {
        const isoDate = cols[5];
        const date = isoDate ? new Date(isoDate) : new Date();
        const beneficiaries = cols[4] ? cols[4].split(', ') : [];

        result.expenses.push({
          id: cols[6] || undefined,
          date,
          description: cols[1] || 'Imported Expense',
          payer: cols[2],
          amount,
          beneficiaries,
        });

        result.participants.add(cols[2]);
        beneficiaries.forEach(b => result.participants.add(b));
      }
    } else if (section === 'PARTICIPANTS') {
      result.participants.add(line);
    } else if (section === 'STRANGERS') {
      result.strangers.add(line);
    }
  }

  return result;
}

/**
 * Generate TSV backup format
 */
export function generateTSV(expenses, participants, strangers, totalSpent) {
  let tsv = 'EXPENSE HISTORY\n';
  tsv += 'Date\tDescription\tPayer\tAmount\tBeneficiaries\tISO_Timestamp\tID\n';

  const formatDate = (date) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);

  const formatTime = (date) =>
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);

  expenses.forEach((exp) => {
    const dateStr = `${formatDate(exp.date)} ${formatTime(exp.date)}`;
    const cleanDesc = exp.description.replace(/[\t\n]/g, ' ');
    const benStr = exp.beneficiaries.join(', ');
    const isoDate = exp.date.toISOString();
    tsv += `${dateStr}\t${cleanDesc}\t${exp.payer}\t${exp.amount.toFixed(2)}\t${benStr}\t${isoDate}\t${exp.id || ''}\n`;
  });

  tsv += `\nTOTAL SPENT\t${totalSpent.toFixed(2)}\n\n`;

  // Participants
  tsv += 'PARTICIPANTS_DATA\n';
  tsv += 'Name\n';
  participants.forEach(p => (tsv += `${p}\n`));
  tsv += '\n';

  // Strangers
  tsv += 'STRANGERS_DATA\n';
  tsv += 'Pair\n';
  strangers.forEach(s => (tsv += `${s}\n`));

  return tsv;
}

/**
 * Create downloadable TSV file
 */
export function downloadTSV(content, filename) {
  const blob = new Blob([content], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
