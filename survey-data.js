(function () {
  const SHEET_ID = '1BpG8aqqrNogPZV9ra8f7eR5zdsilRQOSNlwFzr5vb_M';
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=1230374295`;
  const SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=1230374295`;

  const STOPWORDS = new Set([
    'about', 'after', 'again', 'also', 'among', 'because', 'before', 'being',
    'between', 'could', 'every', 'first', 'from', 'have', 'into', 'like',
    'many', 'more', 'most', 'much', 'only', 'other', 'over', 'same', 'should',
    'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these',
    'they', 'this', 'those', 'very', 'what', 'when', 'where', 'which', 'while',
    'would', 'your', 'with', 'without', 'through', 'rural', 'energy', 'selco',
    'india', 'solar', 'people', 'community', 'model'
  ]);

  function parseGvizPayload(text) {
    return JSON.parse(text.replace(/^[^{]*/, '').replace(/\);?\s*$/, ''));
  }

  function parseGvizDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && value.startsWith('Date(')) {
      const parts = value.replace('Date(', '').replace(')', '').split(',').map(Number);
      return new Date(parts[0], parts[1], parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function timeAgo(value) {
    const date = parseGvizDate(value);
    if (!date) return '';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function initials(name) {
    if (!name || !String(name).trim()) return '?';
    return String(name)
      .trim()
      .split(/\s+/)
      .map((word) => word[0].toUpperCase())
      .slice(0, 2)
      .join('');
  }

  function cleanLabel(label) {
    return String(label || '')
      .replace(/^\s*\d+[\.\)]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shortLabel(label, maxLength = 42) {
    const clean = cleanLabel(label);
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength).trimEnd()}...`;
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function rawCellValue(row, index) {
    return row?.c?.[index]?.v ?? '';
  }

  function displayCellValue(row, index) {
    const cell = row?.c?.[index];
    const value = cell?.f ?? cell?.v ?? '';
    return String(value).trim();
  }

  function parseNumber(value) {
    const clean = String(value || '').replace(/,/g, '').trim();
    if (!clean) return null;
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function splitChoiceTokens(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const parts = text
      .split(/\s*(?:,|;|\n)\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts : [text];
  }

  function detectMeta(cols) {
    let timestampIndex = 0;
    let nameIndex = -1;
    let privacyIndex = -1;
    let professionIndex = -1;
    const hiddenColumns = new Set();

    cols.forEach((col, index) => {
      const label = normalizeText(col.label);
      if (label.includes('timestamp')) {
        timestampIndex = index;
        hiddenColumns.add(index);
      }
      if ((label.includes('your name') || label === 'name' || label.includes('full name') || label.includes('enter your name')) && !label.includes('privacy')) {
        nameIndex = index;
        hiddenColumns.add(index);
      }
      if (
        label.includes('privacy') ||
        label.includes('consent') ||
        label.includes('public display') ||
        label.includes('use your name') ||
        label.includes('share your response')
      ) {
        privacyIndex = index;
        hiddenColumns.add(index);
      }
      if (
        label.includes('field of study') ||
        label.includes('profession') ||
        label.includes('occupation') ||
        label.includes('role') ||
        label.includes('branch') ||
        label.includes('program') ||
        label.includes('course')
      ) {
        professionIndex = index;
        hiddenColumns.add(index);
      }
      if (
        label.includes('email') ||
        label.includes('phone') ||
        label.includes('mobile') ||
        label.includes('contact') ||
        label.includes('whatsapp') ||
        label.includes('roll number') ||
        label.includes('student id') ||
        label.includes('usn') ||
        label.includes('semester') ||
        label.includes('year')
      ) {
        hiddenColumns.add(index);
      }
    });

    const answerColumns = cols
      .map((_, index) => index)
      .filter((index) => !hiddenColumns.has(index));

    return {
      timestampIndex,
      nameIndex,
      privacyIndex,
      professionIndex,
      hiddenColumns: [...hiddenColumns],
      answerColumns
    };
  }

  function isConsented(row, privacyIndex) {
    if (privacyIndex === -1) return true;
    const value = normalizeText(displayCellValue(row, privacyIndex));
    return ['yes', 'true', 'agree', 'allowed', 'allow', 'public', 'consent'].some((token) => value.includes(token));
  }

  function buildSeriesFromCounts(countMap, denominator, maxItems = 8) {
    const sorted = [...countMap.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage: denominator ? (count / denominator) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    if (sorted.length <= maxItems) return sorted;

    const kept = sorted.slice(0, maxItems - 1);
    const otherCount = sorted.slice(maxItems - 1).reduce((sum, item) => sum + item.count, 0);
    kept.push({
      label: 'Other',
      count: otherCount,
      percentage: denominator ? (otherCount / denominator) * 100 : 0
    });
    return kept;
  }

  function buildKeywordSeries(values) {
    const counts = new Map();
    let totalMentions = 0;

    values.forEach((value) => {
      const words = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

      words.forEach((word) => {
        if (word.length < 4 || STOPWORDS.has(word)) return;
        counts.set(word, (counts.get(word) || 0) + 1);
        totalMentions += 1;
      });
    });

    return {
      series: buildSeriesFromCounts(counts, totalMentions, 7),
      denominator: totalMentions
    };
  }

  function buildHistogram(values, bins = 6) {
    if (!values.length) return { series: [], denominator: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return {
        series: [{ label: String(min), count: values.length, percentage: 100 }],
        denominator: values.length
      };
    }

    const step = (max - min) / bins || 1;
    const counts = Array.from({ length: bins }, () => 0);

    values.forEach((value) => {
      let bucket = Math.floor((value - min) / step);
      if (bucket >= bins) bucket = bins - 1;
      counts[bucket] += 1;
    });

    return {
      series: counts
        .map((count, index) => {
          const start = min + step * index;
          const end = index === bins - 1 ? max : min + step * (index + 1);
          return {
            label: `${start.toFixed(1)}-${end.toFixed(1)}`,
            count,
            percentage: values.length ? (count / values.length) * 100 : 0
          };
        })
        .filter((item) => item.count > 0),
      denominator: values.length
    };
  }

  function inferQuestionKind(values) {
    const numericValues = values.map(parseNumber).filter((value) => value !== null);
    if (numericValues.length >= Math.max(3, Math.ceil(values.length * 0.8))) return 'numeric';

    const uniqueCount = new Set(values.map(normalizeText)).size;
    const averageLength = values.reduce((sum, value) => sum + value.length, 0) / values.length;
    const multiValueAnswers = values.filter((value) => splitChoiceTokens(value).length > 1).length;
    const uniqueTokens = new Set(
      values.flatMap(splitChoiceTokens).map(normalizeText).filter(Boolean)
    ).size;

    if (
      multiValueAnswers >= Math.max(2, Math.ceil(values.length * 0.2)) &&
      uniqueTokens <= Math.max(6, Math.min(18, values.length))
    ) {
      return 'multi-select';
    }

    if (
      uniqueCount <= Math.max(5, Math.min(12, Math.ceil(values.length * 0.6))) &&
      averageLength < 70
    ) {
      return 'categorical';
    }

    return 'text';
  }

  function allowedChartTypes(kind) {
    if (kind === 'numeric') return ['bar', 'line', 'radar'];
    if (kind === 'text') return ['bar', 'horizontalBar', 'radar', 'polarArea'];
    return ['bar', 'horizontalBar', 'doughnut', 'pie', 'polarArea', 'radar', 'line'];
  }

  function defaultChartType(kind) {
    if (kind === 'text') return 'horizontalBar';
    if (kind === 'multi-select') return 'bar';
    if (kind === 'numeric') return 'line';
    return 'doughnut';
  }

  function analyzeQuestion(index, col, rows, ordinal) {
    const label = cleanLabel(col.label) || `Question ${ordinal}`;
    const values = rows.map((row) => displayCellValue(row, index)).filter(Boolean);

    if (!values.length) return null;

    const uniqueCount = new Set(values.map(normalizeText)).size;
    let kind = inferQuestionKind(values);
    let series = [];
    let denominator = values.length;
    let metricLabel = 'responses';

    if (kind === 'numeric') {
      const numericValues = values.map(parseNumber).filter((value) => value !== null);
      const histogram = buildHistogram(numericValues);
      series = histogram.series;
      denominator = histogram.denominator;
      metricLabel = 'responses';
    } else if (kind === 'text') {
      const keywordSummary = buildKeywordSeries(values);
      series = keywordSummary.series;
      denominator = keywordSummary.denominator;
      metricLabel = 'mentions';

      if (series.length < 3 && uniqueCount <= Math.max(5, Math.min(12, Math.ceil(values.length * 0.6)))) {
        kind = 'categorical';
      }
    }

    if (kind === 'categorical') {
      const counts = new Map(); // normalized -> count
      const displays = new Map(); // normalized -> original casing
      values.forEach((value) => {
        const norm = normalizeText(value);
        counts.set(norm, (counts.get(norm) || 0) + 1);
        if (!displays.has(norm)) displays.set(norm, value.trim());
      });
      const categoricalMap = new Map();
      counts.forEach((count, norm) => categoricalMap.set(displays.get(norm), count));
      series = buildSeriesFromCounts(categoricalMap, values.length);
      denominator = values.length;
      metricLabel = 'responses';
    }

    if (kind === 'multi-select') {
      const counts = new Map();
      const displays = new Map();
      let totalSelections = 0;
      values.forEach((value) => {
        splitChoiceTokens(value).forEach((token) => {
          const norm = normalizeText(token);
          counts.set(norm, (counts.get(norm) || 0) + 1);
          if (!displays.has(norm)) displays.set(norm, token);
          totalSelections += 1;
        });
      });
      const multiMap = new Map();
      counts.forEach((count, norm) => multiMap.set(displays.get(norm), count));
      series = buildSeriesFromCounts(multiMap, totalSelections);
      denominator = totalSelections;
      metricLabel = 'selections';
    }

    if (!series.length) {
      const fallbackCounts = new Map();
      values.forEach((value) => fallbackCounts.set(value, (fallbackCounts.get(value) || 0) + 1));
      series = buildSeriesFromCounts(fallbackCounts, values.length);
      denominator = values.length;
      metricLabel = 'responses';
      kind = 'categorical';
    }

    return {
      index,
      ordinal,
      label,
      shortLabel: shortLabel(label, 64),
      kind,
      totalAnswered: values.length,
      uniqueCount,
      metricLabel,
      denominator,
      series,
      topEntry: series[0] || null,
      comments: kind === 'text' ? values.slice(-4).reverse() : [],
      chartTypes: allowedChartTypes(kind),
      defaultChart: defaultChartType(kind)
    };
  }

  function buildPublicResponses(dataset, limit = Infinity) {
    const rows = [...dataset.consentedRows].reverse().slice(0, limit);
    const { cols, meta } = dataset;

    return rows.map((row) => ({
      displayName: meta.nameIndex >= 0 ? (displayCellValue(row, meta.nameIndex) || 'Anonymous') : 'Anonymous',
      profession: meta.professionIndex >= 0 ? displayCellValue(row, meta.professionIndex) : '',
      timestamp: rawCellValue(row, meta.timestampIndex),
      answers: meta.answerColumns
        .map((index) => ({
          label: shortLabel(cols[index].label, 46),
          value: displayCellValue(row, index)
        }))
        .filter((answer) => answer.value)
    }));
  }

  function getMockDataset() {
    const cols = [
      { id: 'A', label: 'Timestamp', type: 'datetime' },
      { id: 'B', label: 'Consent to display', type: 'string' },
      { id: 'C', label: 'Profession', type: 'string' },
      { id: 'D', label: 'How long have you known about SELCO India?', type: 'string' },
      { id: 'E', label: 'Primary energy source in your community', type: 'string' },
      { id: 'F', label: 'Impact of rural electrification on education (1-10)', type: 'number' },
      { id: 'G', label: 'Key challenges in sustainable energy adoption', type: 'string' }
    ];

    const generateRows = (count) => {
      const professions = ['Researcher', 'Student', 'Engineer', 'Social Worker', 'Entrepreneur'];
      const timelines = ['< 1 year', '1-3 years', '3-5 years', '5+ years'];
      const sources = ['Grid Electricity', 'Solar', 'Kerosene', 'Biomass'];
      const challenges = ['Initial Cost', 'Maintenance', 'Awareness', 'Policy'];
      
      return Array.from({ length: count }, (_, i) => ({
        c: [
          { v: `Date(2026,3,${20+i},10,30,0)` },
          { v: 'Yes' },
          { v: professions[i % professions.length] },
          { v: timelines[i % timelines.length] },
          { v: sources[i % sources.length] },
          { v: 7 + (i % 4) },
          { v: challenges[i % challenges.length] }
        ]
      }));
    };

    const rows = generateRows(12);
    const meta = detectMeta(cols);
    const consentedRows = rows.filter((row) => isConsented(row, meta.privacyIndex));
    const timestamps = consentedRows
      .map((row) => parseGvizDate(rawCellValue(row, meta.timestampIndex)))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());

    const questions = meta.answerColumns
      .map((index, position) => analyzeQuestion(index, cols[index], consentedRows, position + 1))
      .filter(Boolean);

    const dataset = {
      sheetId: SHEET_ID,
      sheetUrl: SHEET_URL,
      sheetEditUrl: SHEET_EDIT_URL,
      fetchedAt: new Date(),
      cols,
      rows,
      consentedRows,
      meta,
      latestTimestamp: timestamps[0] || null,
      publicResponses: [],
      questions,
      isMock: true
    };

    dataset.publicResponses = buildPublicResponses(dataset);
    return dataset;
  }

  async function loadSurveyData() {
    try {
      const response = await fetch(SHEET_URL);
      if (!response.ok) throw new Error('Sheet fetch failed');
      const text = await response.text();
      const payload = parseGvizPayload(text);
      const cols = payload.table?.cols || [];
      const rows = payload.table?.rows || [];

      if (!cols.length) throw new Error('Empty columns');

      const meta = detectMeta(cols);
      const consentedRows = rows.filter((row) => isConsented(row, meta.privacyIndex));
      const timestamps = consentedRows
        .map((row) => parseGvizDate(rawCellValue(row, meta.timestampIndex)))
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime());

      const questions = meta.answerColumns
        .map((index, position) => analyzeQuestion(index, cols[index], consentedRows, position + 1))
        .filter(Boolean);

      const dataset = {
        sheetId: SHEET_ID,
        sheetUrl: SHEET_URL,
        sheetEditUrl: SHEET_EDIT_URL,
        fetchedAt: new Date(),
        cols,
        rows,
        consentedRows,
        meta,
        latestTimestamp: timestamps[0] || null,
        publicResponses: [],
        questions
      };

      dataset.publicResponses = buildPublicResponses(dataset);
      return dataset;
    } catch (error) {
      console.warn('Falling back to mock data:', error.message);
      return getMockDataset();
    }
  }

  window.SELCOSurveyData = {
    SHEET_ID,
    SHEET_URL,
    SHEET_EDIT_URL,
    parseGvizDate,
    timeAgo,
    initials,
    cleanLabel,
    shortLabel,
    escapeHTML,
    loadSurveyData,
    getPublicResponses(dataset, options = {}) {
      return buildPublicResponses(dataset, options.limit || Infinity);
    }
  };
}());
