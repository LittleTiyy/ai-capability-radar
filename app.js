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
  function source(story) {
    return `<p class="source brief-source"><a class="brief-topic" href="#archive?topic=${encodeURIComponent(story.category)}">${esc(story.category)}</a>${story.urls.map((url,i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">原文${story.urls.length > 1 ? i+1 : ''}</a>`).join('')}<span>${esc(story.evidence)} · ${esc(story.id)}</span></p>`;
  }
  function trial(story) { return story.trialHtml ? `<details class="try-it"><summary><strong>今天可试</strong> ${esc(story.trialLabel || '待执行')}</summary>${story.trialHtml}</details>` : ''; }
  function storyHTML(story, isLead, proof) {
    if (isLead) {
      const figure = proof ? `<figure class="proof"><div class="proof-values"><div><strong>${esc(proof[0])}</strong><small>${esc(proof[1])}</small></div><i aria-hidden="true"></i><div class="last"><strong>${esc(proof[2])}</strong><small>${esc(proof[3])}</small></div></div><figcaption>${esc(proof[4])}</figcaption></figure>` : '';
      return `<article class="lead" id="${esc(story.id)}"><div class="${proof ? 'cover' : ''}"><div><h2 id="lead-title">${esc(story.title)}</h2>${story.dek ? `<p class="dek">${esc(story.dek)}</p>` : ''}${source(story)}</div>${figure}</div><div class="lead-copy">${story.bodyHtml}</div>${trial(story)}</article>`;
    }
    return `<li><article class="story" id="${esc(story.id)}"><h3>${esc(story.title)}</h3><div class="teaser">${story.bodyHtml}</div>${source(story)}${trial(story)}</article></li>`;
  }
  function renderIssue(data) {
    const [lead, ...rest] = data.stories;
    let content = storyHTML(lead, true, data.proof);
    content += `<section aria-labelledby="issue-items-title"><div class="section-head"><h2 id="issue-items-title">本期速览</h2></div><ul class="items" id="issue-items">${rest.map(s => storyHTML(s, false)).join('')}</ul></section>`;
    if (data.editorHtml) content += `<div class="editorial"><article class="editor-note"><h2>主编的话</h2><h3>${esc(data.editorTitle)}</h3><div class="editor-copy">${data.editorHtml}</div></article></div>`;
    const table = data.evidenceRows.length ? `<div class="table-scroll"><table><thead><tr><th>编号</th><th>证据类型</th><th>原文日期（日历日）</th><th>待核与限制</th></tr></thead><tbody>${data.evidenceRows.map(row => '<tr>' + row.map(v => `<td>${esc(v)}</td>`).join('') + '</tr>').join('')}</tbody></table></div>` : '';
    content += `<details class="evidence-box"><summary>来源与证据说明 · ${esc(data.version)}</summary><p>${esc(data.evidenceIntro)}</p>${table}<p>${esc(data.note)}</p></details>`;
    $('issue').innerHTML = content;
    $('issue-intro').textContent = data.intro;
    selectedDate = data.date;
    $('issue-date').dateTime = data.date;
    $('issue-date').textContent = dateLabel(data.date);
    calendar.querySelector('summary').setAttribute('aria-label', dateLabel(data.date) + '，打开日报日历');
    document.title = `AI玩法日报｜${data.date}`;
    month = new Date(data.date.slice(0, 7) + '-01T00:00:00Z');
    renderCalendar();
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
      $('issue').hidden = false; $('issue-intro').hidden = false; $('archive').hidden = true;
      $('view-link').href = '#archive'; $('view-link').textContent = '往期与主题';
      const story = new URLSearchParams(target.split('?')[1]).get('story');
      if (scroll) window.scrollTo(0, 0);
      if (story && data.stories.some(s => s.id === story)) document.getElementById(story)?.scrollIntoView({block:'start'});
    } catch (error) {
      if (token !== routeToken) return;
      renderIssue(current); $('issue').hidden = false; $('issue-intro').hidden = false; $('archive').hidden = true;
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
  document.addEventListener('click', event => { if(calendar.open && !calendar.contains(event.target)) closeCalendar(false); });
  $('topic').addEventListener('change', () => { location.hash = $('topic').value ? 'archive?topic='+encodeURIComponent($('topic').value) : 'archive'; });
  $('previous-page').addEventListener('click', () => {archivePage--;renderArchive(archiveCategory());$('archive-title').focus();});
  $('next-page').addEventListener('click', () => {archivePage++;renderArchive(archiveCategory());$('archive-title').focus();});
  window.addEventListener('hashchange', () => route(true));
  renderCalendar(); route(false);
})();
