(function () {
  const state = {
    charts: new Map(),
    data: null,
    refreshMs: 60000
  };

  const typeLabels = {
    bar: 'Bar',
    horizontalBar: 'Horizontal Bar',
    doughnut: 'Doughnut',
    pie: 'Pie',
    polarArea: 'Polar Area',
    radar: 'Radar',
    line: 'Line'
  };

  const typeHelp = {
    bar: '<strong>What is it:</strong> A vertical comparison of frequencies. <br><strong>Why this chart:</strong> It makes comparing the volume of different responses intuitive and helps quickly identify the majority opinion.',
    horizontalBar: '<strong>What is it:</strong> A landscape-oriented count of responses. <br><strong>Why this chart:</strong> This is ideal when answer labels are long; it ensures every word is readable while still allowing for an accurate length-based comparison.',
    doughnut: '<strong>What is it:</strong> A circular composition ring. <br><strong>Why this chart:</strong> It focuses on the "share" of each answer, helping the audience visualize how the total pool of responses is distributed among parts.',
    pie: '<strong>What is it:</strong> A classic segmented circle. <br><strong>Why this chart:</strong> Best for simple, high-level summaries where you want to show the proportional relationship between a few key categories.',
    polarArea: '<strong>What is it:</strong> A circular plot with variable radii. <br><strong>Why this chart:</strong> It draws visual attention to the magnitude of responses, making outliers and dominant trends feel more impactful than in a standard pie chart.',
    radar: '<strong>What is it:</strong> A multi-axis spider diagram. <br><strong>Why this chart:</strong> It maps data across multiple points to show a "response profile," which is excellent for spotting unique patterns in how people answered.',
    line: '<strong>What is it:</strong> A connected series of data points. <br><strong>Why this chart:</strong> Perfect for answers that follow a sequence (like 1-5 scales), as it visualizes the flow and progression from one value to the next.'
  };

  function formatCount(value, noun) {
    return `${value} ${noun}${value === 1 ? '' : 's'}`;
  }

  function safe(value) {
    return window.SELCOSurveyData.escapeHTML(value);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '0%';
    return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
  }

  function setStatus(message, tone) {
    const status = document.getElementById('dashboardStatus');
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function palette(count) {
    const swatches = [
      '#22c97a', '#f59e1a', '#0a3d2b', '#6bd9a1',
      '#f7c66a', '#2563eb', '#ef4444', '#8b5cf6'
    ];
    return Array.from({ length: count }, (_, index) => swatches[index % swatches.length]);
  }

  function storageKey(question) {
    return `selco-chart-type:${question.index}:${question.label}`;
  }

  function getSelectedType(question) {
    const stored = localStorage.getItem(storageKey(question));
    return question.chartTypes.includes(stored) ? stored : question.defaultChart;
  }

  function saveSelectedType(question, type) {
    localStorage.setItem(storageKey(question), type);
  }

  function destroyCharts() {
    state.charts.forEach((chart) => chart.destroy());
    state.charts.clear();
  }

  function animateNumber(element, nextValue) {
    const target = Number(nextValue) || 0;
    const start = Number(element.dataset.value || 0);
    const startedAt = performance.now();
    const duration = 700;

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      element.textContent = current.toLocaleString('en-IN');
      element.dataset.value = String(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function renderOverview(data) {
    animateNumber(document.getElementById('kpiResponses'), data.publicResponses.length);
    animateNumber(document.getElementById('kpiQuestions'), data.questions.length);
    animateNumber(
      document.getElementById('kpiChartModes'),
      data.questions.reduce((sum, question) => sum + question.chartTypes.length, 0)
    );

    document.getElementById('kpiLatest').textContent = data.latestTimestamp
      ? data.latestTimestamp.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'No responses yet';

    document.getElementById('lastUpdated').textContent = `Last synced ${new Date().toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit'
    })}`;

    const consentNote = document.getElementById('consentNote');
    consentNote.textContent = data.meta.privacyIndex >= 0
      ? 'Only responses marked safe for public display are included in this dashboard.'
      : 'All available responses are included because no privacy column was detected.';
  }

  function renderQuestionJump(questions) {
    const select = document.getElementById('questionJump');
    select.innerHTML = '<option value="">Jump to a question</option>';

    questions.forEach((question) => {
      const option = document.createElement('option');
      option.value = `question-${question.index}`;
      option.textContent = `Q${String(question.ordinal).padStart(2, '0')} - ${question.shortLabel}`;
      select.appendChild(option);
    });
  }

  function cardInsight(question) {
    if (!question.topEntry) return 'No clear data signals detected yet.';

    if (question.kind === 'text') {
      return `<strong>Top signal:</strong> The keyword "${question.topEntry.label}" leads with ${question.topEntry.count} mentions.`;
    }

    if (question.kind === 'multi-select') {
      return `<strong>Top signal:</strong> "${question.topEntry.label}" is the most selected option (${question.topEntry.count} times, ${formatPercent(question.topEntry.percentage)} of selections).`;
    }

    if (question.kind === 'numeric') {
      return `<strong>Top signal:</strong> Most responses fall in the "${question.topEntry.label}" range (${question.topEntry.count} entries).`;
    }

    return `<strong>Top signal:</strong> "${question.topEntry.label}" is the most common answer, representing ${formatPercent(question.topEntry.percentage)} of total responses.`;
  }

  function datasetFor(question, chartType, colors) {
    const counts = question.series.map((item) => item.count);

    if (chartType === 'line') {
      return [{
        label: `${question.label} (${question.metricLabel})`,
        data: counts,
        borderColor: '#22c97a',
        backgroundColor: 'rgba(34, 201, 122, 0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6
      }];
    }

    if (chartType === 'radar') {
      return [{
        label: `${question.label} (${question.metricLabel})`,
        data: counts,
        borderColor: '#0a3d2b',
        backgroundColor: 'rgba(34, 201, 122, 0.22)',
        pointBackgroundColor: '#22c97a',
        pointBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#0a3d2b'
      }];
    }

    const isCircular = ['doughnut', 'pie', 'polarArea'].includes(chartType);
    return [{
      label: `${question.label} (${question.metricLabel})`,
      data: counts,
      backgroundColor: isCircular ? colors : colors.map((color) => `${color}cc`),
      borderColor: isCircular ? '#ffffff' : colors,
      borderWidth: isCircular ? 2 : 1.5,
      borderRadius: isCircular ? 0 : 12,
      maxBarThickness: 46
    }];
  }

  function chartConfig(question, chartType) {
    const colors = palette(question.series.length);
    const isHorizontal = chartType === 'horizontalBar';
    const resolvedType = isHorizontal ? 'bar' : chartType;
    const labels = question.series.map((item) => item.label);
    const cartesian = resolvedType === 'bar' || resolvedType === 'line';
    const tooltipTitle = question.kind === 'text' ? 'Keyword' : 'Answer';

    return {
      type: resolvedType,
      data: {
        labels,
        datasets: datasetFor(question, chartType, colors)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isHorizontal ? 'y' : 'x',
        animation: {
          duration: 1200,
          easing: 'easeOutQuart',
          delay(context) {
            return context.type === 'data' ? context.dataIndex * 70 : 0;
          }
        },
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            display: resolvedType !== 'bar' && resolvedType !== 'horizontalBar',
            position: 'bottom',
            labels: {
              color: '#345244',
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(10, 61, 43, 0.96)',
            padding: 12,
            cornerRadius: 12,
            titleColor: '#ffffff',
            bodyColor: 'rgba(255,255,255,0.85)',
            callbacks: {
              title(items) {
                return `${tooltipTitle}: ${items[0].label}`;
              },
              label(context) {
                const point = question.series[context.dataIndex];
                return `${point.count} ${question.metricLabel} (${formatPercent(point.percentage)})`;
              }
            }
          }
        },
        scales: cartesian ? {
          x: {
            ticks: {
              color: '#4f6a5d'
            },
            grid: {
              color: 'rgba(10, 61, 43, 0.08)'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#4f6a5d',
              precision: 0
            },
            grid: {
              color: 'rgba(10, 61, 43, 0.08)'
            }
          }
        } : resolvedType === 'radar' ? {
          r: {
            beginAtZero: true,
            angleLines: { color: 'rgba(10, 61, 43, 0.08)' },
            grid: { color: 'rgba(10, 61, 43, 0.1)' },
            pointLabels: { color: '#345244' },
            ticks: {
              backdropColor: 'transparent',
              color: '#4f6a5d',
              precision: 0
            }
          }
        } : {}
      }
    };
  }

  function mountChart(question, chartType, canvas) {
    const existing = state.charts.get(question.index);
    if (existing) existing.destroy();

    const chart = new Chart(canvas, chartConfig(question, chartType));
    state.charts.set(question.index, chart);
  }

  function questionMetaLine(question, chartType) {
    const topLabel = question.topEntry ? safe(question.topEntry.label) : 'Waiting for data';
    return `
      <div class="detail-chip">
        <span class="detail-label">Answered by</span>
        <strong>${formatCount(question.totalAnswered, 'person')}</strong>
      </div>
      <div class="detail-chip">
        <span class="detail-label">Top signal</span>
        <strong>${topLabel}</strong>
      </div>
      <div class="detail-chip">
        <span class="detail-label">Unique answers</span>
        <strong>${question.uniqueCount}</strong>
      </div>
      <div class="detail-chip">
        <span class="detail-label">Chart mode</span>
        <strong>${typeLabels[chartType]}</strong>
      </div>
    `;
  }

  function optionsMarkup(question) {
    if (!question.series || !question.series.length) return '';
    // Filter out "Other" or numeric bins if they feel like noise, but user asked for "options given"
    // For categorical/multi-select, these are the actual options.
    const labels = question.series
      .filter(s => s.label !== 'Other')
      .map(s => `<span class="option-pill">${safe(s.label)}</span>`)
      .join('');
    
    if (!labels) return '';

    return `
      <div class="options-container">
        <span class="detail-label">Options identified in responses</span>
        <div class="options-list">${labels}</div>
      </div>
    `;
  }

  function commentMarkup(question) {
    if (question.kind !== 'text' || !question.comments.length) return '';

    return `
      <div class="comment-strip">
        ${question.comments
          .map((comment) => `<p>"${safe(comment)}"</p>`)
          .join('')}
      </div>
    `;
  }

  function createQuestionCard(question) {
    const chartType = getSelectedType(question);
    const card = document.createElement('article');
    card.className = 'question-card';
    card.id = `question-${question.index}`;

    const options = question.chartTypes
      .map((type) => `<option value="${type}" ${type === chartType ? 'selected' : ''}>${typeLabels[type]}</option>`)
      .join('');

    card.innerHTML = `
      <div class="question-head">
        <div>
          <span class="question-kicker">Q${String(question.ordinal).padStart(2, '0')} · ${question.kind.replace('-', ' ')}</span>
          <h3>${safe(question.label)}</h3>
        </div>
        <label class="chart-picker">
          <span>Chart Type</span>
          <select data-chart-select="${question.index}">
            ${options}
          </select>
        </label>
      </div>
      <div class="question-body">
        <div class="chart-shell">
          <canvas height="280"></canvas>
        </div>
        <div class="question-details">
          <div class="detail-grid">${questionMetaLine(question, chartType)}</div>
          <p class="insight-signal" style="color:var(--green-deep); font-weight:500; margin-bottom:0.5rem; font-size:0.95rem"></p>
          <p class="insight-rationale" style="color:var(--muted); line-height:1.6; font-size:0.88rem"></p>
          ${optionsMarkup(question)}
          ${commentMarkup(question)}
        </div>
      </div>
    `;

    const canvas = card.querySelector('canvas');
    mountChart(question, chartType, canvas);
    card.querySelector('.insight-signal').innerHTML = cardInsight(question);
    card.querySelector('.insight-rationale').innerHTML = typeHelp[chartType];

    const select = card.querySelector('select');
    select.addEventListener('change', (event) => {
      const nextType = event.target.value;
      saveSelectedType(question, nextType);
      card.querySelector('.detail-grid').innerHTML = questionMetaLine(question, nextType);
      card.querySelector('.insight-rationale').innerHTML = typeHelp[nextType];
      mountChart(question, nextType, canvas);
    });

    return card;
  }

  function renderQuestions(data) {
    destroyCharts();
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';

    data.questions.forEach((question) => {
      grid.appendChild(createQuestionCard(question));
    });

    renderQuestionJump(data.questions);
  }

  async function refreshDashboard() {
    const refreshButton = document.getElementById('refreshNow');
    refreshButton.disabled = true;
    setStatus('Syncing with the spreadsheet...', 'neutral');

    try {
      const data = await window.SELCOSurveyData.loadSurveyData();
      state.data = data;
      renderOverview(data);
      renderQuestions(data);
      setStatus('Live dashboard is up to date.', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Dashboard could not load. Make sure the Google Sheet is public.', 'error');
    } finally {
      refreshButton.disabled = false;
    }
  }

  function resetChartChoices() {
    if (!state.data) return;
    state.data.questions.forEach((question) => {
      localStorage.removeItem(storageKey(question));
    });
    renderQuestions(state.data);
  }

  function togglePresenterMode(active) {
    if (active) {
      document.body.classList.add('is-presenting');
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen denied:', err);
        });
      }
    } else {
      document.body.classList.remove('is-presenting');
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  }

  function bindControls() {
    document.getElementById('refreshNow').addEventListener('click', refreshDashboard);
    document.getElementById('resetCharts').addEventListener('click', resetChartChoices);
    document.getElementById('startPresenting').addEventListener('click', () => togglePresenterMode(true));
    document.getElementById('exitPresent').addEventListener('click', () => togglePresenterMode(false));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('is-presenting')) {
        togglePresenterMode(false);
      }
    });

    document.getElementById('questionJump').addEventListener('change', (event) => {
      if (!event.target.value) return;
      document.getElementById(event.target.value)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindControls();
    refreshDashboard();
    setInterval(refreshDashboard, state.refreshMs);
  });
}());
