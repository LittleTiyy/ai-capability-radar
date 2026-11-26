/* AI玩法日报 — Attachment B local archive. No external scripts or requests except own issue JSON. */
(function () {
  'use strict';
  const PAGE_SIZE = 10;
  function orderedIssues(index) { return [...index.issues].sort((a, b) => b.date.localeCompare(a.date)); }
  function hasIssue(index, date) { return index.issues.some(issue => issue.date === date); }
  function archiveEntries(index, category, page) {
    const all = orderedIssues(index).map(issue => {
      const matching = issue.stories.filter(story => !category || story.category === category);
      return { date: issue.date, title: issue.title, stories: issue.stories, matching };
    }).filter(entry => entry.matching.length > 0);
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE) || 1);
    const bounded = Math.max(0, Math.min(page, pages - 1));
    return { total: all.length, pages, page: bounded, entries: all.slice(bounded * PAGE_SIZE, (bounded + 1) * PAGE_SIZE) };
  }
  function calendarCells(index, year, month) {
    const start = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return [...Array(start).fill(null), ...Array.from({ length: total }, (_, i) => {
      const date = new Date(Date.UTC(year, month, i + 1)).toISOString().slice(0, 10);
      return { date, day: i + 1, disabled: !hasIssue(index, date) };
    })];
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { PAGE_SIZE, orderedIssues, hasIssue, archiveEntries, calendarCells };
  if (typeof document === 'undefined') return;
  const index = JSON.parse(document.getElementById('archive-index').textContent);
  const current = JSON.parse(document.getElementById('current-issue').textContent);
  const cache = new Map([[current.date, current]]);
  const $ = id => document.getElementById(id);
  const calendar = $('issue-calendar');
  let selectedDate = current.date;
  let month = new Date(current.date.slice(0, 7) + '-01T00:00:00Z');
  let archivePage = 0;
  let routeToken = 0;
  const topics = [...new Set(index.issues.flatMap(i => i.stories.map(s => s.category)))].sort();
  const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function dateLabel(date) { const [y,m,d] = date.split('-').map(Number); return `${y} 年 ${m} 月 ${d} 日`; }
  function httpUrls(story) {
    return (story.urls || []).filter(url => /^https?:\/\//i.test(String(url)));
  }
  function sourceEntry(story) {
    const urls = httpUrls(story);
    const date = story.sourceDate ? String(story.sourceDate) : '';
    const evidence = story.evidence ? String(story.evidence) : '';
    if (!urls.length && !date && !evidence) return '';
    const links = urls.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">原文${urls.length > 1 ? i + 1 : ''}</a>`).join('');
    const dateHtml = date ? `<span class="source-date">${esc(date)}</span>` : '';
    const evHtml = evidence ? `<span class="source-evidence">${esc(evidence)}</span>` : '';
    const panelId = `source-panel-${esc(String(story.id || 'story').replace(/[^A-Za-z0-9_-]/g, ''))}`;
    return `<span class="source-entry"><button type="button" class="source-toggle" aria-expanded="false" aria-controls="${panelId}">来源</button><span class="source-panel" id="${panelId}" role="region">${links}${dateHtml}${evHtml}</span></span>`;
  }
  function storyMeta(story) {
    const topic = story.category
      ? `<a class="brief-topic" href="#archive?topic=${encodeURIComponent(story.category)}">${esc(story.category)}</a>`
      : '';
    const source = sourceEntry(story);
    if (!topic && !source) return '';
    return `<p class="story-meta">${topic}${source}</p>`;
  }
  function trial(story) {
    if (!story.trialHtml) return '';
    const label = story.trialAction || story.trialLabel || '今天可试';
    return `<details class="try-it"><summary><strong>${esc(label)}</strong></summary>${story.trialHtml}</details>`;
  }
  function injectTrial(body, trialHtml) {
    if (!trialHtml) return body;
    const start = body.search(/<div class="lead-follow"[^>]*>/);
    if (start < 0) return body + trialHtml;
    const openEnd = body.indexOf('>', start) + 1;
    let depth = 1, i = openEnd;
    while (i < body.length && depth > 0) {
      const nextOpen = body.indexOf('<div', i);
      const nextClose = body.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
      else { depth--; if (depth === 0) return body.slice(0, nextClose) + trialHtml + body.slice(nextClose); i = nextClose + 6; }
    }
    return body + trialHtml;
  }
  function takeFigure(html) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    const fig = box.querySelector('figure');
    let figure = '';
    if (fig) { figure = fig.outerHTML; fig.remove(); }
    const split = box.querySelector('.lead-split');
    if (split) split.replaceWith(...split.childNodes);
    return { html: box.innerHTML.trim(), figure };
  }
  function storyHTML(story, isLead, proof) {
    const meta = storyMeta(story);
    const alreadyHasTrial = /class="try-it"/.test(story.bodyHtml || '');
    const trialHtml = alreadyHasTrial ? '' : trial(story);
    if (isLead) {
      const proofFig = proof ? `<figure class="proof"><div class="proof-values"><div><strong>${esc(proof[0])}</strong><small>${esc(proof[1])}</small></div><i aria-hidden="true"></i><div class="last"><strong>${esc(proof[2])}</strong><small>${esc(proof[3])}</small></div></div><figcaption>${esc(proof[4])}</figcaption></figure>` : '';
      let { html: body, figure } = takeFigure(story.bodyHtml || '');
      if (!figure) figure = proofFig;
      if (body.includes('lead-follow')) body = injectTrial(body, trialHtml);
      else body = `<div class="lead-copy">${body}</div>` + trialHtml;
      const dek = story.dek ? `<p class="dek">${esc(story.dek)}</p>` : '';
      const main = `<div class="lead-main"><h2 id="lead-title">${esc(story.title)}</h2>${dek}${body}${meta}</div>`;
      const cardClass = figure ? 'lead-card lead-card--split' : 'lead-card';
      return `<article class="lead" id="${esc(story.id)}"><div class="${cardClass}">${main}${figure}</div></article>`;
    }
    return `<li><article class="story" id="${esc(story.id)}"><h3>${esc(story.title)}</h3><div class="teaser">${story.bodyHtml || ''}</div>${trialHtml}${meta}</article></li>`;
  }
  function renderIssue(data) {
    const [lead, ...rest] = data.stories;
    let content = storyHTML(lead, true, data.proof);
    content += `<section class="briefs-panel" aria-labelledby="issue-items-title"><div class="section-head"><h2 id="issue-items-title">本期速览</h2></div><ul class="items" id="issue-items">${rest.map(s => storyHTML(s, false)).join('')}</ul></section>`;
    if (data.editorHtml) content += `<div class="editorial"><article class="editor-note"><h2>主编的话</h2><h3>${esc(data.editorTitle)}</h3><div class="editor-copy">${data.editorHtml}</div></article></div>`;
    $('issue').innerHTML = content;
    $('issue-intro').textContent = '';
    $('issue-intro').hidden = true;
    selectedDate = data.date;
    $('issue-date').dateTime = data.date;
    $('issue-date').textContent = dateLabel(data.date);
    calendar.querySelector('summary').setAttribute('aria-label', dateLabel(data.date) + '，打开日报日历');
    document.title = `AI玩法日报｜${data.date}`;
    month = new Date(data.date.slice(0, 7) + '-01T00:00:00Z');
    renderCalendar();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncIssueNav);
  }
  function renderCalendar() {
    const y = month.getUTCFullYear(), m = month.getUTCMonth();
    $('calendar-month').textContent = `${y} 年 ${m+1} 月`;
    $('calendar-days').replaceChildren(...calendarCells(index, y, m).map(cell => {
      if (!cell) return document.createElement('span');
      const b = document.createElement('button'); b.type = 'button'; b.textContent = cell.day;
      b.dataset.date = cell.date; b.disabled = cell.disabled;
      b.setAttribute('aria-label', `${dateLabel(cell.date)}，${cell.disabled ? '无日报' : '有日报'}`);
      if (cell.date === selectedDate) b.setAttribute('aria-current', 'date');
      return b;
    }));
  }
  async function loadIssue(date) {
    if (cache.has(date)) return cache.get(date);
    const meta = index.issues.find(i => i.date === date);
    if (!meta) throw new Error('该日期没有已归档的日报。');
    if (location.protocol === 'file:') throw new Error('直接打开文件时，历史正文需要 HTTP 服务。当前稿可离线阅读；请通过完整归档的 HTTP 地址切换往期。');
    const response = await fetch(meta.file, { credentials: 'omit' });
    if (!response.ok) throw new Error(`历史正文未能加载（HTTP ${response.status}）。请确认完整 issues 目录随网页一起保存。`);
    const data = await response.json();
    if (data.date !== date || !Array.isArray(data.stories) || !data.stories.length) throw new Error('归档日期或正文数据不符，未切换刊期。');
    cache.set(date, data); return data;
  }
  function closeCalendar(restoreFocus) {
    calendar.open = false;
    if (restoreFocus) calendar.querySelector('summary').focus();
  }
  function closeSourceEntries(except) {
    document.querySelectorAll('.source-entry').forEach(el => {
      if (el !== except) {
        el.classList.remove('is-open', 'is-hover');
        const btn = el.querySelector('.source-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  function renderArchive(category) {
    const state = archiveEntries(index, category, archivePage); archivePage = state.page;
    $('archive-items').innerHTML = state.entries.map(entry => {
      const listed = category ? entry.matching : entry.stories;
      const note = category
        ? `本期含「${esc(category)}」${entry.matching.length} 条，共 ${entry.stories.length} 条报道。点击一条即打开该刊期并滚到对应报道。`
        : `共 ${entry.stories.length} 条报道。点击一条即打开该刊期并滚到对应报道。`;
      const briefs = listed.map(story => `<li><a href="#${entry.date}?story=${encodeURIComponent(story.id)}">${esc(story.title)}</a><a class="brief-topic" href="#archive?topic=${encodeURIComponent(story.category)}">${esc(story.category)}</a></li>`).join('');
      return `<li class="archive-issue"><a class="issue-link" href="#${entry.date}">${entry.date}<br>打开整期</a><article class="story"><p class="category">刊期头条</p><h3><a href="#${entry.date}">${esc(entry.title)}</a></h3><p class="archive-match">${note}</p><ul class="archive-briefs">${briefs}</ul></article></li>`;
    }).join('');
    const filter = category ? `筛选含「${category}」的刊期` : '全部主题';
    if (!state.total) {
      $('archive-status').textContent = `没有含「${category}」的刊期。`;
    } else if (state.pages <= 1) {
      $('archive-status').textContent = `按刊期倒序 · ${filter} · 共 ${state.total} 期 · 每页最多 10 期 · 本页 ${state.total} 期，无须翻页`;
    } else {
      const start = state.page * PAGE_SIZE + 1;
      const end = Math.min((state.page + 1) * PAGE_SIZE, state.total);
      $('archive-status').textContent = `按刊期倒序 · ${filter} · 共 ${state.total} 期 · 每页最多 10 期 · 显示第 ${start}–${end} 期`;
    }
    $('page-number').textContent = `${state.page + 1} / ${state.pages}`;
    $('previous-page').disabled = state.page === 0;
    $('next-page').disabled = state.page + 1 >= state.pages;
    $('pager').hidden = state.pages <= 1;
    document.title = '往期与主题｜AI玩法日报';
  }
  function archiveCategory() {
    const raw = location.hash.slice(1).split('?')[1];
    const category = new URLSearchParams(raw).get('topic') || '';
    return topics.includes(category) ? category : '';
  }
  async function route(scroll) {
    const token = ++routeToken;
    const target = location.hash.slice(1);
    $('load-notice').hidden = true;
    if (target === 'archive' || target.startsWith('archive?')) {
      const category = archiveCategory(); $('topic').value = category;
      archivePage = 0;
      $('issue').hidden = true; $('issue-intro').hidden = true; $('archive').hidden = false;
      $('view-link').href = '#' + selectedDate; $('view-link').textContent = '返回本期';
      renderArchive(category);
      if (scroll) { window.scrollTo(0, 0); $('archive-title').focus({preventScroll:true}); }
      return;
    }
    const requested = target.split('?')[0];
    const date = hasIssue(index, requested) ? requested : index.latest;
    try {
      const data = await loadIssue(date);
      if (token !== routeToken) return;
      renderIssue(data);
      $('issue').hidden = false; $('issue-intro').hidden = true; $('archive').hidden = true;
      $('view-link').href = '#archive'; $('view-link').textContent = '往期与主题';
      const story = new URLSearchParams(target.split('?')[1]).get('story');
      if (scroll) window.scrollTo(0, 0);
      if (story && data.stories.some(s => s.id === story)) document.getElementById(story)?.scrollIntoView({block:'start'});
    } catch (error) {
      if (token !== routeToken) return;
      renderIssue(current); $('issue').hidden = false; $('issue-intro').hidden = true; $('archive').hidden = true;
      $('view-link').href = '#archive'; $('view-link').textContent = '往期与主题';
      $('load-notice').textContent = `${error.message} 以下仍是 ${current.date} 当前修订稿，不是所选历史刊期。`;
      $('load-notice').hidden = false;
    }
  }
  for (const name of topics) { const o = document.createElement('option'); o.value = name; o.textContent = name; $('topic').append(o); }
  $('month-prev').addEventListener('click', () => { month = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-1,1)); renderCalendar(); });
  $('month-next').addEventListener('click', () => { month = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1)); renderCalendar(); });
  $('calendar-days').addEventListener('click', event => { const b=event.target.closest('button[data-date]'); if (!b || b.disabled) return; closeCalendar(true); location.hash=b.dataset.date; });
  $('calendar-close').addEventListener('click', () => closeCalendar(true));
  calendar.addEventListener('keydown', event => { if(event.key==='Escape' && calendar.open) closeCalendar(true); });
  document.addEventListener('pointerover', event => {
    const entry = event.target.closest('.source-entry');
    if (!entry) return;
    document.querySelectorAll('.source-entry.is-hover').forEach(el => { if (el !== entry) el.classList.remove('is-hover'); });
    entry.classList.add('is-hover');
  });
  document.addEventListener('pointerout', event => {
    const entry = event.target.closest('.source-entry');
    if (!entry) return;
    const next = event.relatedTarget;
    if (next && entry.contains(next instanceof Node ? next : null)) return;
    entry.classList.remove('is-hover');
  });
  document.addEventListener('click', event => {
    if (calendar.open && !calendar.contains(event.target)) closeCalendar(false);
    if (event.target.closest('a') && event.target.closest('.source-panel')) return;
    const toggle = event.target.closest('.source-toggle');
    const source = event.target.closest('.source-entry');
    if (toggle && source) {
      const opening = !source.classList.contains('is-open');
      closeSourceEntries(opening ? source : null);
      source.classList.toggle('is-open', opening);
      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
      return;
    }
    closeSourceEntries();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSourceEntries();
  });
  $('topic').addEventListener('change', () => { location.hash = $('topic').value ? 'archive?topic='+encodeURIComponent($('topic').value) : 'archive'; });
  $('previous-page').addEventListener('click', () => {archivePage--;renderArchive(archiveCategory());$('archive-title').focus();});
  $('next-page').addEventListener('click', () => {archivePage++;renderArchive(archiveCategory());$('archive-title').focus();});
  window.addEventListener('hashchange', () => route(true));
  function syncIssueNav() {
    const nav = $('issue-nav');
    const brand = document.querySelector('.masthead');
    if (!nav || !brand) return;
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    nav.style.marginTop = desktop ? `-${brand.offsetHeight}px` : '';
    const brandBottom = brand.getBoundingClientRect().bottom;
    nav.classList.toggle('is-stuck', brandBottom <= 1);
  }
  window.addEventListener('scroll', syncIssueNav, { passive: true });
  window.addEventListener('resize', syncIssueNav);
  renderCalendar(); route(false).then(() => requestAnimationFrame(syncIssueNav));
  requestAnimationFrame(syncIssueNav);
})();
